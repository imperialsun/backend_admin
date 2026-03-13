# Users and access

## Overview

The `/users` page centralizes:

- organization / search / selected-user filtering,
- user creation,
- profile editing,
- password reset,
- global roles,
- organization roles,
- permission overrides,
- effective permission display.

## Filters and URL state

Used parameters:

- `org`: target organization,
- `q`: free-text search,
- `user`: selected user.

Rules:

- super admin: freely chooses `org`,
- organization admin: `org` is forced to `session.organization.id`,
- if `user` no longer matches the current filter, the detail panel falls back to the first visible user.

## User creation

The creation form exposes:

- `email`
- `password`
- `status`

Mutation:

- `createUser(organizationId, input)`

Frontend conditions:

- an organization must be selected,
- `email` and `password` must be non-empty.

Success effects:

- "Utilisateur cree." message,
- form reset,
- invalidation of `["organization-users", organizationId]`,
- selection of the new user through the `user` URL parameter.

## User profile

Editable fields:

- `email`
- `status`
- `organizationId`

Scope rule:

- organization change is disabled for an organization admin,
- it remains available for a super admin.

Mutation:

- `updateUser(userId, { email, status, organizationId })`

## Password reset

Mutation:

- `updateUserPassword(userId, password)`
- `sendUserPasswordResetEmail(userId)`

UI message:

- "Mot de passe reinitialise. Toutes les sessions actives ont ete revoquees."

The frontend only relays the action; actual session revocation stays on the backend.

## User deletion

Mutation:

- `deleteUser(userId)`

UX:

- dedicated destructive action in the detail panel,
- inline confirmation before the network call,
- backend refusal messages surfaced as-is in the UI.

Backend guardrails:

- self-deletion is blocked,
- deleting the last active `super_admin` is blocked,
- deleting the last active `org_admin` in the organization is blocked.

Effects:

- hard deletion of the account,
- refresh session revocation through cascade cleanup,
- deletion of user-scoped data,
- reselection of the next visible user or removal of the `user` URL parameter.

## Roles and catalogs

Loaded catalogs:

- `fetchRolesCatalog()` -> `["roles-catalog"]`
- `fetchPermissionsCatalog()` -> `["permissions-catalog"]`
- `fetchUserAccess(userId)` -> `["user-access", userId]`

Managed roles:

- global roles, reserved to super admins,
- organization roles, tied to the current organization.

## Permission overrides

Each permission can be:

- `inherit`
- `allow`
- `deny`

Only `allow` and `deny` are sent to the backend. `inherit` is a local UI state.

Mutation:

- `updateUserEntitlements(userId, overrides)`

## Effective permissions

The final panel displays `effectivePermissions` resolved by the backend after combining:

- global roles,
- organization roles,
- overrides.

## Invalidation and feedback

After mutations, the page explicitly invalidates the affected queries:

- `["organization-users"]`
- `["user-access", userId]`

Each mutation shows a concise feedback message.

## Links

- Organizations: [`organizations.md`](organizations.md)
- Activity: [`activity-analytics.md`](activity-analytics.md)
- Security: [`security-privacy.md`](security-privacy.md)
