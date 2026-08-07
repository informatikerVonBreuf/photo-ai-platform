# Mise en production locale

## Decision

La premiere production utilise un serveur Linux unique et Docker Compose.
Kubernetes ne devient utile que lorsque la plateforme doit tolerer la perte
d'un noeud, repartir les index ou servir plusieurs workers GPU.

## Perimetre du premier deploiement

```text
frontend
api
postgres
qdrant
redis
minio
worker ML
VLM optionnel
```

## Etat implemente

```text
upload verifie
-> fichier local par SHA-256
-> photo + job idempotent PostgreSQL
-> notification Redis
-> worker TinyCLIP local
-> vecteur image Qdrant
-> recherche lexicale + dense
-> fusion RRF
```

Ce parcours est couvert par `backend/smoke_stack.py`, y compris une requete
texte longue et une recherche image -> image. Le clustering, les captions,
les miniatures et le filtre facial constituent les prochains workers.

Seuls le frontend et l'API sont destines a etre exposes par le reverse proxy.
Les autres services restent sur le reseau prive Docker. Les ports publies par
le Compose de developpement sont lies a `127.0.0.1`.

## Politique des modeles

Un modele n'est approuve pour la production que si :

1. sa licence a ete verifiee pour l'usage vise ;
2. sa revision est figee ;
3. ses poids sont presents dans `models/` ;
4. chaque fichier possede un SHA-256 valide ;
5. le benchmark de non-regression est passe ;
6. l'inference fonctionne sans acces Internet.

Le fichier `ml/model_registry.json` est la source de verite. Les poids ne sont
jamais commits dans Git.

Le candidat actuel est TinyCLIP 8M/3M. Sa revision et les quatre SHA-256 sont
figes, et son service a ete valide hors ligne. Il n'est volontairement pas
`approved_for_production` tant que la pertinence sur le jeu produit et la
licence pour l'usage final ne sont pas signees.

## Chemin d'inference

Le chemin interactif par defaut reste rapide :

```text
filtres metadata
-> index lexical PostgreSQL
-> retrieval TinyCLIP/Qdrant
-> RRF
-> filtre de couverture des concepts
-> resultats
```

Quand `VLM_ENABLED=true` et que la requete demande `use_vlm=true`, un dernier
etage optionnel examine tous les survivants RRF avant la reponse :

```text
pool hybride de taille variable
-> requetes locales SmolVLM-500M par lots via llama.cpp
-> jugement JSON contraint par candidat
-> seuil de confiance
-> resultats confirmes
```

Le VLM intervient aussi en asynchrone pour :

- nommer un cluster ;
- verifier un rattachement ambigu de singleton ;
- enrichir une caption ;
- analyser les echecs du benchmark.

Sur cette machine CPU-only, SmolVLM-500M prend environ 9 secondes par image,
contre environ 75 secondes par image pour Qwen2.5-VL 3B au profil 384 tokens.
Le jugement synchrone reste donc optionnel et intervient uniquement apres le
rappel hybride et le filtre de preuves. La taille de lot limite la memoire mais
pas le nombre total de resultats examines. Pour un grand ensemble, la tache
complete doit passer dans la file asynchrone plutot que couper arbitrairement
les resultats. Qwen 3B reste une reference asynchrone; les 7B sont reserves a
un futur benchmark GPU.

## Donnees et reseau

- Les images restent dans le stockage local ou MinIO.
- Les vecteurs restent dans Qdrant.
- Les metadonnees et jobs restent dans PostgreSQL.
- Redis ne contient que des messages de travail temporaires.
- Les conteneurs ML utilisent `HF_HUB_OFFLINE=1`.
- Les fonctions cloud Ollama sont desactivees.
- Les modeles llama.cpp sont charges avec `-m /models/...`, jamais avec `-hf`.

En production, ajouter une regle firewall de refus des sorties Internet pour
les conteneurs ML. Le mode hors ligne applicatif est une defense
supplementaire, pas un remplacement du controle reseau.

## Sauvegardes

- dump PostgreSQL quotidien ;
- snapshot Qdrant regulier ;
- versioning ou copie chiffree des images ;
- sauvegarde du registre et des checksums ;
- test de restauration planifie.

## Criteres de release

- aucun marqueur de conflit Git ;
- tests backend et frontend verts ;
- registre de modeles valide en mode `--strict` ;
- recherche P95 mesuree ;
- ingestion et jobs asynchrones observes ;
- restauration PostgreSQL/Qdrant testee ;
- journaux inspectes pour exclure images, prompts et donnees biometriques ;
- fonctionnalite faciale desactivee tant que les poids ne sont pas licencies.
