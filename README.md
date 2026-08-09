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

Le frontend, les benchmarks ML et le premier pipeline backend local sont
fonctionnels. L'API persiste les imports dans PostgreSQL, publie les jobs dans
Redis, indexe les images avec un worker TinyCLIP local et recherche dans
PostgreSQL/Qdrant. Les pages de recherche texte et image utilisent ces contrats
reels ; elles n'affichent plus les anciens resultats aleatoires.

Approches actuellement validees :

- recherche texte -> image avec index lexical PostgreSQL + TinyCLIP + RRF ;
- recherche image -> image avec TinyCLIP et Qdrant ;
- reranking des prompts complexes avec contraintes positives et negatives ;
- clustering par buckets de metadonnees et graphe mutual-kNN ;
- assignation d'une categorie a chaque image, y compris les singletons.

La recherche et l'ingestion sont reliees au backend. Le clustering graphe, le
filtre facial et le reranking de contraintes restent valides dans les
notebooks/benchmarks mais ne sont pas encore exposes par l'API produit. Les
ecrans correspondants restent donc experimentaux.

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
            -> TinyCLIP (candidat leger)
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

En mode developpement, le proxy Vite transmet les appels vers l'API Docker
publiee sur `http://127.0.0.1:8002`. Pour desactiver les donnees de demonstration :

```powershell
$env:VITE_USE_MOCK = "false"
$env:VITE_DEV_API_TARGET = "http://127.0.0.1:8002"
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

Le premier provisionnement telecharge explicitement le modele depuis sa
revision figee. Apres cette etape, l'inference et les builds Docker sont hors
ligne :

```powershell
Copy-Item .env.example .env
.\scripts\setup_ml_env.ps1
& 'c:\Users\choun\miniconda3\envs\env\python.exe' scripts\provision_embedding_model.py --accept-license
.\scripts\prepare_backend_wheels.ps1
.\scripts\prepare_embedding_wheels.ps1
.\scripts\build_frontend_production.ps1
docker compose --profile ml config
docker compose --profile ml up --build
```

Services :

- frontend Docker : `http://127.0.0.1:5174` ;
- frontend Vite developpement : `http://127.0.0.1:5173` ;
- API : `http://127.0.0.1:8002` ;
- documentation API : `http://127.0.0.1:8002/docs` ;
- tableau de bord Qdrant : `http://127.0.0.1:6335/dashboard` ;
- console MinIO : `http://127.0.0.1:19001`.

Les interfaces Qdrant et MinIO sont liees uniquement a `127.0.0.1` pour
l'inspection locale. Leurs identifiants sont declares dans `.env`
(`QDRANT_API_KEY`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`). PostgreSQL, Redis,
le worker et le service d'embedding restent sur le reseau Docker prive.

Qdrant ne contient pas les fichiers image : la collection
`photos_tinyclip_v1` contient les vecteurs et leurs metadonnees. Les fichiers
sont actuellement conserves dans le volume Docker `photo_storage` et servis par
l'API sous `/media`. MinIO est provisionne pour la future migration vers le
stockage objet, mais aucun bucket applicatif n'est encore utilise.

Pour inspecter les donnees :

- `GET /api/v1/photos` liste le catalogue et les URLs des images ;
- `GET /api/v1/index/status` compare les statuts du catalogue ;
- le tableau de bord Qdrant affiche les points de `photos_tinyclip_v1` ;
- la bibliotheque du frontend affiche les fichiers via le proxy `/media`.

Une photo n'est recherchable que lorsque son statut est `INDEXED`.

Test d'integration reel, avec nettoyage automatique :

```powershell
docker compose --profile ml run --rm --no-deps `
  -e PHOTO_AI_SMOKE_WITH_WORKER=true `
  -e PHOTO_AI_EMBEDDING_SERVICE_ENABLED=true `
  -e PHOTO_AI_VECTOR_SEARCH_ENABLED=true `
  -e PHOTO_AI_TEXT_VECTOR_SCORE_THRESHOLD=0 `
  api python smoke_stack.py
```

La commande verifie l'import, le job Redis/PostgreSQL, l'embedding local,
Qdrant, la fusion RRF, un prompt long et la recherche image -> image.

L'etat reel de l'index est disponible sur `GET /api/v1/index/status`.

Pour enrichir uniquement le benchmark COCO avec les captions BLIP deja
versionnees dans le projet :

```powershell
python scripts\backfill_benchmark_captions.py --api-base http://127.0.0.1:8002
```

Cet import sert aux tests. En production, les captions et tags doivent provenir
d'un modele local approuve ou de metadonnees metier.

Le VLM est optionnel et ne demarre jamais automatiquement :

```powershell
& 'c:\Users\choun\miniconda3\envs\env\python.exe' `
  scripts\provision_embedding_model.py `
  --model-id smolvlm-500m-instruct-gguf `
  --accept-license

# Dans .env : VLM_ENABLED=true
docker compose --profile ml --profile vlm up -d --build
```

Le provisionnement recupere la revision figee de SmolVLM-500M Q8 et son
projecteur, puis verifie leurs SHA-256. Les deux fichiers occupent environ
546 Mo. Ils restent dans `models/smolvlm/`, hors de Git. Quand le VLM
est active, l'API lui transmet en base64 tous les survivants RRF, par lots
configurables. Le serveur rejette les images seulement proches qui ne
satisfont pas directement la requete ; le nombre final reste variable. En cas
d'indisponibilite, l'API applique le filtre textuel de secours et indique
`diagnostics.vlm_rerank.mode=failed_open`.

La requete et le frontend laissent le VLM desactive par defaut. Sur le Ryzen 5
de developpement, un candidat prend environ 9 secondes et deux candidats 17 a
18 secondes avec le profil 384 tokens. Qwen2.5-VL 3B reste une reference
asynchrone, mais ses 150 secondes pour deux images excluent le parcours
interactif CPU. Une seconde requete simultanee revient rapidement en mode
`busy` avec le filtre textuel de secours.

Dans la recherche texte, l'utilisateur peut afficher tous les resultats
valides ou fixer un plafond de 10, 20 ou 50, et activer/desactiver le VLM. Le
frontend affiche le mode reellement applique, le nombre de candidats verifies
et la latence totale.

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
python scripts\provision_embedding_model.py --verify-only
python scripts\verify_model_registry.py --strict
```

Le mode `--strict` est destine a la release et echoue tant que les roles
obligatoires ne disposent pas d'un modele explicitement approuve. TinyCLIP
reste un candidat jusqu'a validation de licence et benchmark produit.

## Documentation

- [Architecture fonctionnelle et modeles](docs/architecture-fonctionnelle.md)
- [Architecture produit](docs/product-search-architecture.md)
- [Plan de mise en production](docs/production-local-first.md)
- [Plan de recherche](docs/retrieval-production-plan.md)
- [Evaluation du RAG multimodal](docs/evaluation-multimodal-rag.md)
- [Benchmark des VLM locaux](docs/vlm-local-benchmark.md)
- [Gestion des erreurs et incidents](docs/gestion-erreurs-incidents.md)
- [Organisation des notebooks](notebooks/README.md)
- [Couche ML](ml/README.md)

## Licence

La licence du projet doit encore etre choisie. Les licences du code et des
poids de chaque modele sont suivies separement dans
`ml/model_registry.json`. Les poids InsightFace fournis publiquement ne sont
pas approuves pour une production commerciale.
