# Architecture fonctionnelle

Ce document decrit les flux reellement implementes, les modeles locaux et les
frontieres entre produit et recherche. La source de verite des modeles reste
`ml/model_registry.json`.

## Etat des fonctionnalites

| Fonctionnalite | Entree | Moteur actuel | Persistance | Etat |
| --- | --- | --- | --- | --- |
| Bibliotheques | nom, description, photos | FastAPI + worker | PostgreSQL + volume images | Produit |
| Recherche texte -> image | texte libre | PostgreSQL FTS + TinyCLIP + RRF | Qdrant + PostgreSQL | Produit, qualite a benchmarker |
| Recherche image -> image | une ou plusieurs images | TinyCLIP + RRF | Qdrant | Produit |
| Filtre par personne | image de visage | InsightFace/antelopev2 envisage | non branchee | Bloque par licence et poids absents |
| Clustering | bibliotheque ou shooting | graphe mutual-kNN valide en notebook | tables `clusters` | Recherche, API a construire |
| Juge VLM | requete + survivants RRF | SmolVLM-500M via llama.cpp | reponse de recherche | Profil CPU opt-in, validation produit en cours |

Une fonctionnalite marquee `Produit` possede un contrat API reel et ne depend
pas de donnees aleatoires. Les autres ne doivent pas etre activees en
production avant ajout du worker, des tests d'integration et des poids
approuves.

Le juge VLM est un dernier filtre et jamais un moteur de rappel. Lorsqu'il est
active, il examine tous les survivants RRF par lots bornes. Une sortie JSON
contrainte indique pour chacun la pertinence, la confiance et une justification
courte. Seuls les candidats directement confirmes au-dessus du seuil sont
retournes ; leur nombre n'est pas fixe.

## Import et bibliotheques

```text
Navigateur
  -> POST /api/v1/libraries
  -> PostgreSQL.libraries

Navigateur (destination optionnelle)
  -> POST /api/v1/photos/upload
  -> verification MIME + decodage Pillow + limite de taille
  -> SHA-256 et deduplication
  -> volume Docker photo_storage
  -> PostgreSQL.photos + PostgreSQL.jobs
  -> notification Redis
  -> worker
  -> service TinyCLIP local
  -> Qdrant.photos_tinyclip_v1
  -> statut INDEXED
```

L'image est persistante des que l'API repond. `STORED` ou `INDEXING` signifie
qu'elle est visible dans la bibliotheque mais pas encore recherchable.
`INDEXED` signifie que le vecteur est present dans Qdrant.

L'affectation de photos deja importees utilise
`POST /api/v1/photos/assign`. Le changement d'album remet les photos a
`STORED`, cree un job et regenere le payload Qdrant afin que les filtres
`library_id` restent coherents.

La suppression est definitive et coordonnee :

```text
DELETE photo / vider depot / vider album
  -> suppression des vecteurs Qdrant
  -> suppression des jobs et metadonnees PostgreSQL
  -> suppression du fichier dans photo_storage
  -> rafraichissement des compteurs frontend
```

## Recherche image -> image

```text
image de reference
  -> verification locale
  -> TinyCLIP image encoder
  -> vecteur L2-normalise
  -> cosine similarity dans Qdrant
  -> filtre album/shooting optionnel
  -> RRF si plusieurs references
  -> metadonnees PostgreSQL
  -> resultats frontend
```

Cette recherche ne fait pas appel a InsightFace. TinyCLIP represente la scene,
les objets, les couleurs et une partie de la semantique visuelle. Avec plusieurs
references :

- `intersection` conserve les photos presentes dans tous les canaux ;
- `union` fusionne les canaux par RRF ;
- `rrf` effectue la meme fusion robuste sans comparer directement les echelles
  de scores.

## Recherche texte -> image

```text
requete complete
  +-> PostgreSQL FTS sur nom, caption et tags --------+
  +-> TinyCLIP text encoder -> Qdrant image vectors --+-> RRF -> resultats
```

