# Contribution (guide detaille)

## Workflow recommande

1. creer une branche dediee depuis `main`,
2. implementer un changement cible,
3. ajouter ou adapter les tests,
4. mettre a jour la documentation FR et EN si necessaire,
5. executer les checks locaux,
6. ouvrir une PR avec impact, risques et validation.

## Checks obligatoires

```bash
npm run docs:check
npm run lint
npm run test:ci
npm run build
```

## Ou ajouter des tests

- `src/lib/*`: tests unitaires pour client HTTP, session, runtime config, securite,
- `src/routes/*`: tests composants et comportements UI,
- `src/App.test.tsx`: garde de routes et acces super admin.

Quand ajouter des tests:

- toute nouvelle fonction `src/lib/*`,
- toute mutation ou refactor de securite,
- toute page ou flux utilisateur modifie,
- toute regression corrigee.

## Regles projet

- garder les fetchs serveur dans React Query ou dans `src/lib/admin-client.ts`,
- ne pas ajouter de `fetch()` ad hoc dans les pages si un helper type existe deja,
- ne jamais importer `../Backend` ou `../Front user`,
- ne pas persister de secret auth dans un stockage navigateur.

## Documentation

Si le comportement change:

- mettre a jour `README.md` si l onboarding change,
- mettre a jour les docs detaillees FR et EN,
- garder la meme structure dans `docs/fr` et `docs/en`,
- verifier `npm run docs:check`.

## Checklist PR suggeree

- [ ] implementation terminee
- [ ] tests ajoutes ou mis a jour
- [ ] docs FR et EN mises a jour
- [ ] `docs:check`, `lint`, `test:ci`, `build` OK
- [ ] aucun import depuis les depots freres
- [ ] aucun secret committe

## Liens

- Contribution root: [`CONTRIBUTING.md`](../../CONTRIBUTING.md)
- CI: [`ci-quality-observability.md`](ci-quality-observability.md)
- Architecture: [`architecture.md`](architecture.md)
