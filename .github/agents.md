# AI Agent Instructions — Demeter Admin Panel

Quick facts

- Run locally: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Test: `npm run test:ci`
- Docker: `docker build .`

Architecture

- Entry: `src/main.tsx`
- Router and guards: `src/App.tsx`
- Session bootstrap: `src/lib/admin-session-context.tsx`
- Session hook/context: `src/lib/use-admin-session.ts`, `src/lib/admin-session-store.ts`
- Backend HTTP client: `src/lib/admin-api.ts`, `src/lib/admin-client.ts`
- Screens: `src/routes/*`
- Layout and primitives: `src/components/*`
- Runtime config: `src/lib/runtime-config.ts`, `public/runtime-config.js`

Security invariants

- Keep admin auth isolated to `/api/v1/admin/*`.
- Never store auth tokens, CSRF tokens or passwords in browser storage.
- Keep CSRF in memory only.
- Do not add imports from `../Backend` or `../Front user`.
- Do not trust UI guards as security; backend remains the source of truth.

Rules for changes

- Any new feature or refactor must include unit/component tests.
- Keep data fetching in React Query and UI state in React local state unless there is a clear reason otherwise.
- Keep runtime configuration externalized; do not hardcode environment-specific URLs in components.
- Preserve the Docker and Nginx security headers model when changing deployment files.

Required pre-commit checks

```bash
npm run lint
npm run test:ci
npm run build
docker build .
```

Commit policy

- Before commit/push, share:
  - diff
  - outputs of `npm run lint`
  - outputs of `npm run test:ci`
  - outputs of `npm run build`
- Wait for explicit user approval before `git commit` / `git push`.
