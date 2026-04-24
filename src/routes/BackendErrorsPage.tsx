import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, RefreshCcw, Trash2, X } from "lucide-react"
import { createPortal } from "react-dom"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableWrapper } from "@/components/ui/table"
import { copyTextToClipboard } from "@/lib/clipboard"
import {
  fetchBackendErrorEvents,
  fetchOrganizations,
  fetchUsersByOrganization,
  purgeBackendErrorEvents,
} from "@/lib/admin-client"
import type { BackendErrorEvent, BackendErrorEventsResponse } from "@/lib/types"
import { daysAgoDayString, formatDateTime, todayDayString } from "@/lib/utils"
import { useAdminSession } from "@/lib/use-admin-session"

const defaultPageSize = 25

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt((value ?? "").trim(), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return parsed
}

function setSearchParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (typeof value === "number") {
    if (Number.isFinite(value) && value > 0) {
      params.set(key, String(value))
    }
    return
  }
  if (value && value.trim()) {
    params.set(key, value.trim())
    return
  }
  params.delete(key)
}

function hasNonEmptyValue(value: string | undefined) {
  return Boolean(value && value.trim())
}

function badgeVariantForStatus(statusCode?: number) {
  if (!statusCode) {
    return "muted" as const
  }
  if (statusCode >= 500) {
    return "danger" as const
  }
  if (statusCode >= 400) {
    return "danger" as const
  }
  return "success" as const
}

function badgeVariantForRecoveryStatus(recoveryStatus?: string) {
  if (!recoveryStatus) {
    return "muted" as const
  }
  if (recoveryStatus.includes("succeeded")) {
    return "success" as const
  }
  if (recoveryStatus.includes("failed")) {
    return "danger" as const
  }
  return "muted" as const
}

function recoveryStatusLabel(recoveryStatus?: string) {
  if (!recoveryStatus) {
    return "n/a"
  }
  if (recoveryStatus === "raw_retry_succeeded") {
    return "Récupéré après retry brut"
  }
  if (recoveryStatus === "raw_retry_failed") {
    return "Retry brut échoué"
  }
  return recoveryStatus
}

function prettyPayload(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return "{}"
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return trimmed
  }
}

function buildBackendErrorClipboardText(event: BackendErrorEvent, payload: string, annex: string) {
  const lines = [
    "Détail de l'erreur backend",
    `ID: ${event.id}`,
    `Trace: ${event.traceId}`,
    `Date: ${formatDateTime(event.createdAt)}`,
    `Composant: ${event.component}`,
    `Route: ${event.route}`,
    `Étape: ${event.step}`,
    `Titre: ${event.title}`,
    `Statut: ${event.statusCode ?? "n/a"}`,
    `Durée: ${event.durationMs ? `${event.durationMs} ms` : "n/a"}`,
    `Utilisateur: ${event.userId || "n/a"}`,
    `Organisation: ${event.organizationId || "n/a"}`,
    `Récupération: ${event.recoveryStatus || "n/a"}`,
    `Message: ${event.errorMessage || "n/a"}`,
    "",
    "Payload:",
    payload,
  ]

  if (annex.trim() && annex.trim() !== "{}") {
    lines.push("", "Annexe frontend:", annex)
  }

  return lines.join("\n")
}

