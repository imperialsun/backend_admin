# Demeter Admin Panel

Demeter Admin Panel is a standalone React SPA for Demeter operators. This repository is independent from `Backend` and `Front user`: it has its own Git history, CI workflows, tests, Docker image, and documentation set.

## Stack

- React 19
- Vite 7
- TypeScript
- Tailwind CSS 4
- React Router 7
- TanStack React Query 5
- Vitest + Testing Library

## Quickstart

### Local development

```bash
npm ci
npm run dev
```

Default Vite URL: `http://localhost:4173`.

### Local validation

```bash
npm run docs:check
npm run lint
npm run test:ci
npm run build
```

### Preview build

```bash
npm run build
npm run preview
```

## Functional map

The current SPA ships:

- admin login and logout,
- dashboard activity overview,
- super-admin organization management,
- user management by organization,
- global and organization role assignment,
- permission override editing,
- password reset,
- activity analytics by date range, user, mode, and provider.

## Runtime configuration

The backend base URL is read at runtime from `window.__APP_RUNTIME_CONFIG__` through `src/lib/runtime-config.ts`.

Default value:

```js
window.__APP_RUNTIME_CONFIG__ = {
  backendBaseUrl: "http://localhost:8080/api/v1",
}
```

Runtime sources:

- local file: `public/runtime-config.js`,
- container startup injection through `BACKEND_BASE_URL`.

## Security model

- All admin traffic targets the dedicated admin namespace under `/api/v1/admin/*`.
- Admin session bootstrap uses `/admin/auth/me` first, then `/admin/auth/refresh` on `401`.
- Requests are sent with `credentials: include`.
- The admin CSRF token is stored in memory only and injected as `X-Admin-CSRF` on mutating requests.
- No auth token, password, or CSRF token is persisted in `localStorage`, `sessionStorage`, or IndexedDB.
- UI guards improve operator experience, but the backend remains the authorization source of truth.
- This repository must stay autonomous: no imports from `../Backend` or `../Front user`.

## Docker

The production image is a multi-stage build:

1. Node builds the Vite bundle.
2. Nginx serves `dist/` on port `8080`.
3. The entrypoint rewrites `runtime-config.js` from `BACKEND_BASE_URL`.

Example:

```bash
docker build -t demeter-admin-panel .
docker run --rm -p 4173:8080 \
  -e BACKEND_BASE_URL=http://localhost:8080/api/v1 \
  demeter-admin-panel
```

The runtime Nginx configuration provides:

- SPA fallback,
- `runtime-config.js` and `index.html` as non-cacheable,
- immutable cache on hashed assets,
- security headers verified by the smoke workflow.

## Full documentation

- Documentation portal: [`docs/README.md`](docs/README.md)
- French docs: [`docs/fr/index.md`](docs/fr/index.md)
- English docs: [`docs/en/index.md`](docs/en/index.md)

## Repository guides

- Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md)
- Security policy: [`SECURITY.md`](SECURITY.md)
