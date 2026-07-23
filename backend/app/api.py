from __future__ import annotations

import asyncio
import hashlib
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from .config import Settings, endpoint_host, is_private_host
from .model_registry import ModelRegistryError, registry_capabilities


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
        checks["vlm"] = await tcp_check(settings.model_server_url, 8080)

    storage_ok = settings.storage_dir.is_dir() and os.access(
        settings.storage_dir, os.W_OK
    )
    checks["storage"] = {
        "ok": storage_ok,
        "path": str(settings.storage_dir),
    }

    dependencies_ok = all(bool(result["ok"]) for result in checks.values())
    ready = storage_ok and (
        dependencies_ok if settings.require_infrastructure else True
    )
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
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
    for item in staged:
        photo_id = str(item["sha256"])
        final_name = f"{photo_id}{item['extension']}"
        final_path = settings.storage_dir / final_name
        deduplicated = final_path.exists()
        temp_path = Path(item["temp_path"])
        if deduplicated:
            temp_path.unlink(missing_ok=True)
        else:
            os.replace(temp_path, final_path)

        images.append(
            {
                "id": photo_id,
                "filename": item["filename"],
                "url": f"/media/{final_name}",
                "size": item["size"],
                "sha256": photo_id,
                "library_id": library_id,
                "status": "STORED",
                "deduplicated": deduplicated,
            }
        )

    return {
        "images": images,
        "count": len(images),
        "processing": "pending",
    }
