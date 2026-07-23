# ML Layer

Ce dossier contient le code qui transforme les notebooks en composants testables.

## Structure

```text
ml/
  experiments/
    artifact_benchmark.py
```

`artifact_benchmark.py` est le runner principal pour comparer les approches:

- texte -> image,
- image -> image,
- clustering graphe.

Il utilise les artefacts locaux deja produits par les notebooks:

```text
notebooks/data/artifacts/captions_blip.json
notebooks/data/artifacts/emb_img.npy
notebooks/data/artifacts/emb_cap.npy
notebooks/data/images/val2017/
```

## Lancer le benchmark

Installer/preparer l'environnement ML:

```powershell
.\scripts\setup_ml_env.ps1
```

Dans Jupyter, choisir le kernel:

```text
Python (photo-ai-platform)
```

Puis lancer:

```bash
python ml/experiments/artifact_benchmark.py --top-k 10 --text-batch-size 8
```

Les rapports sont generes dans:

```text
reports/algorithm_tests/latest/
```

Ce dossier est ignore par Git.

## Decision actuelle

Pour la production, ne pas utiliser une recherche vector-only.

Approche recommandee:

```text
metadata filters
+ BM25 captions/tags
+ OpenCLIP text->image
+ OpenCLIP text->caption
+ RRF fusion
+ dense prompt constraint rerank
+ OpenCLIP contrastive negative rerank
+ optional local reranker top-N
```

Pour le clustering:

```text
metadata/category buckets
+ mutual kNN visual graph
+ token consistency
+ connected components
```
