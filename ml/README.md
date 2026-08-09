# ML Layer

Ce dossier contient le code qui transforme les notebooks en composants testables.

## Structure

```text
ml/
  evaluation/
    retrieval_metrics.py
  experiments/
    artifact_benchmark.py
  services/
    embedding_service.py
  Dockerfile.embedding
  model_registry.json
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

## Service d'embedding local

Le runtime produit charge actuellement le candidat
`TinyCLIP-ViT-8M-16-Text-3M-YFCC15M` avec Transformers. Les poids sont montes
depuis `models/tinyclip/`; `local_files_only=True` et les variables offline
interdisent un telechargement implicite.

```powershell
python scripts\provision_embedding_model.py --verify-only
.\scripts\prepare_embedding_wheels.ps1
docker compose --profile ml build embedding
```

Endpoints internes :

```text
GET  /health/model?load=true
POST /embed/text
POST /embed/image
```

TinyCLIP est leger et operationnel, mais reste `candidate` dans le registre.
Le mode `--strict` doit continuer a echouer tant que le benchmark de pertinence
et la validation de licence du projet ne l'ont pas approuve.

## Decision de recherche

Pour la production, ne pas utiliser une recherche vector-only.

Approche recommandee:

```text
metadata filters
+ lexical captions/tags/filenames
+ TinyCLIP text->image
+ RRF fusion
+ dense prompt constraint rerank
+ contrastive negative rerank
+ optional local VLM verification of all RRF survivors, in bounded batches
```

Le pipeline API implemente le rappel hybride, la fusion, le filtre textuel de
secours et le juge VLM local optionnel. Les contraintes experimentales restent
dans le benchmark avant une integration guidee par les qrels humains.

Evaluation reproductible :

```powershell
python scripts\evaluate_retrieval.py `
  --qrels ml\evaluation\examples\qrels.example.json `
  --run ml\evaluation\examples\run.example.json
```

Pour le clustering:

```text
metadata/category buckets
+ mutual kNN visual graph
+ token consistency
+ connected components
```
