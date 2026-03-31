# Architecture

## Vue d ensemble

Demeter Admin Panel est une SPA React/TypeScript organisee en couches:

- `src/main.tsx`: bootstrap React Query, router et session provider,
- `src/App.tsx`: routes protegees et garde super admin,
- `src/routes/*`: ecrans metier,
- `src/components/layout/*`: shell, sidebar, topbar,
- `src/lib/admin-api.ts`: couche HTTP bas niveau,
- `src/lib/admin-client.ts`: surface API typee,
- `src/lib/admin-session-context.tsx`: bootstrap et exposition de session,
- `src/lib/runtime-config.ts`: lecture unique de la config runtime.

## Composants majeurs

| Zone | Fichier(s) cle(s) | Role |
| --- | --- | --- |
| Bootstrap | `src/main.tsx` | initialise React, React Query et BrowserRouter |
| Routing | `src/App.tsx` | protege les routes et applique `RequireSuperAdmin` |
| Session | `src/lib/admin-session-context.tsx` | demarre la session et la maintient synchronisee avec les refresh automatiques |
| Hook session | `src/lib/use-admin-session.ts` | point d acces unique pour les composants |
| HTTP bas niveau | `src/lib/admin-api.ts` | `credentials: include`, JSON, erreurs typees, injection CSRF, retry transparent sur `401` |
| Client type | `src/lib/admin-client.ts` | endpoints admin auth, organisations, users, catalogues, activite |
| Types | `src/lib/types.ts` | contrats session, users, organisations, roles, permissions, activite |
| Layout | `src/components/layout/*` | shell admin, navigation, topbar |
| Pages | `src/routes/*` | login, dashboard, organisations, users, activite, forbidden |

## Diagramme: bootstrap et session

```mermaid
flowchart TD
    A[main.tsx] --> B[QueryClientProvider]
    B --> C[BrowserRouter]
    C --> D[AdminSessionProvider]
    D --> E[initializeAdminSession]
    E --> F{/admin/auth/me OK?}
    F -->|Oui| G[Set session]
    F -->|401| H[/admin/auth/refresh]
    H --> I{refresh OK?}
    I -->|Oui| G
    I -->|Non| J[Session nulle]
    G --> K[Render App routes]
    J --> K
```

## Routing applicatif

Routes principales:

- `/login`: authentification admin,
- `/dashboard`: vue de pilotage rapide,
- `/organizations`: gestion des organisations, reservee au super admin,
- `/users`: gestion des comptes, roles et overrides,
- `/activity`: analyse detaillee de l activite,
- `/forbidden`: ecran acces refuse.

`RequireAuth` protege toutes les routes hors login. `RequireSuperAdmin` bloque explicitement `/organizations`.

## Etat et flux de donnees

- Le contexte session est gere par `AdminSessionProvider`.
- Les donnees serveur sont chargees via TanStack React Query.
- Toute requete admin qui passe par `adminFetch` peut tenter un refresh transparent une fois sur `401`.
- Les formulaires restent en `useState` local.
- Il n y a pas de store persistant applicatif dans ce repo.

Parametres React Query globaux:

- `retry: false`,
- `staleTime: 15_000`.

## URL state et UI state

- `DashboardPage` garde ses filtres date / organisation en etat local.
- `ActivityPage` encode `from`, `to`, `org` dans l URL.
- `UsersPage` encode `org`, `q`, `user` dans l URL pour conserver le contexte operateur.

## Config runtime

`src/lib/runtime-config.ts` reste la seule source de verite pour `backendBaseUrl`.

Lecture:

1. lire `window.__APP_RUNTIME_CONFIG__`,
2. si absent, utiliser `http://localhost:8080/api/v1` seulement en dev local sur `http://localhost`,
3. sinon fallback sur `/api/v1`,
4. supprimer le slash final si present et normaliser les chemins relatifs.

## Liens utiles

- Auth et session: [`authentication-session.md`](authentication-session.md)
- Settings runtime: [`settings-reference.md`](settings-reference.md)
- Activite: [`activity-analytics.md`](activity-analytics.md)
