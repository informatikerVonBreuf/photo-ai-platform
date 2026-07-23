from __future__ import annotations

import ipaddress
from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


LOCAL_SERVICE_HOSTS = {
    "localhost",
    "postgres",
    "qdrant",
    "redis",
    "minio",
    "llama",
}


def is_private_host(host: str | None) -> bool:
    if not host:
        return False
    normalized = host.strip("[]").lower()
    if normalized in LOCAL_SERVICE_HOSTS:
        return True
    try:
        return ipaddress.ip_address(normalized).is_private
    except ValueError:
        return False


def endpoint_host(value: str) -> str | None:
    return urlparse(value).hostname


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="PHOTO_AI_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Photo AI Platform API"
    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://127.0.0.1:5173", "http://localhost:5173"]
    )

    storage_dir: Path = Path("var/photos")
    model_registry_path: Path = Path("ml/model_registry.json")
    max_upload_mb: int = Field(default=50, ge=1, le=500)
    max_upload_files: int = Field(default=100, ge=1, le=1000)

    external_network_allowed: bool = False
    offline_required: bool = True
    require_infrastructure: bool = False
    vlm_enabled: bool = False

    postgres_dsn: str = "postgresql://photo_ai:photo_ai@127.0.0.1:5432/photo_ai"
    qdrant_url: str = "http://127.0.0.1:6333"
    redis_url: str = "redis://127.0.0.1:6379/0"
    minio_url: str = "http://127.0.0.1:9000"
    model_server_url: str = "http://127.0.0.1:8080"

    @model_validator(mode="after")
    def reject_external_dependencies(self) -> "Settings":
        if self.external_network_allowed:
            return self

        endpoints = {
            "postgres_dsn": self.postgres_dsn,
            "qdrant_url": self.qdrant_url,
            "redis_url": self.redis_url,
            "minio_url": self.minio_url,
            "model_server_url": self.model_server_url,
        }
        external = [
            f"{name}={endpoint_host(value) or 'invalid'}"
            for name, value in endpoints.items()
            if not is_private_host(endpoint_host(value))
        ]
        if external:
            raise ValueError(
                "External service endpoints are forbidden: " + ", ".join(external)
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
