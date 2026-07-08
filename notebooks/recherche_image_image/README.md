# Recherche image: image -> image

Goal: retrieve visually or semantically similar images from one or more
reference images.

## Notebooks

- `01_filter_by_image_insightface_qdrant.ipynb`: cleaned copy of the existing
  image filtering implementation using InsightFace, FAISS and Qdrant.
- `02_benchmark_image_image_strategies.ipynb`: lightweight benchmark comparing
  embedding-only retrieval, metadata prefiltering, person/context hybrid scoring
  and graph expansion.

## Recommendation

Keep image embeddings + Qdrant as the core. Improve precision with:

- shooting/library filters,
- detected people/faces when available,
- optional graph edges for "similar moment" navigation.

For open source models:

- faces/people: InsightFace,
- general visual similarity: OpenCLIP, SigLIP or DINOv2,
- vector storage: Qdrant.
