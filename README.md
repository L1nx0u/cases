# cases — tableau de cases

Un portfolio réduit à son geste de base : une grille de cases. **Vide par défaut.**
Personne ne peut rien poser sans le mot de passe. Une case = un lien vers un site, ou un
dossier qui contient d'autres cases (imbricables à volonté).

Design : interface sombre, une seule accent lime sur neutre chaud. Les **dossiers ont la
silhouette d'un dossier** (onglet découpé en `clip-path`, épaulements diagonaux, rabat
tinté) et les liens une carte rectangle : on les distingue sans lire. Chaque case porte une
icône — emoji choisi dans la palette, ou URL d'image — et retombe sur un monogramme coloré
dérivé de l'hôte quand aucune icône n'est définie. Typo `Outfit` + `DM Mono`.

Navigation : recherche instantanée sur tout l'arbre (résultats aplatifiés avec leur chemin
d'origine), ouverture des dossiers sans rechargement, `n` nouvelle case, `/` recherche,
`Échap` ferme l'éditeur. Édition en place : la console est devenue la barre supérieure du
tableau, un enregistreur flottant valide les changements.

## Ce qui est public / ce qui est privé

| URL | accès |
|---|---|
| `/` | public — la grille ; avec la session admin, les contrôles d'édition apparaissent |
| `/f/<slug>/<slug>…` | public — un dossier et ses cases |
| `/login` | formulaire du mot de passe |
| `/admin` | redirige vers `/` (console en ligne) ou `/login` (session absente) |
| `PUT /api/tree` | **protégé** — écriture de l'arbre entier |

La lecture est ouverte, l'écriture est fermée. Pas de compte, pas de base de données,
pas de dépendance à une API tierce.

## Stack

- Next.js 15 (App Router, RSC) + TypeScript, CSS écrit à la main (`app/globals.css`, aucun framework CSS)
- Stockage : **Vercel Blob** (`portfolio/data.json`, un seul fichier JSON, écrasé à chaque enregistrement),
  authentification **OIDC** via `BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN`
- Repli local : `data/portfolio.json` hors Vercel (dev uniquement)
- Session admin : cookie `httpOnly` signé en HMAC-SHA256, 30 jours

## Lancer en local

```bash
npm install
cp .env.example .env.local   # puis mets un vrai ADMIN_PASSWORD
npm run dev                  # http://localhost:3000
```

`npm run build` et `npm run typecheck` passent tous les deux.

## Déployer sur Vercel

Le projet `weshlynx/cases` est déjà lié (`.vercel/`, gitignoré) et le store Blob
`cases-data` (région `cdg1`, accès public) est connecté en **OIDC**.

```bash
vercel link --yes --project cases
vercel storage create cases-data --type blob --access public --region cdg1
vercel storage connect cases-data --yes
vercel env add ADMIN_PASSWORD --environment production --force
vercel env add SESSION_SECRET --environment production --force
vercel --prod
```

Deux modes d'authentification Blob sont gérés par `lib/store.ts` :

- **OIDC** (actif ici) : la connexion du store injecte `BLOB_STORE_ID` et le SDK s'autofirme
  avec `VERCEL_OIDC_TOKEN`. Aucun jeton statique à stocker.
- **Jeton statique** : `BLOB_READ_WRITE_TOKEN`, si tu crées le store depuis le dashboard sans
  connexion OIDC.

Sans l'un des deux, l'app retombe sur `data/portfolio.json` : parfait en local, inutile en
production (le filesystem serverless est en lecture seule).

Variables à renseigner :

- `ADMIN_PASSWORD` — le mot de passe de la console (long, aléatoire)
- `SESSION_SECRET` — secret de signature des cookies (le changer invalide toutes les sessions ouvertes)

## Éditer le tableau

Connecte-toi sur `/login` : le tableau se pilote alors depuis sa propre barre supérieure.

- `+ Nouvelle case` ouvre un lien sortant, `+ Dossier` un conteneur de cases. Les deux
  boutons existent aussi en pied de grille quand un niveau est vide.
- Survoler une carte fait apparaître `✎` : l'éditeur s'ouvre en place (titre, icône, adresse,
  note, étiquettes, emplacement). L'adresse publique est déduite du titre et affichée en bas.
