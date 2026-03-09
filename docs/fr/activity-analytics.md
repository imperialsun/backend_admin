# Activite et analytics

## Vue d ensemble

Le repo expose deux ecrans relies au meme endpoint d agregats:

- `/dashboard`: lecture rapide et pilotage,
- `/activity`: analyse detaillee et partageable par URL.

Endpoint consomme:

- `/admin/activity/summary`

## Dashboard

`DashboardPage` utilise un etat local pour:

- `from`
- `to`
- `organizationId`

Vue rendue:

- cartes totals transcriptions / rapports,
- resume organisation ciblee,
- tendance journaliere,
- top providers,
- tableau par utilisateur,
- snapshot des organisations accessibles.

Le top providers fusionne:

- `breakdown.transcriptionsByProvider`
- `breakdown.reportsByProvider`

puis garde les 6 premiers comptes.

## Activity page

`ActivityPage` encode les filtres dans l URL:

- `from`
- `to`
- `org`

Vue rendue:

- cartes totals,
- tableau `byDay`,
- tableau `byUser`,
- quatre blocs breakdown:
  - transcriptions par mode,
  - transcriptions par provider,
  - rapports par mode,
  - rapports par provider.

## Scope et filtres

Regles:

- super admin: peut filtrer par organisation,
- admin organisation: scope limite a `session.organization.id`,
- la plage par defaut couvre les 30 derniers jours via `daysAgoDayString(29)` et `todayDayString()`.

## Contrat de donnees

`ActivitySummary` contient:

- `organizationId`
- `range.from`, `range.to`
- `totals.transcriptions`, `totals.reports`
- `byDay[]`
- `byUser[]`
- `breakdown.*`

Le front ne recalcule pas les agregats: il affiche uniquement ce que renvoie le backend admin.

## Liens

- Architecture: [`architecture.md`](architecture.md)
- Users et droits: [`users-access.md`](users-access.md)
- Depannage: [`troubleshooting.md`](troubleshooting.md)
