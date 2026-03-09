# Activity and analytics

## Overview

The repo exposes two screens backed by the same aggregate endpoint:

- `/dashboard`: quick reading and steering,
- `/activity`: detailed analytics shareable through the URL.

Consumed endpoint:

- `/admin/activity/summary`

## Dashboard

`DashboardPage` uses local state for:

- `from`
- `to`
- `organizationId`

Rendered view:

- total transcription / report cards,
- targeted organization summary,
- daily trend,
- top providers,
- per-user table,
- accessible organization snapshot.

The top providers list merges:

- `breakdown.transcriptionsByProvider`
- `breakdown.reportsByProvider`

then keeps the top 6 counts.

## Activity page

`ActivityPage` stores filters in the URL:

- `from`
- `to`
- `org`

Rendered view:

- total cards,
- `byDay` table,
- `byUser` table,
- four breakdown blocks:
  - transcriptions by mode,
  - transcriptions by provider,
  - reports by mode,
  - reports by provider.

## Scope and filters

Rules:

- super admin: can filter by organization,
- organization admin: scope is limited to `session.organization.id`,
- the default range covers the last 30 days through `daysAgoDayString(29)` and `todayDayString()`.

## Data contract

`ActivitySummary` contains:

- `organizationId`
- `range.from`, `range.to`
- `totals.transcriptions`, `totals.reports`
- `byDay[]`
- `byUser[]`
- `breakdown.*`

The frontend does not recalculate aggregates: it only renders what the admin backend returns.

## Links

- Architecture: [`architecture.md`](architecture.md)
- Users and access: [`users-access.md`](users-access.md)
- Troubleshooting: [`troubleshooting.md`](troubleshooting.md)
