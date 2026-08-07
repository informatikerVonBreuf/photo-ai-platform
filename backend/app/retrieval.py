from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any
from urllib.parse import quote

import httpx


def reciprocal_rank_fusion(
    channels: Mapping[str, Sequence[dict[str, Any]]],
    *,
    rank_constant: int = 60,
    limit: int = 20,
) -> list[dict[str, Any]]:
    fused: dict[str, dict[str, Any]] = {}
    for channel_name, results in channels.items():
        seen_in_channel: set[str] = set()
        for rank, result in enumerate(results, start=1):
            result_id = str(result["id"])
            if result_id in seen_in_channel:
                continue
            seen_in_channel.add(result_id)
            item = fused.setdefault(
                result_id,
                {
                    **result,
                    "id": result_id,
                    "score": 0.0,
                    "channels": {},
                },
            )
            item["score"] += 1.0 / (rank_constant + rank)
            item["channels"][channel_name] = {
                "rank": rank,
                "raw_score": result.get("raw_score"),
            }
            for key, value in result.items():
                if key not in {"score", "channels"} and value not in (None, "", []):
                    item[key] = value

    return sorted(
        fused.values(),
        key=lambda item: (-float(item["score"]), str(item["id"])),
    )[:limit]


def filter_by_score_margin(
    results: Sequence[dict[str, Any]],
    *,
    margin: float,
) -> tuple[list[dict[str, Any]], float | None]:
    scores = [
        float(result["raw_score"])
        for result in results
        if result.get("raw_score") is not None
    ]
    if not scores:
        return list(results), None

    cutoff = max(scores) - margin
    return (
        [
            result
            for result in results
            if result.get("raw_score") is not None
            and float(result["raw_score"]) >= cutoff
        ],
        cutoff,
    )


class LocalRetrievalClient:
    def __init__(
        self,
        *,
        embedding_url: str,
        qdrant_url: str,
        qdrant_api_key: str,
        collection: str,
        score_threshold: float | None = None,
        timeout_seconds: float = 30,
    ) -> None:
        self.embedding_url = embedding_url.rstrip("/")
        self.qdrant_url = qdrant_url.rstrip("/")
        self.collection = quote(collection, safe="")
        self.score_threshold = score_threshold
        self.timeout_seconds = timeout_seconds
        self.qdrant_headers = (
            {"api-key": qdrant_api_key} if qdrant_api_key else {}
        )

    async def embed_text(self, text: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.embedding_url}/embed/text",
                json={"text": text},
            )
            response.raise_for_status()
            return response.json()

    async def embed_image(
        self,
        content: bytes,
        content_type: str,
        filename: str,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                f"{self.embedding_url}/embed/image",
                files={"image": (filename, content, content_type)},
            )
            response.raise_for_status()
            return response.json()

    async def ensure_collection(self, vector_size: int) -> None:
        collection_url = f"{self.qdrant_url}/collections/{self.collection}"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.get(
                collection_url,
                headers=self.qdrant_headers,
            )
            if response.status_code == 404:
                created = await client.put(
                    collection_url,
                    headers=self.qdrant_headers,
                    json={
                        "vectors": {
                            "image": {
                                "size": vector_size,
                                "distance": "Cosine",
                            }
                        }
                    },
                )
                created.raise_for_status()
                return

            response.raise_for_status()
            config = response.json().get("result", {}).get("config", {})
            vectors = config.get("params", {}).get("vectors", {})
            configured_size = vectors.get("image", {}).get("size")
            if configured_size is not None and configured_size != vector_size:
                raise RuntimeError(
                    "Qdrant collection vector size mismatch: "
                    f"{configured_size} != {vector_size}"
                )

    async def upsert_vector(
        self,
        *,
        photo_id: str,
        vector: list[float],
        payload: dict[str, Any],
    ) -> None:
        await self.ensure_collection(len(vector))
        url = f"{self.qdrant_url}/collections/{self.collection}/points"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.put(
                url,
                params={"wait": "true"},
                headers=self.qdrant_headers,
                json={
                    "points": [
                        {
                            "id": photo_id,
                            "vector": {"image": vector},
                            "payload": payload,
                        }
                    ]
                },
            )
            response.raise_for_status()

    async def delete_vectors(self, photo_ids: Sequence[str]) -> None:
        if not photo_ids:
            return
        url = f"{self.qdrant_url}/collections/{self.collection}/points/delete"
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                url,
                params={"wait": "true"},
                headers=self.qdrant_headers,
                json={"points": list(photo_ids)},
            )
            if response.status_code == 404:
                return
            response.raise_for_status()

    async def vector_search(
        self,
        vector: list[float],
        *,
        limit: int,
        library_id: str | None = None,
        shooting_id: str | None = None,
        score_threshold: float | None = None,
    ) -> list[dict[str, Any]]:
        must = []
        if library_id:
            must.append({"key": "library_id", "match": {"value": library_id}})
        if shooting_id:
            must.append({"key": "shooting_id", "match": {"value": shooting_id}})

        body: dict[str, Any] = {
            "query": vector,
            "using": "image",
            "limit": limit,
            "with_payload": True,
        }
        if must:
            body["filter"] = {"must": must}
        effective_threshold = (
            score_threshold
            if score_threshold is not None
            else self.score_threshold
        )
        if effective_threshold is not None:
            body["score_threshold"] = effective_threshold

        url = (
            f"{self.qdrant_url}/collections/{self.collection}/points/query"
        )
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            response = await client.post(
                url,
                headers=self.qdrant_headers,
                json=body,
            )
            if response.status_code == 404:
                return []
            response.raise_for_status()
            result = response.json().get("result", {})
            points = result.get("points", result if isinstance(result, list) else [])

        return [
            {
                "id": str(point["id"]),
                **(point.get("payload") or {}),
                "raw_score": point.get("score"),
            }
            for point in points
        ]
