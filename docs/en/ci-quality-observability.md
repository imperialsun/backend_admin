# CI, quality, and observability

## Purpose

Define the automated controls and useful verification points that keep quality, security, and diagnostics in shape.

## GitHub Actions workflows

### `ci.yml`

Main pipeline:

1. checkout,
2. setup Node from `.nvmrc`,
3. `npm ci`,
4. `npm run docs:check`,
5. `npm run lint`,
6. `npm run test:ci`,
7. `npm run build`,
8. upload the coverage artifact.

### `codeql.yml`

Static security analysis for `javascript-typescript`.

### `trivy.yml`

Two scans:

- repository filesystem,
- built Docker image.

Target severity:

- `HIGH`
- `CRITICAL`

### `prod-smoke.yml`

Verifies:

- image build,
- container startup,
- HTTP availability,
- SPA fallback,
- security headers,
- immutable asset cache,
- `runtime-config.js` content.

## Recommended local validation

```bash
npm run docs:check
npm run lint
npm run test:ci
npm run build
docker build .
```

## Coverage and diagnostics

- `npm run test:ci` produces Vitest V8 coverage.
- `ci.yml` publishes the `coverage` directory as an artifact.
- There is no dedicated in-app telemetry surface in this repo; diagnostics rely on:
  - test output,
  - browser logs,
  - browser network / application panels,
  - runtime Nginx container logs.

## Documentation control

`npm run docs:check` validates:

- presence of required files,
- non-empty files,
- FR / EN parity,
- relative links,
- Markdown anchors.

## Links

- Contribution: [`contributing.md`](contributing.md)
- Deployment: [`deployment-operations.md`](deployment-operations.md)
- Security: [`security-privacy.md`](security-privacy.md)
