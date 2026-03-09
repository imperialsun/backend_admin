# Securite et confidentialite

## Modele general

Demeter Admin Panel est un client front-end pour les endpoints admin du backend Demeter.

Points cle:

- namespace admin dedie sous `/api/v1/admin/*`,
- auth backend dediee,
- cookies transportes avec `credentials: include`,
- CSRF memoire seule,
- autorisation resolue cote backend.

## Auth et CSRF

Implementation:

- `src/lib/admin-api.ts`
- `src/lib/admin-client.ts`
- `src/lib/admin-security.ts`
- `src/lib/admin-session-context.tsx`

Proprietes:

- les requetes mutantes ajoutent `X-Admin-CSRF` si le token est disponible,
- le token CSRF n est jamais persiste,
- `adminLogout()` vide toujours le token memoire.

## Stockage navigateur

Absence explicite de persistance auth:

- pas de token dans `localStorage`,
- pas de token dans `sessionStorage`,
- pas de token dans IndexedDB.

Le backend peut deposer ses propres cookies de session, mais le front n en gere ni le stockage ni le parsing.

## Autorisation

Le front expose des gardes ergonomiques:

- `RequireAuth`
- `RequireSuperAdmin`
- filtrage conditionnel du menu sidebar

Mais ces gardes ne remplacent pas les controles backend. Les permissions effectives affichees dans `/users` viennent du backend admin apres resolution des roles et overrides.

## Runtime config et exposition

Le seul parametre runtime expose est `backendBaseUrl` via `runtime-config.js`.

Contraintes:

- fichier non cacheable,
- injecte au demarrage du conteneur,
- ne doit pas contenir de secret.

## Hardening Nginx

`docker/nginx/admin.conf` applique notamment:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`
- `Strict-Transport-Security`

Politique cache:

- `runtime-config.js`: `no-store`
- `index.html`: `no-store`
- `/assets/`: cache immutable long

## Securite CI/CD

Workflows principaux:

- `ci.yml`
- `codeql.yml`
- `trivy.yml`
- `prod-smoke.yml`

Le smoke test verifie notamment:

- disponibilite HTTP,
- fallback SPA,
- presence des headers securite,
- cache immutable des assets hash.

## Liens

- Auth et session: [`authentication-session.md`](authentication-session.md)
- Deploiement: [`deployment-operations.md`](deployment-operations.md)
- CI: [`ci-quality-observability.md`](ci-quality-observability.md)