function BackendErrorDetailModal(props: {
  event: BackendErrorEvent
  payload: string
  annex: string
  hasAnnex: boolean
  copied: boolean
  copyFailed: boolean
  onCopy: () => void
  onClose: () => void
}) {
  const { annex, copied, copyFailed, event, hasAnnex, onClose, onCopy, payload } = props

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault()
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 bg-foreground/20 p-4 backdrop-blur-sm" onClick={onClose} data-testid="backend-error-detail-overlay">
      <div className="flex min-h-full items-center justify-center">
        <div
          aria-describedby="backend-error-detail-modal-description"
          aria-labelledby="backend-error-detail-modal-title"
          aria-modal="true"
          className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-2xl"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-background/80 px-6 py-5 backdrop-blur">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Détail de l’erreur</p>
              <h2 className="truncate text-xl font-semibold" id="backend-error-detail-modal-title">
                {event.errorMessage || event.title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground" id="backend-error-detail-modal-description">
                {event.component} · {event.route} · {formatDateTime(event.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button className="gap-2" onClick={onCopy} size="sm" variant="secondary">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copié" : "Copier le détail"}
              </Button>
              <Button autoFocus className="gap-2" onClick={onClose} size="sm" variant="secondary">
                <X className="h-4 w-4" />
                Fermer
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={badgeVariantForStatus(event.statusCode)}>{event.statusCode ?? "n/a"}</Badge>
                <Badge variant="muted">{event.component}</Badge>
                <Badge variant="muted">{event.route}</Badge>
                {event.recoveryStatus ? (
                  <Badge variant={badgeVariantForRecoveryStatus(event.recoveryStatus)}>
                    {recoveryStatusLabel(event.recoveryStatus)}
                  </Badge>
                ) : null}
              </div>
              {copyFailed ? (
                <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700">
                  Impossible de copier le détail dans le presse-papiers.
                </div>
              ) : copied ? (
                <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700">
                  Détail copié dans le presse-papiers.
                </div>
              ) : null}
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Trace</p>
                  <p className="font-mono text-xs">{event.traceId}</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Date</p>
                    <p>{formatDateTime(event.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Durée</p>
                    <p>{event.durationMs ? `${event.durationMs} ms` : "n/a"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Utilisateur</p>
                    <p>{event.userId || "n/a"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Organisation</p>
                    <p>{event.organizationId || "n/a"}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Étape</p>
                  <p>{event.step}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Titre</p>
                  <p>{event.title}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Message</p>
                  <p>{event.errorMessage || "n/a"}</p>
                </div>
              </div>
              {event.recoveryStatus ? (
                <div className="space-y-2 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Récupération</p>
                  <p>{recoveryStatusLabel(event.recoveryStatus)}</p>
                </div>
              ) : null}
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Payload</p>
                <pre className="max-h-[32rem] overflow-auto rounded-3xl border border-border/70 bg-muted/40 p-4 text-xs leading-relaxed">
                  {payload}
                </pre>
              </div>
              {hasAnnex ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Annexe frontend</p>
                  <pre className="max-h-[28rem] overflow-auto rounded-3xl border border-border/70 bg-muted/40 p-4 text-xs leading-relaxed">
                    {annex}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function BackendErrorsPage() {
  const queryClient = useQueryClient()
  const { isSuperAdmin, session } = useAdminSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedEventId, setSelectedEventId] = useState<string>("")
  const [purgeConfirmationOpen, setPurgeConfirmationOpen] = useState(false)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")
  const [rowCopyState, setRowCopyState] = useState<{ eventId: string; status: "copied" | "error" } | null>(null)
  const copyResetTimer = useRef<number | null>(null)
  const rowCopyResetTimer = useRef<number | null>(null)

  const from = searchParams.get("from") ?? daysAgoDayString(29)
  const to = searchParams.get("to") ?? todayDayString()
  const component = searchParams.get("component") ?? ""
  const route = searchParams.get("route") ?? ""
  const query = searchParams.get("q") ?? ""
  const selectedUserId = searchParams.get("userId") ?? ""
  const page = parsePositiveInt(searchParams.get("page"), 1)
  const pageSize = parsePositiveInt(searchParams.get("pageSize"), defaultPageSize)
  const selectedOrganizationId = isSuperAdmin ? searchParams.get("org") ?? "" : session?.organization.id ?? ""
  const scopeOrganizationId = isSuperAdmin ? selectedOrganizationId : session?.organization.id ?? ""

  const backendErrorQueryKey = [
    "backend-errors",
    from,
    to,
    component,
    route,
    query,
    selectedOrganizationId || "global",
    selectedUserId || "all-users",
    page,
    pageSize,
  ]

  const organizationsQuery = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  })

  const organizationUsersQuery = useQuery({
    enabled: hasNonEmptyValue(scopeOrganizationId),
    queryKey: ["organization-users", scopeOrganizationId],
    queryFn: () => fetchUsersByOrganization(scopeOrganizationId),
  })

  const eventsQuery = useQuery({
    queryKey: backendErrorQueryKey,
    queryFn: (): Promise<BackendErrorEventsResponse> =>
      fetchBackendErrorEvents({
        from,
        to,
        component,
        route,
        q: query,
        organizationId: selectedOrganizationId || undefined,
        userId: selectedUserId || undefined,
        page,
        pageSize,
      }),
  })

  const backendErrors = useMemo(() => eventsQuery.data?.items ?? [], [eventsQuery.data?.items])
  const organizationUsers = useMemo(() => organizationUsersQuery.data ?? [], [organizationUsersQuery.data])
  const totalEvents = eventsQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalEvents / pageSize))

  const selectedEvent = useMemo<BackendErrorEvent | null>(() => {
    if (!selectedEventId) {
      return null
    }
    return backendErrors.find((event) => event.id === selectedEventId) ?? null
  }, [backendErrors, selectedEventId])

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
    if (!searchParams.get("page")) {
      next.set("page", String(page))
      changed = true
    }
    if (!searchParams.get("pageSize")) {
      next.set("pageSize", String(pageSize))
      changed = true
    }
    if (isSuperAdmin && searchParams.get("org") && searchParams.get("org") !== selectedOrganizationId) {
      next.set("org", selectedOrganizationId)
      changed = true
    }
    if (isSuperAdmin && !selectedOrganizationId && searchParams.get("userId")) {
      next.delete("userId")
      changed = true
    }

    if (changed) {
      setSearchParams(next, { replace: true })
    }
  }, [from, isSuperAdmin, page, pageSize, searchParams, selectedOrganizationId, setSearchParams, to])

  useEffect(() => {
    if (!hasNonEmptyValue(scopeOrganizationId) || organizationUsersQuery.isLoading || !selectedUserId) {
      return
    }
    if (organizationUsers.some((user) => user.id === selectedUserId)) {
      return
    }

    const next = new URLSearchParams(searchParams)
    next.delete("userId")
    setSearchParams(next, { replace: true })
  }, [organizationUsers, organizationUsersQuery.isLoading, scopeOrganizationId, searchParams, selectedUserId, setSearchParams])

  useEffect(() => {
    return () => {
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current)
      }
      if (rowCopyResetTimer.current !== null) {
        window.clearTimeout(rowCopyResetTimer.current)
      }
    }
  }, [])

  const updateFilters = (next: {
    from?: string
    to?: string
    component?: string
    route?: string
    q?: string
    org?: string
    userId?: string
    page?: number
    pageSize?: number
  }) => {
    const params = new URLSearchParams()
    setSearchParam(params, "from", next.from ?? from)
    setSearchParam(params, "to", next.to ?? to)
    setSearchParam(params, "component", next.component ?? component)
    setSearchParam(params, "route", next.route ?? route)
    setSearchParam(params, "q", next.q ?? query)
    setSearchParam(params, "page", next.page ?? 1)
    setSearchParam(params, "pageSize", next.pageSize ?? pageSize)
    if (isSuperAdmin) {
      setSearchParam(params, "org", next.org ?? selectedOrganizationId)
    }
    setSearchParam(params, "userId", next.userId ?? selectedUserId)
    setSearchParams(params, { replace: true })
  }

  const purgeMutation = useMutation({
    mutationFn: () =>
      purgeBackendErrorEvents({
        from,
        to,
        component,
        route,
        q: query,
        organizationId: selectedOrganizationId || undefined,
        userId: selectedUserId || undefined,
      }),
    onSuccess: async () => {
      setPurgeConfirmationOpen(false)
      setSelectedEventId("")
      await queryClient.invalidateQueries({ queryKey: ["backend-errors"] })
    },
  })

  const selectedPayload = prettyPayload(selectedEvent?.payloadJson ?? "")
  const selectedAnnex = prettyPayload(selectedEvent?.annexJson ?? "")
  const hasAnnex = Boolean(selectedEvent?.annexJson && selectedEvent.annexJson.trim() && selectedEvent.annexJson.trim() !== "{}")
  const detailClipboardText = useMemo(() => {
    if (!selectedEvent) {
      return ""
    }
    return buildBackendErrorClipboardText(selectedEvent, selectedPayload, selectedAnnex)
  }, [selectedAnnex, selectedEvent, selectedPayload])
  const isRefreshing = eventsQuery.isFetching || organizationsQuery.isFetching || organizationUsersQuery.isFetching
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      eventsQuery.refetch(),
      isSuperAdmin ? organizationsQuery.refetch() : Promise.resolve(),
      hasNonEmptyValue(scopeOrganizationId) ? organizationUsersQuery.refetch() : Promise.resolve(),
    ])
  }, [eventsQuery, isSuperAdmin, organizationUsersQuery, scopeOrganizationId, organizationsQuery])
  const handleCopyDetail = useCallback(async () => {
    if (!selectedEvent || !detailClipboardText) {
      return
    }

    if (copyResetTimer.current !== null) {
      window.clearTimeout(copyResetTimer.current)
      copyResetTimer.current = null
    }

    try {
      await copyTextToClipboard(detailClipboardText)
      setCopyState("copied")
      copyResetTimer.current = window.setTimeout(() => {
        setCopyState("idle")
        copyResetTimer.current = null
      }, 2000)
    } catch {
      setCopyState("error")
      copyResetTimer.current = window.setTimeout(() => {
        setCopyState("idle")
        copyResetTimer.current = null
      }, 2000)
    }
  }, [detailClipboardText, selectedEvent])
  const handleCopyRowJson = useCallback(async (event: BackendErrorEvent) => {
    if (rowCopyResetTimer.current !== null) {
      window.clearTimeout(rowCopyResetTimer.current)
      rowCopyResetTimer.current = null
    }

    try {
      await copyTextToClipboard(JSON.stringify(event, null, 2))
      setRowCopyState({ eventId: event.id, status: "copied" })
    } catch {
      setRowCopyState({ eventId: event.id, status: "error" })
    }

    rowCopyResetTimer.current = window.setTimeout(() => {
      setRowCopyState(null)
      rowCopyResetTimer.current = null
    }, 2000)
  }, [])
  const scopeLabel = isSuperAdmin
    ? selectedOrganizationId
      ? organizationsQuery.data?.find((organization) => organization.id === selectedOrganizationId)?.name ??
        selectedOrganizationId
      : "Toutes les organisations"
    : session?.organization.name ?? "Organisation courante"
  const usersFilterDisabled = !hasNonEmptyValue(scopeOrganizationId) || organizationUsersQuery.isLoading

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtres des erreurs backend</CardTitle>
          <CardDescription>
            La console affiche l’historique persistant des erreurs serveur avec le même scope que le backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="backend-errors-from">Du</Label>
            <Input
              id="backend-errors-from"
              onChange={(event) =>
                updateFilters({
                  from: event.target.value,
                  to,
                  component,
                  route,
                  q: query,
                  org: selectedOrganizationId,
                  page: 1,
                  pageSize,
                })
              }
              type="date"
              value={from}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="backend-errors-to">Au</Label>
            <Input
              id="backend-errors-to"
              onChange={(event) =>
                updateFilters({
                  from,
                  to: event.target.value,
                  component,
                  route,
                  q: query,
                  org: selectedOrganizationId,
                  page: 1,
                  pageSize,
                })
              }
              type="date"
              value={to}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="backend-errors-component">Composant</Label>
            <Input
              id="backend-errors-component"
              onChange={(event) =>
                updateFilters({
                  from,
                  to,
                  component: event.target.value,
                  route,
                  q: query,
                  org: selectedOrganizationId,
                  page: 1,
                  pageSize,
                })
              }
              placeholder="http, admin, store..."
              value={component}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="backend-errors-route">Route</Label>
            <Input
              id="backend-errors-route"
              onChange={(event) =>
                updateFilters({
                  from,
                  to,
                  component,
                  route: event.target.value,
                  q: query,
                  org: selectedOrganizationId,
                  page: 1,
                  pageSize,
                })
              }
              placeholder="/api/v1/..."
              value={route}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="backend-errors-query">Recherche</Label>
            <Input
              id="backend-errors-query"
              onChange={(event) =>
                updateFilters({
                  from,
                  to,
                  component,
                  route,
                  q: event.target.value,
                  org: selectedOrganizationId,
                  page: 1,
                  pageSize,
                })
              }
              placeholder="trace, message, payload..."
              value={query}
            />
          </div>
          {isSuperAdmin ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="backend-errors-org">Organisation</Label>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                id="backend-errors-org"
                onChange={(event) =>
                  updateFilters({
                    from,
                    to,
                    component,
                    route,
                    q: query,
                    org: event.target.value,
                    userId: "",
                    page: 1,
                    pageSize,
                  })
                }
                value={selectedOrganizationId}
              >
                <option value="">Toutes les organisations</option>
                {(organizationsQuery.data ?? []).map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2 md:col-span-2">
              <Label>Organisation</Label>
              <div className="flex h-11 items-center rounded-2xl border border-border bg-muted/50 px-4 text-sm">
                {scopeLabel}
              </div>
            </div>
          )}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="backend-errors-user">Utilisateur</Label>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              disabled={usersFilterDisabled}
              id="backend-errors-user"
              onChange={(event) =>
                updateFilters({
                  from,
                  to,
                  component,
                  route,
                  q: query,
                  org: selectedOrganizationId,
                  userId: event.target.value,
                  page: 1,
                  pageSize,
                })
              }
              value={hasNonEmptyValue(scopeOrganizationId) ? selectedUserId : ""}
            >
              <option value="">
                {hasNonEmptyValue(scopeOrganizationId) ? "Tous les utilisateurs" : "Sélectionnez une organisation"}
              </option>
              {organizationUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="backend-errors-page-size">Taille page</Label>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              id="backend-errors-page-size"
              onChange={(event) =>
                updateFilters({
                  from,
                  to,
                  component,
                  route,
                  q: query,
                  org: selectedOrganizationId,
                  userId: selectedUserId,
                  page: 1,
                  pageSize: Number.parseInt(event.target.value, 10),
                })
              }
              value={String(pageSize)}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          <div className="flex items-end gap-3 md:col-span-2">
            <Button className="gap-2" disabled={isRefreshing} onClick={() => handleRefresh()} variant="secondary">
              <RefreshCcw className="h-4 w-4" />
              {isRefreshing ? "Rafraîchissement..." : "Rafraîchir"}
            </Button>
            <Button
              className="gap-2"
              disabled={purgeMutation.isPending || totalEvents === 0}
              onClick={() => setPurgeConfirmationOpen(true)}
              variant="danger"
            >
              <Trash2 className="h-4 w-4" />
              Purger le filtre
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                updateFilters({
                  from: daysAgoDayString(29),
                  to: todayDayString(),
                  component: "",
                  route: "",
                  q: "",
                  org: isSuperAdmin ? "" : selectedOrganizationId,
                  userId: "",
                  page: 1,
                  pageSize: defaultPageSize,
                })
              }
            >
              Réinitialiser
            </Button>
          </div>
          {purgeConfirmationOpen ? (
            <div className="md:col-span-4 rounded-3xl border border-rose-500/30 bg-rose-500/5 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold">Confirmer la purge</p>
                  <p className="text-sm text-muted-foreground">
                    Les événements correspondant aux filtres courants seront supprimés définitivement.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setPurgeConfirmationOpen(false)}>
                    Annuler
                  </Button>
                  <Button
                    disabled={purgeMutation.isPending}
                    onClick={() => purgeMutation.mutate()}
                    variant="danger"
                  >
                    {purgeMutation.isPending ? "Purge..." : "Confirmer"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Historique</CardTitle>
              <CardDescription>
                {eventsQuery.isLoading
                  ? "Chargement des erreurs backend..."
                  : `${totalEvents} événement(s) sur ${totalPages} page(s).`}
              </CardDescription>
            </div>
            <Badge variant="muted">{scopeLabel}</Badge>
          </CardHeader>
          <CardContent>
            {eventsQuery.isError ? (
              <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-700">
                {eventsQuery.error instanceof Error ? eventsQuery.error.message : "Impossible de charger les erreurs backend."}
              </div>
            ) : (
              <TableWrapper>
                <Table>
                  <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Composant</th>
                      <th className="px-6 py-4">Route</th>
                      <th className="px-6 py-4">Étape</th>
                      <th className="px-6 py-4">Statut</th>
                      <th className="px-6 py-4">Message</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventsQuery.isLoading ? (
                      <tr className="border-t border-border/70">
                        <td className="px-6 py-4 text-muted-foreground" colSpan={7}>
                          Chargement en cours...
                        </td>
                      </tr>
                    ) : backendErrors.length === 0 ? (
                      <tr className="border-t border-border/70">
                        <td className="px-6 py-4 text-muted-foreground" colSpan={7}>
                          Aucun événement ne correspond à ce filtre.
                        </td>
                      </tr>
                    ) : (
                      backendErrors.map((event) => {
                        const selected = event.id === selectedEvent?.id
                        return (
                          <tr
                            className={selected ? "border-t border-border/70 bg-primary/5" : "border-t border-border/70"}
                            key={event.id}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">{formatDateTime(event.createdAt)}</td>
                            <td className="px-6 py-4">{event.component}</td>
                            <td className="px-6 py-4 max-w-[220px] truncate">{event.route}</td>
                            <td className="px-6 py-4 max-w-[200px] truncate">{event.step}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <Badge variant={badgeVariantForStatus(event.statusCode)}>{event.statusCode ?? "n/a"}</Badge>
                                {event.recoveryStatus ? (
                                  <Badge variant={badgeVariantForRecoveryStatus(event.recoveryStatus)}>
                                    {recoveryStatusLabel(event.recoveryStatus)}
                                  </Badge>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-[280px] truncate">{event.errorMessage || event.title}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  className="gap-2"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleCopyRowJson(event)}
                                >
                                  {rowCopyState?.eventId === event.id && rowCopyState.status === "copied" ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                  {rowCopyState?.eventId === event.id
                                    ? rowCopyState.status === "copied"
                                      ? "Copié"
                                      : "Erreur"
                                    : "Copier"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={selected ? "primary" : "secondary"}
                                  onClick={() => setSelectedEventId(event.id)}
                                >
                                  Voir
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </Table>
              </TableWrapper>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card/80 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {totalPages} · {pageSize} événements par page
          </p>
          <div className="flex gap-2">
            <Button
              disabled={page <= 1 || eventsQuery.isLoading}
              onClick={() =>
                updateFilters({
                  from,
                  to,
                  component,
                  route,
                  q: query,
                  org: selectedOrganizationId,
                  page: page - 1,
                  pageSize,
                })
              }
              variant="secondary"
            >
              Précédent
            </Button>
            <Button
              disabled={page >= totalPages || eventsQuery.isLoading}
              onClick={() =>
                updateFilters({
                  from,
                  to,
                  component,
                  route,
                  q: query,
                  org: selectedOrganizationId,
                  page: page + 1,
                  pageSize,
                })
              }
              variant="secondary"
            >
              Suivant
            </Button>
          </div>
        </div>
      </div>

      {selectedEvent ? (
        <BackendErrorDetailModal
          annex={selectedAnnex}
          copied={copyState === "copied"}
          copyFailed={copyState === "error"}
          event={selectedEvent}
          hasAnnex={hasAnnex}
          onClose={() => {
            setSelectedEventId("")
            setCopyState("idle")
          }}
          onCopy={handleCopyDetail}
          payload={selectedPayload}
        />
      ) : null}
    </div>
  )
}
