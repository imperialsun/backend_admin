# Demarrage rapide

## Prerequis

- Node.js `25.6.1` (voir `.nvmrc`).
- npm.
- Docker Engine pour build et execution conteneurisee.
- Un backend Demeter accessible sur le namespace admin.

## Setup local

```bash
npm ci
npm run dev
```

Serveur Vite par defaut: `http://localhost:4173`.

## Build et preview

```bash
npm run build
npm run preview
```

Le preview utilise aussi le port `4173`.

## Scripts utiles

- `npm run dev`: serveur Vite.
- `npm run docs:check`: validation docs (presence, parite FR/EN, liens, ancres).
- `npm run lint`: ESLint.
- `npm run test`: Vitest en watch.
- `npm run test:ci`: tests + couverture.
- `npm run build`: build TypeScript + Vite.

## Runtime config

Le backend cible est lu depuis `public/runtime-config.js` en local et depuis `BACKEND_BASE_URL` dans l image Docker.

Valeur par defaut:

```js
window.__APP_RUNTIME_CONFIG__ = {
  backendBaseUrl: "http://localhost:8080/api/v1",
}
```

## Build Docker

```bash
docker build -t demeter-admin-panel .
docker run --rm -p 4173:8080 \
  -e BACKEND_BASE_URL=http://localhost:8080/api/v1 \
  demeter-admin-panel
```

## Erreurs frequentes de setup

### Port `4173` deja pris

Symptome: Vite refuse de demarrer car `strictPort` est actif.

Action:

- liberer le port `4173`,
- ou arreter le processus local qui occupe deja ce port.

### Backend admin indisponible

Symptome: login refuse, dashboard vide, ou erreurs reseau sur `/admin/*`.

Actions:

- verifier `public/runtime-config.js`,
- verifier que le backend expose bien `/api/v1/admin/*`,
- verifier les cookies/session admin dans l onglet network.

### Runtime config incoherente en conteneur

Symptome: l application charge mais vise la mauvaise URL backend.

Actions:

- verifier la valeur `BACKEND_BASE_URL`,
- verifier le contenu servi de `/runtime-config.js`,
- reconstruire ou relancer le conteneur si necessaire.

## Suite recommandee

- Architecture: [`architecture.md`](architecture.md)
- Auth et session: [`authentication-session.md`](authentication-session.md)
- Deploiement: [`deployment-operations.md`](deployment-operations.md)
