from __future__ import annotations

from pathlib import Path

import pytest

from backend.app.worker import resolve_storage_file


def test_storage_key_cannot_escape_photo_directory(tmp_path: Path) -> None:
    outside = tmp_path.parent / "secret.jpg"
    outside.write_bytes(b"secret")

    with pytest.raises(ValueError, match="escapes"):
        resolve_storage_file(tmp_path, "../secret.jpg")