Le canal lexical preserve les mots rares, noms propres, tags et contraintes
explicites. Le canal TinyCLIP apporte la similarite semantique texte-image.
RRF fusionne les rangs sans moyenner les embeddings et sans supposer que les
scores des deux moteurs sont comparables.

Pour un prompt long, TinyCLIP peut tronquer son entree. Le canal lexical garde
le texte complet, et l'API renvoie le diagnostic de troncature. Le VLM local est
un filtre synchrone optionnel : il augmente fortement la latence, mais peut
verifier les relations visuelles que les captions ont omises. L'API expose les
temps et volumes de chaque etape dans `diagnostics`.

## InsightFace et antelopev2

InsightFace est un framework de vision faciale, pas un modele unique.
`antelopev2` est un pack de modeles ONNX utilise par InsightFace pour :

- detecter les visages ;
- estimer les landmarks et aligner les crops ;
- produire un embedding d'identite ;
- comparer des personnes par similarite.

Etat local actuel :

```text
models/tinyclip/        present et verifie
models/antelopev2/      absent
models/smolvlm/         SmolVLM-500M Q8 present et verifie
models/qwen-vl/         Qwen2.5-VL 3B et 7B conserves pour benchmark
```

`antelopev2` n'est donc ni telecharge, ni charge, ni utilise. Les poids publics
InsightFace sont declares `non-commercial-research-weights` dans le registre.
Ils restent bloques pour une production commerciale, meme si le code de la
bibliotheque possede une licence differente.

## Clustering cible

Le clustering recommande reste asynchrone :

```text
filtre metadata (date, shooting, appareil)
  -> graphe mutual-kNN sur embeddings image
  -> communautes Leiden ou composantes robustes
  -> rattachement des singletons au voisin fiable
  -> ecriture clusters + cluster_photos
  -> etiquetage par captions/tags
  -> VLM local optionnel pour les cas ambigus
```

Le VLM ne doit jamais etre la seule source d'affectation. Chaque rattachement
conserve un score, une provenance (`metadata`, `graph`, `manual`, `vlm_review`)
et peut etre corrige manuellement.

## Donnees et controle local

| Donnee | Stockage | Exposition |
| --- | --- | --- |
| Fichiers image | volume Docker `photo_storage` | API `/media` |
| Catalogue, captions, jobs | PostgreSQL | reseau prive |
| Vecteurs | Qdrant | reseau prive + tableau de bord local |
| File de travail | Redis | reseau prive |
| Poids TinyCLIP | `models/tinyclip` monte en lecture seule | service embedding |
| Poids VLM | `models/smolvlm` monte en lecture seule | llama.cpp |

Qdrant conserve les vecteurs et les payloads, jamais les fichiers image. MinIO
est provisionne dans la stack mais n'est pas encore le stockage actif : il ne
contient donc aucun bucket applicatif tant que la migration depuis
`photo_storage` n'est pas implementee.

Les conteneurs ML utilisent le mode hors ligne. Aucun prompt, vecteur ou fichier
image n'est envoye vers une API de modele externe. Les poids sont exclus de Git,
mais leurs chemins, revisions et SHA-256 sont declares dans le registre.

## Verification

```powershell
python scripts\verify_model_registry.py
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
& 'C:\Users\choun\miniconda3\envs\env\python.exe' -m pytest backend\tests -q
docker compose --profile ml run --rm --no-deps `
  -e PHOTO_AI_SMOKE_WITH_WORKER=true `
  -e PHOTO_AI_EMBEDDING_SERVICE_ENABLED=true `
  -e PHOTO_AI_VECTOR_SEARCH_ENABLED=true `
  -e PHOTO_AI_TEXT_VECTOR_SCORE_THRESHOLD=0 `
  api python smoke_stack.py
```

Le smoke test couvre stockage, job, worker, TinyCLIP, Qdrant, recherche texte,
prompt long et recherche image -> image, puis nettoie ses donnees.
