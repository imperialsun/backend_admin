# Depannage

## Login refuse

Symptomes:

- message d erreur sur `/login`,
- boucle vers `/login`,
- `401` sur `/admin/auth/login` ou `/admin/auth/me`.

Actions:

1. verifier `backendBaseUrl` dans `/runtime-config.js`,
2. verifier que le backend expose bien le namespace `/api/v1/admin/*`,
3. verifier cookies et reponses `Set-Cookie` dans l onglet network,
4. verifier que les identifiants admin sont valides cote backend.

## `401` sur `me` puis refresh echoue

Symptome:

- l app charge puis reste anonyme.

Actions:

1. verifier `/admin/auth/refresh`,
2. verifier que le refresh cookie existe encore,
3. verifier domaine, secure flag et path des cookies backend.

## Liste d organisations vide

Symptomes:

- select organisation vide,
- dashboard sans snapshot organisation attendu.

Actions:

1. verifier le scope reel de la session admin,
2. verifier la reponse de `/admin/organizations`,
3. verifier si le compte courant est super admin ou admin organisation.

## Aucun utilisateur visible

Symptomes:

- message "Selectionnez une organisation pour gerer ses utilisateurs.",
- ou tableau vide apres selection.

Actions:

1. pour un super admin, choisir explicitement une organisation,
2. verifier `/admin/organizations/{organizationId}/users`,
3. verifier le filtre `q` et le parametre `user`.

## `403` / acces refuse

Symptome:

- redirection vers `/forbidden`.

Causes probables:

- tentative d acces a `/organizations` sans role super admin,
- session valide mais droits insuffisants.

Action:

- verifier les roles globaux renvoyes par `AdminSessionPayload`.

## Erreurs CSRF sur mutations

Symptomes:

- `403` ou `401` sur `POST`, `PATCH` ou `PUT`,
- lecture OK mais mutations KO.

Actions:

1. verifier que `csrfToken` est bien renvoye dans le payload de session,
2. verifier que `X-Admin-CSRF` part bien dans la requete,
3. verifier que la session n a pas expire entre lecture et mutation.

## Pas de donnees d activite

Symptomes:

- totaux a zero,
- tableaux vides.

Actions:

1. verifier la plage `from` / `to`,
2. verifier le filtre `org`,
3. verifier la reponse de `/admin/activity/summary`.

## Headers ou fallback Docker incorrects

Actions:

1. verifier `docker/nginx/admin.conf`,
2. tester `curl -I http://localhost:4173/index.html`,
3. tester `curl -I http://localhost:4173/users`,
4. tester `curl -I http://localhost:4173/runtime-config.js`.

## CI echoue sur docs

Actions:

1. lancer `npm run docs:check`,
2. corriger les liens relatifs casses,
3. verifier la parite `docs/fr` / `docs/en`,
4. verifier que les fichiers racine ne sont pas vides.
