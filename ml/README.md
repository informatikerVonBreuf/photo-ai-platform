# ML Strategy

This folder is for reusable ML experiments and production-oriented prototypes.

The current recommendation for Photo AI Platform is:

1. Start with image embeddings and vector search.
2. Add metadata filters for library, shooting, date, orientation, dimensions and tags.
3. Add a lightweight similarity graph for navigation, recommendations and optional cluster views.
4. Keep caption generation and text clustering as an offline enrichment, not as the core runtime path.

Why this order:

- It is easier to maintain than a full BLIP caption + BM25 + UMAP + HDBSCAN stack.
- It scales naturally with a vector database such as Qdrant.
- It supports text search later with CLIP text embeddings without forcing captions for every image.
- It keeps expensive models out of the request path.

## Experiments

- `experiments/photo_strategy_benchmark.py`: synthetic benchmark comparing text clustering, vector search, metadata facets and graph-based grouping.
- `experiments/retrieval_strategy_benchmark.py`: task-specific benchmark for text-to-image, image-to-image and clustering strategies.

Run:

```bash
python ml/experiments/photo_strategy_benchmark.py
python ml/experiments/retrieval_strategy_benchmark.py
```
