from __future__ import annotations

import asyncio
import json
import os
import time
from io import BytesIO
from pathlib import Path
from typing import Any

import httpx
from fastapi.testclient import TestClient
from PIL import Image

from app.main import create_app
from app.retrieval import LocalRetrievalClient


def wait_for_job(
    client: TestClient,
    job_id: str,
    *,
    timeout_seconds: float = 180,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    latest: dict[str, Any] | None = None
    while time.monotonic() < deadline:
        response = client.get(f"/jobs/{job_id}")
        response.raise_for_status()
        latest = response.json()
        if latest["status"] == "DONE":
            return latest
        if latest["status"] == "FAILED":
            raise RuntimeError(f"Worker job failed: {latest}")
        time.sleep(1)
    raise TimeoutError(f"Worker job did not complete: {latest}")


async def qdrant_smoke(photo: dict[str, Any]) -> int:
    collection = "photo_ai_smoke"
    retrieval = LocalRetrievalClient(
        embedding_url="http://embedding:8001",
        qdrant_url="http://qdrant:6333",
        qdrant_api_key="change-me",
        collection=collection,
    )
    try:
        await retrieval.upsert_vector(
            photo_id=photo["id"],
            vector=[1.0, 0.0, 0.0],
            payload={"url": photo["url"]},
        )
        results = await retrieval.vector_search(
            [1.0, 0.0, 0.0],
            limit=3,
        )
        return len(results)
    finally:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.delete(
                f"http://qdrant:6333/collections/{collection}",
                headers={"api-key": "change-me"},
            )


def main() -> None:
    app = create_app()
    with_worker = os.getenv("PHOTO_AI_SMOKE_WITH_WORKER", "").lower() in {
        "1",
        "true",
        "yes",
    }
    photo: dict[str, Any] | None = None
    library_id: str | None = None
    shooting_id: str | None = None
    job_id: str | None = None
    assignment_job_ids: list[str] = []
    qdrant_count = 0

    with TestClient(app) as client:
        try:
            library_response = client.post(
                "/libraries",
                json={
                    "name": "Smoke library",
                    "description": "Integration test",
                },
            )
            library_response.raise_for_status()
            library_id = library_response.json()["id"]

            shooting_response = client.post(
                "/shootings",
                json={
                    "name": "Smoke production",
                    "description": "Integration test",
                    "library_id": library_id,
                },
            )
            shooting_response.raise_for_status()
            shooting = shooting_response.json()
            shooting_id = shooting["id"]

            test_image = Image.new("RGB", (24, 24), "red")
            color_marker = int(shooting_id.replace("-", "")[:2], 16)
            test_image.putpixel((0, 0), (255, color_marker, 0))
            image_bytes = BytesIO()
            test_image.save(
                image_bytes,
                format="JPEG",
            )
            image_content = image_bytes.getvalue()
            upload_response = client.post(
                "/upload",
                files={
                    "files": (
                        f"red-square-{shooting_id[:8]}.jpg",
                        image_content,
                        "image/jpeg",
                    )
                },
                data={
                    "shooting_id": shooting_id,
                    "library_id": library_id,
                },
            )
            upload_response.raise_for_status()
            photo = upload_response.json()["images"][0]
            job_id = photo["job_id"]

            if with_worker:
                job = wait_for_job(client, job_id)
            else:
                job_response = client.get(f"/jobs/{job_id}")
                job_response.raise_for_status()
                job = job_response.json()
                with app.state.database.pool.connection() as connection:
                    connection.execute(
                        """
                        UPDATE photos
                        SET status = 'INDEXED'
                        WHERE id = %s
                        """,
                        (photo["id"],),
                    )

            metadata_response = client.patch(
                f"/photos/{photo['id']}",
                json={"caption": "red square photograph"},
            )
            metadata_response.raise_for_status()

            if with_worker:
                unassign_response = client.post(
                    "/photos/assign",
                    json={"photo_ids": [photo["id"]], "library_id": None},
                )
                unassign_response.raise_for_status()
                unassign_job_id = unassign_response.json()["job_ids"][0]
                assignment_job_ids.append(unassign_job_id)
                wait_for_job(client, unassign_job_id)

                reassign_response = client.post(
                    "/photos/assign",
                    json={
                        "photo_ids": [photo["id"]],
                        "library_id": library_id,
                    },
                )
                reassign_response.raise_for_status()
                reassign_job_id = reassign_response.json()["job_ids"][0]
                assignment_job_ids.append(reassign_job_id)
                wait_for_job(client, reassign_job_id)

            search_response = client.post(
                "/search",
                data={
                    "mode": "text",
                    "query": "red square photograph",
                    "shooting_id": shooting_id,
                },
            )
            if not search_response.is_success:
                raise RuntimeError(
                    f"Search failed: {search_response.status_code} "
                    f"{search_response.text}"
                )
            search = search_response.json()
            complex_search: dict[str, Any] | None = None
            if with_worker:
                complex_query = (
                    "documentary editorial scene with natural light and people "
                    * 20
                    + "red square photograph"
                )
                complex_response = client.post(
                    "/search",
                    data={
                        "mode": "text",
                        "query": complex_query,
                        "shooting_id": shooting_id,
                    },
                )
                if not complex_response.is_success:
                    raise RuntimeError(
                        f"Complex search failed: {complex_response.status_code} "
                        f"{complex_response.text}"
                    )
                complex_search = complex_response.json()
            image_search: dict[str, Any] | None = None
            if with_worker:
                image_response = client.post(
                    "/search",
                    files={
                        "images": (
                            "reference.jpg",
                            image_content,
                            "image/jpeg",
                        )
                    },
                    data={
                        "mode": "image",
                        "shooting_id": shooting_id,
                    },
                )
                if not image_response.is_success:
                    raise RuntimeError(
                        f"Image search failed: {image_response.status_code} "
                        f"{image_response.text}"
                    )
                image_search = image_response.json()
                qdrant_count = image_search["count"]
            else:
                qdrant_count = asyncio.run(qdrant_smoke(photo))

            libraries_response = client.get("/libraries")
            libraries_response.raise_for_status()
            smoke_library = next(
                item
                for item in libraries_response.json()["libraries"]
                if item["id"] == library_id
            )

            report = {
                "upload_status": photo["status"],
                "job_status": job["status"],
                "assignment_jobs": len(assignment_job_ids),
                "library_photo_count": smoke_library["photo_count"],
                "search_strategy": search["strategy"],
                "search_count": search["count"],
                "qdrant_count": qdrant_count,
                "image_search_strategy": (
                    image_search["strategy"] if image_search else "not_run"
                ),
                "complex_prompt_truncated": (
                    complex_search["diagnostics"]["text_embedding"]["truncated"]
                    if complex_search
                    else False
                ),
            }
            expected_strategy = "rrf_hybrid" if with_worker else "lexical_only"
            if (
                report["search_count"] != 1
                or report["library_photo_count"] != 1
                or report["search_strategy"] != expected_strategy
                or qdrant_count != 1
                or (
                    complex_search is not None
                    and (
                        complex_search["results"][0]["id"] != photo["id"]
                        or not report["complex_prompt_truncated"]
                    )
                )
                or (
                    image_search is not None
                    and image_search["results"][0]["id"] != photo["id"]
                )
            ):
                raise RuntimeError(f"Smoke assertions failed: {report}")
            print(json.dumps(report))
            hold_seconds = float(
                os.getenv("PHOTO_AI_SMOKE_HOLD_SECONDS", "0")
            )
            if hold_seconds > 0:
                print(
                    f"Smoke fixture available for {hold_seconds:g} seconds",
                    flush=True,
                )
                time.sleep(hold_seconds)
        finally:
            all_job_ids = ([job_id] if job_id else []) + assignment_job_ids
            if app.state.job_queue is not None:
                for queued_job_id in all_job_ids:
                    app.state.job_queue.client.lrem(
                        app.state.job_queue.queue_name,
                        0,
                        queued_job_id,
                    )

            photo_deleted = False
            if photo:
                try:
                    delete_response = client.delete(f"/photos/{photo['id']}")
                    delete_response.raise_for_status()
                    photo_deleted = delete_response.json()["deleted"] == 1
                except Exception as exc:
                    print(
                        f"Warning: photo deletion endpoint cleanup failed: {exc}",
                    )

            if (
                not photo_deleted
                and with_worker
                and photo
                and app.state.retrieval is not None
            ):
                try:
                    asyncio.run(
                        app.state.retrieval.delete_vectors([str(photo["id"])])
                    )
                except Exception as exc:
                    print(f"Warning: Qdrant smoke cleanup failed: {exc}")

            with app.state.database.pool.connection() as connection:
                for cleanup_job_id in all_job_ids:
                    connection.execute(
                        "DELETE FROM jobs WHERE id = %s",
                        (cleanup_job_id,),
                    )
                if photo and not photo_deleted:
                    connection.execute(
                        "DELETE FROM photos WHERE id = %s",
                        (photo["id"],),
                    )
                if shooting_id:
                    connection.execute(
                        "DELETE FROM shootings WHERE id = %s",
                        (shooting_id,),
                    )
                if library_id:
                    connection.execute(
                        "DELETE FROM libraries WHERE id = %s",
                        (library_id,),
                    )
            if photo and not photo_deleted:
                storage_file = Path(app.state.settings.storage_dir) / Path(
                    photo["url"]
                ).name
                storage_file.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
