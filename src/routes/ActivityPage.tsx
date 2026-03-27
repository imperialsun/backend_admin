import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import { useSearchParams } from "react-router-dom"

import { ActivitySummarySection } from "@/components/activity/ActivitySummarySection"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fetchActivitySummary, fetchOrganizations, fetchUserActivitySummary, fetchUsersByOrganization } from "@/lib/admin-client"
import type { ActivitySummary, UserActivitySummary } from "@/lib/types"
import { daysAgoDayString, todayDayString } from "@/lib/utils"
import { useAdminSession } from "@/lib/use-admin-session"

export default function ActivityPage() {
  const { isSuperAdmin, session } = useAdminSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const from = searchParams.get("from") ?? daysAgoDayString(29)
  const to = searchParams.get("to") ?? todayDayString()
  const organizationId = isSuperAdmin ? searchParams.get("org") ?? "" : session?.organization.id ?? ""
  const selectedUserId = searchParams.get("user") ?? ""

  const setActivitySearchParams = (next: { from?: string; to?: string; org?: string; user?: string }) => {
    const params = new URLSearchParams()

    params.set("from", (next.from ?? from).trim())
    params.set("to", (next.to ?? to).trim())
    if (isSuperAdmin) {
      const nextOrg = next.org ?? organizationId
      if (nextOrg.trim()) {
        params.set("org", nextOrg.trim())
      }
    }
    if ((next.user ?? selectedUserId).trim()) {
      params.set("user", (next.user ?? selectedUserId).trim())
    }

    setSearchParams(params, { replace: true })
  }

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  })

  const organizationUsersQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organization-users", organizationId],
    queryFn: () => fetchUsersByOrganization(organizationId),
  })

  const organizationUsers = useMemo(() => organizationUsersQuery.data ?? [], [organizationUsersQuery.data])
  const selectedUser = useMemo(() => {
    if (!organizationId || !selectedUserId) {
      return null
    }
    return organizationUsers.find((user) => user.id === selectedUserId) ?? null
  }, [organizationId, organizationUsers, selectedUserId])

  const waitingForSelectedUser = Boolean(organizationId) && Boolean(selectedUserId) && organizationUsersQuery.isLoading

  const summaryQuery = useQuery<ActivitySummary | UserActivitySummary>({
    enabled: !waitingForSelectedUser,
    queryKey: ["activity-summary", from, to, organizationId || "global", selectedUser?.id ?? ""],
    queryFn: async (): Promise<ActivitySummary | UserActivitySummary> => {
      if (selectedUser) {
        return await fetchUserActivitySummary(selectedUser.id, {
          from,
          to,
        })
      }

      return await fetchActivitySummary({
        from,
        to,
        organizationId: organizationId || undefined,
      })
    },
  })

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let changed = false
    if (!searchParams.get("from")) {
      next.set("from", from)
      changed = true
    }
    if (!searchParams.get("to")) {
      next.set("to", to)
      changed = true
    }
    if (changed) {
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
            <Input
              id="activity-from"
              onChange={(event) =>
                setActivitySearchParams({
                  from: event.target.value,
                  to,
                  org: organizationId,
                  user: selectedUser?.id ?? "",
                })
              }
              type="date"
              value={from}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="activity-to">Au</Label>
            <Input
              id="activity-to"
              onChange={(event) =>
                setActivitySearchParams({
                  from,
                  to: event.target.value,
                  org: organizationId,
                  user: selectedUser?.id ?? "",
                })
              }
              type="date"
              value={to}
            />
          </div>
          {isSuperAdmin ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="activity-org">Organisation</Label>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                id="activity-org"
                onChange={(event) =>
                  setActivitySearchParams({
                    from,
                    to,
                    org: event.target.value,
                    user: "",
                  })
                }
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
          {organizationId ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="activity-user">Utilisateur</Label>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                disabled={organizationUsersQuery.isLoading}
                id="activity-user"
                onChange={(event) =>
                  setActivitySearchParams({
                    from,
                    to,
                    org: organizationId,
                    user: event.target.value,
                  })
                }
                value={selectedUser?.id ?? ""}
              >
                <option value="">Vue organisation</option>
                {organizationUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {summaryQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>Impossible de charger l’activité</CardTitle>
            <CardDescription>
              {summaryQuery.error instanceof Error ? summaryQuery.error.message : "Une erreur est survenue."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : summaryQuery.data ? (
        <ActivitySummarySection summary={summaryQuery.data} showByUserTable={!selectedUser} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Chargement de l’activité</CardTitle>
            <CardDescription>Le résumé sélectionné est en cours de récupération.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  )
}
