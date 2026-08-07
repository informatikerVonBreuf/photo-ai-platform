from __future__ import annotations

from backend.app.api import apply_reference_logic
from backend.app.retrieval import filter_by_score_margin, reciprocal_rank_fusion


def test_rrf_rewards_cross_channel_agreement_without_score_averaging() -> None:
    results = reciprocal_rank_fusion(
        {
            "lexical": [
                {"id": "a", "raw_score": 9_000.0},
                {"id": "b", "raw_score": 0.2},
            ],
            "text_image": [
                {"id": "b", "raw_score": 0.71},
                {"id": "c", "raw_score": 0.99},
            ],
        },
        rank_constant=60,
        limit=10,
    )

    assert [item["id"] for item in results] == ["b", "a", "c"]
    assert results[0]["channels"]["lexical"]["raw_score"] == 0.2
    assert results[0]["channels"]["text_image"]["raw_score"] == 0.71
    assert results[0]["score"] < 0.04


def test_rrf_counts_a_duplicate_only_once_per_channel() -> None:
    results = reciprocal_rank_fusion(
        {
            "image_reference_1": [
                {"id": "a", "raw_score": 0.9},
                {"id": "a", "raw_score": 0.8},
            ]
        },
        rank_constant=10,
        limit=10,
    )

    assert len(results) == 1
    assert results[0]["score"] == 1 / 11


def test_reference_intersection_keeps_only_cross_reference_matches() -> None:
    results = [
        {
            "id": "both",
            "channels": {
                "image_reference_1": {"rank": 1},
                "image_reference_2": {"rank": 2},
            },
        },
        {
            "id": "one",
            "channels": {"image_reference_1": {"rank": 2}},
        },
    ]

    intersection = apply_reference_logic(
        results,
        reference_count=2,
        reference_logic="intersection",
    )
    union = apply_reference_logic(
        results,
        reference_count=2,
        reference_logic="union",
    )

    assert [item["id"] for item in intersection] == ["both"]
    assert union == results


def test_score_margin_removes_weak_dense_candidates() -> None:
    filtered, cutoff = filter_by_score_margin(
        [
            {"id": "strong", "raw_score": 0.38},
            {"id": "close", "raw_score": 0.34},
            {"id": "weak", "raw_score": 0.29},
        ],
        margin=0.06,
    )

    assert cutoff == 0.32
    assert [item["id"] for item in filtered] == ["strong", "close"]
