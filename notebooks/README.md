# Notebooks

This folder separates research work by product capability.

## Structure

- `recherche_textuelle_texte_image/`: text query to image retrieval.
- `recherche_image_image/`: reference image to similar image retrieval.
- `clustering_images/`: photo grouping, clustering and graph experiments.

## Historical notebooks kept intact

- `Recherche_textuelle-Clustering.ipynb`
- `test.ipynb`
- `filter_by_image (1).ipynb`

These are kept as research history. The split notebooks in the subfolders are
cleaner, output-free versions intended for maintenance and comparison.

## Rules

- Keep notebooks small when possible.
- Do not commit generated datasets, model weights, caches or outputs.
- Put reusable logic in `ml/experiments/` before copying code into multiple notebooks.
