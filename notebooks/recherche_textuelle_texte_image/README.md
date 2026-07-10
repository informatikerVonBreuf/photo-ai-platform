# Recherche textuelle: texte -> image

Goal: retrieve images from a text query using open source models.

## Notebooks

- `01_recherche_textuelle_rrf_llm_from_original.ipynb`: split from the original
  text-search and clustering notebook. It contains the heavier POC with BLIP,
  OpenCLIP, BM25, RRF and LLM judge.
- `02_benchmark_texte_image_open_source.ipynb`: lightweight benchmark comparing
  simpler retrieval strategies.

## Recommendation

For production, start with:

1. CLIP/SigLIP text embedding.
2. Qdrant vector search.
3. Metadata filters from the frontend.
4. Optional caption/BM25 with RRF only when captions are already generated.
5. LLM judge only as top-N reranker or evaluator.

RRF + LLM judge is a good research setup, but it should not be the first recall
layer in production. It adds latency, tuning and operational complexity.
