from __future__ import annotations

import argparse
import asyncio
import sys
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.retrieval import LocalRetrievalClient


PHOTO_ID = "018f9ee8-8e5d-7b3d-ae20-21d646f5f16a"


async def run(args: argparse.Namespace) -> None:
    client = LocalRetrievalClient(
        embedding_url=args.embedding_url,
        qdrant_url=args.qdrant_url,
        qdrant_api_key=args.qdrant_api_key,
        collection=args.collection,
    )
    image_bytes = BytesIO()
    Image.new("RGB", (96, 96), "red").save(image_bytes, format="JPEG")

    try:
        image_embedding = await client.embed_image(
            image_bytes.getvalue(),
            "image/jpeg",
            "red.jpg",
        )
        text_embedding = await client.embed_text(
            "a simple red square photograph"
        )
        await client.upsert_vector(
            photo_id=PHOTO_ID,
            vector=image_embedding["vector"],
            payload={"caption": "red square"},
        )
        results = await client.vector_search(
            text_embedding["vector"],
            limit=3,
        )
        if not results or results[0]["id"] != PHOTO_ID:
            raise RuntimeError(f"Unexpected dense search result: {results}")
        print(
            {
                "count": len(results),
                "top_id": results[0]["id"],
                "score": round(float(results[0]["raw_score"]), 4),
                "dimensions": len(text_embedding["vector"]),
                "model": text_embedding["model"],
                "local_only": text_embedding["local_only"],
            }
        )
    finally:
        async with httpx.AsyncClient(timeout=10) as http:
            await http.delete(
                f"{args.qdrant_url.rstrip('/')}/collections/{args.collection}",
                headers={"api-key": args.qdrant_api_key},
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Smoke-test the local embedding and Qdrant contract."
    )
    parser.add_argument(
        "--embedding-url",
        default="http://127.0.0.1:8001",
    )
    parser.add_argument(
        "--qdrant-url",
        default="http://127.0.0.1:6333",
    )
    parser.add_argument("--qdrant-api-key", default="change-me")
    parser.add_argument("--collection", default="tinyclip_smoke")
    return parser.parse_args()


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
