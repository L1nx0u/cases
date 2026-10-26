# cases — tableau de cases

Un portfolio réduit à son geste de base : une grille de cases. **Vide par défaut.**
Personne ne peut rien poser sans le mot de passe. Une case = un lien vers un site, ou un
dossier qui contient d'autres cases (imbricables à volonté).

Design : papier d'archive, bordures tremblées dessinées à la main, scotch au survol,
ombres franches, tampon vermillon en mode admin. `Bricolage Grotesque` + `IBM Plex Mono`.

## Ce qui est public / ce qui est privé

| URL | accès |
|---|---|
| `/` | public — la grille |
| `/f/<slug>/<slug>…` | public — un dossier et ses cases |
| `/admin` | **protégé** — console de création |
| `/login` | formulaire du mot de passe |
| `PUT /api/tree` | **protégé** — écriture de l'arbre entier |

La lecture est ouverte, l'écriture est fermée. Pas de compte, pas de base de données,
pas de dépendance à une API tierce.

## Stack

- Next.js 15 (App Router, RSC) + TypeScript, CSS écrit à la main (`app/globals.css`, aucun framework CSS)
- Stockage : **Vercel Blob** (`portfolio/data.json`, un seul fichier JSON, écrasé à chaque enregistrement)
- Repli local : `data/portfolio.json` quand `BLOB_READ_WRITE_TOKEN` est absent (dev uniquement)
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

## Utiliser la console

- `+ case` crée un lien sortant, `+ dossier` crée un conteneur de cases.
- `éditer` ouvre titre / url / note / étiquettes ; l'URL publique est déduite du titre (slug) et affichée en bas de l'éditeur.
- Glisser une case sur une autre la place **avant** ; sur un dossier, l'**y range** ; sous la liste, la met **à la fin**. Le menu « déplacer vers » fait le même travail au clavier.
- Rien n'est écrit tant que tu n'as pas cliqué **enregistrer** (bouton grisé tant que l'état n'est pas modifié).
- Onglet **json brut** : édition directe de l'arbre entier, avec validation au retour. Utile pour coller une longue liste de liens d'un coup.

## Notes de sécurité (honnêtes)

- Le mot de passe est comparé en temps constant ; les URL `javascript:` et autres sont rejetées à l'écriture comme à l'affichage (`isSafeUrl`).
- L'anti-brute-force (`lib/auth.ts:rateLimit`) est **par instance** : sur serverless, un attaquant distribué peut le contourner. La vraie défense est un `ADMIN_PASSWORD` long et aléatoire.
- L'arbre est stocké en public (Blob `access: "public"`), donc **les titres, notes et liens sont lisibles par quiconque devinant l'URL du JSON**. C'est un portfolio, pas un coffre. Si tu veux du privé, passe le blob en privé et sers l'arbre par une route authentifiée.
- Le fichier `data/portfolio.json` local est gitignoré : ton contenu de dev ne part pas sur GitHub.

## Structure

```
app/
  page.tsx                 grille racine
  f/[...path]/page.tsx     dossiers imbriqués
  admin/page.tsx           garde + console
  login/page.tsx           formulaire
  api/session/route.ts     connexion (JSON + formulaire HTML)
  api/logout/route.ts      déconnexion
  api/tree/route.ts        lecture / écriture de l'arbre
  globals.css              toute l'identité visuelle (variables en :root)
components/
  Board.tsx                masthead, fil d'ariane, cartes, cases vides
  AdminConsole.tsx         éditeur client (création, glisser-déposer, JSON)
  deco.tsx                 trait dessiné à la main + inclinaison des cartes
lib/
  tree.ts                  modèle, slugs, déplacements, normalisation
  nodes.ts                 recherche/mise à jour/liste des dossiers
  store.ts                 Blob <-> fichier local
  auth.ts                  mot de passe, cookie signé, rate limit
```

Pour changer la palette : `app/globals.css:1` (`--paper`, `--ink`, `--stamp`).
Pour changer l'inclinaison maximale des cartes : `components/deco.tsx:15` (`tiltOf`).
