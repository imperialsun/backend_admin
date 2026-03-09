# Settings reference

## Purpose

This document references the runtime parameters and state conventions used by the admin client.

Unlike `Front user`, this repo does not persist a large operator settings blob. The admin frontend mainly relies on:

- backend runtime configuration,
- backend session state,
- React Query cache,
- local form and filter state.

## Runtime config

Source of truth:

- `window.__APP_RUNTIME_CONFIG__.backendBaseUrl`

Read through:

- `src/lib/runtime-config.ts`

Default value:

- `http://localhost:8080/api/v1` only for local `http://localhost` development
- `/api/v1` in other environments when `runtime-config.js` is missing or empty

Normalization:

- trailing slash removal,
- leading slash enforcement for relative paths,
- client-side memoized cache until explicit reset in tests.

## Session and security

Non-persisted state:

- current admin session,
- admin CSRF token,
- session loading flag.

Storage:

- CSRF: memory only,
- session cookies: managed by the backend and transported by the browser,
- no auth secret in `localStorage`, `sessionStorage`, or IndexedDB.

## React Query

Global configuration:

- `retry: false`
- `staleTime: 15_000`

Used query keys:

- `["organizations"]`
- `["dashboard-summary", from, to, organizationId]`
- `["activity-summary", from, to, organizationId]`
- `["roles-catalog"]`
- `["permissions-catalog"]`
- `["organization-users", organizationId]`
- `["user-access", userId]`

## Used URL params

`/activity`:

- `from`
- `to`
- `org`

`/users`:

- `org`
- `q`
- `user`

`/login`:

- no dedicated query parameter,
- redirect preserved through `location.state.from`.

## Test notes

`resetRuntimeConfigForTests()` clears the config cache between scenarios.

## Links

- Architecture: [`architecture.md`](architecture.md)
- Auth and session: [`authentication-session.md`](authentication-session.md)
