from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ModelRegistryError(RuntimeError):
    """Raised when the local model registry cannot be read."""


def load_model_registry(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ModelRegistryError(f"Unable to read model registry: {exc}") from exc

    if data.get("schema_version") != 1 or not isinstance(data.get("models"), list):
        raise ModelRegistryError("Invalid model registry schema")
    return data


def registry_capabilities(path: Path) -> dict[str, Any]:
    data = load_model_registry(path)
    models = data["models"]
    return {
        "external_inference_allowed": data.get("policy", {}).get(
            "external_inference_allowed", False
        ),
        "automatic_model_downloads_allowed": data.get("policy", {}).get(
            "automatic_model_downloads_allowed", False
        ),
        "models": [
            {
                "id": model.get("id"),
                "role": model.get("role"),
                "runtime": model.get("runtime"),
                "status": model.get("status"),
                "approved_for_production": bool(
                    model.get("approved_for_production")
                ),
                "local_artifacts": len(model.get("artifacts") or []),
            }
            for model in models
        ],
    }
