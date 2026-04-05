import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useSearchParams } from "react-router-dom"
import { createPortal } from "react-dom"
import { CircleHelp, RefreshCcw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableWrapper } from "@/components/ui/table"
import {
  fetchOrganizations,
  fetchPerformanceSummary,
  fetchUsersByOrganization,
  purgePerformanceEvents,
} from "@/lib/admin-client"
import type { PerformanceSummary } from "@/lib/types"
import {
  advanceIsoByDays,
  applyTimeToIso,
  formatDateTime,
  hoursAgoIsoString,
  nowIsoString,
  formatTimeLocalInput,
  toTitleCase,
} from "@/lib/utils"
import { useAdminSession } from "@/lib/use-admin-session"

type PerformanceEvent = PerformanceSummary["recentEvents"][number]

type PerformanceEventDetailState = {
  eventId: string
  title: string
  summary: string
  event: PerformanceEvent
}

function StatCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
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

function formatDurationMs(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "0 ms"
  }
  if (value < 1_000) {
    return `${Math.round(value)} ms`
  }
  if (value < 60_000) {
    return `${(value / 1_000).toFixed(2)} s`
  }
  return `${(value / 60_000).toFixed(1)} min`
}

function formatJsonBlock(value: unknown) {
  if (value === null || value === undefined) {
    return "—"
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function parsePerformanceMeta(metaJson: string) {
  if (!metaJson.trim()) {
    return null
  }

  try {
    return JSON.parse(metaJson) as Record<string, unknown>
  } catch {
    return { raw: metaJson }
  }
}

function buildPerformanceEventSummary(event: PerformanceEvent) {
  const taskDisplay = formatPerformanceTaskDisplay(event.task)
  return `${taskDisplay.label}${taskDisplay.detail ? ` · ${taskDisplay.detail}` : ""} · ${formatPerformanceStatus(event.status)}`
}

function DetailField({
  label,
  value,
  mono = false,
  wrap = false,
  className,
}: {
  label: string
  value: ReactNode
  mono?: boolean
  wrap?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className={`mt-1 text-sm ${mono ? "font-mono text-xs" : ""} ${wrap ? "break-words" : ""}`}>{value}</div>
    </div>
  )
}

function PerformanceEventDetailDialog({
  detail,
  onClose,
}: {
  detail: PerformanceEventDetailState | null
  onClose: () => void
}) {
  const dialogId = useId()
  const titleId = `${dialogId}-title`
  const descriptionId = `${dialogId}-description`
  const closeButtonId = `${dialogId}-close`

  useEffect(() => {
    if (!detail) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [detail, onClose])

  useEffect(() => {
    if (!detail) {
      return
    }

    const rafId = window.requestAnimationFrame(() => {
      document.getElementById(closeButtonId)?.focus()
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [closeButtonId, detail])

  if (!detail || typeof document === "undefined") {
    return null
  }

  const meta = parsePerformanceMeta(detail.event.metaJson)

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55" aria-hidden="true" />
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative z-[81] flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col rounded-3xl border border-border/70 bg-background shadow-2xl"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border/70 px-6 py-5">
          <div className="space-y-1">
            <h2 id={titleId} className="text-xl font-semibold">
              Détail de l’exécution
            </h2>
            <p id={descriptionId} className="text-sm text-muted-foreground">
              {detail.title}
            </p>
          </div>
          <button
            id={closeButtonId}
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-full border border-border bg-card px-3 text-sm font-medium text-foreground transition hover:bg-card/80 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>

        <div className="grid gap-6 overflow-auto px-6 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="space-y-4">
            <Card className="border-border/70 bg-muted/15">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Résumé</CardTitle>
                <CardDescription>{detail.summary}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <DetailField label="Horodatage" value={formatDateTime(detail.event.occurredAt)} />
                <DetailField label="Statut" value={<Badge variant={statusVariant(detail.event.status)}>{formatPerformanceStatus(detail.event.status)}</Badge>} />
                <DetailField label="Surface" value={<Badge variant={surfaceVariant(detail.event.surface)}>{toTitleCase(detail.event.surface)}</Badge>} />
                <DetailField label="Composant" value={toTitleCase(detail.event.component)} />
                <DetailField label="Tâche" value={detail.event.task} mono />
                <DetailField label="Durée" value={formatDurationMs(detail.event.durationMs)} />
                <DetailField label="Route" value={detail.event.route} mono wrap />
                <DetailField label="Trace" value={detail.event.traceId} mono wrap />
                <DetailField label="Event ID" value={detail.event.eventId} mono wrap className="sm:col-span-2" />
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-muted/15">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Métadonnées</CardTitle>
                <CardDescription>Payload enrichi associé à l’exécution.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailField label="Surface brute" value={detail.event.surface} mono />
                  <DetailField label="Créée le" value={formatDateTime(detail.event.createdAt)} />
                  <DetailField label="Jour" value={detail.event.day} mono />
                  <DetailField label="Organisation" value={detail.event.organizationId ?? "—"} mono wrap />
                  <DetailField label="Utilisateur" value={detail.event.userId ?? "—"} mono wrap />
                  <DetailField label="Marqueur" value={detail.event.traceId} mono wrap />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Meta JSON</p>
                  <pre className="max-h-72 overflow-auto rounded-2xl border border-border/70 bg-background p-4 text-xs leading-6 text-muted-foreground">
                    {detail.event.metaJson || "—"}
                  </pre>
                </div>
                {meta ? (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Meta parsées</p>
                    <pre className="max-h-72 overflow-auto rounded-2xl border border-border/70 bg-background p-4 text-xs leading-6 text-muted-foreground">
                      {formatJsonBlock(meta)}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <Card className="border-border/70 bg-muted/15">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Détail technique</CardTitle>
                <CardDescription>Vue complète pour audit et support.</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="max-h-[42rem] overflow-auto rounded-2xl border border-border/70 bg-background p-4 text-[11px] leading-6 text-muted-foreground">
                  {formatJsonBlock(detail.event)}
                </pre>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function statusVariant(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized === "success") {
    return "success" as const
  }
  if (normalized === "token_expired") {
    return "muted" as const
  }
  return "danger" as const
}

function formatPerformanceStatus(status: string) {
  const normalized = status.trim().toLowerCase()
  if (normalized === "token_expired") {
    return "Token expiré"
  }
  return toTitleCase(status)
}

function surfaceVariant(surface: string) {
  return surface.toLowerCase() === "frontend" ? ("muted" as const) : ("default" as const)
}

function setSearchParam(params: URLSearchParams, key: string, value: string | undefined) {
  const trimmed = value?.trim() ?? ""
  if (trimmed) {
    params.set(key, trimmed)
    return
  }
  params.delete(key)
}

const performanceTaskStepLabels: Record<string, string> = {
  request_start: "Début de requête",
  request_error: "Erreur de requête",
  response_received: "Réponse reçue",
  upstream_error_response: "Réponse en erreur",
  transport_error: "Erreur réseau",
  read_error: "Erreur de lecture",
}

function formatPerformanceTaskStep(step: string) {
  return performanceTaskStepLabels[step] ?? toTitleCase(step)
}

const performanceTaskLabels: Record<string, { label: string; detail?: string }> = {
  http_request: { label: "Requête HTTP backend" },
  backend_audio_transcription: { label: "Traitement audio backend" },
  demeter_audio_transcription: { label: "Transcription audio Demeter" },
  frontend_audio_decode: { label: "Décodage audio frontend" },
  frontend_audio_segment_decode: { label: "Décodage segment frontend" },
  frontend_model_load: { label: "Chargement modèle frontend" },
  frontend_cloud_decode_ffmpeg: { label: "Décodage FFmpeg cloud" },
  frontend_cloud_preprocess: { label: "Prétraitement cloud" },
  frontend_cloud_transcribe: { label: "Transcription cloud" },
  frontend_cloud_total: { label: "Traitement cloud total" },
  frontend_llm_local_total: { label: "Génération LLM locale" },
  frontend_llm_cloud_total: { label: "Génération LLM cloud" },
  mistral_models: { label: "Client Mistral", detail: "Liste des modèles" },
  mistral_request: { label: "Client Mistral", detail: "Requête générique" },
  mistral_audio_transcription: { label: "Client Mistral", detail: "Transcription audio" },
  mistral_report_generation: { label: "Client Mistral", detail: "Génération de CR" },
  mistral_report_cri: { label: "Client Mistral", detail: "CRI" },
  mistral_report_cro: { label: "Client Mistral", detail: "CRO" },
  mistral_report_crs: { label: "Client Mistral", detail: "CRS" },
}

function formatPerformanceTaskDisplay(task: string) {
  const normalized = task.trim()
  if (!normalized) {
    return { label: "Inconnue", detail: "" }
  }

  if (performanceTaskLabels[normalized]) {
    return performanceTaskLabels[normalized]
  }

  if (normalized === "CRI" || normalized === "CRO" || normalized === "CRS") {
    return {
      label: "Client Mistral",
      detail: normalized,
    }
  }

  if (normalized.startsWith("mistral_")) {
    const detail = normalized.slice("mistral_".length)
    if (detail.startsWith("report_")) {
      const reportVariant = detail.slice("report_".length)
      return {
        label: "Client Mistral",
        detail: reportVariant.toUpperCase(),
      }
    }
    return {
      label: "Client Mistral",
      detail: formatPerformanceTaskStep(detail),
    }
  }

  if (normalized.startsWith("frontend_")) {
    return {
      label: toTitleCase(normalized.replace(/^frontend_/, "frontend ")),
      detail: "",
    }
  }

  return { label: toTitleCase(normalized), detail: "" }
}

const performanceTaskHelpSections = [
  {
    title: "Lecture générale",
    items: [
      {
        task: "http_request",
        description:
          "Durée totale d'une requête HTTP backend, du début du traitement jusqu'à la réponse finale, succès ou erreur.",
      },
      {
        task: "timeout",
        description: "Requête arrivée au délai limite de traitement côté backend.",
      },
      {
        task: "mistral_request",
        description: "Mesure du client Mistral sur les appels génériques, indépendamment du type de payload.",
      },
      {
        task: "mistral_models",
        description: "Durée d'accès à la liste des modèles Mistral, utile pour mesurer la latence de découverte.",
      },
    ],
  },
  {
    title: "Transcription et audio",
    items: [
      {
        task: "mistral_audio_transcription",
        description: "Durée de transcription audio côté client Mistral.",
      },
      {
        task: "backend_audio_transcription",
        description: "Durée de traitement audio sur le backend Demeter Santé.",
      },
      {
        task: "demeter_audio_transcription",
        description: "Durée de traitement audio par le pipeline Demeter.",
      },
      {
        task: "frontend_audio_decode",
        description: "Durée de décodage audio côté frontend user.",
      },
      {
        task: "frontend_audio_segment_decode",
        description: "Durée de décodage d'un segment audio côté frontend user.",
      },
      {
        task: "frontend_cloud_preprocess",
        description: "Durée du prétraitement audio côté frontend cloud.",
      },
    ],
  },
  {
    title: "Génération de CR",
    items: [
      {
        task: "mistral_report_generation",
        description: "Durée globale de génération de compte rendu côté client Mistral.",
      },
      {
        task: "mistral_report_cri",
        description: "Durée de génération du format CRI.",
      },
      {
        task: "mistral_report_cro",
        description: "Durée de génération du format CRO.",
      },
      {
        task: "mistral_report_crs",
        description: "Durée de génération du format CRS.",
      },
    ],
  },
  {
    title: "Frontend avancé",
    items: [
      {
        task: "frontend_model_load",
        description: "Durée de chargement complet du modèle ASR côté frontend.",
      },
      {
        task: "frontend_cloud_decode_ffmpeg",
        description: "Durée de décodage ffmpeg dans le parcours cloud frontend.",
      },
      {
        task: "frontend_cloud_transcribe",
        description: "Durée de transcription cloud côté frontend user.",
      },
      {
        task: "frontend_cloud_total",
        description: "Durée totale d'un run cloud côté frontend user.",
      },
      {
        task: "frontend_llm_local_total",
        description: "Durée totale d'une génération LLM locale côté frontend user.",
      },
      {
        task: "frontend_llm_cloud_total",
        description: "Durée totale d'une génération LLM cloud côté frontend user.",
      },
    ],
  },
] as const

function TaskHelpPopover() {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const interactionRef = useRef<"pointer" | "keyboard" | null>(null)
  const panelId = useId()

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger || typeof window === "undefined") {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth
    const width = Math.max(0, Math.min(640, viewportWidth - 32))
    const left = Math.max(16, Math.min(rect.left, viewportWidth - 16 - width))

    setPosition({
      left: Math.round(left),
      top: Math.round(rect.bottom + 12),
      width: Math.round(width),
    })
  }, [])

  useLayoutEffect(() => {
    if (open) {
      updatePosition()
    }
    // The button geometry can change when the page reflows, so recompute on open.
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) {
      return
    }

    const closeIfOutside = (event: Event) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (triggerRef.current?.contains(target)) {
        return
      }
      if (panelRef.current?.contains(target)) {
        return
      }
      setOpen(false)
      interactionRef.current = null
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        interactionRef.current = null
        triggerRef.current?.blur()
      }
    }

    const handleReposition = () => {
      updatePosition()
    }

    window.addEventListener("resize", handleReposition)
    window.addEventListener("scroll", handleReposition, true)
    document.addEventListener("pointerdown", closeIfOutside, true)
    document.addEventListener("keydown", handleKeyDown)

    return () => {
      window.removeEventListener("resize", handleReposition)
      window.removeEventListener("scroll", handleReposition, true)
      document.removeEventListener("pointerdown", closeIfOutside, true)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open, updatePosition])

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onBlur={(event) => {
        const relatedTarget = event.relatedTarget
        if (relatedTarget instanceof Node && wrapperRef.current?.contains(relatedTarget)) {
          return
        }
        if (relatedTarget instanceof Node && panelRef.current?.contains(relatedTarget)) {
          return
        }
        setOpen(false)
        interactionRef.current = null
      }}
    >
      <div className="flex items-center gap-2">
        <Label htmlFor="performance-task">Tâche</Label>
        <button
          ref={triggerRef}
          aria-controls={panelId}
          aria-expanded={open}
          aria-label="Aide sur les tâches de performance"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition hover:border-foreground/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          type="button"
          onPointerDown={() => {
            interactionRef.current = "pointer"
          }}
          onFocus={() => {
            if (interactionRef.current !== "pointer") {
              setOpen(true)
            }
          }}
          onClick={(event) => {
            if (event.detail === 0) {
              setOpen(true)
            } else {
              setOpen((currentOpen) => !currentOpen)
            }
            interactionRef.current = null
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false)
              interactionRef.current = null
              event.currentTarget.blur()
            }
          }}
        >
          <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              aria-label="Définition des tâches de performance"
              className="fixed z-[70] max-h-[calc(100vh-2rem)] overflow-auto rounded-2xl border border-border/70 bg-background p-4 shadow-2xl ring-1 ring-border/60"
              id={panelId}
              role="tooltip"
              style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
                width: `${position.width}px`,
              }}
            >
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Valeurs exactes du champ <span className="font-mono">task</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Le filtre sélectionne la valeur brute enregistrée en base. Les libellés ci-dessous expliquent
                    précisément ce que mesure chaque timing.
                  </p>
                </div>

                <div className="space-y-4">
                  {performanceTaskHelpSections.map((section) => (
                    <section key={section.title} className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        {section.title}
                      </h3>
                      <div className="space-y-2">
                        {section.items.map((item) => {
                          const taskDisplay = formatPerformanceTaskDisplay(item.task)
                          return (
                            <div key={item.task} className="rounded-2xl border border-border/60 bg-muted/30 p-3">
                              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                <span>{taskDisplay.label}</span>
                                {taskDisplay.detail ? (
                                  <span className="text-muted-foreground">{taskDisplay.detail}</span>
                                ) : null}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                <code className="rounded-md bg-background px-1.5 py-0.5 font-mono text-[0.8em]">
                                  {item.task}
                                </code>
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function PerformancePageContent() {
  const queryClient = useQueryClient()
  const { isSuperAdmin, session } = useAdminSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [purgeConfirmationOpen, setPurgeConfirmationOpen] = useState(false)
  const [selectedPerformanceEvent, setSelectedPerformanceEvent] = useState<PerformanceEventDetailState | null>(null)
  const [defaultPerformanceTo] = useState(() => nowIsoString())
  const [defaultPerformanceFrom] = useState(() => hoursAgoIsoString(24))
  const from = searchParams.get("from") ?? defaultPerformanceFrom
  const to = searchParams.get("to") ?? defaultPerformanceTo
  const organizationId = isSuperAdmin ? searchParams.get("organizationId") ?? "" : session?.organization.id ?? ""
  const scopeOrganizationId = isSuperAdmin ? organizationId : session?.organization.id ?? ""
  const selectedUserId = searchParams.get("userId") ?? ""
  const task = searchParams.get("task") ?? ""
  const performanceSummaryQueryKey = [
    "performance-summary",
    from,
    to,
    organizationId || "global",
    selectedUserId || "all-users",
    task || "all",
  ] as const
  const organizationUsersQueryKey = ["organization-users", scopeOrganizationId || "none"] as const

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    enabled: isSuperAdmin,
  })

  const organizationUsersQuery = useQuery({
    queryKey: organizationUsersQueryKey,
    queryFn: () => fetchUsersByOrganization(scopeOrganizationId),
    enabled: Boolean(scopeOrganizationId),
  })

  const summaryQuery = useQuery({
    enabled: isSuperAdmin,
    queryKey: performanceSummaryQueryKey,
    queryFn: () =>
      fetchPerformanceSummary({
        from,
        to,
        organizationId: organizationId || undefined,
        userId: selectedUserId || undefined,
        task: task || undefined,
      }),
  })

  const purgeMutation = useMutation({
    mutationFn: () =>
      purgePerformanceEvents({
        from,
        to,
        organizationId: organizationId || undefined,
        userId: selectedUserId || undefined,
        task: task || undefined,
      }),
    onSuccess: async () => {
      setPurgeConfirmationOpen(false)
      await queryClient.invalidateQueries({ queryKey: ["performance-summary"] })
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
    if (isSuperAdmin && searchParams.get("userId") && !organizationId) {
      next.delete("userId")
      changed = true
    }

    if (changed) {
      setSearchParams(next, { replace: true })
    }
  }, [defaultPerformanceFrom, defaultPerformanceTo, from, isSuperAdmin, organizationId, searchParams, setSearchParams, to])

  useEffect(() => {
    if (!selectedUserId) {
      return
    }

    if (!scopeOrganizationId) {
      const next = new URLSearchParams(searchParams)
      next.delete("userId")
      setSearchParams(next, { replace: true })
      return
    }

    if (organizationUsersQuery.isLoading) {
      return
    }

    const organizationUsers = organizationUsersQuery.data ?? []
    if (organizationUsers.some((user) => user.id === selectedUserId)) {
      return
    }

    const next = new URLSearchParams(searchParams)
    next.delete("userId")
    setSearchParams(next, { replace: true })
  }, [organizationUsersQuery.data, organizationUsersQuery.isLoading, scopeOrganizationId, searchParams, selectedUserId, setSearchParams])

  const updatePerformanceSearchParams = (next: {
    from?: string
    to?: string
    organizationId?: string
    userId?: string
    task?: string
  }) => {
    const params = new URLSearchParams()
    setSearchParam(params, "from", next.from ?? from)
    setSearchParam(params, "to", next.to ?? to)
    if (isSuperAdmin) {
      setSearchParam(params, "organizationId", next.organizationId ?? organizationId)
    }
    setSearchParam(params, "userId", next.userId ?? selectedUserId)
    setSearchParam(params, "task", next.task ?? task)
    setSearchParams(params, { replace: true })
  }

  const summary = summaryQuery.data
  const slowestTask = summary?.topTasks[0]
  const isRefreshing = summaryQuery.isFetching || organizationsQuery.isFetching || organizationUsersQuery.isFetching
  const taskOptions = useMemo(() => {
    const values = new Set(summary?.taskOptions ?? [])
    if (task && !values.has(task)) {
      values.add(task)
    }
    return Array.from(values)
  }, [summary?.taskOptions, task])
  const organizationUsers = useMemo(() => organizationUsersQuery.data ?? [], [organizationUsersQuery.data])
  const usersFilterDisabled = !scopeOrganizationId || organizationUsersQuery.isLoading
  const updatePerformanceTimeSearchParams = (field: "from" | "to", timeValue: string) => {
    const currentFromTime = formatTimeLocalInput(from)
    const currentToTime = formatTimeLocalInput(to)
    const nextFrom =
      field === "from" ? applyTimeToIso(from, timeValue) || from : applyTimeToIso(from, currentFromTime) || from
    const nextTo = field === "to" ? applyTimeToIso(to, timeValue) || to : applyTimeToIso(to, currentToTime) || to
    const normalizedTo = new Date(nextFrom).getTime() >= new Date(nextTo).getTime() ? advanceIsoByDays(nextTo, 1) : nextTo

    updatePerformanceSearchParams({
      from: nextFrom,
      to: normalizedTo,
      organizationId,
      userId: selectedUserId,
      task,
    })
  }
  const scopeLabel = useMemo(() => {
    if (!isSuperAdmin) {
      return "Administration"
    }
    if (!organizationId) {
      return "Toutes les organisations"
    }
    return organizationsQuery.data?.find((organization) => organization.id === organizationId)?.name ?? organizationId
  }, [isSuperAdmin, organizationId, organizationsQuery.data])

  useEffect(() => {
    if (!selectedPerformanceEvent || !summary?.recentEvents.length) {
      return
    }
    const stillVisible = summary.recentEvents.some((event) => event.eventId === selectedPerformanceEvent.eventId)
    if (!stillVisible) {
      setSelectedPerformanceEvent(null)
    }
  }, [selectedPerformanceEvent, summary?.recentEvents])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fenêtre de performance 24 h</CardTitle>
          <CardDescription>
            Dashboard réservé aux super admin. Les timings sont agrégés sur une fenêtre glissante de 24 heures et
            regroupés par tâche, composant et route.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="performance-from">Du</Label>
            <Input
              id="performance-from"
              onChange={(event) =>
                updatePerformanceTimeSearchParams("from", event.target.value)
              }
              step={60}
              type="time"
              value={formatTimeLocalInput(from)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="performance-to">Au</Label>
            <Input
              id="performance-to"
              onChange={(event) =>
                updatePerformanceTimeSearchParams("to", event.target.value)
              }
              step={60}
              type="time"
              value={formatTimeLocalInput(to)}
            />
          </div>
          {isSuperAdmin ? (
            <div className="space-y-1.5 md:col-span-6">
              <Label htmlFor="performance-organization">Organisation</Label>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                id="performance-organization"
                onChange={(event) =>
                  updatePerformanceSearchParams({
                    from,
                    to,
                    organizationId: event.target.value,
                    userId: "",
                    task,
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
          <div className="space-y-1.5 md:col-span-6">
            <Label htmlFor="performance-user">Utilisateur</Label>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              disabled={usersFilterDisabled}
              id="performance-user"
              onChange={(event) =>
                updatePerformanceSearchParams({
                  from,
                  to,
                  organizationId,
                  userId: event.target.value,
                  task,
                })
              }
              value={scopeOrganizationId ? selectedUserId : ""}
            >
              <option value="">
                {scopeOrganizationId ? "Tous les utilisateurs" : "Sélectionnez une organisation"}
              </option>
              {organizationUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 md:col-span-6">
            <TaskHelpPopover />
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              id="performance-task"
              onChange={(event) =>
                updatePerformanceSearchParams({
                  from,
                  to,
                  organizationId,
                  userId: selectedUserId,
                  task: event.target.value,
                })
              }
              value={task}
            >
              <option value="">Toutes les tâches</option>
              {taskOptions.map((taskOption) => {
                const taskDisplay = formatPerformanceTaskDisplay(taskOption)
                return (
                  <option key={taskOption} value={taskOption}>
                    {taskDisplay.detail ? `${taskDisplay.label} · ${taskDisplay.detail}` : taskDisplay.label}
                  </option>
                )
              })}
            </select>
          </div>
          {isSuperAdmin ? (
            <>
              <div className="flex flex-wrap items-end gap-3 md:col-span-6">
                <Button
                  className="gap-2"
                  disabled={isRefreshing}
                  onClick={() =>
                    updatePerformanceSearchParams({
                      from: hoursAgoIsoString(24),
                      to: nowIsoString(),
                      organizationId,
                      userId: selectedUserId,
                      task,
                    })
                  }
                  variant="secondary"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {isRefreshing ? "Rafraîchissement..." : "Rafraîchir"}
                </Button>
                <Button
                  className="gap-2"
                  disabled={purgeMutation.isPending || (summary?.totals.events ?? 0) === 0}
                  onClick={() => setPurgeConfirmationOpen(true)}
                  variant="danger"
                >
                  <Trash2 className="h-4 w-4" />
                  Purger les données
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    updatePerformanceSearchParams({
                      from: hoursAgoIsoString(24),
                      to: nowIsoString(),
                      organizationId: "",
                      userId: "",
                      task: "",
                    })
                  }
                >
                  Réinitialiser
                </Button>
              </div>
              {purgeConfirmationOpen ? (
                <div className="md:col-span-6 rounded-3xl border border-rose-500/30 bg-rose-500/5 p-4">
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
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard helper="Nombre total d’exécutions mesurées." label="Exécutions" value={summary?.totals.events ?? 0} />
        <StatCard helper="Durées réussies agrégées." label="Succès" value={summary?.totals.successes ?? 0} />
        <StatCard helper="Runs en erreur ou arrêtés." label="Erreurs" value={summary?.totals.failures ?? 0} />
        <StatCard
          helper="Durée moyenne de la fenêtre."
          label="Durée moyenne"
          value={formatDurationMs(summary?.totals.averageDurationMs ?? 0)}
        />
        <StatCard
          helper="Durée la plus élevée observée."
          label="Pic max"
          value={formatDurationMs(summary?.totals.maxDurationMs ?? 0)}
        />
        <StatCard
          helper={`Périmètre actif: ${scopeLabel}`}
          label="Tâche la plus lente"
          value={slowestTask ? formatPerformanceTaskDisplay(slowestTask.task).label : "Aucune donnée"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dernières exécutions</CardTitle>
          <CardDescription>Historique détaillé des derniers timings remontés au backend.</CardDescription>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Horodatage</th>
                  <th className="px-6 py-4">Surface</th>
                  <th className="px-6 py-4">Composant</th>
                  <th className="px-6 py-4">Tâche</th>
                  <th className="px-6 py-4">Durée</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Route</th>
                  <th className="px-6 py-4 text-right">Détail</th>
                </tr>
              </thead>
              <tbody>
                {summary?.recentEvents.length ? (
                  summary.recentEvents.map((event) => {
                    const taskDisplay = formatPerformanceTaskDisplay(event.task)
                    const detailTitle = `${taskDisplay.label}${taskDisplay.detail ? ` · ${taskDisplay.detail}` : ""}`
                    return (
                      <tr className="border-t border-border/70" key={event.eventId}>
                        <td className="px-6 py-4">{formatDateTime(event.occurredAt)}</td>
                        <td className="px-6 py-4">
                          <Badge variant={surfaceVariant(event.surface)}>{toTitleCase(event.surface)}</Badge>
                        </td>
                        <td className="px-6 py-4">{toTitleCase(event.component)}</td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">{taskDisplay.label}</div>
                            {taskDisplay.detail ? <div className="text-xs text-muted-foreground">{taskDisplay.detail}</div> : null}
                            <code className="block text-xs font-mono text-muted-foreground">{event.task}</code>
                          </div>
                        </td>
                        <td className="px-6 py-4">{formatDurationMs(event.durationMs)}</td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant(event.status)}>{formatPerformanceStatus(event.status)}</Badge>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{event.route}</td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              setSelectedPerformanceEvent({
                                eventId: event.eventId,
                                title: detailTitle,
                                summary: buildPerformanceEventSummary(event),
                                event,
                              })
                            }
                          >
                            Voir
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-8 text-center text-muted-foreground" colSpan={8}>
                      Aucun timing remonté sur la fenêtre sélectionnée.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>

      <PerformanceEventDetailDialog detail={selectedPerformanceEvent} onClose={() => setSelectedPerformanceEvent(null)} />

      <Card>
        <CardHeader>
          <CardTitle>Top tâches lentes</CardTitle>
          <CardDescription>Classement des opérations par durée moyenne, route et API.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {summary?.topTasks.length ? (
              summary.topTasks.map((item) => {
                const taskDisplay = formatPerformanceTaskDisplay(item.task)
                return (
                  <div
                    className="min-w-0 rounded-2xl border border-border/70 bg-muted/35 p-4"
                    key={`${item.surface}-${item.component}-${item.task}-${item.route}`}
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant={surfaceVariant(item.surface)}>{toTitleCase(item.surface)}</Badge>
                      <Badge variant="muted">{toTitleCase(item.component)}</Badge>
                      <Badge variant="default">{taskDisplay.label}</Badge>
                      {taskDisplay.detail ? <span className="text-xs text-muted-foreground">{taskDisplay.detail}</span> : null}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Route</p>
                      <p className="mt-1 min-w-0 break-words font-mono text-sm font-medium [overflow-wrap:anywhere]">
                        {item.route}
                      </p>
                    </div>
                    <div className="mt-4 grid min-w-0 gap-3 text-sm sm:grid-cols-3">
                      <div className="min-w-0 rounded-xl border border-border/50 bg-background/50 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Moyenne</p>
                        <p className="mt-1 font-medium">{formatDurationMs(item.averageDurationMs)}</p>
                      </div>
                      <div className="min-w-0 rounded-xl border border-border/50 bg-background/50 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Pic</p>
                        <p className="mt-1 font-medium">{formatDurationMs(item.maxDurationMs)}</p>
                      </div>
                      <div className="min-w-0 rounded-xl border border-border/50 bg-background/50 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Exécutions</p>
                        <p className="mt-1 font-medium">{item.events}</p>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <p className="text-sm text-muted-foreground">Aucune tâche lente détectée sur cette fenêtre.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contexte de lecture</CardTitle>
          <CardDescription>Le tableau de bord reste réservé aux super admin et suit le scope réel du backend.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Périmètre:</span>
          <Badge variant="muted">{scopeLabel}</Badge>
          <span>Fenêtre:</span>
          <Badge variant="muted">
            {summary?.range.from ? formatDateTime(summary.range.from) : formatDateTime(from)} →{" "}
            {summary?.range.to ? formatDateTime(summary.range.to) : formatDateTime(to)}
          </Badge>
          <span>Tâche:</span>
          <Badge variant="muted">
            {task ? formatPerformanceTaskDisplay(task).label : "Toutes les tâches"}
          </Badge>
          <span>Événements:</span>
          <Badge variant="muted">{summary?.totals.events ?? 0}</Badge>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PerformancePage() {
  return <PerformancePageContent />
}