- **Icônes** : 32 glyphes dans la palette, ou n'importe quel emoji collé dans le champ, ou
  l'URL d'une image. Sans icône, une carte de lien reçoit un monogramme coloré dérivé de son
  hôte ; un dossier garde sa silhouette, son rabat suffit.
- **Déplacer** une case se fait par le champ « emplacement » (la liste exclut ses propres
  sous-dossiers, impossible donc de l'enferrer dans elle-même).
- Rien n'est écrit avant le bouton **enregistrer** de la barre flottante ; `annuler` revient à
  l'état publié.
- Raccourcis : `/` recherche, `n` nouvelle case, `Échap` ferme l'éditeur.

## Notes de sécurité (honnêtes)

- Le mot de passe est comparé en temps constant ; les URL `javascript:` et autres sont rejetées
  à l'écriture, sur le champ `url` comme sur un champ `icon` qui y ressemble (`isSafeUrl`).
- L'anti-brute-force (`lib/auth.ts:rateLimit`) est **par instance** : sur serverless, un attaquant distribué peut le contourner. La vraie défense est un `ADMIN_PASSWORD` long et aléatoire.
- L'arbre est stocké en public (Blob `access: "public"`), donc **les titres, notes et liens sont lisibles par quiconque devinant l'URL du JSON**. C'est un portfolio, pas un coffre. Si tu veux du privé, passe le blob en privé et sers l'arbre par une route authentifiée.
- Le dossier `data/` local est gitignoré : ton contenu de dev ne part pas sur GitHub.

## Écrire sans écraser

`PUT /api/tree` remplace l'arbre entier : sans garde-fou, un onglet resté ouvert publie son
vieil état et **fait disparaître tout ce qui a été créé depuis**. Le client envoie donc la
`version` reçue en chargeant (`versionOf()` = signature du contenu, `lib/tree.ts`), et le
serveur refuse le décalage par un `409` accompagné de l'arbre courant ; la barre de sauvegarde
affiche alors « recharger la version publiée ». Deux onglets ouverts depuis des heures ne
peuvent plus se marcher dessus.

Reste une fenêtre de **6 à 12 s** aprés une écriture : Vercel Blob met ce temps à refléter sa
propre donnée (`head()` annonce `max-age=60`, et un paramètre de query ne casse pas la clé de
cache du CDN, qui se fait sur le chemin). Concretement :

- ton onglet à toi est juste immédiatement — il garde son état local et ne relit pas ;
- un rechargement ou un autre visiteur peut voir l'état précédent quelques secondes ;
- deux sauvegardes a moins de dix secondes d'intervalle peuvent declencher un `409` abusif.
  Il est dans le bon sens (il refuse d'ecrire) : un rechargement suffit.

Pour une cohérence forte il faudrait KV ou Postgres ; le portage est une question de
`lib/store.ts`, le reste de l'app ne parle qu'a `load()` et `savePortfolio()`.

## Structure

```
app/
  page.tsx                 grille racine (garde admin lue cote serveur)
  f/[...path]/page.tsx     dossiers imbriques
  admin/page.tsx           redirecteur selon la session
  login/page.tsx           formulaire
  api/session/route.ts     connexion (JSON + formulaire HTML)
  api/logout/route.ts      deconnexion
  api/tree/route.ts        lecture / ecriture de l'arbre
  globals.css              toute l'identite visuelle (variables en :root)
components/
  Chrome.tsx               barre haute, fil d'ariane, carte, carte-dossier, icone
  BoardApp.tsx             etat client : recherche, navigation, editeur, sauvegarde
lib/
  tree.ts                  modele, slugs, deplacements, normalisation, icones
  nodes.ts                 recherche/mise a jour/liste des dossiers
  store.ts                 Blob <-> fichier local
  auth.ts                  mot de passe, cookie signe, rate limit
```

Palette et rayons : `app/globals.css:1` (`--bg`, `--surface`, `--accent`).
Silhouette du dossier : `app/globals.css:428` (`.folder-shell`, variables `--tab` et `--notch`).
Palette d'icônes : `components/BoardApp.tsx:49` (`ICON_CODEPOINTS`, construite par points de
code pour survivre aux encodages).
Retombée monogramme : `components/Chrome.tsx:23` (`CardIcon`).
