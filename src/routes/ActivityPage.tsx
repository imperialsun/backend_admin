import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableWrapper } from "@/components/ui/table"
import { fetchActivitySummary, fetchOrganizations } from "@/lib/admin-client"
import { daysAgoDayString, toTitleCase, todayDayString } from "@/lib/utils"
import { useAdminSession } from "@/lib/use-admin-session"

function BreakdownTable({ title, items }: { title: string; items: Record<string, number> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(items).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune donnée disponible.</p>
        ) : (
          Object.entries(items)
            .sort((left, right) => right[1] - left[1])
            .map(([label, value]) => (
              <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3" key={label}>
                <span>{toTitleCase(label)}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))
        )}
      </CardContent>
    </Card>
  )
}

export default function ActivityPage() {
  const { isSuperAdmin, session } = useAdminSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const from = searchParams.get("from") ?? daysAgoDayString(29)
  const to = searchParams.get("to") ?? todayDayString()
  const organizationId = isSuperAdmin ? searchParams.get("org") ?? "" : session?.organization.id ?? ""

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  })

  const summaryQuery = useQuery({
    queryKey: ["activity-summary", from, to, organizationId],
    queryFn: () =>
      fetchActivitySummary({
        from,
        to,
        organizationId: organizationId || undefined,
      }),
  })

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (!searchParams.get("from")) next.set("from", from)
    if (!searchParams.get("to")) next.set("to", to)
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true })
    }
  }, [from, searchParams, setSearchParams, to])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtres d’activité</CardTitle>
          <CardDescription>La lecture reste alignée sur le scope effectivement autorisé par le backend.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="activity-from">Du</Label>
            <Input id="activity-from" onChange={(event) => setSearchParams({ from: event.target.value, to, ...(organizationId ? { org: organizationId } : {}) })} type="date" value={from} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-to">Au</Label>
            <Input id="activity-to" onChange={(event) => setSearchParams({ from, to: event.target.value, ...(organizationId ? { org: organizationId } : {}) })} type="date" value={to} />
          </div>
          {isSuperAdmin ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="activity-org">Organisation</Label>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                id="activity-org"
                onChange={(event) => setSearchParams({ from, to, ...(event.target.value ? { org: event.target.value } : {}) })}
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription>Transcriptions</CardDescription>
            <CardTitle className="text-4xl">{summaryQuery.data?.totals.transcriptions ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Rapports</CardDescription>
            <CardTitle className="text-4xl">{summaryQuery.data?.totals.reports ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <TableWrapper>
        <Table>
          <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Jour</th>
              <th className="px-6 py-4">Transcriptions</th>
              <th className="px-6 py-4">Rapports</th>
            </tr>
          </thead>
          <tbody>
            {(summaryQuery.data?.byDay ?? []).map((item) => (
              <tr className="border-t border-border/70" key={item.day}>
                <td className="px-6 py-4">{item.day}</td>
                <td className="px-6 py-4">{item.transcriptions}</td>
                <td className="px-6 py-4">{item.reports}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableWrapper>

      <div className="grid gap-6 xl:grid-cols-2">
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
                <tr className="border-t border-border/70" key={item.userId}>
                  <td className="px-6 py-4">{item.email || item.userId}</td>
                  <td className="px-6 py-4">{item.transcriptions}</td>
                  <td className="px-6 py-4">{item.reports}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>

        <div className="grid gap-6">
          <BreakdownTable items={summaryQuery.data?.breakdown.transcriptionsByMode ?? {}} title="Transcriptions par mode" />
          <BreakdownTable items={summaryQuery.data?.breakdown.transcriptionsByProvider ?? {}} title="Transcriptions par provider" />
          <BreakdownTable items={summaryQuery.data?.breakdown.reportsByMode ?? {}} title="Rapports par mode" />
          <BreakdownTable items={summaryQuery.data?.breakdown.reportsByProvider ?? {}} title="Rapports par provider" />
        </div>
      </div>
    </div>
  )
}
