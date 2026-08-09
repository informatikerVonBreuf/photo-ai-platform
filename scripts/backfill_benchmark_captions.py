from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_IMAGES = ROOT / "notebooks" / "data" / "images" / "val2017"
DEFAULT_CAPTIONS = (
    ROOT / "notebooks" / "data" / "artifacts" / "captions_blip.json"
)


def request_json(
    url: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = Request(url, data=body, headers=headers, method=method)
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def caption_mapping(images_dir: Path, captions_path: Path) -> dict[str, str]:
    image_paths = sorted(
        path
        for path in images_dir.iterdir()
        if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        and " - Copie" not in path.stem
    )
    captions = json.loads(captions_path.read_text(encoding="utf-8"))
    if not isinstance(captions, list) or len(captions) != len(image_paths):
        raise ValueError(
            "Caption artifact and image directory are not aligned: "
            f"{len(captions) if isinstance(captions, list) else 'invalid'} "
            f"captions for {len(image_paths)} images"
        )
    return {
        image_path.name: str(caption).strip()
        for image_path, caption in zip(image_paths, captions, strict=True)
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Attach cached benchmark captions to imported COCO photos."
    )
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES)
    parser.add_argument("--captions", type=Path, default=DEFAULT_CAPTIONS)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    mapping = caption_mapping(args.images_dir, args.captions)
    query = urlencode({"limit": 1000, "offset": 0})
    response = request_json(f"{args.api_base.rstrip('/')}/photos?{query}")
    photos = response.get("photos", [])
    matched = [
        photo for photo in photos if photo.get("original_filename") in mapping
    ]

    if not args.dry_run:
        for photo in matched:
            request_json(
                f"{args.api_base.rstrip('/')}/photos/{photo['id']}",
                method="PATCH",
                payload={"caption": mapping[photo["original_filename"]]},
            )

    print(
        json.dumps(
            {
                "photos_seen": len(photos),
                "captions_available": len(mapping),
                "photos_updated": 0 if args.dry_run else len(matched),
                "photos_matched": len(matched),
                "dry_run": args.dry_run,
            },
            ensure_ascii=True,
        )
    )


if __name__ == "__main__":
    main()
