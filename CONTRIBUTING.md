# Contributing

Thanks for contributing to Demeter Admin Panel.

## Full guides

- French detailed guide: [`docs/fr/contributing.md`](docs/fr/contributing.md)
- English detailed guide: [`docs/en/contributing.md`](docs/en/contributing.md)

## Minimum local gate before PR

```bash
npm run docs:check
npm run lint
npm run test:ci
npm run build
```

## Scope reminders

- Keep changes focused and backed by tests.
- Update both FR and EN documentation when behavior changes.
- Do not commit secrets or environment-specific credentials.
- Do not add imports from sibling repositories.
