# Evaluation du RAG multimodal

## Decision produit

La recherche renvoie un ensemble de taille variable. `5`, `10` ou `50` sont
des points de mesure ou des budgets de rappel, jamais le nombre impose de
photos pertinentes.

```text
metadata + recherche lexicale + recherche texte-image
-> RRF sur un pool de rappel configurable
-> verification locale par lots
-> toutes les images acceptees, eventuellement aucune
```

`SEARCH_CANDIDATE_LIMIT` borne le travail du moteur et doit etre calibre avec
`Recall@candidate_limit`. `VLM_JUDGE_BATCH_SIZE` borne seulement la memoire et
le contexte d'une requete llama.cpp. Tous les survivants RRF sont parcourus.

## Ce qui existait deja

Le benchmark `ml/experiments/artifact_benchmark.py` mesure :

- `precision_at_k` pour la recherche texte-image ;
- precision de contraintes, taux de faux positifs explicites et couverture
  des concepts pour les prompts denses ;
- chevauchement de captions pour image-image ;
- coherence, couverture et singletons pour le clustering ;
- temps total et temps d'encodage.

Le dernier rapport porte sur 5 000 images. Le reranking de contraintes obtient
une precision heuristique de `0.9256` et un taux de faux positifs explicites de
`0.0`. Le clustering assigne toutes les images mais conserve `96.82 %` de
singletons. Ces chiffres ne sont pas des scores de production : la pertinence
est principalement derivee des captions BLIP, donc le signal qui sert de label
sert aussi a certains moteurs recherches. Cela favorise les methodes textuelles
et ne detecte pas les omissions ou hallucinations de caption.

## Protocole robuste

Construire un jeu produit gele avec au moins trois familles de requetes :

1. requetes courtes et visuelles ;
2. prompts longs avec objets, actions, nombres, attributs et relations ;
3. requetes sans resultat et hard negatives proches mais incorrects.

Chaque paire requete-photo recoit un grade humain : `0` non pertinente, `1`
pertinente, `2` correspondance directe. Deux annotateurs couvrent un sous-jeu
commun ; Cohen kappa ou Krippendorff alpha mesure leur accord. Les desaccords
sont arbitres avant le gel des `qrels`.

Separer strictement calibration et test. Les seuils Qdrant et VLM sont choisis
sur la calibration, puis mesures une seule fois sur le test. Conserver aussi
COCO pour un test de non-regression public, mais ne pas l'utiliser comme seul
proxy des photos du produit.

## Metriques par etape

| Etape | Metriques principales | Echec detecte |
| --- | --- | --- |
| Ingestion | couverture d'indexation, echecs, delai P50/P95/P99 | photos non recherchables |
| Canal lexical | Recall@K, MAP, nDCG@K | captions/tags incomplets |
| Canal texte-image | Recall@K, MAP, nDCG@K | modele visuel trop faible |
| RRF | gain de rappel, nDCG, candidats uniques | fusion qui n'apporte rien |
| Filtres | rappel avant/apres, vrais positifs perdus | filtre trop agressif |
| Juge | precision, rappel, F1, FPR, FNR, Brier, ECE | faux positifs ou confiance mal calibree |
| Sortie variable | precision, rappel, F1 de l'ensemble, no-match accuracy | trop ou trop peu de photos |
| Exploitation | latence par etape, debit, RAM/VRAM, images et tokens par requete | cout non soutenable |

`Recall@K` mesure si le pool contient bien les images pertinentes. `nDCG@K`
mesure leur ordre avec les grades `1/2`. MAP mesure la qualite du classement
sur toutes les positions. La precision seule est insuffisante : un systeme qui
ne renvoie qu'une image facile peut avoir une excellente precision et un tres
mauvais rappel.

Pour le resultat final, utiliser les metriques d'ensemble sans `K`. Tracer la
courbe precision-rappel du seuil VLM, puis choisir un point selon le cout
metier des faux positifs et faux negatifs. Brier et ECE verifient si une
confiance de `0.8` correspond reellement a environ 80 % de bonnes decisions.
Le module de calibration attend une probabilite de la classe pertinente. Pour
la sortie actuelle du VLM, la convertir avec `confidence` si `relevant=true`
et `1-confidence` si `relevant=false`.

Le module `ml/evaluation/retrieval_metrics.py` implemente ces mesures sans
service externe. Le script accepte ce format :

```json
{
  "queries": [
    {
      "query_id": "q_food_table",
      "relevance": {"photo_exacte": 2, "photo_acceptable": 1}
    }
  ]
}
```

Un run conserve les identifiants apres chaque etape :

```json
{
  "queries": [
    {
      "query_id": "q_food_table",
      "stages": {
        "lexical": ["photo_exacte", "chambre"],
        "text_image": ["photo_acceptable", "tasse"],
        "rrf": ["photo_exacte", "photo_acceptable", "chambre"],
        "judge": ["photo_exacte", "photo_acceptable"],
        "final": ["photo_exacte", "photo_acceptable"]
      }
    }
  ]
}
```

```powershell
python scripts\evaluate_retrieval.py `
  --qrels reports\evaluation\qrels.json `
  --run reports\evaluation\run.json `
  --output reports\evaluation\metrics.json
