# Contributing (detailed guide)

## Recommended workflow

1. create a dedicated branch from `main`,
2. implement a focused change,
3. add or update tests,
4. update FR and EN documentation when needed,
5. run local checks,
6. open a PR with impact, risks, and validation notes.

## Mandatory checks

```bash
npm run docs:check
npm run lint
npm run test:ci
npm run build
```

## Where to add tests

- `src/lib/*`: unit tests for HTTP client, session, runtime config, and security logic,
- `src/routes/*`: component tests and UI behavior,
- `src/App.test.tsx`: route guards and super-admin access.

When to add tests:

- every new `src/lib/*` function,
- every security-sensitive mutation or refactor,
- every changed page or user flow,
- every regression fix.

## Project rules

- keep server fetching in React Query or `src/lib/admin-client.ts`,
- do not add ad hoc `fetch()` calls in pages when a typed helper already exists,
- never import from `../Backend` or `../Front user`,
- never persist auth secrets in browser storage.

## Documentation

If behavior changes:

- update `README.md` if onboarding changes,
- update detailed FR and EN docs,
- keep the same structure in `docs/fr` and `docs/en`,
- run `npm run docs:check`.

## Suggested PR checklist

- [ ] implementation completed
- [ ] tests added or updated
- [ ] FR and EN docs updated
- [ ] `docs:check`, `lint`, `test:ci`, `build` all green
- [ ] no imports from sibling repositories
- [ ] no committed secrets

## Links

- Root contribution guide: [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
- CI: [`ci-quality-observability.md`](ci-quality-observability.md)
- Architecture: [`architecture.md`](architecture.md)
