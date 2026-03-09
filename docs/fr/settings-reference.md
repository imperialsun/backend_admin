# Reference des parametres

## Objectif

Ce document reference les parametres runtime et conventions d etat utilises par le client admin.

Contrairement au `Front user`, ce repo ne persiste pas un grand bloc de settings operateur. Le front admin repose surtout sur:

- la config runtime backend,
- la session backend,
- le cache React Query,
- l etat local des formulaires et filtres.

## Runtime config

Source de verite:

- `window.__APP_RUNTIME_CONFIG__.backendBaseUrl`

Lecture via:

- `src/lib/runtime-config.ts`

Valeur par defaut:

- `http://localhost:8080/api/v1` uniquement en dev local sur `http://localhost`
- `/api/v1` sur les autres environnements quand `runtime-config.js` est absent ou vide

Normalisation:

- suppression des slashs finaux,
- ajout d un slash initial pour les chemins relatifs,
- cache memoize cote client jusqu a reset explicite en tests.

## Session et securite

Etat non persiste:

- session admin actuelle,
- token CSRF admin,
- etat de chargement du contexte session.

Stockage:

- CSRF: memoire uniquement,
- cookies session: geres par le backend et transportes par le navigateur,
- aucun secret auth dans `localStorage`, `sessionStorage` ou IndexedDB.

## React Query

Configuration globale:

- `retry: false`
- `staleTime: 15_000`

Query keys utilisees:

- `["organizations"]`
- `["dashboard-summary", from, to, organizationId]`
- `["activity-summary", from, to, organizationId]`
- `["roles-catalog"]`
- `["permissions-catalog"]`
- `["organization-users", organizationId]`
- `["user-access", userId]`

## URL params utilises

`/activity`:

- `from`
- `to`
- `org`

`/users`:

- `org`
- `q`
- `user`

`/login`:

- pas de query param dedie,
- redirection conservee via `location.state.from`.

## Notes de tests

`resetRuntimeConfigForTests()` permet de vider le cache de config entre scenarios.

## Liens

- Architecture: [`architecture.md`](architecture.md)
- Auth et session: [`authentication-session.md`](authentication-session.md)
