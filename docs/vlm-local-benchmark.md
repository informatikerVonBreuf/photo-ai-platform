# Benchmark des VLM locaux

## Decision actuelle

Le profil CPU retenu est `SmolVLM-500M-Instruct` en GGUF Q8, servi par
llama.cpp. Les deux fichiers sont presents dans `models/smolvlm`, figes a la
revision `72e986006ef53e37cdd3f6d4241c90b0f01df376` et verifies par SHA-256
dans `ml/model_registry.json`.

Il remplace Qwen2.5-VL 3B dans le profil interactif opt-in: environ 9 secondes
par image au lieu d'environ 75 secondes. Il ne sera marque
`approved_for_production` qu'apres un benchmark statistique sur un jeu produit
annote par des humains. Qwen 3B reste une reference plus riche pour les taches
asynchrones ou une future machine plus puissante.

## Pourquoi une cascade

Un VLM ne doit ni parcourir toute la phototheque, ni assurer seul le rappel :

```text
filtres metadata
-> PostgreSQL lexical + TinyCLIP/Qdrant
-> RRF et seuils calibres
-> filtre de preuves et couverture des concepts
-> survivants en nombre variable
-> VLM local par petits lots
-> seuil de confiance
-> resultats confirmes en nombre variable
```

`VLM_JUDGE_BATCH_SIZE` controle uniquement la memoire et le contexte. Il ne
coupe pas les resultats a un top-k arbitraire. Les candidats sans preuve des
concepts demandes sont rejetes avant le VLM. `VLM_TIMEOUT_SECONDS` constitue
un budget global pour la requete VLM complete. En cas d'erreur ou de timeout,
l'API revient au filtre de preuves textuelles et expose `failed_open` dans les
diagnostics. Une requete concurrente obtient `busy` au lieu d'attendre dans le
slot unique; apres un timeout, `cooldown` protege le serveur pendant 90 secondes.

Pour monter en charge, la prochaine optimisation a mesurer est un routage par
incertitude : accepter les preuves fortes, rejeter les preuves faibles et
n'envoyer au VLM que la zone ambigue. Ce routage ne doit etre active qu'apres
calibration, car il peut sinon supprimer du rappel.

## Mesures deja obtenues

Materiel observe : AMD Ryzen 5 7520U, 8 Go de RAM, inference CPU Docker.

| Modele | Chargement | Requete observee | Decision |
| --- | ---: | ---: | --- |
| Qwen2.5-VL 7B Q4_K_M | environ 25 min | timeout a 180 s | ecarte sur ce CPU, conserve pour GPU |
| Qwen2.5-VL 3B Q4_K_M | 4 min 49 s a 6 min 06 s | positif correct a 0.95 en 185 s; negatif tasse/couteau rejete a 0.0 en 188 s | asynchrone CPU ou GPU |
| SmolVLM-500M Q8 | 60 a 78 s | environ 9 s/image; deux images en 17 a 18 s | profil CPU interactif opt-in |

Le profil produit CPU utilise 384 tokens image, des lots de 1 et un budget
global de 240 secondes. SmolVLM occupe environ 383 Mio au repos dans Docker;
llama.cpp projette un maximum d'environ 674 Mio. Sur `food on a table`, le
filtre a reduit 10 candidats RRF a 2 candidats avec preuves et la recherche
complete a termine en 17,6 secondes, avec `verified`, 2/2 candidats examines
et aucun avertissement.

Le smoke qualitatif a donne les decisions attendues sur cinq cas:

- nourriture sur une table: accepte a 1.0;
- tasse et couteau sans nourriture: rejete a 0.0;
- prompt dense conforme avec riz, legumes, table et verre: accepte a 0.9;
- personnes mangeant pizza dehors sur l'image de riz: rejete a 0.0;
- requete sans riz et verre devant l'assiette: rejetee a 0.0.

Passer de 384 a 256 tokens image n'a apporte aucun gain mesurable sur le lot de
deux images, qui est reste a 17,7 secondes. Le profil conserve donc 384 tokens
pour ne pas perdre inutilement de detail. Deux images dans un meme appel ont
egalement coute environ autant que deux lots de 1; le lot reste fixe a 1 pour
reduire le pic de memoire et simplifier la reprise sur erreur.

