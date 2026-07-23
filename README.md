# Photo AI Platform

Plateforme locale de gestion, de recherche et de regroupement de photographies.
Le produit vise les photographes et les equipes qui doivent conserver le
controle de leurs images, de leurs index et de leurs modeles.

## Capacites

- import et organisation de bibliotheques et de shootings ;
- recherche texte -> image avec fusion lexicale et visuelle ;
- recherche image -> image et filtre par personne ;
- regroupement par metadonnees et graphe de similarite ;
- enrichissement optionnel par modele vision-langage local ;
- visualisation et validation des resultats dans le frontend.

## Etat du projet

Le frontend et les benchmarks ML sont fonctionnels. La fondation backend et
l'infrastructure locale sont en cours d'integration.

Approches actuellement validees :

- recherche hybride BM25 + OpenCLIP + RRF ;
- reranking des prompts complexes avec contraintes positives et negatives ;
- similarite image -> image ;
- clustering par buckets de metadonnees et graphe mutual-kNN ;
- assignation d'une categorie a chaque image, y compris les singletons.

Les notebooks de recherche historiques sont conserves. Les notebooks `02` et
`ml/experiments/artifact_benchmark.py` servent de reference reproductible.

## Architecture cible

```text
Frontend React
    -> API FastAPI
        -> PostgreSQL : metadonnees et jobs
        -> Qdrant : vecteurs de recherche
        -> stockage local/MinIO : images
        -> Redis : file de traitements
        -> workers ML locaux
            -> OpenCLIP/SigLIP2
            -> VLM local optionnel
```

Les modeles ne sont pas appeles via une API externe. Les poids sont stockes
hors Git, verifies par checksum et charges depuis un chemin local.

## Structure

```text
backend/                  API FastAPI
frontend/                 application React + Vite
infra/                    configuration d'infrastructure
ml/                       benchmarks et registre de modeles
notebooks/                recherche organisee par capacite
docs/                     architecture et decisions
scripts/                  installation et audits
compose.yaml              stack locale privee
```

## Demarrage du frontend

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Le frontend est disponible sur `http://127.0.0.1:5173`.

Par defaut il utilise les donnees de demonstration. Pour appeler le backend :

```powershell
$env:VITE_USE_MOCK = "false"
$env:VITE_API_BASE = "http://127.0.0.1:8000"
npm.cmd run dev
```

## Environnement ML

```powershell
.\scripts\setup_ml_env.ps1
conda activate env
python ml\experiments\artifact_benchmark.py --top-k 10 --text-batch-size 8
```

Dans Jupyter, selectionner le kernel `Python (photo-ai-platform)`.

Les rapports sont generes dans `reports/algorithm_tests/latest/` et ne sont pas
versionnes.

## Stack locale

Creer la configuration locale :

```powershell
Copy-Item .env.example .env
.\scripts\prepare_backend_wheels.ps1
.\scripts\build_frontend_production.ps1
docker compose config
docker compose up --build
```

Services :

- frontend : `http://127.0.0.1:5173` ;
- API : `http://127.0.0.1:8000` ;
- documentation API : `http://127.0.0.1:8000/docs` ;
- Qdrant : `http://127.0.0.1:6333` ;
- console MinIO : `http://127.0.0.1:9001`.

Le VLM est optionnel et ne demarre jamais automatiquement :

```powershell
docker compose --profile vlm up --build
```

Avant cette commande, les poids GGUF et le projecteur multimodal doivent etre
places dans `models/qwen-vl/` et declares dans `ml/model_registry.json`.

## Confidentialite

La production doit respecter les regles suivantes :

- aucune image ni aucun prompt envoye vers un fournisseur externe ;
- services de donnees non exposes publiquement ;
- modeles charges uniquement depuis des fichiers locaux ;
- telemetrie des bibliotheques desactivee ;
- journaux sans contenu d'image ni donnees biometriques ;
- sauvegardes chiffrees de PostgreSQL, Qdrant et du stockage objet.

Verifier le registre :

```powershell
python scripts\verify_model_registry.py
python scripts\verify_model_registry.py --strict
```

Le mode `--strict` est destine a la release et echoue tant que les roles
obligatoires ne disposent pas de poids locaux verifies.

## Documentation

- [Architecture produit](docs/product-search-architecture.md)
- [Plan de mise en production](docs/production-local-first.md)
- [Plan de recherche](docs/retrieval-production-plan.md)
- [Organisation des notebooks](notebooks/README.md)
- [Couche ML](ml/README.md)

## Licence

La licence du projet doit encore etre choisie. Les licences du code et des
poids de chaque modele sont suivies separement dans
`ml/model_registry.json`. Les poids InsightFace fournis publiquement ne sont
pas approuves pour une production commerciale.
