# Glossary

## Admin session

Session context returned by the admin backend with user, organization, roles, permissions, and an optional `csrfToken`.

## Super admin

User holding the global `super_admin` role. This user can access the organizations page and change a user's organization.

## Org admin

Admin user limited to the current organization scope.

## Global role

Role applied at global level and managed through `/admin/users/{id}/global-roles`.

## Org role

Role applied at organization level and managed through `/admin/users/{id}/org-roles`.

## Permission override

Explicit per-user forcing of a permission to `allow` or `deny`.

## Effective permissions

Final permission list resolved by the backend after combining roles and overrides.

## CSRF

Token added to the `X-Admin-CSRF` header on mutating requests.

## Runtime config

Configuration injected at runtime through `window.__APP_RUNTIME_CONFIG__`.

## SPA fallback

Nginx rule that serves `index.html` for frontend routes such as `/users` or `/activity`.
