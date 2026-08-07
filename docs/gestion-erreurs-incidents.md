# Gestion des erreurs et incidents

## Objectif

Ce document est le journal de reprise technique du projet. Il explique les
erreurs connues, leurs causes, les corrections appliquees et les controles qui
evitent leur retour. Il ne doit contenir ni secret, ni image, ni donnee
biometrique, ni prompt utilisateur complet.

## Politique applicative

| Famille | Comportement attendu | Exemple |
| --- | --- | --- |
| Entree invalide | refuser avec un HTTP 4xx explicite | fichier non image, requete trop longue |
| Conflit metier | refuser sans perdre les donnees | doublon, bibliotheque inconnue |
| Dependence principale | readiness 503, aucune fausse reussite | PostgreSQL requis indisponible |
| Dependence optionnelle | continuer en mode degrade et le signaler | VLM en chargement ou timeout |
| Traitement asynchrone | retry borne puis statut d'echec observable | indexation Qdrant |
| Erreur inattendue | HTTP 500 + identifiant de correlation, sans contenu sensible | exception non geree |

L'API verifie les uploads avant ecriture, persiste les jobs, borne les retries
du worker et expose l'etat `STORED`, `INDEXING`, `INDEXED` ou `FAILED`. La
recherche accepte une degradation partielle si au moins un canal fonctionne.
Le VLM est fail-open : un timeout global ou une erreur restaure le filtre de
preuves textuelles et ajoute un avertissement dans `diagnostics`.

## Registre historique

| Incident | Symptome | Cause | Resolution et prevention | Etat |
| --- | --- | --- | --- | --- |
| Stash PowerShell | `git stash apply stash@{0}` retourne `unknown switch e` | PowerShell interprete les accolades | utiliser `git stash apply 'stash@{0}'`, puis verifier `git status` | resolu |
| Frontend npm | `ENOENT frontend/package.json` | commande lancee depuis un mauvais dossier ou frontend duplique | conserver `frontend/` comme source canonique et utiliser `npm.cmd --prefix frontend ...` depuis la racine | resolu |
| Dependances frontend | lint impossible apres recuperation de branche | `node_modules` absent ou lockfile non applique | `npm.cmd --prefix frontend ci`, puis lint et build dans la CI | resolu |
| Kernel Jupyter | `notebook controller is DISPOSED` | kernel ferme, extension VS Code ou environnement incoherent | recreer l'environnement, selectionner `Python (photo-ai-platform)`, redemarrer le kernel; garder les scripts comme source reproductible | resolu, peut revenir |
| Benchmark exit 3 | `CalledProcessError` dans le notebook | environnement, dependance ou artefact de benchmark absent | `scripts/setup_ml_env.ps1`, kernel correct et validation explicite des artefacts avant execution | resolu |
| Images invisibles | bibliotheque vide ou photos non recherchables | stack/Qdrant/worker non demarres ou statut non `INDEXED` | profils Compose explicites, `/api/v1/index/status`, worker idempotent et volume persistant | resolu |
| Buckets MinIO vides | aucune image dans MinIO | MinIO provisionne mais pas encore stockage actif | documenter que `photo_storage` est la source actuelle; migrer explicitement avant d'attendre des buckets | explique |
| Faux positifs TinyCLIP | animaux pour `people are playing`; lit ou tasse pour `food on the table` | similarite globale sans garantie sur objets, actions et relations | PostgreSQL lexical + TinyCLIP separes, RRF, couverture de concepts, seuils et juge VLM local | correction en validation |
| Perte par moyenne | informations de canaux diluees | moyenne d'embeddings ou scores non calibres | conserver chaque canal et fusionner les rangs avec RRF | resolu |
| Perte par top-k | des resultats valides disparaissent | limite fixe utilisee comme decision semantique | sortie variable; le client peut fixer une limite d'affichage, le VLM traite tous les survivants par lots | resolu |
| VLM bloque l'API | conteneur API en erreur pendant le chargement | readiness testait seulement le port et rendait le VLM obligatoire | healthcheck HTTP reel; VLM marque optionnel et expose dans `degraded` | resolu |
| Qwen2.5-VL 7B CPU | chargement environ 25 min puis timeout 180 s | modele trop lourd pour Ryzen 5 7520U / 8 Go | statut `benchmark_failed_cpu`, conservation pour GPU, passage au 3B Q4 | resolu par repli |
| Certificat Hugging Face | echec SSL au provisionnement | magasin de certificats Windows non pris en compte | injection `truststore`, revision figee et verification SHA-256 | resolu |
| Cache HF Windows | avertissement sur les symlinks | mode developpeur Windows desactive | non bloquant; activer Developer Mode ou dedier un cache pour eviter les copies disque | ouvert faible |
| VLM par lots | temps maximal multiplie par le nombre de lots | timeout applique a chaque appel seulement | budget global `VLM_TIMEOUT_SECONDS`, puis repli textuel | resolu |
| Precision Qwen-VL | avertissement llama.cpp sur le grounding | le grounding demande au moins 1024 tokens image | profil pertinence teste a 384 tokens; conserver 1024 pour les taches de localisation et benchmarker separement | surveille |
| JSON VLM non contraint | Markdown, structure libre ou contenu vide | mauvais emplacement du schema dans `response_format` llama.cpp | utiliser `json_schema.schema`, valider contenu/unicite et lever `VlmResponseError`; test de contrat ajoute | resolu |
| Qwen 3B synchrone CPU | environ 185 s pour une image positive | encodage de 1024 tokens image sans GPU | VLM opt-in, budget global et repli; viser file asynchrone, GPU ou challenger 2B | ouvert produit |
| VLM apres deux tests | premier appel annule, second bloque dans le slot | pool RRF brut, budget 180 s et aucune protection de concurrence | filtrer les concepts avant VLM, profil 384 tokens, budget 240 s, lots de 1, verrou `busy` et cooldown; deux executions successives verifiees | resolu fonctionnel |
| VLM trop lent sans GPU | Qwen 3B demande environ 150 s pour deux images | 2.8 Go de poids/projecteur et encodage visuel couteux sur Ryzen 5 | SmolVLM-500M Q8 local: environ 383 MiB au repos, 9 s/image, faux positif tasse/couteau rejete; Qwen conserve en asynchrone | resolu pour usage interactif opt-in |
| Build Vite Windows | esbuild refuse de lire un parent du projet | execution restreinte dans un chemin OneDrive | relancer le build dans un contexte autorise; la CI doit construire dans un workspace isole | environnement |
| Scene 3D frontend | fond masque ou mal cadre | camera/echelle non adaptees aux viewports | cadrage responsive et verification visuelle desktop/mobile | resolu |

