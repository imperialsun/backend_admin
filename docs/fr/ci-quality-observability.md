# CI, qualite et observabilite

## Objectif

Definir les controles automatiques et les points de verification utiles pour maintenir qualite, securite et diagnostic.

## Workflows GitHub Actions

### `ci.yml`

Pipeline principal:

1. checkout,
2. setup Node via `.nvmrc`,
3. `npm ci`,
4. `npm run docs:check`,
5. `npm run lint`,
6. `npm run test:ci`,
7. `npm run build`,
8. upload de l artefact coverage.

### `codeql.yml`

Analyse statique securite pour `javascript-typescript`.

### `trivy.yml`

Deux scans:

- filesystem repo,
- image Docker construite.

Severite cible:

- `HIGH`
- `CRITICAL`

### `prod-smoke.yml`

Verifie:

- build image,
- demarrage conteneur,
- disponibilite HTTP,
- fallback SPA,
- headers securite,
- cache immutable des assets,
- contenu de `runtime-config.js`.

## Validation locale recommandee

```bash
npm run docs:check
npm run lint
npm run test:ci
npm run build
docker build .
```

## Couverture et diagnostics

- `npm run test:ci` produit la couverture V8 pour Vitest.
- `ci.yml` publie le dossier `coverage` comme artefact.
- Il n y a pas de telemetrie applicative dediee dans ce repo; le diagnostic se fait via:
  - sorties de tests,
  - logs navigateur,
  - onglets network / application du navigateur,
  - logs conteneur Nginx en runtime.

## Controle documentation

`npm run docs:check` verifie:

- presence des fichiers requis,
- non vacuite,
- parite FR / EN,
- liens relatifs,
- ancres Markdown.

## Liens

- Contribution: [`contributing.md`](contributing.md)
- Deploiement: [`deployment-operations.md`](deployment-operations.md)
- Securite: [`security-privacy.md`](security-privacy.md)
