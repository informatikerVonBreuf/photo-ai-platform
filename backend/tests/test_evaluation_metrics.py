from __future__ import annotations

import pytest

from ml.evaluation import (
    binary_classification_metrics,
    evaluate_retrieval_run,
    latency_percentiles,
    ndcg_at_k,
    variable_set_metrics,
)


def test_variable_output_metrics_penalize_false_positives_and_false_negatives() -> None:
    metrics = variable_set_metrics(["a", "wrong"], {"a", "b"})

    assert metrics["precision"] == 0.5
    assert metrics["recall"] == 0.5
    assert metrics["f1"] == 0.5
    assert metrics["false_positives"] == 1
    assert metrics["false_negatives"] == 1


def test_graded_ndcg_rewards_the_best_image_first() -> None:
    relevance = {"excellent": 2, "useful": 1}

    assert ndcg_at_k(["excellent", "useful"], relevance, 2) == 1.0
    assert ndcg_at_k(["useful", "excellent"], relevance, 2) < 1.0


def test_judge_metrics_include_calibration_and_error_rates() -> None:
    metrics = binary_classification_metrics(
        [1, 1, 0, 0],
        [0.9, 0.4, 0.8, 0.1],
        threshold=0.7,
        calibration_bins=2,
    )

    assert metrics["true_positives"] == 1
    assert metrics["false_positives"] == 1
    assert metrics["false_negatives"] == 1
    assert metrics["brier_score"] == pytest.approx(0.255)
    assert 0 <= metrics["expected_calibration_error"] <= 1


def test_staged_report_exposes_recall_loss_and_no_match_accuracy() -> None:
    report = evaluate_retrieval_run(
        {
            "complex": {"a": 2, "b": 1},
            "absent": {},
        },
        {
            "complex": {
                "rrf": ["a", "b", "wrong"],
                "judge": ["a"],
                "final": ["a"],
            },
            "absent": {"rrf": ["wrong"], "final": []},
        },
        cutoffs=(1, 3),
    )

    aggregate = report["aggregate"]
    assert aggregate["stage_recall"]["rrf"] == 1.0
    assert aggregate["stage_recall"]["judge"] == 0.5
    assert aggregate["no_match_accuracy"] == 1.0
    assert report["queries"]["complex"]["stages"]["judge"][
        "relevant_lost_since_previous"
    ] == 1


def test_latency_percentiles_make_tail_latency_visible() -> None:
    metrics = latency_percentiles([10, 20, 30, 100])

    assert metrics["p50_ms"] == 25
    assert metrics["p95_ms"] > 80
    assert metrics["p99_ms"] > metrics["p95_ms"]
