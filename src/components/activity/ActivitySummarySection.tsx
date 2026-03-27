import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableWrapper } from "@/components/ui/table"
import type { ActivitySummary, UserActivitySummary } from "@/lib/types"
import { toTitleCase } from "@/lib/utils"

type ActivitySummaryData = ActivitySummary | UserActivitySummary

function BreakdownCard(props: { title: string; items: Record<string, number> }) {
  const { title, items } = props

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

function SummaryTotals(props: { transcriptions: number; reports: number }) {
  const { transcriptions, reports } = props

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardDescription>Transcriptions</CardDescription>
          <CardTitle className="text-4xl">{transcriptions}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardDescription>Rapports</CardDescription>
          <CardTitle className="text-4xl">{reports}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}

export function ActivitySummarySection(props: {
  summary: ActivitySummaryData
  showByUserTable?: boolean
}) {
  const { summary, showByUserTable = true } = props
  const user = "user" in summary ? summary.user : null
  const byUserRows = "byUser" in summary ? summary.byUser : []

  return (
    <div className="space-y-6">
      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>{user.email}</CardTitle>
            <CardDescription>Résumé d’activité pour le compte {user.id}.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant={user.status === "active" ? "success" : "danger"}>{user.status}</Badge>
            <Badge variant="muted">{user.organizationId}</Badge>
          </CardContent>
        </Card>
      ) : null}

      <SummaryTotals transcriptions={summary.totals.transcriptions} reports={summary.totals.reports} />

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
            {summary.byDay.length === 0 ? (
              <tr className="border-t border-border/70">
                <td className="px-6 py-4 text-muted-foreground" colSpan={3}>
                  Aucune donnée disponible sur cette période.
                </td>
              </tr>
            ) : (
              summary.byDay.map((item) => (
                <tr className="border-t border-border/70" key={item.day}>
                  <td className="px-6 py-4">{item.day}</td>
                  <td className="px-6 py-4">{item.transcriptions}</td>
                  <td className="px-6 py-4">{item.reports}</td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrapper>

      {showByUserTable && byUserRows.length > 0 ? (
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
              {byUserRows.map((item) => (
                <tr className="border-t border-border/70" key={item.userId}>
                  <td className="px-6 py-4">{item.email || item.userId}</td>
                  <td className="px-6 py-4">{item.transcriptions}</td>
                  <td className="px-6 py-4">{item.reports}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableWrapper>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <BreakdownCard items={summary.breakdown.transcriptionsByMode} title="Transcriptions par mode" />
        <BreakdownCard items={summary.breakdown.transcriptionsByProvider} title="Transcriptions par provider" />
        <BreakdownCard items={summary.breakdown.reportsByMode} title="Rapports par mode" />
        <BreakdownCard items={summary.breakdown.reportsByProvider} title="Rapports par provider" />
      </div>
    </div>
  )
}
