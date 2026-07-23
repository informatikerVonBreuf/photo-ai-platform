from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = ROOT / "ml" / "model_registry.json"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_registry(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema_version") != 1:
        raise ValueError("Unsupported model registry schema_version")
    if not isinstance(data.get("models"), list):
        raise ValueError("The registry must contain a models list")
    return data


def validate_registry(data: dict[str, Any], strict: bool) -> list[str]:
    errors: list[str] = []
    approved_roles: set[str] = set()
    seen_ids: set[str] = set()

    for model in data["models"]:
        model_id = str(model.get("id", "")).strip()
        if not model_id:
            errors.append("A model is missing its id")
            continue
        if model_id in seen_ids:
            errors.append(f"{model_id}: duplicate id")
        seen_ids.add(model_id)

        approved = model.get("approved_for_production") is True
        artifacts = model.get("artifacts") or []
        if approved:
            approved_roles.add(str(model.get("role", "")))
            if not model.get("revision"):
                errors.append(f"{model_id}: approved model has no pinned revision")
            if model.get("license") in {None, "", "verify_before_production"}:
                errors.append(f"{model_id}: approved model has no verified license")
            if not artifacts:
                errors.append(f"{model_id}: approved model has no local artifacts")

        for artifact in artifacts:
            relative_path = Path(str(artifact.get("path", "")))
            expected_hash = str(artifact.get("sha256", "")).lower()
            if relative_path.is_absolute() or ".." in relative_path.parts:
                errors.append(f"{model_id}: artifact path must stay inside the repository")
                continue
            artifact_path = ROOT / relative_path
            if not artifact_path.is_file():
                errors.append(f"{model_id}: missing artifact {relative_path}")
                continue
            if len(expected_hash) != 64:
                errors.append(f"{model_id}: invalid SHA-256 for {relative_path}")
                continue
            actual_hash = file_sha256(artifact_path)
            if actual_hash != expected_hash:
                errors.append(f"{model_id}: checksum mismatch for {relative_path}")

    if strict:
        required_roles = set(data.get("policy", {}).get("required_production_roles", []))
        for role in sorted(required_roles - approved_roles):
            errors.append(f"production role has no approved model: {role}")

    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the local model registry.")
    parser.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    parser.add_argument("--strict", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        registry = load_registry(args.registry)
        errors = validate_registry(registry, strict=args.strict)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"Registry error: {exc}", file=sys.stderr)
        return 2

    for model in registry["models"]:
        approval = "APPROVED" if model.get("approved_for_production") else "NOT_APPROVED"
        print(f"{model['id']}: {model.get('status')} / {approval}")

    if errors:
        print("\nValidation errors:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("\nModel registry is valid.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
