# Security and privacy

## General model

Demeter Admin Panel is a frontend client for the Demeter admin backend endpoints.

Key points:

- dedicated admin namespace under `/api/v1/admin/*`,
- dedicated backend auth flow,
- cookies transported with `credentials: include`,
- memory-only CSRF,
- authorization resolved on the backend.

## Auth and CSRF

Implementation:

- `src/lib/admin-api.ts`
- `src/lib/admin-client.ts`
- `src/lib/admin-security.ts`
- `src/lib/admin-session-context.tsx`

Properties:

- mutating requests add `X-Admin-CSRF` when the token is available,
- the CSRF token is never persisted,
- `adminLogout()` always clears the in-memory token.

## Browser storage

Explicit absence of auth persistence:

- no token in `localStorage`,
- no token in `sessionStorage`,
- no token in IndexedDB.

The backend may set its own session cookies, but the frontend neither stores nor parses them directly.

## Authorization

The frontend exposes ergonomic guards:

- `RequireAuth`
- `RequireSuperAdmin`
- conditional sidebar navigation filtering

But these guards do not replace backend checks. Effective permissions displayed in `/users` come from the admin backend after role and override resolution.

## Runtime config and exposure

The only exposed runtime parameter is `backendBaseUrl` through `runtime-config.js`.

Constraints:

- non-cacheable file,
- injected at container startup,
- must not contain secrets.

## Nginx hardening

`docker/nginx/admin.conf` applies, among others:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`
- `Strict-Transport-Security`

Cache policy:

- `runtime-config.js`: `no-store`
- `index.html`: `no-store`
- `/assets/`: long immutable cache

## CI/CD security

Main workflows:

- `ci.yml`
- `codeql.yml`
- `trivy.yml`
- `prod-smoke.yml`

The smoke test verifies, among other things:

- HTTP availability,
- SPA fallback,
- security headers,
- immutable cache on hashed assets.

## Links

- Auth and session: [`authentication-session.md`](authentication-session.md)
- Deployment: [`deployment-operations.md`](deployment-operations.md)
- CI: [`ci-quality-observability.md`](ci-quality-observability.md)
