from __future__ import annotations

import math
from collections.abc import Mapping, Sequence
from statistics import mean
from typing import Any


Relevance = Mapping[str, float] | set[str]


def _unique(items: Sequence[str]) -> list[str]:
    return list(dict.fromkeys(str(item) for item in items))


def _grades(relevance: Relevance) -> dict[str, float]:
    if isinstance(relevance, set):
        return {str(item): 1.0 for item in relevance}
    return {
        str(item): float(grade)
        for item, grade in relevance.items()
        if float(grade) > 0
    }


def precision_at_k(ranking: Sequence[str], relevance: Relevance, k: int) -> float:
    if k < 1:
        raise ValueError("k must be positive")
    relevant = set(_grades(relevance))
    selected = _unique(ranking)[:k]
    return sum(item in relevant for item in selected) / k


def recall_at_k(ranking: Sequence[str], relevance: Relevance, k: int) -> float:
    relevant = set(_grades(relevance))
    if not relevant:
        return 0.0
    selected = set(_unique(ranking)[:k])
    return len(selected & relevant) / len(relevant)


def hit_rate_at_k(ranking: Sequence[str], relevance: Relevance, k: int) -> float:
    return float(recall_at_k(ranking, relevance, k) > 0)


def reciprocal_rank(ranking: Sequence[str], relevance: Relevance) -> float:
    relevant = set(_grades(relevance))
    for rank, item in enumerate(_unique(ranking), start=1):
        if item in relevant:
            return 1.0 / rank
    return 0.0


def average_precision(ranking: Sequence[str], relevance: Relevance) -> float:
    relevant = set(_grades(relevance))
    if not relevant:
        return 0.0
    hits = 0
    precision_sum = 0.0
    for rank, item in enumerate(_unique(ranking), start=1):
        if item not in relevant:
            continue
        hits += 1
        precision_sum += hits / rank
    return precision_sum / len(relevant)


def ndcg_at_k(ranking: Sequence[str], relevance: Relevance, k: int) -> float:
    grades = _grades(relevance)
    selected = _unique(ranking)[:k]
    dcg = sum(
        (2 ** grades.get(item, 0.0) - 1) / math.log2(rank + 1)
        for rank, item in enumerate(selected, start=1)
    )
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum(
        (2**grade - 1) / math.log2(rank + 1)
        for rank, grade in enumerate(ideal, start=1)
    )
    return dcg / idcg if idcg else 0.0


def variable_set_metrics(
    selected: Sequence[str],
    relevance: Relevance,
) -> dict[str, float | int]:
    """Score a variable-sized result set, including a correct empty response."""
    predicted = set(_unique(selected))
    relevant = set(_grades(relevance))
    true_positives = len(predicted & relevant)
    false_positives = len(predicted - relevant)
    false_negatives = len(relevant - predicted)

    # Empty/empty is a correct no-match response, not an undefined score.
    precision = (
        true_positives / len(predicted)
        if predicted
        else float(not relevant)
    )
    recall = (
        true_positives / len(relevant)
        if relevant
        else float(not predicted)
    )
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0
    )
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "true_positives": true_positives,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        "selected_count": len(predicted),
        "relevant_count": len(relevant),
    }


def stage_diagnostics(
    stages: Mapping[str, Sequence[str]],
    relevance: Relevance,
) -> dict[str, dict[str, float | int]]:
    """Expose recall and relevant-item movement across named pipeline stages."""
    relevant = set(_grades(relevance))
    previous_relevant = relevant
    diagnostics: dict[str, dict[str, float | int]] = {}
    for name, ranking in stages.items():
        candidates = set(_unique(ranking))
        retained_relevant = candidates & relevant
        lost = previous_relevant - retained_relevant
        added = retained_relevant - previous_relevant
        diagnostics[name] = {
            "candidate_count": len(candidates),
            "relevant_retained": len(retained_relevant),
            "stage_recall": (
                len(retained_relevant) / len(relevant) if relevant else 0.0
            ),
            "relevant_lost_since_previous": len(lost),
            "relevant_added_since_previous": len(added),
        }
        previous_relevant = retained_relevant
    return diagnostics


