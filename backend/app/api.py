from __future__ import annotations

import asyncio
import hashlib
import os
import uuid
from io import BytesIO
from pathlib import Path
from time import perf_counter
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field, field_validator

from .config import Settings, endpoint_host, is_private_host
from .database import Database
from .model_registry import ModelRegistryError, registry_capabilities
from .query_concepts import concept_coverage
from .queue import JobQueue
from .retrieval import (
    LocalRetrievalClient,
    filter_by_score_margin,
    reciprocal_rank_fusion,
)
from .vlm import LocalVlmJudgeClient, VlmCandidate


router = APIRouter()
CHUNK_SIZE = 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": {".jpg", ".jpeg"},
    "image/png": {".png"},
    "image/webp": {".webp"},
}
FORMAT_EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}


def settings_from(request: Request) -> Settings:
    return request.app.state.settings


def database_from(request: Request) -> Database:
    database = getattr(request.app.state, "database", None)
    if database is None:
        raise HTTPException(
            status_code=503,
            detail="PostgreSQL persistence is not enabled",
        )
    return database


def queue_from(request: Request) -> JobQueue | None:
    return getattr(request.app.state, "job_queue", None)


def retrieval_from(request: Request) -> LocalRetrievalClient | None:
    return getattr(request.app.state, "retrieval", None)


async def enqueue_ingest_job(
    database: Database,
    job_queue: JobQueue | None,
    photo: dict[str, Any],
) -> str:
    job = await asyncio.to_thread(database.create_ingest_job, photo)
    job_id = str(job["id"])
    if job_queue is not None:
        try:
            await asyncio.to_thread(job_queue.enqueue, job_id)
        except Exception:
            # The worker also polls PostgreSQL, so this job remains recoverable.
            pass
    return job_id


async def delete_photo_records(
    request: Request,
    photos: list[dict[str, Any]],
) -> dict[str, int]:
    if not photos:
        return {"deleted": 0, "files_deleted": 0}

    photo_ids = [str(photo["id"]) for photo in photos]
    retrieval = retrieval_from(request)
    if retrieval is not None:
        try:
            await retrieval.delete_vectors(photo_ids)
        except Exception as exc:
            raise HTTPException(
                status_code=503,
                detail=f"Vector deletion failed: {exc.__class__.__name__}",
            ) from exc

    database = database_from(request)
    deleted = await asyncio.to_thread(database.delete_photos, photo_ids)
    storage_root = settings_from(request).storage_dir.resolve()
    files_deleted = 0
    for photo in deleted:
        candidate = (storage_root / str(photo["storage_key"])).resolve()
        if candidate != storage_root and storage_root not in candidate.parents:
            continue
        if candidate.is_file():
            candidate.unlink()
            files_deleted += 1

    return {"deleted": len(deleted), "files_deleted": files_deleted}


async def tcp_check(url: str, default_port: int) -> dict[str, object]:
    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port or default_port
    if not host:
        return {"ok": False, "host": None, "port": port, "error": "invalid URL"}

    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=1.5,
        )
        writer.close()
        await writer.wait_closed()
        return {"ok": True, "host": host, "port": port}
    except (OSError, TimeoutError) as exc:
        return {
            "ok": False,
            "host": host,
            "port": port,
            "error": exc.__class__.__name__,
        }


async def http_health_check(
    url: str,
    *,
    path: str = "/health",
    timeout_seconds: float = 2.0,
) -> dict[str, object]:
    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    endpoint = f"{url.rstrip('/')}{path}"
    if not host:
        return {
            "ok": False,
            "host": None,
            "port": port,
            "error": "invalid URL",
        }

    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.get(endpoint)
        result: dict[str, object] = {
            "ok": response.status_code == 200,
            "host": host,
            "port": port,
            "status_code": response.status_code,
        }
        if response.status_code != 200:
            try:
                result["detail"] = response.json()
            except ValueError:
                result["detail"] = response.text[:240]
        return result
    except (httpx.HTTPError, TimeoutError) as exc:
        return {
            "ok": False,
            "host": host,
            "port": port,
            "error": exc.__class__.__name__,
        }


@router.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "photo-ai-platform-api",
        "documentation": "/docs",
        "liveness": "/health/live",
        "readiness": "/health/ready",
    }


@router.get("/health/live")
async def liveness(request: Request) -> dict[str, str]:
    settings = settings_from(request)
    return {
        "status": "ok",
        "environment": settings.environment,
    }


