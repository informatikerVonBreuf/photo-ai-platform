# Approach Comparison

This document compares image organization strategies for Photo AI Platform.

## Current heavy POC

The existing notebooks explore a rich pipeline:

- BLIP captions for every image.
- OpenCLIP image and text embeddings.
- BM25 over generated captions.
- Qdrant with named vectors.
- UMAP and HDBSCAN for clustering.
- Optional local LLM enrichment.

This is useful for research, but it is heavy for production because it requires
several models, GPU-friendly batching, cache invalidation, cluster tuning and
extra infrastructure around captions.

## Recommended production path

Use a simpler pipeline first:

1. Upload images and store originals in object storage.
2. Extract cheap metadata: dimensions, date, orientation, shooting, library.
3. Compute one image embedding per photo.
4. Store the vector in Qdrant and metadata in PostgreSQL.
5. Search with vector similarity plus metadata filters.
6. Build a lightweight graph from nearest neighbors, face/person ids, time and
   shooting proximity.
7. Generate captions only offline, when needed for richer search or summaries.

## Decision Matrix

| Approach | Scalability | Maintenance | UX value | Recommendation |
| --- | --- | --- | --- | --- |
| Metadata filters | Excellent | Excellent | Medium | Keep as baseline |
| Image vector search | Excellent with Qdrant | Good | High | Core runtime |
| Text embedding search | Good | Good | High | Add after image search |
| Caption + BM25 | Medium | Medium/High | Medium | Offline enrichment only |
| UMAP/HDBSCAN clustering | Medium | High | Medium | Batch job, not core path |
| Hybrid similarity graph | Good | Good | High | Best grouping layer |
| Face/person grouping | Good | Medium | High for events | Optional vertical feature |

## Local benchmark snapshot

Command:

```bash
python ml/experiments/photo_strategy_benchmark.py
```

Synthetic dataset: 800 photos. Timings vary by machine and run; use them as
orders of magnitude, not fixed performance numbers.

| Approach | Elapsed ms | Groups | Largest group |
| --- | ---: | ---: | ---: |
| Metadata facets | ~1 | 76 | 23 |
| Text caption clustering | ~430 | 280 | 32 |
| Embedding kNN graph | ~3000 | 566 | 26 |
| Hybrid similarity graph | ~400 | 13 | 80 |

Interpretation:

- Metadata is the cheapest and should remain the first filtering layer.
- Text clustering can fragment the collection and depends on caption quality.
- Exact embedding kNN is slow in pure Python, but this is exactly what Qdrant
  optimizes in production.
- The hybrid graph gives product-friendly groups by combining simple signals.

## Why graph-based grouping is attractive

A graph lets the product connect photos through multiple simple signals:

- visual similarity,
- same detected person,
- same shooting,
- close timestamp,
- same location or tag,
- user actions such as favorites or selections.

The graph does not need to replace vector search. It sits on top of it and
supports flows such as "show similar", "continue this moment", "group this
sequence", "select alternatives" and "build a client delivery set".

## Production recommendation

For this project, the most maintainable MVP is:

- PostgreSQL for libraries, shootings, photos and metadata.
- Object storage for files.
- Qdrant for one image embedding vector.
- Optional text vector later for text-to-image search.
- A graph table or adjacency cache for photo relationships.
- Captioning as async enrichment, not a request-time dependency.

This keeps infrastructure understandable while leaving room for advanced AI
features later.
