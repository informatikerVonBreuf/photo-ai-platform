# Backend

API FastAPI locale de Photo AI Platform.

## Demarrage local

Depuis la racine du depot :

```powershell
& 'c:\Users\choun\miniconda3\envs\env\python.exe' -m pip install -r backend\requirements-dev.txt
& 'c:\Users\choun\miniconda3\envs\env\python.exe' -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Endpoints principaux :

- `GET /health/live`
- `GET /health/ready`
- `GET /api/v1/system/privacy`
- `GET /api/v1/system/models`
- `POST /upload`
- `POST /api/v1/photos/upload`
- `GET|POST /shootings`
- `DELETE /shootings/{shooting_id}`
- `GET /jobs/{job_id}`
- `POST /search`
- `POST /api/v1/search`
- `GET /media/{filename}`

L'upload verifie le type declare, le contenu de l'image, la taille et le hash.
Il stocke les fichiers sous leur SHA-256 afin de dedupliquer sans appeler un
service externe. En mode persistant, chaque image cree un job idempotent. Le
worker calcule ensuite son embedding local et l'indexe dans Qdrant.

## Recherche

`POST /search` utilise `multipart/form-data` :

```text
mode=text   + query
mode=image  + images[]
mode=hybrid + query + images[]
```

Filtres optionnels : `library_id`, `shooting_id`, `limit`. Le formulaire
`use_vlm=true|false` permet au client de demander ou d'ignorer la verification
visuelle pour une recherche texte ou hybride.
Avec plusieurs images, `reference_logic=union|intersection|rrf` controle si un
resultat doit apparaitre dans au moins un canal, dans tous les canaux, ou etre
simplement classe par accord RRF.

Pour le texte, les rappels lexical PostgreSQL et texte -> image TinyCLIP
restent deux listes distinctes. Elles sont fusionnees par RRF ; aucun embedding
ni score brut n'est moyenne. Chaque image de reference cree egalement son
propre canal de classement.

Sans VLM, la recherche texte privilegie la precision : des qu'une caption, un
tag ou un nom de fichier apporte une preuve lexicale, les candidats issus
uniquement du canal dense sont retires. Si aucune preuve textuelle n'existe,
TinyCLIP conserve tous les candidats deja controles par le seuil absolu et la
marge relative. Aucun second top-k fixe n'est applique.

Avec le VLM, tous les survivants RRF sont verifies par lots. La taille du lot
controle la memoire et non le nombre final de resultats. Si le VLM echoue, le
filtre textuel sert de repli. La reponse expose ces decisions dans
`diagnostics.text_evidence_policy`, `diagnostics.vlm_rerank`, les volumes par
etape et leurs latences.

Les mots vides anglais et francais sont retires du canal lexical. Pour une
requete d'au moins trois termes significatifs, une image doit en couvrir au
moins deux pour constituer une preuve textuelle. Cette regle evite qu'un simple
`a`, `the`, `dans` ou un concept isole valide une image hors sujet.

Les termes proches sont regroupes en concepts avant le rappel lexical et le
filtrage. Par exemple, `people/person/man/woman/child`, les actions de jeu ou de
sport, et les principales variantes de nourriture partagent chacun un groupe.
Une requete de deux concepts comme `food on the table` doit couvrir les deux :
une chambre qui mentionne seulement `table` est donc rejetee.

Les reponses exposent `strategy`, `channels`, `warnings` et `diagnostics`. Pour
un prompt depassant la fenetre TinyCLIP, le canal dense est tronque
explicitement et le diagnostic l'indique, tandis que le canal lexical traite
la requete complete.

## Tests

```powershell
& 'c:\Users\choun\miniconda3\envs\env\python.exe' -m pytest backend\tests
```

## Image Docker hors ligne

L'image API n'accede pas a PyPI pendant sa construction. Preparer d'abord les
wheels Linux depuis la racine :

```powershell
.\scripts\prepare_backend_wheels.ps1
docker compose build api
```

Le dossier `backend/wheels/` est ignore par Git.

## Limites actuelles

- L'authentification reste une session locale frontend ; une authentification
  backend et des autorisations sont obligatoires avant exposition publique.
- Le clustering et le filtre facial ne sont pas encore exposes par l'API.
- Le worker ne genere pas encore de captions ou de miniatures.
- La suppression d'un shooting ne purge pas encore ses objets et vecteurs.
- Les ecrans clustering, filtres avances et assistant restent en mode
  experimental tant que leurs endpoints produit ne sont pas implementes.
