# Getting started

## Prerequisites

- Node.js `25.6.1` (see `.nvmrc`).
- npm.
- Docker Engine for containerized build and runtime.
- A reachable Demeter backend exposing the admin namespace.

## Local setup

```bash
npm ci
npm run dev
```

Default Vite server: `http://localhost:4173`.

## Build and preview

```bash
npm run build
npm run preview
```

Preview also runs on port `4173`.

## Useful scripts

- `npm run dev`: Vite dev server.
- `npm run docs:check`: documentation validation (presence, FR/EN parity, links, anchors).
- `npm run lint`: ESLint.
- `npm run test`: watch-mode Vitest.
- `npm run test:ci`: tests plus coverage.
- `npm run build`: TypeScript + Vite build.

## Runtime config

The target backend is read from `public/runtime-config.js` locally and from `BACKEND_BASE_URL` in the Docker image.

Default value:

```js
window.__APP_RUNTIME_CONFIG__ = {
  backendBaseUrl: "http://localhost:8080/api/v1",
}
```

## Docker build

```bash
docker build -t demeter-admin-panel .
docker run --rm -p 4173:8080 \
  -e BACKEND_BASE_URL=http://localhost:8080/api/v1 \
  demeter-admin-panel
```

## Common setup failures

### Port `4173` already in use

Symptom: Vite refuses to start because `strictPort` is enabled.

Action:

- free port `4173`,
- or stop the local process already using it.

### Admin backend unavailable

Symptom: login fails, dashboard stays empty, or `/admin/*` requests fail.

Actions:

- check `public/runtime-config.js`,
- check that the backend really exposes `/api/v1/admin/*`,
- inspect admin cookies and session responses in the network panel.

### Wrong runtime config inside the container

Symptom: the app loads but calls the wrong backend URL.

Actions:

- check `BACKEND_BASE_URL`,
- inspect the served `/runtime-config.js`,
- rebuild or restart the container if needed.

## Recommended next steps

- Architecture: [`architecture.md`](architecture.md)
- Auth and session: [`authentication-session.md`](authentication-session.md)
- Deployment: [`deployment-operations.md`](deployment-operations.md)
