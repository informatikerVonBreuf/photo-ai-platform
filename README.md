# Photo AI Platform

Plateforme pour entreprises de photographie :
- Upload & gestion d’albums
- Recherche multimodale (texte ↔ image)
- Regroupement personnes (option événementiel)
- Scènes & moments
- Livraison client (galeries privées)
- Assistant intelligent (onboarding & commandes)

## Architecture (high level)
Frontend → Backend API → (PostgreSQL, Vector DB, Object Storage, Model Server)

## Quickstart (dev)
À venir : docker-compose + scripts de démarrage.

<<<<<<< Updated upstream
## Datasets
- COCO, Flickr30k, WIDER FACE, Places365 (liens dans /docs)
=======
Core workflows:

- create libraries and shootings,
- search photos by text or reference image,
- filter photos by metadata and tags,
- explore similarity groups,
- interact with an assistant layer,
- prepare a future backend around storage, vectors and async jobs.

## Current Repository Structure

```text
photo-ai-platform/
  frontend/                 React + Vite application
  notebooks/                Research and experiment notebooks
  ml/
    experiments/            Lightweight reproducible ML benchmarks
  docs/                     Architecture and decision documents
  README.md                 Project overview
  CONTRIBUTING.md           Contribution rules
```

The `backend`, `infra` and deeper `ml` production modules are intentionally
still open. The recommended next step is to add them only when the data model
and runtime strategy are stable.

## Recommended AI Strategy

The original research notebooks explore a heavy pipeline:

- BLIP captions,
- OpenCLIP embeddings,
- BM25 over captions,
- Qdrant named vectors,
- UMAP/HDBSCAN clustering,
- optional local LLM enrichment.

This remains useful for research, but it is expensive to maintain as the first
production path.

Recommended production-first approach:

1. Store images and metadata.
2. Compute one image embedding per photo.
3. Store vectors in Qdrant.
4. Search with vector similarity plus metadata filters.
5. Build a lightweight graph from visual neighbors, time, shooting and people.
6. Run captioning only as an asynchronous enrichment when needed.

See [docs/approach-comparison.md](docs/approach-comparison.md).

## Frontend Quickstart

```bash
cd frontend
npm ci
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Build:

```bash
cd frontend
npm run lint
npm run build
```

Note for Windows PowerShell: if `npm` is blocked by execution policy, use
`npm.cmd`.

## ML Experiments

Run the lightweight strategy benchmark:

```bash
python ml/experiments/photo_strategy_benchmark.py
python ml/experiments/retrieval_strategy_benchmark.py
```

Related notebooks:

- `notebooks/recherche_textuelle_texte_image/`
- `notebooks/recherche_image_image/`
- `notebooks/clustering_images/`

Existing notebooks are kept for historical research:

- `notebooks/Recherche_textuelle-Clustering.ipynb`
- `notebooks/test.ipynb`
- `notebooks/filter_by_image (1).ipynb`

## Recommended Backend Shape

Suggested services:

- API: FastAPI or similar Python backend.
- Database: PostgreSQL for libraries, shootings, photos and metadata.
- Vector database: Qdrant for image embeddings.
- Object storage: local filesystem in dev, S3-compatible storage in prod.
- Jobs: worker queue for embeddings, graph refresh and optional captions.

Suggested tables:

- `libraries`
- `shootings`
- `photos`
- `photo_metadata`
- `photo_edges`
- `jobs`

## Development Hygiene

- Keep notebooks versionable, but do not commit generated caches, datasets or
  model weights.
- Keep heavy model outputs in ignored folders such as `notebooks/cache/`,
  `notebooks/outputs/`, `ml/runs/` or `ml/artifacts/`.
- Prefer small reproducible scripts in `ml/experiments/` when comparing
  approaches.
- Move repeated frontend logic into hooks or shared UI components.

## Current Status

Validated locally:

- `npm.cmd run lint`
- `npm.cmd run build`
- `python ml/experiments/photo_strategy_benchmark.py`

Known warning:

- The frontend bundle is large because the app includes 3D and AI-oriented
  dependencies. Code splitting can be added later.

## Next Milestones

1. Define backend data model and API contracts.
2. Implement photo upload and metadata extraction.
3. Add Qdrant indexing for image embeddings.
4. Add graph edge generation as an async job.
5. Connect frontend search pages to real endpoints.
6. Add captioning as an offline enrichment job.
>>>>>>> Stashed changes

## License
TBD
