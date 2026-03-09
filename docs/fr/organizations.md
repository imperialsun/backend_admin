# Organisations

## Objectif

La page organisations permet aux super admins de lister, creer et modifier les tenants admin exposes par le backend.

## Visibilite

- Le lien sidebar n apparait que pour les super admins.
- La route `/organizations` est protegee par `RequireSuperAdmin`.
- Un admin organisation est redirige vers `/forbidden`.

## Lecture

La liste est chargee via `fetchOrganizations()` avec la query React Query:

- `["organizations"]`

Champs affiches:

- `name`
- `code`
- `status`
- `updatedAt`

## Creation

Le formulaire de creation expose:

- `name`
- `code`
- `status`

Mutation:

- `createOrganization({ name, code, status })`

Effets de succes:

- message "Organisation creee.",
- reset du formulaire,
- invalidation de `["organizations"]`.

## Edition

Chaque ligne peut passer en mode edition inline pour:

- `name`
- `code`
- `status`

Mutation:

- `updateOrganization(id, payload)`

Effets de succes:

- message "Organisation mise a jour.",
- sortie du mode edition,
- invalidation de `["organizations"]`.

## Limites fonctionnelles cote front

- Pas de suppression d organisation.
- Pas de pagination ni de tri serveur cote front.
- Le front ne force pas de regles metier sur `code` ou `status`; la validation finale reste cote backend.

## Liens

- Auth et scope: [`authentication-session.md`](authentication-session.md)
- Users et droits: [`users-access.md`](users-access.md)
