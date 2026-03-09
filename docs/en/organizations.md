# Organizations

## Purpose

The organizations page allows super admins to list, create, and edit admin tenants exposed by the backend.

## Visibility

- The sidebar link only appears for super admins.
- The `/organizations` route is protected by `RequireSuperAdmin`.
- An organization admin is redirected to `/forbidden`.

## Read flow

The list is loaded through `fetchOrganizations()` with the React Query key:

- `["organizations"]`

Displayed fields:

- `name`
- `code`
- `status`
- `updatedAt`

## Creation

The creation form exposes:

- `name`
- `code`
- `status`

Mutation:

- `createOrganization({ name, code, status })`

Success effects:

- "Organisation creee." message,
- form reset,
- invalidation of `["organizations"]`.

## Editing

Each row can switch to inline edit mode for:

- `name`
- `code`
- `status`

Mutation:

- `updateOrganization(id, payload)`

Success effects:

- "Organisation mise a jour." message,
- exit edit mode,
- invalidation of `["organizations"]`.

## Frontend functional limits

- No organization deletion.
- No frontend pagination or server-side sorting logic.
- The frontend does not enforce business rules on `code` or `status`; final validation stays on the backend.

## Links

- Auth and scope: [`authentication-session.md`](authentication-session.md)
- Users and access: [`users-access.md`](users-access.md)
