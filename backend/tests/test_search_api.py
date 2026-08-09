from __future__ import annotations

import asyncio
from pathlib import Path
from time import perf_counter
from typing import Any

from fastapi.testclient import TestClient

from backend.app.api import apply_text_evidence_policy, apply_vlm_rerank
from backend.app.config import Settings
from backend.app.main import create_app
from backend.app.vlm import VlmJudgement


ROOT = Path(__file__).resolve().parents[2]


class FakeDatabase:
    def lexical_search(
        self,
        query: str,
        *,
        limit: int,
        library_id: str | None,
        shooting_id: str | None,
    ) -> list[dict[str, Any]]:
        assert "mariage" in query
        assert limit >= 10
        assert library_id == "album-1"
        assert shooting_id is None
        return [
            {
                "id": "photo-1",
                "url": "/media/photo-1.jpg",
                "caption": (
                    "mariage elegant sous une pluie fine avec des invites "
                    "pres de la piste de danse"
                ),
                "raw_score": 0.5,
            }
        ]


class UnavailableRetrieval:
    async def embed_text(self, _: str) -> dict[str, Any]:
        raise ConnectionError("local model is stopped")


class EmptyDatabase:
    def lexical_search(
        self,
        query: str,
        *,
        limit: int,
        library_id: str | None,
        shooting_id: str | None,
    ) -> list[dict[str, Any]]:
        return []


class ManyRelevantResultsDatabase:
    def lexical_search(
        self,
        query: str,
        *,
        limit: int,
        library_id: str | None,
        shooting_id: str | None,
    ) -> list[dict[str, Any]]:
        return [
            {
                "id": f"photo-{index}",
                "url": f"/media/photo-{index}.jpg",
                "caption": "food on a table",
                "raw_score": 1 / (index + 1),
            }
            for index in range(min(limit, 30))
        ]


class MixedEvidenceDatabase:
    def lexical_search(
        self,
        query: str,
        *,
        limit: int,
        library_id: str | None,
        shooting_id: str | None,
    ) -> list[dict[str, Any]]:
        return [
            {
                "id": "food",
                "storage_key": "food.jpg",
                "content_type": "image/jpeg",
                "caption": "a plate of food on a table",
                "raw_score": 1.0,
            },
            {
                "id": "bedroom",
                "storage_key": "bedroom.jpg",
                "content_type": "image/jpeg",
                "caption": "a bedroom with a bed and a table",
                "raw_score": 0.9,
            },
        ]


class ThresholdedRetrieval:
    def __init__(self) -> None:
        self.threshold: float | None = None

    async def embed_text(self, _: str) -> dict[str, Any]:
        return {"vector": [1.0, 0.0]}

    async def vector_search(
        self,
        _: list[float],
        *,
        limit: int,
        library_id: str | None,
        shooting_id: str | None,
        score_threshold: float | None,
    ) -> list[dict[str, Any]]:
        self.threshold = score_threshold
        return []


class FakeVlmJudge:
    async def judge_candidates(self, *, query: str, candidates: list[Any]):
        assert query == "food on the table"
        return [
            VlmJudgement(
                candidate_id=candidates[0].candidate_id,
                relevant=False,
                confidence=0.96,
                reason="No food is visible.",
            ),
            VlmJudgement(
                candidate_id=candidates[1].candidate_id,
                relevant=True,
                confidence=0.91,
                reason="Food is visibly placed on a table.",
            ),
        ]


class FailingVlmJudge:
    async def judge_candidates(self, *, query: str, candidates: list[Any]):
        raise ConnectionError("local VLM is stopped")


class RecordingVlmJudge:
    def __init__(self) -> None:
        self.batch_sizes: list[int] = []

    async def judge_candidates(self, *, query: str, candidates: list[Any]):
        self.batch_sizes.append(len(candidates))
        return [
            VlmJudgement(
                candidate_id=candidate.candidate_id,
                relevant=True,
                confidence=0.9,
                reason="Direct match.",
            )
            for candidate in candidates
        ]


