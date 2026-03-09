# Glossaire

## Admin session

Contexte de session renvoye par le backend admin avec user, organisation, roles, permissions et eventuel `csrfToken`.

## Super admin

Utilisateur possedant le role global `super_admin`. Il peut acceder a la page organisations et changer l organisation d un utilisateur.

## Org admin

Utilisateur admin limite a son organisation de rattachement.

## Global role

Role applique a l echelle globale et gere via `/admin/users/{id}/global-roles`.

## Org role

Role applique a l echelle d une organisation et gere via `/admin/users/{id}/org-roles`.

## Permission override

Forcage explicite d une permission en `allow` ou `deny` au niveau utilisateur.

## Effective permissions

Liste finale de permissions resolues par le backend apres combinaison des roles et overrides.

## CSRF

Jeton ajoute au header `X-Admin-CSRF` sur les requetes mutantes.

## Runtime config

Configuration injectee au runtime via `window.__APP_RUNTIME_CONFIG__`.

## SPA fallback

Regle Nginx qui sert `index.html` pour les routes front comme `/users` ou `/activity`.