@router.get("/health/ready")
async def readiness(request: Request) -> JSONResponse:
    settings = settings_from(request)
    checks = {
        "postgres": await tcp_check(settings.postgres_dsn, 5432),
        "qdrant": await tcp_check(settings.qdrant_url, 6333),
        "redis": await tcp_check(settings.redis_url, 6379),
        "minio": await tcp_check(settings.minio_url, 9000),
    }
    if settings.vlm_enabled:
        vlm_check = await http_health_check(settings.model_server_url)
        # Search is deliberately fail-open: an unavailable judge must not
        # prevent the API, uploads, lexical retrieval, or the frontend from
        # starting. Its degraded state remains visible to operators and users.
        vlm_check["required"] = False
        checks["vlm"] = vlm_check
    if settings.embedding_service_enabled:
        checks["embedding"] = await tcp_check(
            settings.embedding_service_url,
            8001,
        )

    storage_ok = settings.storage_dir.is_dir() and os.access(
        settings.storage_dir, os.W_OK
    )
    checks["storage"] = {
        "ok": storage_ok,
        "path": str(settings.storage_dir),
    }

    dependencies_ok = all(
        bool(result["ok"])
        for result in checks.values()
        if result.get("required", True)
    )
    degraded = [
        name
        for name, result in checks.items()
        if not result["ok"] and not result.get("required", True)
    ]
    ready = storage_ok and (
        dependencies_ok if settings.require_infrastructure else True
    )
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
            "degraded": degraded,
            "infrastructure_required": settings.require_infrastructure,
            "checks": checks,
        },
    )


@router.get("/api/v1/system/privacy")
async def privacy_status(request: Request) -> dict[str, object]:
    settings = settings_from(request)
    endpoints = {
        "postgres": settings.postgres_dsn,
        "qdrant": settings.qdrant_url,
        "redis": settings.redis_url,
        "minio": settings.minio_url,
        "embedding": settings.embedding_service_url,
        "vlm": settings.model_server_url,
    }
    return {
        "external_network_allowed": settings.external_network_allowed,
        "offline_required": settings.offline_required,
        "vlm_enabled": settings.vlm_enabled,
        "endpoints": {
            name: {
                "host": endpoint_host(value),
                "private": is_private_host(endpoint_host(value)),
            }
            for name, value in endpoints.items()
        },
    }


@router.get("/api/v1/system/models")
async def model_status(request: Request) -> dict[str, object]:
    settings = settings_from(request)
    try:
        return registry_capabilities(settings.model_registry_path)
    except ModelRegistryError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


async def stage_upload(
    upload: UploadFile,
    temp_dir: Path,
    max_bytes: int,
) -> dict[str, object]:
    content_type = (upload.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type: {content_type or 'unknown'}",
        )

    temp_path = temp_dir / f"{uuid.uuid4().hex}.upload"
    digest = hashlib.sha256()
    size = 0
    try:
        with temp_path.open("wb") as handle:
            while chunk := await upload.read(CHUNK_SIZE):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"{Path(upload.filename or 'image').name} exceeds the upload limit",
                    )
                digest.update(chunk)
                handle.write(chunk)

        try:
            with Image.open(temp_path) as image:
                width, height = image.size
                image.verify()
                image_format = str(image.format or "").upper()
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
            raise HTTPException(status_code=415, detail="Invalid image content") from exc

        extension = FORMAT_EXTENSIONS.get(image_format)
        if extension is None or extension not in ALLOWED_IMAGE_TYPES[content_type]:
            raise HTTPException(
                status_code=415,
                detail="Image content does not match its declared media type",
            )

        return {
            "temp_path": temp_path,
            "sha256": digest.hexdigest(),
            "size": size,
            "extension": extension,
            "filename": Path(upload.filename or f"image{extension}").name,
            "content_type": content_type,
            "width": width,
            "height": height,
        }
    except Exception:
        temp_path.unlink(missing_ok=True)
        raise
    finally:
        await upload.close()


