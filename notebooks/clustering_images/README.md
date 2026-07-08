# Clustering des images

Goal: group unordered images into useful product clusters.

## Notebooks

- `01_clustering_thematique_from_original.ipynb`: split from the original heavy
  notebook. It keeps the HDBSCAN/UMAP/refinement clustering path.
- `02_benchmark_clustering_metadata_graph.ipynb`: lightweight benchmark comparing
  metadata grouping and graph-based grouping.

## Recommendation

Use two layers:

1. Metadata-first grouping aligned with the frontend filters:
   library, shooting, date, tags, orientation and dimensions.
2. Intelligent grouping for unordered images:
   image embeddings + time proximity + people/faces + optional tags.

Keep HDBSCAN/UMAP as an offline research/batch option. For maintainable product
UX, graph groups are easier to debug and adjust.
