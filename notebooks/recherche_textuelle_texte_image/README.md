# Recherche textuelle: texte -> image

Goal: retrieve images from a text query using open source models.

## Notebooks

- `01_recherche_textuelle_rrf_llm_from_original.ipynb`: split from the original
  text-search and clustering notebook. It contains the heavier POC with BLIP,
  OpenCLIP, BM25, RRF and LLM judge.
- `02_benchmark_texte_image_open_source.ipynb`: lightweight benchmark comparing
  simpler retrieval strategies.
- `03_evaluation_rag_multimodal.ipynb`: product evaluation with human qrels,
  staged recall, variable-output metrics and judge calibration.

## Recommendation

For production, start with:

1. CLIP/SigLIP text embedding.
2. Qdrant vector search.
3. Metadata filters from the frontend.
4. Optional caption/BM25 with RRF only when captions are already generated.
5. Local VLM judge over every RRF survivor, processed in bounded batches.

RRF + a local VLM judge keeps recall and pixel-level verification separate.
The judge adds latency and must be calibrated, but its batch size must never be
confused with a fixed number of final results.