def test_dense_failure_degrades_to_lexical_search(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
        embedding_service_enabled=True,
        vector_search_enabled=True,
        vlm_enabled=False,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        app.state.database = FakeDatabase()
        app.state.retrieval = UnavailableRetrieval()
        response = client.post(
            "/search",
            data={
                "mode": "text",
                "query": (
                    "mariage elegant sous une pluie fine avec des invites "
                    "pres de la piste de danse"
                ),
                "library_id": "album-1",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["strategy"] == "lexical_only"
    assert payload["results"][0]["id"] == "photo-1"
    assert payload["warnings"] == ["text_image_unavailable:ConnectionError"]


def test_search_rejects_invalid_limit(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
    )
    app = create_app(settings)
    with TestClient(app) as client:
        app.state.database = FakeDatabase()
        response = client.post(
            "/search",
            data={"mode": "text", "query": "mariage", "limit": "0"},
        )

    assert response.status_code == 422


def test_search_has_variable_output_unless_client_sets_a_limit(
    tmp_path: Path,
) -> None:
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
        search_candidate_limit=50,
        vlm_enabled=False,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        app.state.database = ManyRelevantResultsDatabase()
        variable_response = client.post(
            "/search",
            data={
                "mode": "text",
                "query": "food on the table",
                "use_vlm": "true",
            },
        )
        limited_response = client.post(
            "/search",
            data={
                "mode": "text",
                "query": "food on the table",
                "limit": "7",
            },
        )
        no_vlm_response = client.post(
            "/search",
            data={
                "mode": "text",
                "query": "food on the table",
                "use_vlm": "false",
            },
        )

    assert variable_response.status_code == 200
    assert variable_response.json()["count"] == 30
    assert variable_response.json()["diagnostics"]["result_policy"] == (
        "all_validated_candidates"
    )
    assert variable_response.json()["diagnostics"]["vlm_rerank"]["mode"] == (
        "server_disabled"
    )
    assert limited_response.status_code == 200
    assert limited_response.json()["count"] == 7
    assert limited_response.json()["diagnostics"]["result_policy"] == (
        "explicit_limit"
    )
    assert no_vlm_response.status_code == 200
    assert no_vlm_response.json()["diagnostics"]["vlm_rerank"]["mode"] == (
        "skipped_by_user"
    )


def test_search_sends_only_text_evidence_survivors_to_vlm(
    tmp_path: Path,
) -> None:
    (tmp_path / "food.jpg").write_bytes(b"food")
    (tmp_path / "bedroom.jpg").write_bytes(b"bedroom")
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
        vlm_enabled=True,
        vlm_judge_batch_size=1,
    )
    judge = RecordingVlmJudge()
    app = create_app(settings)
    with TestClient(app) as client:
        app.state.database = MixedEvidenceDatabase()
        app.state.vlm_judge = judge
        response = client.post(
            "/search",
            data={
                "mode": "text",
                "query": "food on the table",
                "use_vlm": "true",
            },
        )

    payload = response.json()
    assert response.status_code == 200
    assert [item["id"] for item in payload["results"]] == ["food"]
    assert judge.batch_sizes == [1]
    assert payload["diagnostics"]["candidate_counts"] == {
        "post_rrf_and_reference_logic": 2,
        "post_text_evidence": 1,
        "post_vlm_or_fallback": 1,
        "returned": 1,
    }


def test_search_skips_vlm_during_cooldown(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
        vlm_enabled=True,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        app.state.database = ManyRelevantResultsDatabase()
        app.state.vlm_retry_after = perf_counter() + 60
        response = client.post(
            "/search",
            data={
                "mode": "text",
                "query": "food on the table",
                "use_vlm": "true",
            },
        )

    payload = response.json()
    assert response.status_code == 200
    assert payload["diagnostics"]["vlm_rerank"]["mode"] == "cooldown"
    assert payload["warnings"] == ["vlm_unavailable:Cooldown"]


def test_search_rejects_oversized_query(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
        search_max_query_chars=100,
    )
    app = create_app(settings)
    with TestClient(app) as client:
        app.state.database = FakeDatabase()
        response = client.post(
            "/search",
            data={"mode": "text", "query": "m" * 101},
        )

    assert response.status_code == 413


def test_search_reports_no_match_after_dense_threshold(tmp_path: Path) -> None:
    settings = Settings(
        environment="test",
        storage_dir=tmp_path,
        model_registry_path=ROOT / "ml" / "model_registry.json",
        embedding_service_enabled=True,
        vector_search_enabled=True,
        text_vector_score_threshold=0.42,
    )
    retrieval = ThresholdedRetrieval()
    app = create_app(settings)
    with TestClient(app) as client:
        app.state.database = EmptyDatabase()
        app.state.retrieval = retrieval
        response = client.post(
            "/search",
            data={"mode": "text", "query": "an impossible scene"},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["results"] == []
    assert payload["strategy"] == "no_match"
    assert payload["diagnostics"]["channel_counts"] == {
        "lexical": 0,
        "text_image": 0,
    }
    assert retrieval.threshold == 0.42


def test_text_evidence_rejects_dense_only_candidates() -> None:
    filtered, diagnostics = apply_text_evidence_policy(
        [
            {
                "id": "person-playing",
                "caption": "a woman and child playing",
                "channels": {"lexical": {}, "text_image": {}},
            },
            {
                "id": "animal",
                "channels": {"text_image": {}},
            },
            {
                "id": "tennis",
                "caption": "a man playing tennis",
                "channels": {"lexical": {}},
            },
        ],
        query="people playing",
        lexical_results=[
            {
                "id": "person-playing",
                "caption": "a woman and child playing",
            },
            {
                "id": "tennis",
                "caption": "a man playing tennis",
            },
        ],
    )

    assert [item["id"] for item in filtered] == [
        "person-playing",
        "tennis",
    ]
    assert diagnostics == {
        "mode": "lexical_evidence_required",
        "rejected_dense_only": 1,
        "rejected_weak_lexical": 0,
        "rejected_low_confidence": 0,
        "query_concepts": 2,
        "minimum_concepts": 2,
    }


def test_text_evidence_keeps_all_thresholded_dense_candidates() -> None:
    results = [{"id": "candidate", "channels": {"text_image": {}}}]

    filtered, diagnostics = apply_text_evidence_policy(
        results * 8,
        query="professional editorial photography",
        lexical_results=[],
    )

    assert len(filtered) == 8
    assert diagnostics == {
        "mode": "dense_fallback",
        "rejected_dense_only": 0,
        "rejected_weak_lexical": 0,
        "rejected_low_confidence": 0,
        "query_concepts": 0,
        "minimum_concepts": 0,
    }


def test_text_evidence_rejects_single_term_for_dense_query() -> None:
    filtered, diagnostics = apply_text_evidence_policy(
        [
            {"id": "exact", "caption": "a man playing tennis"},
            {"id": "mentions-man-only", "caption": "a man sitting"},
        ],
        query="man playing tennis",
        lexical_results=[
            {
                "id": "exact",
                "caption": "a man playing tennis",
            },
            {
                "id": "mentions-man-only",
                "caption": "a man sitting",
            },
        ],
    )

    assert [item["id"] for item in filtered] == ["exact"]
    assert diagnostics["rejected_weak_lexical"] == 1


def test_text_evidence_requires_food_and_table_concepts() -> None:
    candidates = [
        {"id": "food-table", "caption": "a plate of food on a table"},
        {"id": "apples-table", "caption": "green apples on a table"},
        {"id": "bedroom-table", "caption": "a bedroom with a bed and a table"},
        {"id": "food-only", "caption": "a bowl of food"},
    ]

    filtered, diagnostics = apply_text_evidence_policy(
        candidates,
        query="food on the table",
        lexical_results=candidates,
    )

    assert [item["id"] for item in filtered] == [
        "food-table",
        "apples-table",
    ]
    assert diagnostics["query_concepts"] == 2
    assert diagnostics["minimum_concepts"] == 2


def test_vlm_rerank_rejects_related_but_inexact_image(
    tmp_path: Path,
) -> None:
    (tmp_path / "bedroom.jpg").write_bytes(b"bedroom")
    (tmp_path / "food.jpg").write_bytes(b"food")
    results = [
        {
            "id": "bedroom",
            "url": "/media/bedroom.jpg",
            "storage_key": "bedroom.jpg",
            "content_type": "image/jpeg",
            "caption": "a bedroom with a table",
            "score": 0.04,
        },
        {
            "id": "food",
            "url": "/media/food.jpg",
            "storage_key": "food.jpg",
            "content_type": "image/jpeg",
            "caption": "food on a table",
            "score": 0.03,
        },
    ]

    reranked, diagnostics, warnings = asyncio.run(
        apply_vlm_rerank(
            results,
            query="food on the table",
            judge=FakeVlmJudge(),  # type: ignore[arg-type]
            storage_dir=tmp_path,
            batch_size=5,
            relevance_threshold=0.7,
        )
    )

    assert [item["id"] for item in reranked] == ["food"]
    assert reranked[0]["vlm_judgement"]["confidence"] == 0.91
    assert diagnostics["mode"] == "verified"
    assert diagnostics["rejected"] == 1
    assert warnings == []


def test_vlm_failure_keeps_hybrid_results(
    tmp_path: Path,
) -> None:
    (tmp_path / "candidate.jpg").write_bytes(b"candidate")
    results = [
        {
            "id": "candidate",
            "url": "/media/candidate.jpg",
            "storage_key": "candidate.jpg",
            "content_type": "image/jpeg",
        }
    ]

    reranked, diagnostics, warnings = asyncio.run(
        apply_vlm_rerank(
            results,
            query="food on the table",
            judge=FailingVlmJudge(),  # type: ignore[arg-type]
            storage_dir=tmp_path,
            batch_size=5,
            relevance_threshold=0.7,
        )
    )

    assert reranked == results
    assert diagnostics["mode"] == "failed_open"
    assert warnings == ["vlm_unavailable:ConnectionError"]


def test_vlm_reviews_every_rrf_survivor_in_bounded_batches(
    tmp_path: Path,
) -> None:
    results = []
    for index in range(7):
        filename = f"candidate-{index}.jpg"
        (tmp_path / filename).write_bytes(str(index).encode("ascii"))
        results.append(
            {
                "id": str(index),
                "storage_key": filename,
                "content_type": "image/jpeg",
                "score": 1 / (index + 1),
            }
        )
    judge = RecordingVlmJudge()

    reranked, diagnostics, warnings = asyncio.run(
        apply_vlm_rerank(
            results,
            query="all matching images",
            judge=judge,  # type: ignore[arg-type]
            storage_dir=tmp_path,
            batch_size=3,
            relevance_threshold=0.7,
        )
    )

    assert [item["id"] for item in reranked] == [str(i) for i in range(7)]
    assert judge.batch_sizes == [3, 3, 1]
    assert diagnostics["policy"] == "all_evidence_survivors_batched"
    assert diagnostics["reviewed"] == 7
    assert warnings == []