def binary_classification_metrics(
    labels: Sequence[bool | int],
    scores: Sequence[float],
    *,
    threshold: float,
    calibration_bins: int = 10,
) -> dict[str, float | int]:
    """Evaluate positive-class probabilities and their calibration."""
    if len(labels) != len(scores) or not labels:
        raise ValueError("labels and scores must be non-empty and have equal length")
    if calibration_bins < 1:
        raise ValueError("calibration_bins must be positive")

    truth = [bool(label) for label in labels]
    probabilities = [min(1.0, max(0.0, float(score))) for score in scores]
    predictions = [score >= threshold for score in probabilities]
    tp = sum(prediction and label for prediction, label in zip(predictions, truth))
    fp = sum(prediction and not label for prediction, label in zip(predictions, truth))
    tn = sum(not prediction and not label for prediction, label in zip(predictions, truth))
    fn = sum(not prediction and label for prediction, label in zip(predictions, truth))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    specificity = tn / (tn + fp) if tn + fp else 0.0

    expected_calibration_error = 0.0
    width = 1.0 / calibration_bins
    for index in range(calibration_bins):
        lower = index * width
        upper = (index + 1) * width
        members = [
            position
            for position, score in enumerate(probabilities)
            if lower <= score < upper or (index == calibration_bins - 1 and score == 1)
        ]
        if not members:
            continue
        confidence = mean(probabilities[position] for position in members)
        accuracy = mean(float(truth[position]) for position in members)
        expected_calibration_error += (
            len(members) / len(truth) * abs(accuracy - confidence)
        )

    return {
        "threshold": threshold,
        "precision": precision,
        "recall": recall,
        "f1": (
            2 * precision * recall / (precision + recall)
            if precision + recall
            else 0.0
        ),
        "accuracy": (tp + tn) / len(truth),
        "specificity": specificity,
        "false_positive_rate": fp / (fp + tn) if fp + tn else 0.0,
        "false_negative_rate": fn / (fn + tp) if fn + tp else 0.0,
        "brier_score": mean(
            (score - float(label)) ** 2
            for score, label in zip(probabilities, truth)
        ),
        "expected_calibration_error": expected_calibration_error,
        "true_positives": tp,
        "false_positives": fp,
        "true_negatives": tn,
        "false_negatives": fn,
    }


def _percentile(values: Sequence[float], percentile: float) -> float:
    ordered = sorted(float(value) for value in values)
    position = (len(ordered) - 1) * percentile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def latency_percentiles(values_ms: Sequence[float]) -> dict[str, float]:
    if not values_ms:
        return {"mean_ms": 0.0, "p50_ms": 0.0, "p95_ms": 0.0, "p99_ms": 0.0}
    return {
        "mean_ms": mean(values_ms),
        "p50_ms": _percentile(values_ms, 0.50),
        "p95_ms": _percentile(values_ms, 0.95),
        "p99_ms": _percentile(values_ms, 0.99),
    }


def evaluate_retrieval_run(
    qrels: Mapping[str, Mapping[str, float]],
    runs: Mapping[str, Mapping[str, Sequence[str]]],
    *,
    cutoffs: Sequence[int] = (1, 5, 10, 20, 50),
    final_stage: str = "final",
) -> dict[str, Any]:
    """Evaluate staged rankings against graded, human-authored qrels."""
    per_query: dict[str, Any] = {}
    ranked_rows: list[dict[str, float]] = []
    set_rows: list[dict[str, float | int]] = []
    no_match_hits: list[float] = []
    stage_recalls: dict[str, list[float]] = {}

    for query_id, relevance in qrels.items():
        stages = runs.get(query_id, {})
        ranking = list(stages.get(final_stage, []))
        has_relevant = bool(_grades(relevance))
        ranked: dict[str, float] = {
            "reciprocal_rank": reciprocal_rank(ranking, relevance),
            "average_precision": average_precision(ranking, relevance),
        }
        for cutoff in cutoffs:
            ranked[f"precision_at_{cutoff}"] = precision_at_k(
                ranking, relevance, cutoff
            )
            ranked[f"recall_at_{cutoff}"] = recall_at_k(
                ranking, relevance, cutoff
            )
            ranked[f"hit_rate_at_{cutoff}"] = hit_rate_at_k(
                ranking, relevance, cutoff
            )
            ranked[f"ndcg_at_{cutoff}"] = ndcg_at_k(
                ranking, relevance, cutoff
            )
        if has_relevant:
            ranked_rows.append(ranked)
        else:
            no_match_hits.append(float(not ranking))

        set_metrics = variable_set_metrics(ranking, relevance)
        set_rows.append(set_metrics)
        diagnostics = stage_diagnostics(stages, relevance)
        for stage, values in diagnostics.items():
            if has_relevant:
                stage_recalls.setdefault(stage, []).append(
                    float(values["stage_recall"])
                )
        per_query[query_id] = {
            "ranking": ranked,
            "final_set": set_metrics,
            "stages": diagnostics,
        }

    ranking_keys = ranked_rows[0].keys() if ranked_rows else []
    set_keys = ("precision", "recall", "f1")
    return {
        "aggregate": {
            "evaluated_queries": len(qrels),
            "queries_with_relevant_items": len(ranked_rows),
            "ranking": {
                key: mean(float(row[key]) for row in ranked_rows)
                for key in ranking_keys
            },
            "final_variable_set": {
                key: mean(float(row[key]) for row in set_rows)
                if set_rows
                else 0.0
                for key in set_keys
            },
            "no_match_accuracy": mean(no_match_hits) if no_match_hits else None,
            "stage_recall": {
                stage: mean(values) for stage, values in stage_recalls.items()
            },
        },
        "queries": per_query,
    }
