from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "ml" / "model_registry.json"
DEFAULT_MODEL_ID = "tinyclip-vit-8m-text-3m-yfcc15m"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_model(model_id: str) -> dict[str, Any]:
    registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    for model in registry["models"]:
        if model["id"] == model_id:
            return model
    raise ValueError(f"Unknown model id: {model_id}")


def verify_artifacts(model: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    for artifact in model.get("artifacts", []):
        path = ROOT / artifact["path"]
        if not path.is_file():
            errors.append(f"missing: {artifact['path']}")
            continue
        actual_hash = file_sha256(path)
        if actual_hash != artifact["sha256"]:
            errors.append(f"checksum mismatch: {artifact['path']}")
    return errors


def provision(model: dict[str, Any]) -> None:
    try:
        from huggingface_hub import hf_hub_download
    except ImportError as exc:
        raise RuntimeError(
            "huggingface_hub is required. Run scripts/setup_ml_env.ps1 first."
        ) from exc

    if os.name == "nt":
        try:
            from pip._vendor import truststore

            truststore.inject_into_ssl()
        except ImportError:
            pass

    os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
    os.environ.setdefault("HF_HUB_DISABLE_IMPLICIT_TOKEN", "1")

    for artifact in model.get("artifacts", []):
        destination = ROOT / artifact["path"]
        destination.parent.mkdir(parents=True, exist_ok=True)
        downloaded = Path(
            hf_hub_download(
                repo_id=model["source"],
                filename=destination.name,
                revision=model["revision"],
            )
        )
        temporary = destination.with_suffix(destination.suffix + ".part")
        shutil.copy2(downloaded, temporary)
        if file_sha256(temporary) != artifact["sha256"]:
            temporary.unlink(missing_ok=True)
            raise RuntimeError(f"Checksum mismatch for {artifact['path']}")
        os.replace(temporary, destination)
        print(f"verified: {artifact['path']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Provision a pinned local model from the project registry."
    )
    parser.add_argument("--model-id", default=DEFAULT_MODEL_ID)
    parser.add_argument("--verify-only", action="store_true")
    parser.add_argument(
        "--accept-license",
        action="store_true",
        help="Confirm that the operator reviewed the model license.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        model = load_model(args.model_id)
        if not args.verify_only:
            if not args.accept_license:
                raise ValueError(
                    "Provisioning requires --accept-license after reviewing "
                    f"the license for {model['source']}."
                )
            provision(model)
        errors = verify_artifacts(model)
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
        print(f"Model provisioning error: {exc}", file=sys.stderr)
        return 1

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1
    print(
        f"{model['id']} is present locally at revision {model['revision']} "
        "and all checksums match."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
