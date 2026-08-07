# Infrastructure

La stack locale est definie dans `compose.yaml` a la racine.

## Profils

```text
sans profil : frontend, API et services de donnees
ml          : service TinyCLIP local + worker d'indexation
vlm         : llama.cpp/Qwen VLM optionnel
```

Le profil `ml` ne telecharge jamais de poids au demarrage. Le repertoire
`models/tinyclip/` est monte en lecture seule.

```powershell
& 'c:\Users\choun\miniconda3\envs\env\python.exe' `
  scripts\provision_embedding_model.py --verify-only
$env:EMBEDDING_SERVICE_ENABLED = "true"
docker compose --profile ml up --build
```

## Regles

- utiliser uniquement des volumes Docker nommes pour PostgreSQL et Qdrant sous
  Docker Desktop/Windows ;
- ne pas placer les donnees Qdrant dans un dossier OneDrive monte ;
- ne jamais exposer PostgreSQL, Redis, Qdrant, MinIO ou llama.cpp sur
  `0.0.0.0` sans authentification, pare-feu et reverse proxy ;
- remplacer tous les secrets de `.env.example` ;
- tester les sauvegardes et restaurations avant une release.

`frontend` et `api` utilisent `app_edge` pour publier leurs ports sur
`127.0.0.1`, ainsi que `app_private` pour dialoguer entre eux. Tous les services
de donnees et de modele utilisent seulement `app_private`, qui est un reseau
Docker interne sans route de sortie. Les declarations de ports d'infrastructure
sont reservees aux environnements ou un override ajoute explicitement un reseau
de diagnostic.

## Verification

```powershell
docker compose --profile ml config
docker compose --profile ml ps
docker compose --profile ml logs worker embedding
```

Le smoke test documente dans le README racine cree ses propres donnees, attend
le worker et nettoie PostgreSQL, Redis, Qdrant et le fichier importe.

## VLM

Le service `llama` appartient au profil Compose `vlm`. Il ne peut demarrer que
si les fichiers declares existent dans `models/qwen-vl/`.

```powershell
$env:VLM_ENABLED = "true"
docker compose --profile vlm up --build
```

Le serveur n'a aucun port publie sur l'hote. Seule l'API peut le joindre sur le
reseau Docker prive.