Le temps de chargement n'est pas la latence d'une recherche. Le service doit
rester chaud en production et sa latence P50/P95 doit etre mesuree separement.
La verification VLM est donc desactivee par defaut dans le frontend et l'API;
elle reste disponible comme option experimentale explicite. Ces cas ne
constituent pas un benchmark statistique et ne prouvent pas la robustesse du
modele sur toute la phototheque.

## Challengers locaux

| Candidat | Interet | Limite a verifier | Priorite |
| --- | --- | --- | --- |
| Florence-2-base 0.23B | captions detaillees, detection et regions, MIT | nouveau runtime PyTorch a mesurer | 1, enrichissement asynchrone |
| Qwen3-VL 2B Instruct GGUF | plus riche, Apache-2.0, support llama.cpp | probablement trop lent en synchrone sur ce CPU | 2 |
| SmolVLM2 500M Video | meme classe de taille, image et video | aucun besoin video produit actuel | 3 |
| Moondream2 2B | requetes et detection | code specifique et revisions frequentes a figer | 4 |

Le prochain test prioritaire n'est pas un autre gros juge synchrone. Il consiste
a extraire une seule fois, pendant l'indexation, des captions detaillees,
objets et regions avec Florence-2-base. Ces preuves deviennent recherchables
dans PostgreSQL et evitent de relire les pixels a chaque requete. SmolVLM reste
le dernier arbitre des cas ambigus. Cette cascade est plus scalable sur CPU
qu'un VLM de 2 a 3 milliards de parametres appele pour chaque resultat.

Sources officielles :

- https://huggingface.co/ggml-org/Qwen2.5-VL-3B-Instruct-GGUF
- https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF
- https://huggingface.co/HuggingFaceTB/SmolVLM2-2.2B-Instruct
- https://huggingface.co/ggml-org/SmolVLM-500M-Instruct-GGUF
- https://huggingface.co/microsoft/Florence-2-base
- https://huggingface.co/vikhyatk/moondream2
- https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md

## Protocole de comparaison

Le jeu de test doit contenir des requetes naturelles, des prompts longs et des
negatifs difficiles. Exemples indispensables :

- `people are playing`, avec animaux et personnes immobiles comme negatifs ;
- `food on the table`, avec lit + table et tasse + couteau comme negatifs ;
- objets, actions, nombres, couleurs, negations et relations spatiales ;
- prompts verbeux ou contradictoires ;
- requetes sans resultat valide.

Pour chaque couple requete-image, annoter `relevant`, les concepts requis et
la cause d'un eventuel rejet. Utiliser une partie calibration pour choisir les
seuils et une partie test jamais utilisee pendant le reglage.

Mesures obligatoires :

- rappel du pool avant VLM et recall@candidate_limit ;
- precision, rappel, F1 et faux positifs du juge ;
- average precision et nDCG pour l'ordre RRF ;
- taux de reponse JSON valide et taux de `failed_open` ;
- latence P50/P95, debit, RAM et temps de demarrage ;
- cout par image jugee et nombre moyen d'images envoyees au VLM.

La selection finale se fait d'abord sur une contrainte de rappel du retrieval,
puis sur la precision du juge, et enfin sur la latence. Un modele plus rapide
n'est pas retenu s'il laisse passer les faux positifs critiques.

## Exploitation locale

Provisionnement idempotent du profil CPU actuel :

```powershell
conda run -n env python scripts\provision_embedding_model.py `
  --model-id smolvlm-500m-instruct-gguf `
  --accept-license

docker compose --profile ml --profile vlm up -d --build
docker compose --profile vlm ps
docker compose --profile vlm logs -f llama
```

Le telechargement est la seule etape qui contacte Hugging Face. L'inference
utilise ensuite des fichiers locaux montes en lecture seule, avec les services
ML en mode hors ligne. Changer de modele impose une nouvelle entree figee dans
le registre, de nouveaux checksums et un benchmark de non-regression.

## Cache et observabilite cibles

Un jugement peut etre mis en cache avec la cle : revision du modele, version du
prompt systeme, requete normalisee et SHA-256 de l'image. Les diagnostics
doivent conserver les volumes par etape, les latences, le modele, la revision,
le seuil, le mode de repli et le nombre de lots, mais jamais l'image en base64.