@router.post("/upload")
@router.post("/api/v1/photos/upload")
async def upload_images(
    request: Request,
    files: list[UploadFile] = File(...),
    library_id: str | None = Form(default=None),
    shooting_id: str | None = Form(default=None),
) -> dict[str, object]:
    settings = settings_from(request)
    if not files:
        raise HTTPException(status_code=400, detail="At least one image is required")
    if len(files) > settings.max_upload_files:
        raise HTTPException(
            status_code=413,
            detail=f"At most {settings.max_upload_files} images are accepted per request",
        )

    temp_dir = settings.storage_dir / ".tmp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    staged: list[dict[str, object]] = []
    try:
        for upload in files:
            staged.append(
                await stage_upload(
                    upload,
                    temp_dir,
                    max_bytes=settings.max_upload_mb * 1024 * 1024,
                )
            )
    except Exception:
        for item in staged:
            Path(item["temp_path"]).unlink(missing_ok=True)
        raise

    images = []
    database = (
        database_from(request) if settings.persistence_enabled else None
    )
    if (
        database is not None
        and library_id is not None
        and not await asyncio.to_thread(database.library_exists, library_id)
    ):
        for item in staged:
            Path(item["temp_path"]).unlink(missing_ok=True)
        raise HTTPException(status_code=404, detail="Library not found")

    job_queue = queue_from(request)
    for item in staged:
        content_hash = str(item["sha256"])
        final_name = f"{content_hash}{item['extension']}"
        final_path = settings.storage_dir / final_name
        deduplicated = final_path.exists()
        temp_path = Path(item["temp_path"])
        if deduplicated:
            temp_path.unlink(missing_ok=True)
        else:
            os.replace(temp_path, final_path)

        photo_id = content_hash
        job_id = None
        status = "STORED"
        if database is not None:
            try:
                photo = await asyncio.to_thread(
                    database.upsert_photo,
                    shooting_id=shooting_id,
                    library_id=library_id,
                    original_filename=str(item["filename"]),
                    storage_key=final_name,
                    url=f"/media/{final_name}",
                    content_type=str(item["content_type"]),
                    byte_size=int(item["size"]),
                    sha256=content_hash,
                    width=int(item["width"]),
                    height=int(item["height"]),
                )
                photo_id = str(photo["id"])
                status = str(photo["status"])
                if status != "INDEXED":
                    job_id = await enqueue_ingest_job(
                        database,
                        job_queue,
                        photo,
                    )
            except Exception as exc:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        "Image stored locally, but metadata persistence failed: "
                        f"{exc.__class__.__name__}"
                    ),
                ) from exc

        images.append(
            {
                "id": photo_id,
                "filename": item["filename"],
                "url": f"/media/{final_name}",
                "size": item["size"],
                "sha256": content_hash,
                "library_id": library_id,
                "shooting_id": shooting_id,
                "status": status,
                "job_id": job_id,
                "deduplicated": deduplicated,
            }
        )

    return {
        "images": images,
        "count": len(images),
        "processing": (
            "queued"
            if database is not None
            and settings.embedding_service_enabled
            and settings.vector_search_enabled
            else "waiting_for_indexer"
            if database is not None
            else "not_configured"
        ),
    }


class LibraryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Library name cannot be blank")
        return normalized


class PhotoMetadataUpdate(BaseModel):
    caption: str | None = Field(default=None, max_length=4000)
    tags: list[str] | None = Field(default=None, max_length=100)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        normalized = []
        for tag in value:
            clean = tag.strip()
            if clean and clean not in normalized:
                normalized.append(clean[:100])
        return normalized


class PhotoLibraryAssignment(BaseModel):
    photo_ids: list[str] = Field(min_length=1, max_length=1000)
    library_id: str | None = Field(default=None, max_length=200)

    @field_validator("photo_ids")
    @classmethod
    def validate_photo_ids(cls, value: list[str]) -> list[str]:
        normalized = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if not normalized:
            raise ValueError("At least one photo id is required")
        return normalized


@router.get("/libraries")
@router.get("/api/v1/libraries")
async def list_libraries(request: Request) -> dict[str, object]:
    database = database_from(request)
    libraries = await asyncio.to_thread(database.list_libraries)
    return {"libraries": libraries}


@router.post("/libraries", status_code=201)
@router.post("/api/v1/libraries", status_code=201)
async def create_library(
    request: Request,
    payload: LibraryCreate,
) -> dict[str, Any]:
    database = database_from(request)
    return await asyncio.to_thread(
        database.create_library,
        name=payload.name,
        description=payload.description.strip(),
    )


