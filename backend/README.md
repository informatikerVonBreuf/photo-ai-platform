# Backend

API FastAPI locale de Photo AI Platform.

## Demarrage local

Depuis la racine du depot :

```powershell
& 'c:\Users\choun\miniconda3\envs\env\python.exe' -m pip install -r backend\requirements-dev.txt
& 'c:\Users\choun\miniconda3\envs\env\python.exe' -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Endpoints initiaux :

- `GET /health/live`
- `GET /health/ready`
- `GET /api/v1/system/privacy`
- `GET /api/v1/system/models`
- `POST /upload`
- `POST /api/v1/photos/upload`
- `GET /media/{filename}`

L'upload verifie le type declare, le contenu de l'image, la taille et le hash.
Il stocke les fichiers sous leur SHA-256 afin de dedupliquer sans appeler un
service externe.

## Tests

```powershell
& 'c:\Users\choun\miniconda3\envs\env\python.exe' -m pytest backend\tests
```

## Image Docker hors ligne

L'image API n'accede pas a PyPI pendant sa construction. Preparer d'abord les
wheels Linux depuis la racine :

```powershell
.\scripts\prepare_backend_wheels.ps1
docker compose build api
```

Le dossier `backend/wheels/` est ignore par Git.

## Limites du premier jalon

- Les metadonnees d'upload ne sont pas encore persistees dans PostgreSQL.
- La file Redis et les workers ML ne sont pas encore implementes.
- Les endpoints de recherche et de clustering ne sont pas encore relies aux
  index Qdrant.
- Le frontend continue donc a utiliser son mode mock pour ces fonctions.
