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

## Chemin d'inference

La recherche interactive ne doit pas attendre un VLM :

```text
filtres metadata
-> BM25
-> retrieval visuel
-> RRF
-> reranking de contraintes
-> resultats
```

Le VLM intervient en asynchrone pour :

- nommer un cluster ;
- verifier un rattachement ambigu de singleton ;
- enrichir une caption ;
- analyser les echecs du benchmark.

Sur une machine CPU-only, cette separation protege la latence de recherche.

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
