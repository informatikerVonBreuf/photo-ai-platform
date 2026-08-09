from __future__ import annotations

from pathlib import Path
from typing import Any

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from .query_concepts import LEXICAL_STOP_WORDS, expanded_lexical_query


class Database:
    def __init__(
        self,
        dsn: str,
        schema_path: Path | None = None,
        min_size: int = 1,
        max_size: int = 10,
    ) -> None:
        self.schema_path = schema_path or Path(__file__).with_name("schema.sql")
        self.pool = ConnectionPool(
            conninfo=dsn,
            min_size=min_size,
            max_size=max_size,
            open=False,
            kwargs={"row_factory": dict_row},
        )

    def open(self) -> None:
        self.pool.open(wait=True, timeout=15)
        schema = self.schema_path.read_text(encoding="utf-8")
        with self.pool.connection() as connection:
            connection.execute(schema)

    def close(self) -> None:
        self.pool.close()

    def ping(self) -> bool:
        with self.pool.connection() as connection:
            return connection.execute("SELECT 1 AS ok").fetchone()["ok"] == 1

    def upsert_photo(
        self,
        *,
        shooting_id: str | None,
        library_id: str | None,
        original_filename: str,
        storage_key: str,
        url: str,
        content_type: str,
        byte_size: int,
        sha256: str,
        width: int,
        height: int,
    ) -> dict[str, Any]:
        query = """
            INSERT INTO photos (
                shooting_id, library_id, original_filename, storage_key, url,
                content_type, byte_size, sha256, width, height
            )
            VALUES (
                %(shooting_id)s, %(library_id)s, %(original_filename)s,
                %(storage_key)s, %(url)s, %(content_type)s, %(byte_size)s,
                %(sha256)s, %(width)s, %(height)s
            )
            ON CONFLICT (sha256) DO UPDATE SET
                shooting_id = coalesce(EXCLUDED.shooting_id, photos.shooting_id),
                library_id = coalesce(EXCLUDED.library_id, photos.library_id),
                original_filename = EXCLUDED.original_filename,
                storage_key = EXCLUDED.storage_key,
                url = EXCLUDED.url,
                content_type = EXCLUDED.content_type,
                byte_size = EXCLUDED.byte_size,
                width = EXCLUDED.width,
                height = EXCLUDED.height,
                status = CASE
                    WHEN coalesce(EXCLUDED.shooting_id, photos.shooting_id)
                             IS DISTINCT FROM photos.shooting_id
                      OR coalesce(EXCLUDED.library_id, photos.library_id)
                             IS DISTINCT FROM photos.library_id
                    THEN 'STORED'
                    ELSE photos.status
                END,
                embedding_model = CASE
                    WHEN coalesce(EXCLUDED.shooting_id, photos.shooting_id)
                             IS DISTINCT FROM photos.shooting_id
                      OR coalesce(EXCLUDED.library_id, photos.library_id)
                             IS DISTINCT FROM photos.library_id
                    THEN NULL
                    ELSE photos.embedding_model
                END,
                embedding_revision = CASE
                    WHEN coalesce(EXCLUDED.shooting_id, photos.shooting_id)
                             IS DISTINCT FROM photos.shooting_id
                      OR coalesce(EXCLUDED.library_id, photos.library_id)
                             IS DISTINCT FROM photos.library_id
                    THEN NULL
                    ELSE photos.embedding_revision
                END,
                updated_at = now()
            RETURNING *
        """
        values = {
            "shooting_id": shooting_id,
            "library_id": library_id,
            "original_filename": original_filename,
            "storage_key": storage_key,
            "url": url,
            "content_type": content_type,
            "byte_size": byte_size,
            "sha256": sha256,
            "width": width,
            "height": height,
        }
        with self.pool.connection() as connection:
            return dict(connection.execute(query, values).fetchone())

    def create_ingest_job(self, photo: dict[str, Any]) -> dict[str, Any]:
        query = """
            INSERT INTO jobs (job_type, dedupe_key, payload)
            VALUES ('INGEST_PHOTO', %(dedupe_key)s, %(payload)s)
            ON CONFLICT (job_type, dedupe_key)
                WHERE dedupe_key IS NOT NULL
                  AND status IN ('PENDING', 'RUNNING')
            DO UPDATE SET updated_at = jobs.updated_at
            RETURNING *
        """
        payload = {
            "photo_id": photo["id"],
            "storage_key": photo["storage_key"],
            "content_type": photo["content_type"],
        }
        with self.pool.connection() as connection:
            row = connection.execute(
                query,
                {
                    "dedupe_key": photo["id"],
                    "payload": Jsonb(payload),
                },
            ).fetchone()
            return dict(row)

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self.pool.connection() as connection:
            row = connection.execute(
                "SELECT * FROM jobs WHERE id = %s",
                (job_id,),
            ).fetchone()
            return dict(row) if row else None

    def get_photo(self, photo_id: str) -> dict[str, Any] | None:
        with self.pool.connection() as connection:
            row = connection.execute(
                "SELECT * FROM photos WHERE id = %s",
                (photo_id,),
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def _mark_photo_for_job(
        connection: Any,
        job: dict[str, Any] | None,
        status: str,
    ) -> None:
        if not job or job.get("job_type") != "INGEST_PHOTO":
            return
        photo_id = job.get("payload", {}).get("photo_id")
        if photo_id:
            connection.execute(
                "UPDATE photos SET status = %s, updated_at = now() WHERE id = %s",
                (status, str(photo_id)),
            )

    def claim_job(self, job_id: str) -> dict[str, Any] | None:
        query = """
            UPDATE jobs
            SET status = 'RUNNING',
                attempts = attempts + 1,
                started_at = coalesce(started_at, now()),
                updated_at = now(),
                message = 'Indexation en cours'
            WHERE id = %s AND status = 'PENDING'
            RETURNING *
        """
        with self.pool.connection() as connection:
            with connection.transaction():
                row = connection.execute(query, (job_id,)).fetchone()
                job = dict(row) if row else None
                self._mark_photo_for_job(connection, job, "INDEXING")
                return job

    def claim_next_job(self) -> dict[str, Any] | None:
        query = """
            WITH candidate AS (
                SELECT id
                FROM jobs
                WHERE status = 'PENDING'
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE jobs
            SET status = 'RUNNING',
                attempts = attempts + 1,
                started_at = coalesce(started_at, now()),
                updated_at = now(),
                message = 'Indexation en cours'
            WHERE id = (SELECT id FROM candidate)
            RETURNING *
        """
        with self.pool.connection() as connection:
            with connection.transaction():
                row = connection.execute(query).fetchone()
                job = dict(row) if row else None
                self._mark_photo_for_job(connection, job, "INDEXING")
                return job

    def complete_ingest_job(
        self,
        job_id: str,
        photo_id: str,
        *,
        embedding_model: str,
        embedding_revision: str | None,
    ) -> None:
        with self.pool.connection() as connection:
            with connection.transaction():
                connection.execute(
                    """
                    UPDATE photos
                    SET status = 'INDEXED',
                        embedding_model = %s,
                        embedding_revision = %s,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (embedding_model, embedding_revision, photo_id),
                )
                connection.execute(
                    """
                    UPDATE jobs
                    SET status = 'DONE',
                        progress = 1,
                        message = 'Photo indexee',
                        finished_at = now(),
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (job_id,),
                )

    def retry_or_fail_job(
        self,
        job_id: str,
        message: str,
        *,
        max_attempts: int,
    ) -> str:
        with self.pool.connection() as connection:
            with connection.transaction():
                row = connection.execute(
                    """
                    UPDATE jobs
                    SET status = CASE
                        WHEN attempts < %(max_attempts)s
                            THEN 'PENDING'
                            ELSE 'FAILED'
                        END,
                        message = %(message)s,
                        finished_at = CASE
                            WHEN attempts < %(max_attempts)s
                            THEN NULL
                            ELSE now()
                        END,
                        updated_at = now()
                    WHERE id = %(job_id)s
                    RETURNING *
                    """,
                    {
                        "max_attempts": max_attempts,
                        "message": message[:1000],
                        "job_id": job_id,
                    },
                ).fetchone()
                job = dict(row) if row else None
                if job is None:
                    return "MISSING"
                photo_status = "STORED" if job["status"] == "PENDING" else "FAILED"
                self._mark_photo_for_job(connection, job, photo_status)
                return str(job["status"])

    def create_library(self, *, name: str, description: str) -> dict[str, Any]:
        with self.pool.connection() as connection:
            row = connection.execute(
                """
                INSERT INTO libraries (name, description)
                VALUES (%s, %s)
                RETURNING *
                """,
                (name, description),
            ).fetchone()
            return dict(row)

    def list_libraries(self) -> list[dict[str, Any]]:
        with self.pool.connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    l.*,
                    count(DISTINCT p.id)::integer AS photo_count,
                    count(DISTINCT s.id)::integer AS shooting_count
                FROM libraries l
                LEFT JOIN photos p ON p.library_id = l.id
                LEFT JOIN shootings s ON s.library_id = l.id
                GROUP BY l.id
                ORDER BY l.created_at DESC
                """
            ).fetchall()
            return [dict(row) for row in rows]

    def library_exists(self, library_id: str) -> bool:
        with self.pool.connection() as connection:
            return (
                connection.execute(
                    "SELECT 1 FROM libraries WHERE id = %s",
                    (library_id,),
                ).fetchone()
                is not None
            )

    def delete_library(self, library_id: str) -> bool:
        with self.pool.connection() as connection:
            with connection.transaction():
                connection.execute(
                    "UPDATE photos SET library_id = NULL WHERE library_id = %s",
                    (library_id,),
                )
                connection.execute(
                    "UPDATE shootings SET library_id = NULL WHERE library_id = %s",
                    (library_id,),
                )
                result = connection.execute(
                    "DELETE FROM libraries WHERE id = %s",
                    (library_id,),
                )
                return result.rowcount > 0

    def list_photos(
        self,
        *,
        library_id: str | None = None,
        shooting_id: str | None = None,
        status: str | None = None,
        limit: int = 200,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        with self.pool.connection() as connection:
            rows = connection.execute(
                """
                SELECT
                    p.id,
                    p.url,
                    p.original_filename,
                    p.content_type,
                    p.byte_size,
                    p.width,
                    p.height,
                    p.caption,
                    p.tags,
                    p.metadata,
                    p.status,
                    p.embedding_model,
                    p.embedding_revision,
                    p.library_id,
                    p.shooting_id,
                    p.created_at,
                    p.updated_at,
                    l.name AS library_name,
                    s.name AS shooting_name,
                    latest_job.id AS job_id,
                    latest_job.status AS job_status,
                    latest_job.progress AS job_progress,
                    latest_job.message AS job_message
                FROM photos p
                LEFT JOIN libraries l ON l.id = p.library_id
                LEFT JOIN shootings s ON s.id = p.shooting_id
                LEFT JOIN LATERAL (
                    SELECT j.id, j.status, j.progress, j.message
                    FROM jobs j
                    WHERE j.job_type = 'INGEST_PHOTO'
                      AND j.payload ->> 'photo_id' = p.id
                    ORDER BY j.created_at DESC
                    LIMIT 1
                ) latest_job ON true
                WHERE (
                        CAST(%(library_id)s AS TEXT) IS NULL
                        OR p.library_id = %(library_id)s
                      )
                  AND (
                        CAST(%(shooting_id)s AS TEXT) IS NULL
                        OR p.shooting_id = %(shooting_id)s
                      )
                  AND (
                        CAST(%(status)s AS TEXT) IS NULL
                        OR p.status = %(status)s
                      )
                ORDER BY p.created_at DESC
                LIMIT %(limit)s
                OFFSET %(offset)s
                """,
                {
                    "library_id": library_id,
                    "shooting_id": shooting_id,
                    "status": status,
                    "limit": limit,
                    "offset": offset,
                },
            ).fetchall()
            return [dict(row) for row in rows]

    def update_photo_metadata(
        self,
        photo_id: str,
        *,
        caption: str | None,
        tags: list[str] | None,
    ) -> dict[str, Any] | None:
        with self.pool.connection() as connection:
            row = connection.execute(
                """
                UPDATE photos
                SET caption = coalesce(%(caption)s, caption),
                    tags = coalesce(%(tags)s, tags),
                    updated_at = now()
                WHERE id = %(photo_id)s
                RETURNING id, url, original_filename, caption, tags,
                          library_id, shooting_id, status, updated_at
                """,
                {
                    "photo_id": photo_id,
                    "caption": caption,
                    "tags": tags,
                },
            ).fetchone()
            return dict(row) if row else None

    def assign_photos_to_library(
        self,
        photo_ids: list[str],
        *,
        library_id: str | None,
    ) -> list[dict[str, Any]]:
        if not photo_ids:
            return []

        with self.pool.connection() as connection:
            rows = connection.execute(
                """
                UPDATE photos
                SET library_id = %(library_id)s,
                    status = CASE
                        WHEN library_id IS DISTINCT FROM %(library_id)s
                        THEN 'STORED'
                        ELSE status
                    END,
                    embedding_model = CASE
                        WHEN library_id IS DISTINCT FROM %(library_id)s
                        THEN NULL
                        ELSE embedding_model
                    END,
                    embedding_revision = CASE
                        WHEN library_id IS DISTINCT FROM %(library_id)s
                        THEN NULL
                        ELSE embedding_revision
                    END,
                    updated_at = now()
                WHERE id = ANY(%(photo_ids)s)
                RETURNING *
                """,
                {
                    "photo_ids": photo_ids,
                    "library_id": library_id,
                },
            ).fetchall()
            return [dict(row) for row in rows]

    def list_library_photo_files(self, library_id: str) -> list[dict[str, Any]]:
        with self.pool.connection() as connection:
            rows = connection.execute(
                """
                SELECT id, storage_key
                FROM photos
                WHERE library_id = %s
                """,
                (library_id,),
            ).fetchall()
            return [dict(row) for row in rows]

    def list_unassigned_photo_files(self) -> list[dict[str, Any]]:
        with self.pool.connection() as connection:
            rows = connection.execute(
                """
                SELECT id, storage_key
                FROM photos
                WHERE library_id IS NULL
                """
            ).fetchall()
            return [dict(row) for row in rows]

    def delete_photos(self, photo_ids: list[str]) -> list[dict[str, Any]]:
        if not photo_ids:
            return []

        with self.pool.connection() as connection:
            with connection.transaction():
                connection.execute(
                    """
                    DELETE FROM jobs
                    WHERE job_type = 'INGEST_PHOTO'
                      AND payload ->> 'photo_id' = ANY(%s)
                    """,
                    (photo_ids,),
                )
                rows = connection.execute(
                    """
                    DELETE FROM photos
                    WHERE id = ANY(%s)
                    RETURNING id, storage_key
                    """,
                    (photo_ids,),
                ).fetchall()
                return [dict(row) for row in rows]

    def index_status(self) -> dict[str, int]:
        with self.pool.connection() as connection:
            rows = connection.execute(
                """
                SELECT status, count(*)::integer AS count
                FROM photos
                GROUP BY status
                """
            ).fetchall()
            counts = {str(row["status"]): int(row["count"]) for row in rows}
            counts["TOTAL"] = sum(counts.values())
            return counts

    def create_shooting(
        self,
        *,
        name: str,
        description: str,
        library_id: str | None,
    ) -> dict[str, Any]:
        with self.pool.connection() as connection:
            row = connection.execute(
                """
                INSERT INTO shootings (name, description, library_id)
                VALUES (%s, %s, %s)
                RETURNING *
                """,
                (name, description, library_id),
            ).fetchone()
            return dict(row)

    def list_shootings(self) -> list[dict[str, Any]]:
        with self.pool.connection() as connection:
            rows = connection.execute(
                """
                SELECT s.*, count(p.id)::integer AS photo_count
                FROM shootings s
                LEFT JOIN photos p ON p.shooting_id = s.id
                GROUP BY s.id
                ORDER BY s.created_at DESC
                """
            ).fetchall()
            return [dict(row) for row in rows]

    def delete_shooting(self, shooting_id: str) -> bool:
        with self.pool.connection() as connection:
            result = connection.execute(
                "DELETE FROM shootings WHERE id = %s",
                (shooting_id,),
            )
            return result.rowcount > 0

    def lexical_search(
        self,
        query: str,
        *,
        limit: int,
        library_id: str | None = None,
        shooting_id: str | None = None,
    ) -> list[dict[str, Any]]:
        expanded_query = expanded_lexical_query(query)
        sql = """
            WITH terms AS (
                SELECT DISTINCT term
                FROM unnest(
                    tsvector_to_array(to_tsvector('simple', %(query)s))
                ) AS query_terms(term)
                WHERE length(term) >= 2
                  AND term <> ALL(CAST(%(stopwords)s AS TEXT[]))
            ),
            search_query AS (
                SELECT CASE
                    WHEN count(*) = 0 THEN NULL
                    ELSE to_tsquery(
                        'simple',
                        string_agg(quote_literal(term), ' | ')
                    )
                END AS value
                FROM terms
            )
            SELECT
                p.id,
                p.url,
                p.original_filename,
                p.caption,
                p.tags,
                p.library_id,
                p.shooting_id,
                ts_rank_cd(p.search_document, sq.value) AS raw_score,
                (
                    SELECT count(*)
                    FROM terms
                    WHERE term = ANY(tsvector_to_array(p.search_document))
                ) AS matched_term_count,
                (SELECT count(*) FROM terms) AS query_term_count
            FROM photos p
            CROSS JOIN search_query sq
            WHERE sq.value IS NOT NULL
              AND p.search_document @@ sq.value
              AND p.status = 'INDEXED'
              AND (
                    CAST(%(library_id)s AS TEXT) IS NULL
                    OR p.library_id = %(library_id)s
                  )
              AND (
                    CAST(%(shooting_id)s AS TEXT) IS NULL
                    OR p.shooting_id = %(shooting_id)s
                  )
            ORDER BY raw_score DESC, p.created_at DESC
            LIMIT %(limit)s
        """
        with self.pool.connection() as connection:
            rows = connection.execute(
                sql,
                {
                    "query": expanded_query,
                    "stopwords": list(LEXICAL_STOP_WORDS),
                    "library_id": library_id,
                    "shooting_id": shooting_id,
                    "limit": limit,
                },
            ).fetchall()
            return [dict(row) for row in rows]

    def get_photos(self, photo_ids: list[str]) -> dict[str, dict[str, Any]]:
        if not photo_ids:
            return {}
        with self.pool.connection() as connection:
            rows = connection.execute(
                """
                SELECT id, url, storage_key, content_type, original_filename,
                       caption, tags, library_id, shooting_id
                FROM photos
                WHERE id = ANY(%s)
                """,
                (photo_ids,),
            ).fetchall()
            return {str(row["id"]): dict(row) for row in rows}