@router.delete("/libraries/{library_id}")
@router.delete("/api/v1/libraries/{library_id}")
async def delete_library(
    request: Request,
    library_id: str,
) -> dict[str, bool]:
    database = database_from(request)
    deleted = await asyncio.to_thread(database.delete_library, library_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Library not found")
    return {"ok": True}


@router.delete("/libraries/{library_id}/photos")
@router.delete("/api/v1/libraries/{library_id}/photos")
async def delete_library_photos(
    request: Request,
    library_id: str,
) -> dict[str, int]:
    database = database_from(request)
    if not await asyncio.to_thread(database.library_exists, library_id):
        raise HTTPException(status_code=404, detail="Library not found")
    photos = await asyncio.to_thread(
        database.list_library_photo_files,
        library_id,
    )
    return await delete_photo_records(request, photos)


@router.get("/photos")
@router.get("/api/v1/photos")
async def list_photos(
    request: Request,
    library_id: str | None = Query(default=None),
    shooting_id: str | None = Query(default=None),
    status: Literal["STORED", "INDEXING", "INDEXED", "FAILED"] | None = Query(
        default=None
    ),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> dict[str, object]:
    database = database_from(request)
    photos = await asyncio.to_thread(
        database.list_photos,
        library_id=library_id,
        shooting_id=shooting_id,
        status=status,
        limit=limit,
        offset=offset,
    )
    return {
        "photos": photos,
        "count": len(photos),
        "limit": limit,
        "offset": offset,
    }


@router.delete("/photos/unassigned")
@router.delete("/api/v1/photos/unassigned")
async def delete_unassigned_photos(request: Request) -> dict[str, int]:
    database = database_from(request)
    photos = await asyncio.to_thread(database.list_unassigned_photo_files)
    return await delete_photo_records(request, photos)


@router.post("/photos/assign")
@router.post("/api/v1/photos/assign")
async def assign_photos_to_library(
    request: Request,
    payload: PhotoLibraryAssignment,
) -> dict[str, object]:
    database = database_from(request)
    if (
        payload.library_id is not None
        and not await asyncio.to_thread(database.library_exists, payload.library_id)
    ):
        raise HTTPException(status_code=404, detail="Library not found")

    existing_photos = await asyncio.to_thread(
        database.get_photos,
        payload.photo_ids,
    )
    found_ids = set(existing_photos)
    missing_ids = [
        photo_id for photo_id in payload.photo_ids if photo_id not in found_ids
    ]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail={"message": "Some photos were not found", "photo_ids": missing_ids},
        )

    photos = await asyncio.to_thread(
        database.assign_photos_to_library,
        payload.photo_ids,
        library_id=payload.library_id,
    )

    job_queue = queue_from(request)
    job_ids = []
    for photo in photos:
        if str(photo["status"]) != "INDEXED":
            job_ids.append(
                await enqueue_ingest_job(database, job_queue, photo)
            )

    return {
        "photos": photos,
        "count": len(photos),
        "job_ids": job_ids,
    }


@router.delete("/photos/{photo_id}")
@router.delete("/api/v1/photos/{photo_id}")
async def delete_photo(
    request: Request,
    photo_id: str,
) -> dict[str, int]:
    database = database_from(request)
    photo = await asyncio.to_thread(database.get_photo, photo_id)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return await delete_photo_records(request, [photo])


@router.patch("/photos/{photo_id}")
@router.patch("/api/v1/photos/{photo_id}")
async def update_photo_metadata(
    request: Request,
    photo_id: str,
    payload: PhotoMetadataUpdate,
) -> dict[str, Any]:
    if payload.caption is None and payload.tags is None:
        raise HTTPException(status_code=400, detail="No metadata field was provided")
    database = database_from(request)
    photo = await asyncio.to_thread(
        database.update_photo_metadata,
        photo_id,
        caption=payload.caption.strip() if payload.caption is not None else None,
        tags=payload.tags,
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return photo


@router.get("/api/v1/index/status")
async def index_status(request: Request) -> dict[str, object]:
    settings = settings_from(request)
    database = database_from(request)
    counts = await asyncio.to_thread(database.index_status)
    return {
        "counts": counts,
        "indexer_enabled": (
            settings.embedding_service_enabled and settings.vector_search_enabled
        ),
        "searchable": counts.get("INDEXED", 0),
        "pending": counts.get("STORED", 0) + counts.get("INDEXING", 0),
        "failed": counts.get("FAILED", 0),
    }


class ShootingCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    library_id: str | None = Field(default=None, max_length=200)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Shooting name cannot be blank")
        return normalized


@router.get("/shootings")
@router.get("/api/v1/shootings")
async def list_shootings(request: Request) -> dict[str, object]:
    database = database_from(request)
    shootings = await asyncio.to_thread(database.list_shootings)
    return {"shootings": shootings}


@router.post("/shootings", status_code=201)
@router.post("/api/v1/shootings", status_code=201)
async def create_shooting(
    request: Request,
    payload: ShootingCreate,
) -> dict[str, Any]:
    database = database_from(request)
    return await asyncio.to_thread(
        database.create_shooting,
        name=payload.name,
        description=payload.description.strip(),
        library_id=payload.library_id,
    )


@router.delete("/shootings/{shooting_id}")
@router.delete("/api/v1/shootings/{shooting_id}")
async def delete_shooting(
    request: Request,
    shooting_id: str,
) -> dict[str, bool]:
    database = database_from(request)
    deleted = await asyncio.to_thread(database.delete_shooting, shooting_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Shooting not found")
    return {"ok": True}


@router.get("/jobs/{job_id}")
@router.get("/api/v1/jobs/{job_id}")
async def get_job(request: Request, job_id: str) -> dict[str, Any]:
    database = database_from(request)
    job = await asyncio.to_thread(database.get_job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def read_search_image(
    upload: UploadFile,
    *,
    max_bytes: int,
) -> tuple[bytes, str, str]:
    content_type = (upload.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=415, detail="Unsupported search image type")

    content = await upload.read(max_bytes + 1)
    await upload.close()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="Search image is too large")
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=415, detail="Invalid search image") from exc
    return (
        content,
        content_type,
        Path(upload.filename or "query-image").name,
    )


async def enrich_vector_results(
    database: Database,
    results: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not results:
        return []
    metadata = await asyncio.to_thread(
        database.get_photos,
        [str(item["id"]) for item in results],
    )
    return [
        {
            **item,
            **metadata.get(str(item["id"]), {}),
            "id": str(item["id"]),
        }
        for item in results
        if str(item["id"]) in metadata
    ]


def apply_reference_logic(
    results: list[dict[str, Any]],
    *,
    reference_count: int,
    reference_logic: Literal["rrf", "union", "intersection"],
) -> list[dict[str, Any]]:
    if reference_logic != "intersection" or reference_count < 2:
        return results
    return [
        item
        for item in results
        if sum(
            channel.startswith("image_reference_")
            for channel in item.get("channels", {})
        )
        == reference_count
    ]


def apply_text_evidence_policy(
    results: list[dict[str, Any]],
    *,
    query: str,
    lexical_results: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not lexical_results:
        # Dense retrieval already applied its absolute threshold and relative
        # score margin. A second fixed top-k here would silently lose recall.
        return results, {
            "mode": "dense_fallback",
            "rejected_dense_only": 0,
            "rejected_weak_lexical": 0,
            "rejected_low_confidence": 0,
            "query_concepts": 0,
            "minimum_concepts": 0,
        }

    coverage = [
        (item, concept_coverage(query, item)) for item in lexical_results
    ]
    supported_lexical = [
        item
        for item, (matched, _, minimum) in coverage
        if matched >= minimum
    ]
    _, query_concepts, minimum_concepts = coverage[0][1]
    lexical_ids = {str(item["id"]) for item in supported_lexical}
    supported = [
        item for item in results if str(item["id"]) in lexical_ids
    ]
    return supported, {
        "mode": "lexical_evidence_required",
        "rejected_dense_only": len(results) - len(supported),
        "rejected_weak_lexical": (
            len(lexical_results) - len(supported_lexical)
        ),
        "rejected_low_confidence": 0,
        "query_concepts": query_concepts,
        "minimum_concepts": minimum_concepts,
    }


async def apply_vlm_rerank(
    results: list[dict[str, Any]],
    *,
    query: str,
    judge: LocalVlmJudgeClient,
    storage_dir: Path,
    batch_size: int,
    relevance_threshold: float,
) -> tuple[list[dict[str, Any]], dict[str, Any], list[str]]:
    if batch_size < 1:
        raise ValueError("batch_size must be positive")

    # The batch size is only a memory/context control. Every RRF survivor is
    # reviewed, so it never acts as a semantic top-k cutoff.
    reviewed_results = results
    storage_root = storage_dir.resolve()
    candidate_specs: list[tuple[str, Path, str, str]] = []
    by_candidate_id: dict[str, dict[str, Any]] = {}
    for index, result in enumerate(reviewed_results, start=1):
        storage_key = Path(str(result.get("storage_key") or "")).name
        if not storage_key:
            storage_key = Path(urlparse(str(result.get("url") or "")).path).name
        image_path = (storage_root / storage_key).resolve()
        if image_path.parent != storage_root or not image_path.is_file():
            return results, {
                "mode": "failed_open",
                "reviewed": 0,
                "accepted": len(results),
                "rejected": 0,
            }, ["vlm_unavailable:ImageFileMissing"]

        candidate_id = f"candidate_{index}"
        by_candidate_id[candidate_id] = result
        candidate_specs.append(
            (
                candidate_id,
                image_path,
                str(result.get("content_type") or "image/jpeg"),
                str(result.get("caption") or ""),
            )
        )

    if not candidate_specs:
        return results, {
            "mode": "not_needed",
            "reviewed": 0,
            "accepted": 0,
            "rejected": 0,
        }, []

    judgements = []
    batch_count = 0
    try:
        for offset in range(0, len(candidate_specs), batch_size):
            specs = candidate_specs[offset : offset + batch_size]
            batch = [
                VlmCandidate(
                    candidate_id=candidate_id,
                    content=await asyncio.to_thread(image_path.read_bytes),
                    content_type=content_type,
                    caption=caption,
                )
                for candidate_id, image_path, content_type, caption in specs
            ]
            batch_judgements = await judge.judge_candidates(
                query=query,
                candidates=batch,
            )
            expected_ids = {candidate.candidate_id for candidate in batch}
            returned_ids = {
                judgement.candidate_id for judgement in batch_judgements
            }
            if (
                len(batch_judgements) != len(batch)
                or returned_ids != expected_ids
            ):
                raise ValueError("VLM returned an incomplete judgement set")
            judgements.extend(batch_judgements)
            batch_count += 1
    except Exception as exc:
        return results, {
            "mode": "failed_open",
            "reviewed": 0,
            "accepted": len(results),
            "rejected": 0,
            "batch_size": batch_size,
            "batches_completed": batch_count,
        }, [f"vlm_unavailable:{exc.__class__.__name__}"]

    judgement_by_id = {item.candidate_id: item for item in judgements}
    accepted = []
    # Preserve the RRF order: confidence values from separate VLM batches are
    # useful for filtering but are not calibrated enough for global reranking.
    for candidate_id, _, _, _ in candidate_specs:
        judgement = judgement_by_id[candidate_id]
        result = by_candidate_id[candidate_id]
        if not judgement.relevant:
            continue
        if judgement.confidence < relevance_threshold:
            continue
        accepted.append(
            {
                **result,
                "vlm_judgement": {
                    "relevant": judgement.relevant,
                    "confidence": judgement.confidence,
                    "reason": judgement.reason,
                },
            }
        )
    return accepted, {
        "mode": "verified",
        "policy": "all_evidence_survivors_batched",
        "input_candidates": len(results),
        "reviewed": len(candidate_specs),
        "accepted": len(accepted),
        "rejected": len(candidate_specs) - len(accepted),
        "batch_size": batch_size,
        "batches": batch_count,
        "threshold": relevance_threshold,
    }, []


@router.post("/search")
@router.post("/api/v1/search")
async def search(
    request: Request,
    mode: Literal["text", "image", "hybrid"] = Form(default="text"),
    query: str = Form(default=""),
    images: list[UploadFile] | None = File(default=None),
    reference_logic: Literal["rrf", "union", "intersection"] = Form(
        default="rrf"
    ),
    library_id: str | None = Form(default=None),
    shooting_id: str | None = Form(default=None),
    limit: int | None = Form(default=None),
    use_vlm: bool = Form(default=False),
) -> dict[str, Any]:
    search_started = perf_counter()
    settings = settings_from(request)
    database = database_from(request)
    retrieval = retrieval_from(request)
    if limit is not None and not 1 <= limit <= 100:
        raise HTTPException(
            status_code=422,
            detail="Search limit must be between 1 and 100",
        )
    candidate_limit = max(limit or 0, settings.search_candidate_limit)
    # Without an explicit client limit, return every candidate that survives
    # the calibrated filters/judge instead of imposing an arbitrary top-k.
    result_limit = limit if limit is not None else candidate_limit
    normalized_query = query.strip()
    if len(normalized_query) > settings.search_max_query_chars:
        raise HTTPException(
            status_code=413,
            detail=(
                "Search query exceeds the configured limit of "
                f"{settings.search_max_query_chars} characters"
            ),
        )
    warnings: list[str] = []
    channels: dict[str, list[dict[str, Any]]] = {}
    successful_channels: list[str] = []
    diagnostics: dict[str, Any] = {
        "query_characters": len(normalized_query),
        "result_policy": (
            "explicit_limit" if limit is not None else "all_validated_candidates"
        ),
        "candidate_limit": candidate_limit,
        "stage_timings_ms": {},
    }
    timings: dict[str, float] = diagnostics["stage_timings_ms"]

    if mode in {"text", "hybrid"}:
        if not normalized_query:
            raise HTTPException(
                status_code=400,
                detail="A text query is required for text or hybrid search",
            )
        stage_started = perf_counter()
        try:
            channels["lexical"] = await asyncio.to_thread(
                database.lexical_search,
                normalized_query,
                limit=candidate_limit,
                library_id=library_id,
                shooting_id=shooting_id,
            )
            successful_channels.append("lexical")
        except Exception as exc:
            warnings.append(f"lexical_unavailable:{exc.__class__.__name__}")
        finally:
            timings["lexical"] = round(
                (perf_counter() - stage_started) * 1000,
                2,
            )

        if settings.vector_search_enabled and retrieval is not None:
            stage_started = perf_counter()
            try:
                embedding = await retrieval.embed_text(normalized_query)
                if embedding.get("input"):
                    diagnostics["text_embedding"] = embedding["input"]
                dense = await retrieval.vector_search(
                    embedding["vector"],
                    limit=candidate_limit,
                    library_id=library_id,
                    shooting_id=shooting_id,
                    score_threshold=settings.text_vector_score_threshold,
                )
                dense, relative_cutoff = filter_by_score_margin(
                    dense,
                    margin=settings.text_vector_relative_margin,
                )
                diagnostics["text_image_relative_cutoff"] = relative_cutoff
                channels["text_image"] = await enrich_vector_results(
                    database,
                    dense,
                )
                successful_channels.append("text_image")
            except Exception as exc:
                warnings.append(
                    f"text_image_unavailable:{exc.__class__.__name__}"
                )
            finally:
                timings["text_image"] = round(
                    (perf_counter() - stage_started) * 1000,
                    2,
                )

    if mode in {"image", "hybrid"}:
        if not images:
            raise HTTPException(
                status_code=400,
                detail="At least one reference image is required",
            )
        if not settings.vector_search_enabled or retrieval is None:
            raise HTTPException(
                status_code=503,
                detail="Local vector search is not enabled",
            )

        stage_started = perf_counter()
        for index, upload in enumerate(images, start=1):
            try:
                content, content_type, filename = await read_search_image(
                    upload,
                    max_bytes=settings.max_upload_mb * 1024 * 1024,
                )
                embedding = await retrieval.embed_image(
                    content,
                    content_type,
                    filename,
                )
                dense = await retrieval.vector_search(
                    embedding["vector"],
                    limit=candidate_limit,
                    library_id=library_id,
                    shooting_id=shooting_id,
                    score_threshold=settings.image_vector_score_threshold,
                )
                channel_name = f"image_reference_{index}"
                channels[channel_name] = await enrich_vector_results(
                    database,
                    dense,
                )
                successful_channels.append(channel_name)
            except HTTPException:
                raise
            except Exception as exc:
                warnings.append(
                    f"image_reference_{index}_unavailable:"
                    f"{exc.__class__.__name__}"
                )
        timings["image_references"] = round(
            (perf_counter() - stage_started) * 1000,
            2,
        )

    if not successful_channels:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "No local retrieval channel is available",
                "warnings": warnings,
            },
        )

    stage_started = perf_counter()
    results = reciprocal_rank_fusion(
        channels,
        rank_constant=settings.rrf_rank_constant,
        limit=candidate_limit,
    )
    results = apply_reference_logic(
        results,
        reference_count=len(images or []),
        reference_logic=reference_logic,
    )
    timings["fusion_and_reference_logic"] = round(
        (perf_counter() - stage_started) * 1000,
        2,
    )
    candidate_counts = {
        "post_rrf_and_reference_logic": len(results),
    }
    if mode in {"text", "hybrid"}:
        stage_started = perf_counter()
        evidence_results, text_evidence = apply_text_evidence_policy(
            results,
            query=normalized_query,
            lexical_results=channels.get("lexical", []),
        )
        timings["text_evidence"] = round(
            (perf_counter() - stage_started) * 1000,
            2,
        )
        candidate_counts["post_text_evidence"] = len(evidence_results)
        vlm_active = use_vlm and settings.vlm_enabled
        text_evidence["application"] = (
            "fallback_only" if vlm_active else "primary_filter"
        )
        diagnostics["text_evidence_policy"] = text_evidence
        diagnostics["vlm_requested"] = use_vlm
        if vlm_active:
            judge = getattr(request.app.state, "vlm_judge", None)
            if judge is None:
                diagnostics["vlm_rerank"] = {"mode": "unavailable"}
                warnings.append("vlm_unavailable:ClientNotConfigured")
                results = evidence_results
            else:
                vlm_lock = request.app.state.vlm_lock
                retry_after = max(
                    0.0,
                    float(request.app.state.vlm_retry_after) - perf_counter(),
                )
                if retry_after > 0:
                    results = evidence_results
                    vlm_diagnostics = {
                        "mode": "cooldown",
                        "reviewed": 0,
                        "accepted": len(evidence_results),
                        "rejected": 0,
                        "fallback": "text_evidence_policy",
                        "retry_after_seconds": round(retry_after, 1),
                    }
                    vlm_warnings = ["vlm_unavailable:Cooldown"]
                elif vlm_lock.locked():
                    results = evidence_results
                    vlm_diagnostics = {
                        "mode": "busy",
                        "reviewed": 0,
                        "accepted": len(evidence_results),
                        "rejected": 0,
                        "fallback": "text_evidence_policy",
                    }
                    vlm_warnings = ["vlm_unavailable:Busy"]
                else:
                    stage_started = perf_counter()
                    async with vlm_lock:
                        try:
                            async with asyncio.timeout(
                                settings.vlm_timeout_seconds
                            ):
                                results, vlm_diagnostics, vlm_warnings = (
                                    await apply_vlm_rerank(
                                        evidence_results,
                                        query=normalized_query,
                                        judge=judge,
                                        storage_dir=settings.storage_dir,
                                        batch_size=(
                                            settings.vlm_judge_batch_size
                                        ),
                                        relevance_threshold=(
                                            settings.vlm_relevance_threshold
                                        ),
                                    )
                                )
                        except TimeoutError:
                            request.app.state.vlm_retry_after = (
                                perf_counter()
                                + settings.vlm_cooldown_seconds
                            )
                            results = evidence_results
                            vlm_diagnostics = {
                                "mode": "failed_open",
                                "reviewed": 0,
                                "accepted": len(evidence_results),
                                "rejected": 0,
                                "fallback": "text_evidence_policy",
                                "timeout_seconds": (
                                    settings.vlm_timeout_seconds
                                ),
                            }
                            vlm_warnings = [
                                "vlm_unavailable:GlobalTimeout"
                            ]
                    timings["vlm_judge"] = round(
                        (perf_counter() - stage_started) * 1000,
                        2,
                    )
                if vlm_diagnostics["mode"] == "failed_open":
                    results = evidence_results
                    vlm_diagnostics["fallback"] = "text_evidence_policy"
                diagnostics["vlm_rerank"] = vlm_diagnostics
                warnings.extend(vlm_warnings)
        elif use_vlm:
            results = evidence_results
            diagnostics["vlm_rerank"] = {"mode": "server_disabled"}
        else:
            results = evidence_results
            diagnostics["vlm_rerank"] = {"mode": "skipped_by_user"}
        candidate_counts["post_vlm_or_fallback"] = len(results)
    results = results[:result_limit]
    candidate_counts["returned"] = len(results)
    non_empty_channels = [
        name for name in successful_channels if channels.get(name)
    ]
    diagnostics["channel_counts"] = {
        name: len(channels.get(name, [])) for name in successful_channels
    }
    diagnostics["score_thresholds"] = {
        "text_image": settings.text_vector_score_threshold,
        "image_image": settings.image_vector_score_threshold,
    }
    diagnostics["candidate_counts"] = candidate_counts
    timings["total"] = round((perf_counter() - search_started) * 1000, 2)
    if not results:
        strategy = "no_match"
    elif len(non_empty_channels) > 1:
        strategy = "rrf_hybrid"
    elif non_empty_channels:
        strategy = f"{non_empty_channels[0]}_only"
    else:
        strategy = f"{successful_channels[0]}_only"
    return {
        "results": results,
        "count": len(results),
        "strategy": strategy,
        "channels": successful_channels,
        "warnings": warnings,
        "query": normalized_query,
        "diagnostics": diagnostics,
        "reference_logic": reference_logic,
    }
