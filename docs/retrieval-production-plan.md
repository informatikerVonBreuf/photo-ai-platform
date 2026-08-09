# Retrieval Production Plan

## Goal

Build local-first, controllable search for:

- text -> image,
- image -> image,
- image clustering.

All inference models should run locally. External APIs should not be required
for the production path.

## What Was Tested

Benchmark runner:

```bash
python ml/experiments/artifact_benchmark.py --top-k 10 --text-batch-size 8
```

Dataset:

- 5000 aligned images/captions/embeddings.
- `OpenCLIP ViT-L-14/openai` for local text query encoding.
- cached image embeddings and caption embeddings from the notebooks.

Text -> image methods tested:

- BM25 over captions.
- TF-IDF over captions.
- OpenCLIP text -> image vectors.
- OpenCLIP text -> caption vectors.
- caption-seed dense expansion without embedding averaging.
- weighted fusion.
- RRF fusion.
- two-stage BM25 recall -> dense rerank.
- two-stage dense recall -> BM25 rerank.
- separated/interleaved channels.
- dense prompt constraint reranking.
- hard negative filtering for explicit exclusions.

## Latest Full-Dataset Results

Top methods on the local automatic caption-derived metric:

```text
caption_bm25: 0.92
linear_openclip_bm25: 0.92
linear_openclip_caption_bm25: 0.92
linear_bm25_image: 0.9175
linear_all_channels: 0.9175
rrf_all_channels: 0.91
two_stage_bm25_recall_openclip_rerank: 0.91
two_stage_openclip_recall_bm25_rerank: 0.905
openclip_text_to_caption: 0.7825
openclip_text_to_image: 0.66
```

Important caveat: the metric is caption-derived, so it favors caption lexical
matching. Visual contact sheets in `reports/algorithm_tests/latest/` were also
generated and should be reviewed before finalizing relevance decisions.

Clustering latest run:

```text
groups: 4542
non_singleton_groups: 145
largest_group: 40
singleton_ratio: 0.9681
avg_non_singleton_coherence: 0.8967
```

This is still conservative, but more product-friendly than pure global visual
clustering because it now builds graph edges inside metadata/category buckets.

Dense text prompt latest run:

```text
raw_hybrid:
  constraint_precision_at_k: 0.8857
  false_positive_rate_at_k: 0.0714
constraint_aware_rerank:
  constraint_precision_at_k: 0.9857
  false_positive_rate_at_k: 0.0
hard_negative_filter:
  constraint_precision_at_k: 0.9857
  false_positive_rate_at_k: 0.0
rrf_constraint_aware:
  constraint_precision_at_k: 1.0
  false_positive_rate_at_k: 0.0
contrastive_negative_rerank:
  constraint_precision_at_k: 0.9714
  false_positive_rate_at_k: 0.0
```

For dense prompts, vector similarity is not enough. The production path should
extract positive constraints and explicit negative constraints, then rerank or
filter candidates before returning results.

## Recommendation

Do not choose vector-only search.

Use a hybrid strategy with separate channels and late fusion:

1. Metadata filters first:
   library, shooting, date, tags, orientation, dimensions, user-selected facets.
2. Sparse lexical recall:
   BM25 over captions, tags and user metadata.
3. Dense multimodal recall:
   OpenCLIP/SigLIP text embedding searched against image embeddings.
4. Dense caption recall:
   OpenCLIP/SigLIP text embedding searched against caption embeddings.
5. Fusion:
   RRF first because it is robust across score scales.
6. Optional verification:
   local VLM over all RRF survivors in bounded batches, never as the first
   recall layer.

Production default:

```text
metadata filters
+ BM25 captions/tags
+ OpenCLIP text->image
+ OpenCLIP text->caption
+ RRF
+ constraint-aware rerank for dense prompts
+ hard negative filter for explicit "no/without/sans" clauses
+ optional local VLM verification with variable output size
```

Keep weighted linear fusion as an experiment, but prefer RRF for the first
production implementation because it avoids score calibration problems.

## Dense Prompts

Dense prompts need a separate guardrail:

```text
user prompt
-> detect positive constraints
-> detect negative constraints
-> retrieve broad candidates
-> penalize or remove negatives
-> optional OpenCLIP contrastive negative rerank
-> rerank by positive coverage + hybrid score
```

The local LLM judge is still useful, but it should be optional and limited to
the last 20-50 candidates. The first production guardrail should be deterministic
because it is cheaper, easier to test and easier to explain.

## Image -> Image

Use two complementary paths:

- general visual similarity with image embeddings,
- face/person identity filtering with InsightFace from
  `notebooks/recherche_image_image/01_filter_by_image_insightface_qdrant.ipynb`.

The InsightFace notebook should be kept as the person-reference filter because
it solves a precise product use case better than a global CLIP embedding:
"find the photos where this person appears".

## Clustering

Production clustering should be layered:

1. Metadata grouping first.
2. Then graph-based grouping inside each metadata bucket.
3. Add face/person edges and time proximity edges.
4. Keep UMAP/HDBSCAN offline for research and batch analysis.
5. Keep graph connected components as the first production default.

## Product Docs

Architecture detail:

- `docs/product-search-architecture.md`
- `docs/image-to-image-filter-notebook-explained.md`

## Sources Checked

- CLIP paper: https://arxiv.org/abs/2103.00020
- SigLIP paper: https://arxiv.org/abs/2303.15343
- Qdrant hybrid queries: https://qdrant.tech/documentation/search/hybrid-queries/
- OpenCLIP: https://github.com/mlfoundations/open_clip
- clip-retrieval: https://github.com/rom1504/clip-retrieval
