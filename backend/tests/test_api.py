from __future__ import annotations

from io import BytesIO
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image

from backend.app.config import Settings
from backend.app.main import create_app


ROOT = Path(__file__).resolve().parents[2]


def test_settings_reject_external_service() -> None:
    try:
        Settings(qdrant_url="https://external.example.com")
    except ValueError as exc:
        assert "External service endpoints are forbidden" in str(exc)
    else:
        raise AssertionError("External endpoint should have been rejected")


def test_health_privacy_and_registry(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
        require_infrastructure=False,
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/health/live").json()["status"] == "ok"

        ready = client.get("/health/ready")
        assert ready.status_code == 200
        assert ready.json()["checks"]["storage"]["ok"] is True

        privacy = client.get("/api/v1/system/privacy").json()
        assert privacy["external_network_allowed"] is False
        assert all(item["private"] for item in privacy["endpoints"].values())

        registry = client.get("/api/v1/system/models")
        assert registry.status_code == 200
        assert registry.json()["external_inference_allowed"] is False


def test_upload_verified_image(tmp_path: Path) -> None:
    image_bytes = BytesIO()
    Image.new("RGB", (16, 16), "red").save(image_bytes, format="JPEG")

    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
    )
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/upload",
            files={"files": ("photo.jpg", image_bytes.getvalue(), "image/jpeg")},
            data={"library_id": "library-1"},
        )

        assert response.status_code == 200
        image = response.json()["images"][0]
        assert image["library_id"] == "library-1"
        assert image["url"].startswith("/media/")
        assert (tmp_path / Path(image["url"]).name).is_file()


def test_upload_rejects_non_image(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
    )
    with TestClient(create_app(settings)) as client:
        response = client.post(
            "/upload",
            files={"files": ("fake.jpg", b"not an image", "image/jpeg")},
        )

    assert response.status_code == 415
    assert list(tmp_path.glob("*.jpg")) == []