## Runbook de diagnostic

1. Verifier les services et ne pas se fier au seul statut `Up` :

```powershell
docker compose --profile ml --profile vlm ps
Invoke-RestMethod http://127.0.0.1:8002/health/ready
docker compose logs --tail 100 api worker embedding llama
```

2. Verifier le parcours d'une image :

```powershell
Invoke-RestMethod http://127.0.0.1:8002/api/v1/index/status
Invoke-RestMethod http://127.0.0.1:8002/api/v1/photos
```

Une image visible mais non recherchable doit d'abord etre examinee par son
statut, le job PostgreSQL, les logs worker, puis le point Qdrant. Ne jamais
reindexer toute la collection avant d'avoir localise l'etape fautive.

3. Verifier les modeles locaux :

```powershell
conda run -n env python scripts\verify_model_registry.py
conda run -n env python scripts\provision_embedding_model.py `
  --model-id smolvlm-500m-instruct-gguf --verify-only
```

4. Verifier le code :

```powershell
conda run -n env python -m pytest backend\tests -q
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```

## Informations a journaliser

- `request_id`, route, code HTTP, duree et taille, sans corps sensible ;
- statut de chaque canal de retrieval et nombre de candidats par etape ;
- modele, revision, lot, latence et mode du juge, sans image base64 ;
- `job_id`, tentative, etape et classe d'erreur du worker ;
- saturation CPU/RAM/GPU, profondeur Redis et latence Qdrant/PostgreSQL.

Les erreurs externes sont classees (`Timeout`, `ConnectionError`,
`InvalidResponse`) avant d'etre exposees. Les traces detaillees restent dans
les journaux prives; le frontend recoit un message actionnable et non une
stacktrace.

## Nouveau rapport d'incident

```text
Date/heure UTC :
Version/commit :
Environnement :
Impact utilisateur :
Symptome et code d'erreur :
Etape fautive :
Cause racine :
Correction :
Donnees affectees :
Test de non-regression :
Action preventive et responsable :
Etat : ouvert | surveille | resolu
```

## Risques ouverts

- precision de SmolVLM-500M pas encore mesuree sur un jeu produit annote ;
- TinyCLIP candidat tant que le benchmark produit final n'est pas signe ;
- pas encore de circuit breaker partage ni de cache de jugements VLM ;
- MinIO n'est pas encore le stockage image actif ;
- filtre facial bloque pour la production commerciale par la licence des poids ;
- tableaux de bord et alertes P95/debit/file Redis restent a construire.
- chunk Three.js du frontend proche de 503 kB, a profiler et decouper si le
  temps de chargement reel depasse le budget produit.
