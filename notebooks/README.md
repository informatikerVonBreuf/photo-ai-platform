# Notebooks

Les notebooks sont organises par capacite produit.

```text
notebooks/
  recherche_image_image/
  recherche_textuelle_texte_image/
  clustering_images/
```

## Recherche image -> image

Notebook de reference:

```text
notebooks/recherche_image_image/01_filter_by_image_insightface_qdrant.ipynb
```

Ce notebook est conserve car il implemente un filtre par image base sur les
visages avec InsightFace, FAISS et Qdrant. Il est particulierement important
pour le produit: retrouver les photos ou une personne apparait.

Notebook de benchmark/production:

```text
notebooks/recherche_image_image/02_benchmark_image_image_strategies.ipynb
```

Le notebook `02` lit le rapport du runner actuel et compare la similarite
visuelle generale avec l'hybride image+caption.

## Recherche texte -> image

Notebook de recherche:

```text
notebooks/recherche_textuelle_texte_image/01_recherche_textuelle_rrf_llm_from_original.ipynb
```

Notebook de benchmark/production:

```text
notebooks/recherche_textuelle_texte_image/02_benchmark_texte_image_open_source.ipynb
```

Notebook d'evaluation produit:

```text
notebooks/recherche_textuelle_texte_image/03_evaluation_rag_multimodal.ipynb
```

Le notebook `02` execute le runner actuel `ml/experiments/artifact_benchmark.py`
et compare les canaux BM25, OpenCLIP, RRF, linear fusion et deux-stage rerank.
Le notebook `03` calcule les metriques par etape a partir de qrels humains et
visualise la perte de rappel entre RRF, juge et sortie finale.

## Clustering

Notebook de recherche:

```text
notebooks/clustering_images/01_clustering_thematique_from_original.ipynb
```

Notebook de benchmark/production:

```text
notebooks/clustering_images/02_benchmark_clustering_metadata_graph.ipynb
```

Le notebook `02` utilise le clustering graphe du runner actuel:

```text
metadata/category buckets
-> mutual kNN
-> visual/token consistency
-> connected components
```

## Regle importante

Les notebooks de recherche restent disponibles. Les notebooks `02` servent de
pont vers une implementation production plus maintenable.
