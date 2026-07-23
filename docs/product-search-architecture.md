# Product Search Architecture

Ce document decrit l'architecture cible pour transformer les notebooks en produit maintenable, local-first et scalable.

## Objectif produit

L'application doit couvrir trois besoins:

- rechercher des images par texte,
- rechercher des images par image,
- regrouper automatiquement des images.

La contrainte importante est le controle local des modeles. Le chemin production ne doit pas dependre d'une API externe.

## Architecture globale

```text
Frontend
  -> API search service
      -> metadata store
      -> vector store
      -> lexical index
      -> model service local
      -> object storage
  -> API clustering service
      -> graph builder
      -> cluster registry
```

Composants recommandes:

- `Postgres`: images, albums, shootings, tags, dates, dimensions, droits, jobs.
- `Qdrant`: vecteurs nommes par image et par visage.
- `BM25` ou sparse vectors Qdrant: recherche lexicale sur captions, tags, noms de dossiers.
- `MinIO` ou stockage fichier local: fichiers images et thumbnails.
- `Redis` ou file de jobs: ingestion, embeddings, clustering.
- `FastAPI`: API de recherche et clustering.
- workers Python: inference locale, indexation, batch clustering.

## Model registry local

Les modeles doivent etre pinnees avec version et hash:

```text
models/
  openclip/ViT-L-14-openai/
  insightface/antelopev2/
  captioning/blip-base/
```

Chaque run doit enregistrer:

- nom du modele,
- version/checkpoint,
- dimension embedding,
- device CPU/GPU,
- date de generation,
- code version,
- parametres importants.

Note: le benchmark OpenCLIP a remonte un warning `QuickGELU mismatch` avec `ViT-L-14/openai`. Avant production, il faut verrouiller exactement la config OpenCLIP/checkpoint et regenerer les embeddings avec le meme couple modele/pretrained.

## Donnees indexees

Pour chaque image:

```text
image_id
path
album_id
shooting_id
created_at
width
height
orientation
tags
caption
image_openclip_vector
caption_openclip_vector
face_vectors[]
cluster_ids[]
```

Dans Qdrant, utiliser des vecteurs separes:

```text
image_openclip
caption_openclip
face_insightface
```

Les scores ne doivent pas etre melanges trop tot. Chaque canal fait son rappel, puis on fusionne les rangs.

## Recherche texte -> image

Pipeline recommande:

```text
query text
-> metadata filters
-> BM25 captions/tags
-> OpenCLIP text -> image vector
-> OpenCLIP text -> caption vector
-> RRF late fusion
-> dense prompt constraint rerank
-> OpenCLIP contrastive negative rerank
-> hard negative filter when query says no/without/sans
-> optional local reranker top-N
-> UI results
```

Pourquoi:

- BM25 est excellent quand les captions/tags contiennent les bons mots.
- OpenCLIP text->image rattrape les concepts visuels absents ou mal formules.
- OpenCLIP text->caption aide quand les captions sont semantiquement proches.
- RRF evite de calibrer les scores de canaux differents.
- Le reranking par contraintes reduit les faux positifs sur les prompts longs.
- Le LLM local doit etre un reranker ou un outil d'evaluation, pas le moteur de recall.

Pour un prompt dense, ne pas encoder toute la phrase comme un seul signal et
faire confiance au score vectoriel. Le systeme doit identifier:

- les contraintes positives,
- les contraintes negatives,
- les synonymes simples,
- le niveau de filtrage voulu.

Exemple:

```text
"a person riding a horse outdoors without cars"
positive: person, horse, outdoor
negative: car
```

Le hard filter est adapte quand l'utilisateur exprime clairement une exclusion.
Sinon, preferer une penalite douce pour eviter de supprimer de bonnes images a
cause d'une caption incomplete.

Alternative locale au LLM juge:

```text
encode positive concepts
encode negative concepts
score = hybrid_score + positive_visual_score - negative_visual_score
```

Cette approche garde le controle local, evite l'appel LLM sur chaque recherche
et permet de mesurer le taux de faux positifs.

## Recherche image -> image

Deux modes doivent coexister:

1. similarite generale: image embedding OpenCLIP,
2. filtre par personne: InsightFace, comme dans le notebook `01_filter_by_image`.

Pipeline produit:

```text
reference image
-> detect mode
   -> faces found: face search + optional visual search
   -> no face: visual search only
-> metadata filters
-> ranking hybrid
-> UI results
```

Pour les evenements photo, le filtre par personne est un avantage produit important: il permet a un client de retrouver toutes les photos d'une personne sans formuler de texte.

## Clustering images

Le clustering production doit etre un graphe, pas un clustering texte lourd.

Pipeline recommande:

```text
images
-> metadata buckets
-> local visual nearest neighbors per bucket
-> mutual kNN graph
-> optional semantic/token consistency
-> optional face/time edges
-> connected components
-> cluster labels
```

Le premier filtre par metadata sert au front-end:

- album,
- shooting,
- date,
- lieu,
- orientation,
- tags,
- personnes detectees.

Le regroupement intelligent sert aux images desordonnees:

- scene similaire,
- meme moment,
- meme personne,
- meme categorie visuelle.

## Endpoints API

```text
POST /ingest/images
POST /search/text
POST /search/image
POST /filters/person
POST /clusters/build
GET  /clusters
GET  /clusters/{cluster_id}/images
GET  /reports/search-eval/latest
```

## Scalabilite

Pour savoir si l'application est scalable, mesurer:

- temps d'ingestion par 1000 images,
- temps d'embedding CPU/GPU,
- latence P50/P95/P99 de recherche,
- memoire Qdrant,
- taille index lexical,
- temps de build clustering,
- nombre de jobs en attente,
- taux d'erreur inference.

Seuils produit de depart:

```text
search P95 < 500 ms apres indexation
image upload accepte immediatement
embedding en async
clustering en batch async
resultats pagines
top-N rerank limite a 20-50 resultats
```

## Decision actuelle

Garder:

- image->image InsightFace/Qdrant pour les personnes,
- image embeddings pour similarite generale,
- texte->image hybride BM25 + OpenCLIP + RRF,
- clustering graph mutual-kNN avec metadata buckets.

Ne pas retenir pour la premiere prod:

- vector-only,
- moyennes d'embeddings de concepts differents,
- LLM juge dans le recall primaire,
- clustering texte pur comme coeur de production.
