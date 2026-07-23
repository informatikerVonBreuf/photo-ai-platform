# Infrastructure

La stack locale est definie dans `compose.yaml` a la racine.

## Regles

- utiliser uniquement des volumes Docker nommes pour PostgreSQL et Qdrant sous
  Docker Desktop/Windows ;
- ne pas placer les donnees Qdrant dans un dossier OneDrive monte ;
- ne jamais exposer PostgreSQL, Redis, Qdrant, MinIO ou llama.cpp sur
  `0.0.0.0` sans authentification, pare-feu et reverse proxy ;
- remplacer tous les secrets de `.env.example` ;
- tester les sauvegardes et restaurations avant une release.

## VLM

Le service `llama` appartient au profil Compose `vlm`. Il ne peut demarrer que
si les fichiers declares existent dans `models/qwen-vl/`.

```powershell
$env:VLM_ENABLED = "true"
docker compose --profile vlm up --build
```

Le serveur n'a aucun port publie sur l'hote. Seule l'API peut le joindre sur le
reseau Docker prive.
