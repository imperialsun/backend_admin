# Utilisateurs et droits

## Vue d ensemble

La page `/users` centralise:

- filtre organisation / recherche / utilisateur selectionne,
- creation d utilisateur,
- edition du profil,
- reset de mot de passe,
- roles globaux,
- roles organisation,
- overrides de permissions,
- lecture des permissions effectives.

## Filtres et URL state

Parametres utilises:

- `org`: organisation cible,
- `q`: texte libre,
- `user`: utilisateur selectionne.

Regles:

- super admin: choisit librement `org`,
- admin organisation: `org` est force a `session.organization.id`,
- si `user` ne correspond pas au filtre courant, le panneau detail bascule sur le premier utilisateur visible.

## Creation d utilisateur

Le formulaire de creation expose:

- `email`
- `password`
- `status`

Mutation:

- `createUser(organizationId, input)`

Conditions front:

- une organisation doit etre selectionnee,
- `email` et `password` doivent etre non vides.

Effets de succes:

- message "Utilisateur cree.",
- reset du formulaire,
- invalidation de `["organization-users", organizationId]`,
- selection du nouvel utilisateur via le parametre `user`.

## Profil utilisateur

Edition possible:

- `email`
- `status`
- `organizationId`

Regle de scope:

- le changement d organisation est desactive pour un admin organisation,
- il reste disponible pour un super admin.

Mutation:

- `updateUser(userId, { email, status, organizationId })`

## Reset mot de passe

Mutation:

- `updateUserPassword(userId, password)`

Message UI:

- "Mot de passe reinitialise. Toutes les sessions actives ont ete revoquees."

Le front relaie l operation; la revocation effective des sessions reste cote backend.

## Roles et catalogues

Catalogues charges:

- `fetchRolesCatalog()` -> `["roles-catalog"]`
- `fetchPermissionsCatalog()` -> `["permissions-catalog"]`
- `fetchUserAccess(userId)` -> `["user-access", userId]`

Roles geres:

- roles globaux, reserves au super admin,
- roles organisation, lies a l organisation de rattachement.

## Overrides de permissions

Chaque permission peut etre:

- `inherit`
- `allow`
- `deny`

Seules les valeurs `allow` et `deny` sont envoyees au backend. `inherit` est un etat UI local.

Mutation:

- `updateUserEntitlements(userId, overrides)`

## Permissions effectives

Le panneau final affiche `effectivePermissions` resolues par le backend apres combinaison:

- roles globaux,
- roles organisation,
- overrides.

## Invalidation et feedback

Apres mutation, la page invalide explicitement les queries affectees:

- `["organization-users"]`
- `["user-access", userId]`

Chaque mutation affiche un message de feedback concis.

## Liens

- Organisations: [`organizations.md`](organizations.md)
- Activite: [`activity-analytics.md`](activity-analytics.md)
- Securite: [`security-privacy.md`](security-privacy.md)