```

## VLM ou modele de texte

Un modele de texte est moins couteux si toutes les informations necessaires
sont presentes dans la caption. Il est adapte aux noms, tags, dates et concepts
explicitement decrits. Il ne peut cependant pas verifier un detail absent de la
caption : nombre de personnes, aliment reellement pose sur la table, action,
position spatiale, texte visible ou faux contexte genere par le captionneur.

Le VLM voit les pixels et la requete. Son role est donc un **verificateur de
precision**, pas un moteur de rappel ni un substitut aux embeddings. Il coute
plus cher en calcul et en latence. Le pipeline recommande est :

```text
recall lexical + TinyCLIP
-> RRF
-> VLM local sur les survivants, par lots
-> seuil calibre
-> ensemble variable
```

Une cascade texte puis VLM peut reduire le cout, mais seulement apres mesure du
rappel perdu par le juge texte. Le routage le plus sur en phase suivante est de
reserver le VLM aux candidats incertains ou contradictoires, sur la base d'un
seuil calibre et non de leur position dans un top fixe.

## Modeles a challenger

| Composant | Avantage | Cout/risque | Decision actuelle |
| --- | --- | --- | --- |
| PostgreSQL FTS | rapide, explicable, aucun GPU | depend des captions et tags | conserver comme canal complementaire |
| TinyCLIP 8M/3M | 23.4 M parametres, poids 93.8 Mo, CPU local | faible sur compositions fines | baseline produit, pas encore approuve |
| OpenCLIP ViT-L/14 | representation plus riche | beaucoup plus lourd ; licence/source a figer | challenger offline uniquement |
| SigLIP 2 Base | multilingue, 86 M parametres, Apache-2.0 | poids environ 1.5 Go, index a regenerer | meilleur prochain challenger retrieval |
| BLIP base | captions utiles au lexical | omissions et hallucinations possibles | enrichissement asynchrone, jamais verite terrain |
| Llama 3.1 8B texte | juge les captions a faible cout image | aveugle aux pixels, licence a verifier | ne pas ajouter au chemin produit actuel |
| SmolVLM-500M Q8 | verifie directement image + texte, Apache-2.0 | environ 546 Mo; raisonnement fin a valider sur qrels humains | juge interactif CPU opt-in, a calibrer |
| Qwen2.5-VL 3B Q4 | meilleure capacite attendue, Apache-2.0 | environ 2.8 Go; environ 75 s/image sur ce CPU | reference asynchrone, hors chemin interactif |
| Qwen3-VL 2B Q4 | challenger plus riche avec GGUF officiel | non encore provisionne ni mesure | benchmark ulterieur si SmolVLM echoue sur les qrels |
| VLM2Vec/MMEB | embeddings instruits plus expressifs | modele et index plus couteux | challenger de recherche apres baseline |

Le rapport actuel ne permet pas de conclure qu'OpenCLIP est meilleur : sur les
labels derives des captions, `openclip_text_to_image` est logiquement penalise
face aux moteurs texte-caption. La comparaison decisive doit utiliser les
qrels visuels humains et reporter qualite, latence, memoire, taille d'index et
energie sur le materiel cible.

## Sorties RAG generees

L'application renvoie aujourd'hui des photos, pas une reponse textuelle longue.
Les metriques de retrieval ci-dessus sont donc prioritaires. Si une synthese,
une legende ou une explication utilisateur est generee, ajouter :

- fidelite aux images et contextes recuperes ;
- couverture des faits attendus ;
- pertinence de la reponse ;
- taux de faits non supportes ;
- evaluation humaine sur un echantillon gele.

RAGAS fournit context precision/recall, faithfulness et answer relevance.
RAGChecker ajoute un diagnostic fin au niveau des claims et annonce une
meilleure correlation avec les jugements humains. ARES montre qu'un petit juge
entraine avec quelques centaines d'annotations humaines peut rester robuste au
changement de domaine. Ces outils sont pertinents pour la generation ; ils ne
remplacent ni les qrels visuels ni l'evaluation du juge VLM.

## Travaux comparables

- RRF, Cormack et al. : https://research.google/pubs/reciprocal-rank-fusion-outperforms-condorcet-and-individual-rank-learning-methods/
- RAGAS : https://aclanthology.org/2024.eacl-demo.16/
- RAGChecker : https://arxiv.org/abs/2408.08067
- ARES : https://arxiv.org/abs/2311.09476
- UniIR et M-BEIR : https://tiger-ai-lab.github.io/UniIR/
- VLM2Vec et MMEB : https://arxiv.org/abs/2410.05160
- SigLIP 2 : https://arxiv.org/abs/2502.14786
- ColPali et ViDoRe : https://arxiv.org/abs/2407.01449

M-BEIR couvre huit taches de retrieval multimodal dans un pool global de 5.6
millions de candidats. MMEB couvre 36 jeux et VLM2Vec rapporte des gains moyens
absolus de 10 a 20 points sur ses evaluations. ColPali montre l'interet des
representations visuelles multi-vecteurs pour les documents, mais son domaine
et son cout d'index sont differents des photographies naturelles : il sert de
reference architecturale, pas de remplacement direct de TinyCLIP. SigLIP 2
rapporte des gains sur le retrieval a toutes les tailles de sa famille et offre
un checkpoint Base Apache-2.0 : c'est le prochain challenger raisonnable avant
des embeddings issus d'un VLM beaucoup plus lourd.
