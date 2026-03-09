# Troubleshooting

## Login rejected

Symptoms:

- error message on `/login`,
- redirect loop back to `/login`,
- `401` on `/admin/auth/login` or `/admin/auth/me`.

Actions:

1. check `backendBaseUrl` in `/runtime-config.js`,
2. check that the backend really exposes `/api/v1/admin/*`,
3. inspect cookies and `Set-Cookie` responses in the network panel,
4. verify that admin credentials are valid on the backend side.

## `401` on `me` and refresh also fails

Symptom:

- the app loads but stays anonymous.

Actions:

1. inspect `/admin/auth/refresh`,
2. verify that the refresh cookie still exists,
3. verify cookie domain, secure flag, and backend path configuration.

## Empty organization list

Symptoms:

- empty organization selector,
- missing organization snapshot in the dashboard.

Actions:

1. verify the real scope of the current admin session,
2. inspect the response from `/admin/organizations`,
3. verify whether the current account is super admin or organization admin.

## No visible users

Symptoms:

- "Selectionnez une organisation pour gerer ses utilisateurs." message,
- or an empty table after organization selection.

Actions:

1. for a super admin, explicitly choose an organization,
2. inspect `/admin/organizations/{organizationId}/users`,
3. verify the `q` filter and `user` parameter.

## `403` / access denied

Symptom:

- redirect to `/forbidden`.

Probable causes:

- attempt to access `/organizations` without the super admin role,
- valid session but insufficient rights.

Action:

- inspect the global roles returned in `AdminSessionPayload`.

## CSRF errors on mutations

Symptoms:

- `403` or `401` on `POST`, `PATCH`, or `PUT`,
- reads succeed but mutations fail.

Actions:

1. verify that `csrfToken` is returned in the session payload,
2. verify that `X-Admin-CSRF` is present in the request,
3. verify that the session did not expire between read and mutation.

## No activity data

Symptoms:

- zero totals,
- empty tables.

Actions:

1. verify the `from` / `to` range,
2. verify the `org` filter,
3. inspect the response from `/admin/activity/summary`.

## Docker headers or fallback incorrect

Actions:

1. inspect `docker/nginx/admin.conf`,
2. run `curl -I http://localhost:4173/index.html`,
3. run `curl -I http://localhost:4173/users`,
4. run `curl -I http://localhost:4173/runtime-config.js`.

## CI fails on docs

Actions:

1. run `npm run docs:check`,
2. fix broken relative links,
3. verify `docs/fr` / `docs/en` parity,
4. verify that root files are not empty.
