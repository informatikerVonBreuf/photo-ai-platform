from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from .config import Settings, get_settings
from .database import Database
from .queue import JobQueue
from .retrieval import LocalRetrievalClient


LOGGER = logging.getLogger("photo_ai.worker")


def resolve_storage_file(storage_root: Path, storage_key: str) -> Path:
    root = storage_root.resolve()
    candidate = (root / storage_key).resolve()
    if candidate != root and root not in candidate.parents:
        raise ValueError("Storage key escapes the configured storage directory")
    if not candidate.is_file():
        raise FileNotFoundError(candidate)
    return candidate


async def process_ingest_job(
    *,
    job: dict[str, Any],
    database: Database,
    retrieval: LocalRetrievalClient,
    settings: Settings,
) -> None:
    payload = job["payload"]
    photo_id = str(payload["photo_id"])
    photo = await asyncio.to_thread(database.get_photo, photo_id)
    if photo is None:
        raise RuntimeError(f"Photo not found: {photo_id}")

    image_path = resolve_storage_file(
        settings.storage_dir,
        str(photo["storage_key"]),
    )
    content = await asyncio.to_thread(image_path.read_bytes)
    embedding = await retrieval.embed_image(
        content,
        str(photo["content_type"]),
        str(photo["original_filename"]),
    )
    vector = embedding.get("vector")
    if not isinstance(vector, list) or not vector:
        raise RuntimeError("Embedding service returned an empty vector")

    await retrieval.upsert_vector(
        photo_id=photo_id,
        vector=vector,
        payload={
            "url": photo["url"],
            "original_filename": photo["original_filename"],
            "caption": photo["caption"],
            "tags": photo["tags"],
            "library_id": (
                str(photo["library_id"]) if photo["library_id"] is not None else None
            ),
            "shooting_id": (
                str(photo["shooting_id"])
                if photo["shooting_id"] is not None
                else None
            ),
        },
    )
    await asyncio.to_thread(
        database.complete_ingest_job,
        str(job["id"]),
        photo_id,
        embedding_model=str(embedding.get("model", "unknown")),
        embedding_revision=embedding.get("revision"),
    )


async def run_worker(settings: Settings) -> None:
    if not settings.persistence_enabled:
        raise RuntimeError("Worker requires PHOTO_AI_PERSISTENCE_ENABLED=true")
    if not settings.embedding_service_enabled:
        raise RuntimeError(
            "Worker requires PHOTO_AI_EMBEDDING_SERVICE_ENABLED=true"
        )

    database = Database(settings.postgres_dsn)
    queue = (
        JobQueue(settings.redis_url, settings.redis_queue_name)
        if settings.queue_enabled
        else None
    )
    retrieval = LocalRetrievalClient(
        embedding_url=settings.embedding_service_url,
        qdrant_url=settings.qdrant_url,
        qdrant_api_key=settings.qdrant_api_key,
        collection=settings.qdrant_collection,
        score_threshold=settings.vector_score_threshold,
        timeout_seconds=120,
    )

    await asyncio.to_thread(database.open)
    if queue is not None:
        await asyncio.to_thread(queue.ping)
    LOGGER.info("Worker ready; queue=%s", settings.redis_queue_name)

    try:
        while True:
            job = None
            if queue is not None:
                queued_id = await asyncio.to_thread(queue.dequeue, 2)
                if queued_id:
                    job = await asyncio.to_thread(database.claim_job, queued_id)
            if job is None:
                job = await asyncio.to_thread(database.claim_next_job)
            if job is None:
                await asyncio.sleep(settings.worker_poll_seconds)
                continue

            try:
                if job["job_type"] != "INGEST_PHOTO":
                    raise RuntimeError(f"Unsupported job type: {job['job_type']}")
                await process_ingest_job(
                    job=job,
                    database=database,
                    retrieval=retrieval,
                    settings=settings,
                )
                LOGGER.info("Job %s completed", job["id"])
            except Exception as exc:
                status = await asyncio.to_thread(
                    database.retry_or_fail_job,
                    str(job["id"]),
                    f"{exc.__class__.__name__}: {exc}",
                    max_attempts=settings.worker_max_attempts,
                )
                LOGGER.exception("Job %s moved to %s", job["id"], status)
                if status == "PENDING":
                    await asyncio.sleep(settings.worker_poll_seconds)
                    if queue is not None:
                        await asyncio.to_thread(queue.enqueue, str(job["id"]))
    finally:
        if queue is not None:
            await asyncio.to_thread(queue.close)
        await asyncio.to_thread(database.close)


def main() -> None:
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    asyncio.run(run_worker(settings))


if __name__ == "__main__":
    main()
