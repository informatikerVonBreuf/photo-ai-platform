from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.main import create_app


ROOT = Path(__file__).resolve().parents[2]


class FakeCatalogDatabase:
    def list_libraries(self) -> list[dict[str, Any]]:
        return [{"id": "library-1", "name": "Mariages", "photo_count": 1}]

    def create_library(self, *, name: str, description: str) -> dict[str, Any]:
        return {
            "id": "library-created",
            "name": name,
            "description": description,
            "status": "READY",
        }

    def delete_library(self, library_id: str) -> bool:
        return library_id == "library-1"

    def library_exists(self, library_id: str) -> bool:
        return library_id == "library-1"

    def get_photos(self, photo_ids: list[str]) -> dict[str, dict[str, Any]]:
        return {
            photo_id: {"id": photo_id, "status": "INDEXED"}
            for photo_id in photo_ids
            if photo_id == "photo-1"
        }

    def assign_photos_to_library(
        self,
        photo_ids: list[str],
        *,
        library_id: str | None,
    ) -> list[dict[str, Any]]:
        assert library_id == "library-1"
        return [
            {
                "id": photo_id,
                "library_id": library_id,
                "status": "INDEXED",
            }
            for photo_id in photo_ids
        ]

    def get_photo(self, photo_id: str) -> dict[str, Any] | None:
        if photo_id != "photo-1":
            return None
        return {"id": photo_id, "storage_key": "photo-1.jpg"}

    def list_library_photo_files(self, library_id: str) -> list[dict[str, Any]]:
        assert library_id == "library-1"
        return [{"id": "photo-1", "storage_key": "photo-1.jpg"}]

    def list_unassigned_photo_files(self) -> list[dict[str, Any]]:
        return [{"id": "photo-1", "storage_key": "photo-1.jpg"}]

    def delete_photos(self, photo_ids: list[str]) -> list[dict[str, Any]]:
        return [
            {"id": photo_id, "storage_key": "photo-1.jpg"}
            for photo_id in photo_ids
        ]

    def list_photos(self, **filters: Any) -> list[dict[str, Any]]:
        assert filters["library_id"] == "library-1"
        assert filters["limit"] == 25
        return [
            {
                "id": "photo-1",
                "original_filename": "photo.jpg",
                "status": "INDEXED",
            }
        ]

    def update_photo_metadata(
        self,
        photo_id: str,
        *,
        caption: str | None,
        tags: list[str] | None,
    ) -> dict[str, Any] | None:
        if photo_id != "photo-1":
            return None
        return {
            "id": photo_id,
            "caption": caption,
            "tags": tags,
            "status": "INDEXED",
        }

    def index_status(self) -> dict[str, int]:
        return {"INDEXED": 1, "STORED": 2, "TOTAL": 3}


def test_catalog_and_index_status_routes(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
        embedding_service_enabled=True,
        vector_search_enabled=True,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        app.state.database = FakeCatalogDatabase()
        app.state.retrieval = None

        libraries = client.get("/libraries")
        assert libraries.status_code == 200
        assert libraries.json()["libraries"][0]["photo_count"] == 1

        created = client.post(
            "/libraries",
            json={"name": "  Portraits  ", "description": " Studio "},
        )
        assert created.status_code == 201
        assert created.json()["name"] == "Portraits"
        assert created.json()["description"] == "Studio"

        photos = client.get("/photos?library_id=library-1&limit=25")
        assert photos.status_code == 200
        assert photos.json()["photos"][0]["status"] == "INDEXED"

        updated = client.patch(
            "/photos/photo-1",
            json={"caption": "  portrait en studio  ", "tags": [" portrait ", ""]},
        )
        assert updated.status_code == 200
        assert updated.json()["caption"] == "portrait en studio"
        assert updated.json()["tags"] == ["portrait"]

        assigned = client.post(
            "/api/v1/photos/assign",
            json={"photo_ids": ["photo-1"], "library_id": "library-1"},
        )
        assert assigned.status_code == 200
        assert assigned.json()["count"] == 1
        assert assigned.json()["photos"][0]["library_id"] == "library-1"

        (tmp_path / "photo-1.jpg").write_bytes(b"test")
        deleted_photo = client.delete("/api/v1/photos/photo-1")
        assert deleted_photo.status_code == 200
        assert deleted_photo.json() == {"deleted": 1, "files_deleted": 1}
        assert not (tmp_path / "photo-1.jpg").exists()

        cleared_library = client.delete("/api/v1/libraries/library-1/photos")
        assert cleared_library.status_code == 200
        assert cleared_library.json()["deleted"] == 1

        cleared_unassigned = client.delete("/api/v1/photos/unassigned")
        assert cleared_unassigned.status_code == 200
        assert cleared_unassigned.json()["deleted"] == 1

        status = client.get("/api/v1/index/status")
        assert status.status_code == 200
        assert status.json()["searchable"] == 1
        assert status.json()["pending"] == 2
        assert status.json()["indexer_enabled"] is True

        deleted = client.delete("/libraries/library-1")
        assert deleted.status_code == 200
        assert deleted.json() == {"ok": True}
