import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableWrapper } from "@/components/ui/table"
import { fetchActivitySummary, fetchOrganizations } from "@/lib/admin-client"
import { daysAgoDayString, formatDay, todayDayString, toTitleCase } from "@/lib/utils"
import { useAdminSession } from "@/lib/use-admin-session"

function StatCard({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-4xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { isSuperAdmin } = useAdminSession()
  const [from, setFrom] = useState(daysAgoDayString(29))
  const [to, setTo] = useState(todayDayString())
  const [organizationId, setOrganizationId] = useState("")

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  })

  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", from, to, organizationId],
    queryFn: () =>
      fetchActivitySummary({
        from,
        to,
        organizationId: organizationId || undefined,
      }),
  })

  const providers = useMemo(() => {
    const summary = summaryQuery.data
    if (!summary) return []

    return Object.entries({
      ...summary.breakdown.transcriptionsByProvider,
      ...summary.breakdown.reportsByProvider,
    })
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
  }, [summaryQuery.data])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fenêtre d’analyse</CardTitle>
          <CardDescription>Le dashboard s’appuie uniquement sur les agrégats admin du backend.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="dashboard-from">Du</Label>
            <Input id="dashboard-from" onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dashboard-to">Au</Label>
            <Input id="dashboard-to" onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          </div>
          {isSuperAdmin ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="dashboard-organization">Organisation</Label>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                id="dashboard-organization"
                onChange={(event) => setOrganizationId(event.target.value)}
                value={organizationId}
              >
                <option value="">Toutes les organisations</option>
                {(organizationsQuery.data ?? []).map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <StatCard
          helper="Agrégat de la fenêtre sélectionnée."
          label="Transcriptions"
          value={summaryQuery.data?.totals.transcriptions ?? 0}
        />
        <StatCard helper="Rapports générés sur la période." label="Rapports" value={summaryQuery.data?.totals.reports ?? 0} />
        <Card>
          <CardHeader>
            <CardDescription>Organisation ciblée</CardDescription>
            <CardTitle className="text-2xl">
              {organizationId
                ? organizationsQuery.data?.find((organization) => organization.id === organizationId)?.name ?? "Organisation"
                : "Vue globale"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {summaryQuery.data?.range.from} au {summaryQuery.data?.range.to}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tendance journalière</CardTitle>
            <CardDescription>Lecture rapide de la charge sur la période sélectionnée.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(summaryQuery.data?.byDay ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune activité sur la fenêtre choisie.</p>
            ) : (
              summaryQuery.data?.byDay.map((item) => (
                <div className="grid grid-cols-[110px_1fr_1fr] items-center gap-3" key={item.day}>
                  <p className="text-sm font-medium">{formatDay(item.day)}</p>
                  <div className="rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">Transcriptions: {item.transcriptions}</div>
                  <div className="rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">Rapports: {item.reports}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Providers dominants</CardTitle>
            <CardDescription>Top rapide pour prioriser l’observabilité.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore de provider dominant à afficher.</p>
            ) : (
              providers.map(([provider, count]) => (
                <div className="flex items-center justify-between rounded-2xl bg-muted/70 px-4 py-3" key={provider}>
                  <span className="text-sm font-medium">{toTitleCase(provider)}</span>
                  <Badge variant="muted">{count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <TableWrapper>
          <Table>
            <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Utilisateur</th>
                <th className="px-6 py-4">Transcriptions</th>
                <th className="px-6 py-4">Rapports</th>
              </tr>
            </thead>
            <tbody>
              {(summaryQuery.data?.byUser ?? []).map((item) => (
                <tr className="border-t border-border/70" key={`${item.userId}-${item.email}`}>
                  <td className="px-6 py-4">{item.email || item.userId}</td>
                  <td className="px-6 py-4">{item.transcriptions}</td>
                  <td className="px-6 py-4">{item.reports}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>

        <Card>
          <CardHeader>
            <CardTitle>Organisations accessibles</CardTitle>
            <CardDescription>Snapshot du scope réel renvoyé par le backend admin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(organizationsQuery.data ?? []).map((organization) => (
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3" key={organization.id}>
                <div>
                  <p className="font-medium">{organization.name}</p>
                  <p className="text-xs text-muted-foreground">{organization.code}</p>
                </div>
                <Badge variant={organization.status === "active" ? "success" : "danger"}>{organization.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
