# Notebook image -> image: filtre par image

Notebook de reference:

`notebooks/recherche_image_image/01_filter_by_image_insightface_qdrant.ipynb`

Ce notebook doit rester dans le projet: il couvre un cas produit tres fort et deja fonctionnel, le filtre par personne a partir d'une image de reference.

## Ce que fait le notebook

Le notebook construit une classe `FilterByImage` qui indexe les visages detectes dans un dossier d'images, puis permet de retrouver les images contenant une ou plusieurs personnes presentes dans des images de reference.

Flux principal:

1. Chargement local d'InsightFace avec le modele `antelopev2`.
2. Detection des visages image par image.
3. Extraction d'un embedding de visage par personne detectee.
4. Stockage dans un `DataFrame` local avec le chemin image et un identifiant de personne.
5. Indexation dans Qdrant avec une collection `faces_{folder_name}`.
6. Recherche de visages proches via Qdrant/FAISS et retour des images correspondantes.

## Pourquoi cette approche est bonne

Elle ne cherche pas une similarite generale entre images. Elle repond a une question produit beaucoup plus precise:

> Montre-moi les photos ou cette personne apparait.

Pour ce besoin, InsightFace est plus adapte qu'un simple embedding CLIP, car CLIP capture le contenu global de l'image, alors qu'InsightFace encode l'identite faciale.

## Fonctions importantes

`filter_df(image_path)`

Retourne les images qui contiennent les personnes detectees dans l'image de reference.

`filter_union(path1, path2, ...)`

Retourne les images qui contiennent au moins une des personnes presentes dans les images de reference. C'est utile pour un filtre produit de type "personne A ou personne B".

`filter_intersection(path1, path2, ...)`

Retourne les images qui satisfont les contraintes de toutes les references. C'est utile pour retrouver les photos ou plusieurs personnes sont ensemble.

`add_images(path1, path2, ...)`

Ajoute de nouvelles images a l'index sans tout reconstruire.

`remove_images(path1, path2, ...)`

Supprime des images de l'index et de la base locale.

## Positionnement production

Ce notebook doit devenir un service "person filter", separe de la recherche semantique globale.

Architecture cible:

```text
image reference
-> face detection InsightFace
-> face embedding
-> Qdrant face vector search
-> images candidates
-> metadata filters
-> UI results
```

Il doit etre branche sur les filtres front-end comme un canal specialise:

- personne presente,
- groupe de personnes,
- intersection de plusieurs personnes,
- union de plusieurs personnes.

## Ce qu'il ne faut pas faire

Ne pas remplacer ce notebook par CLIP pour le cas "retrouver une personne". CLIP peut retrouver des images visuellement proches, mais il ne donne pas le meme niveau de controle sur l'identite.

Ne pas melanger l'index face avec l'index general texte/image. Les deux peuvent etre combines au niveau produit, mais les vecteurs et les seuils doivent rester separes.

## Ameliorations avant API

- Ajouter un seuil de similarite configurable par environnement.
- Persister le `DataFrame` sous forme SQLite/Postgres plutot qu'en memoire.
- Ajouter un identifiant stable `image_id`.
- Ajouter des tests sur `filter_df`, `filter_union`, `filter_intersection`.
- Garde-fou: si aucun visage n'est detecte, retourner une reponse claire.
- Ajouter une etape de deduplication des embeddings de la meme personne.
