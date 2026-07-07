# Project Handoff

This document is for a new contributor taking over Photo AI Platform.

## What exists today

- A cleaned React/Vite frontend in `frontend/`.
- Research notebooks in `notebooks/`.
- A lightweight ML benchmark in `ml/experiments/`.
- Architecture notes in `docs/`.

## What not to delete

- Existing notebooks, especially:
  - `Recherche_textuelle-Clustering.ipynb`
  - `test.ipynb`
  - `filter_by_image (1).ipynb`
- The generated datasets and caches may be ignored by Git, but they can still be
  useful locally.

## Preferred technical direction

Avoid making caption-based clustering the first production dependency. It is
powerful but operationally heavy.

Use this order instead:

1. metadata filters,
2. image embeddings,
3. vector search,
4. similarity graph,
5. optional captions and local LLM enrichment.

## Frontend conventions

- Routes are declared in `frontend/src/App.jsx`.
- Page components live in `frontend/src/pages/`.
- Shared UI components live in `frontend/src/ui/`.
- Shared hooks live in `frontend/src/hooks/`.
- API mocks and mock datasets live in `frontend/src/api/mockData.js`.

## ML conventions

- Keep large experimental notebooks, but avoid committing heavy outputs.
- Put reproducible, dependency-light experiments in `ml/experiments/`.
- Keep production candidates documented in `docs/approach-comparison.md`.

## Verification commands

```bash
cd frontend
npm.cmd run lint
npm.cmd run build
```

```bash
python ml/experiments/photo_strategy_benchmark.py
```

## Suggested next pull request

Implement backend contracts without adding heavy ML dependencies:

- `POST /libraries`
- `GET /libraries`
- `POST /shootings`
- `POST /photos/upload`
- `GET /photos/search`
- `POST /jobs/embed`
- `POST /jobs/refresh-graph`

The first backend version can return mock data while the database schema is
stabilized.
