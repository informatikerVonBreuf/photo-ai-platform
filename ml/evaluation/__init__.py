"""Evaluation utilities for the local multimodal retrieval pipeline."""

from .retrieval_metrics import (
    average_precision,
    binary_classification_metrics,
    evaluate_retrieval_run,
    hit_rate_at_k,
    latency_percentiles,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
    stage_diagnostics,
    variable_set_metrics,
)

__all__ = [
    "average_precision",
    "binary_classification_metrics",
    "evaluate_retrieval_run",
    "hit_rate_at_k",
    "latency_percentiles",
    "ndcg_at_k",
    "precision_at_k",
    "recall_at_k",
    "reciprocal_rank",
    "stage_diagnostics",
    "variable_set_metrics",
]
