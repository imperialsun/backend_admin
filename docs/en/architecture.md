# Architecture

## Overview

Demeter Admin Panel is a React/TypeScript SPA organized in layers:

- `src/main.tsx`: React Query, router, and session provider bootstrap,
- `src/App.tsx`: protected routes and super-admin guard,
- `src/routes/*`: page-level business screens,
- `src/components/layout/*`: shell, sidebar, topbar,
- `src/lib/admin-api.ts`: low-level HTTP layer,
- `src/lib/admin-client.ts`: typed API surface,
- `src/lib/admin-session-context.tsx`: session bootstrap and exposure,
- `src/lib/runtime-config.ts`: single runtime config reader.

## Major components

| Area | Key file(s) | Role |
| --- | --- | --- |
| Bootstrap | `src/main.tsx` | initializes React, React Query, and BrowserRouter |
| Routing | `src/App.tsx` | protects routes and applies `RequireSuperAdmin` |
| Session | `src/lib/admin-session-context.tsx` | calls `me`, then `refresh` on `401` |
| Session hook | `src/lib/use-admin-session.ts` | single entry point for components |
| Low-level HTTP | `src/lib/admin-api.ts` | `credentials: include`, JSON, typed errors, CSRF injection |
| Typed client | `src/lib/admin-client.ts` | admin auth, organizations, users, catalogs, activity endpoints |
| Types | `src/lib/types.ts` | session, users, organizations, roles, permissions, activity contracts |
| Layout | `src/components/layout/*` | admin shell, navigation, topbar |
| Pages | `src/routes/*` | login, dashboard, organizations, users, activity, forbidden |

## Diagram: bootstrap and session

```mermaid
flowchart TD
    A[main.tsx] --> B[QueryClientProvider]
    B --> C[BrowserRouter]
    C --> D[AdminSessionProvider]
    D --> E[initializeAdminSession]
    E --> F{/admin/auth/me OK?}
    F -->|Yes| G[Set session]
    F -->|401| H[/admin/auth/refresh]
    H --> I{refresh OK?}
    I -->|Yes| G
    I -->|No| J[Null session]
    G --> K[Render App routes]
    J --> K
```

## Application routing

Main routes:

- `/login`: admin authentication,
- `/dashboard`: quick operating view,
- `/organizations`: organization management, reserved for super admins,
- `/users`: account, role, and override management,
- `/activity`: detailed activity analytics,
- `/forbidden`: access denied screen.

`RequireAuth` protects every internal route. `RequireSuperAdmin` explicitly blocks `/organizations`.

## State and data flow

- Session context is managed by `AdminSessionProvider`.
- Server data is loaded through TanStack React Query.
- Forms stay in local `useState`.
- This repo does not use a persistent application store.

Global React Query parameters:

- `retry: false`,
- `staleTime: 15_000`.

## URL state and UI state

- `DashboardPage` keeps date / organization filters in local state.
- `ActivityPage` stores `from`, `to`, `org` in the URL.
- `UsersPage` stores `org`, `q`, `user` in the URL to preserve operator context.

## Runtime config

`src/lib/runtime-config.ts` remains the single source of truth for `backendBaseUrl`.

Read order:

1. read `window.__APP_RUNTIME_CONFIG__`,
2. if missing, use `http://localhost:8080/api/v1` only for local `http://localhost` development,
3. otherwise fall back to `/api/v1`,
4. strip trailing slashes and normalize relative paths.

## Useful links

- Auth and session: [`authentication-session.md`](authentication-session.md)
- Runtime settings: [`settings-reference.md`](settings-reference.md)
- Activity: [`activity-analytics.md`](activity-analytics.md)
