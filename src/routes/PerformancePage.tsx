import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { createPortal } from "react-dom"
import { CircleHelp, RefreshCcw, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableWrapper } from "@/components/ui/table"
import { fetchOrganizations, fetchPerformanceSummary, purgePerformanceEvents } from "@/lib/admin-client"
import { daysAgoDayString, formatDateTime, formatDay, todayDayString, toTitleCase } from "@/lib/utils"
import { useAdminSession } from "@/lib/use-admin-session"

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

function statusVariant(status: string) {
  return status.toLowerCase() === "success" ? ("success" as const) : ("danger" as const)
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

function formatPerformanceTaskDisplay(task: string) {
  const normalized = task.trim()
  if (!normalized) {
    return { label: "Inconnue", detail: "" }
  }

  const familyPrefixes = [
    { prefix: "transcription_", label: "Transcription" },
    { prefix: "cr_generation_", label: "Génération de CR" },
    { prefix: "mistral_", label: "Mistral" },
  ] as const

  for (const family of familyPrefixes) {
    if (normalized.startsWith(family.prefix)) {
      return {
        label: family.label,
        detail: formatPerformanceTaskStep(normalized.slice(family.prefix.length)),
      }
    }
  }

  if (normalized === "audio_transcription") {
    return { label: "Transcription Demeter", detail: "Historique" }
  }

  return { label: toTitleCase(normalized), detail: "" }
}

const performanceTaskHelpSections = [
  {
    title: "Requêtes backend",
    items: [
      {
        task: "request",
        description:
          "Durée totale d'une requête HTTP backend, du début du traitement jusqu'à la réponse finale, succès ou erreur.",
      },
      {
        task: "timeout",
        description: "Requête arrivée au délai limite de traitement côté backend.",
      },
    ],
  },
  {
    title: "Mistral",
    items: [
      {
        task: "mistral_request_start",
        description: "Début d'un appel Mistral générique.",
      },
      {
        task: "mistral_request_error",
        description: "Erreur de construction de la requête Mistral.",
      },
      {
        task: "mistral_response_received",
        description: "Appel Mistral terminé normalement avec une réponse exploitable.",
      },
      {
        task: "mistral_upstream_error_response",
        description: "Appel Mistral revenu avec un code HTTP en erreur.",
      },
      {
        task: "mistral_transport_error",
        description: "Appel Mistral interrompu par une erreur réseau ou transport.",
      },
      {
        task: "mistral_read_error",
        description: "Appel Mistral interrompu pendant la lecture du corps de réponse.",
      },
    ],
  },
  {
    title: "Transcription",
    items: [
      {
        task: "transcription_request_start",
        description: "Début d'un appel de transcription.",
      },
      {
        task: "transcription_request_error",
        description: "Erreur de construction de la requête de transcription.",
      },
      {
        task: "transcription_response_received",
        description: "Transcription terminée normalement avec une réponse exploitable.",
      },
      {
        task: "transcription_upstream_error_response",
        description: "Transcription revenue avec un code HTTP en erreur.",
      },
      {
        task: "transcription_transport_error",
        description: "Transcription interrompue par une erreur réseau ou transport.",
      },
      {
        task: "transcription_read_error",
        description: "Transcription interrompue pendant la lecture du corps de réponse.",
      },
    ],
  },
  {
    title: "Génération de CR",
    items: [
      {
        task: "cr_generation_request_start",
        description: "Début d'une génération de CR.",
      },
      {
        task: "cr_generation_request_error",
        description: "Erreur de construction de la requête de génération de CR.",
      },
      {
        task: "cr_generation_response_received",
        description: "Génération de CR terminée normalement avec une réponse exploitable.",
      },
      {
        task: "cr_generation_upstream_error_response",
        description: "Génération de CR revenue avec un code HTTP en erreur.",
      },
      {
        task: "cr_generation_transport_error",
        description: "Génération de CR interrompue par une erreur réseau ou transport.",
      },
      {
        task: "cr_generation_read_error",
        description: "Génération de CR interrompue pendant la lecture du corps de réponse.",
      },
    ],
  },
  {
    title: "Appels upstream",
    items: [
      {
        task: "response_received",
        description: "Appel vers une API externe terminé normalement avec une réponse exploitable.",
      },
      {
        task: "upstream_error_response",
        description: "Appel vers une API externe revenu avec un code HTTP en erreur.",
      },
      {
        task: "transport_error",
        description: "Appel vers une API externe interrompu par une erreur réseau ou transport.",
      },
      {
        task: "read_error",
        description: "Appel vers une API externe interrompu pendant la lecture du corps de réponse.",
      },
    ],
  },
  {
    title: "Runs frontend",
    items: [
      {
        task: "load_model_total",
        description: "Chargement complet du modèle ASR.",
      },
      {
        task: "decode_audio_total",
        description: "Décodage audio complet côté frontend.",
      },
      {
        task: "decode_audio_segment_total",
        description: "Décodage d'un segment audio.",
      },
      {
        task: "cloud_decode_ffmpeg",
        description: "Décodage ffmpeg dans le parcours cloud.",
      },
      {
        task: "cloud_preprocess",
        description: "Prétraitement du flux audio avant transcription cloud.",
      },
      {
        task: "cloud_transcribe",
        description: "Transcription cloud elle-même.",
      },
      {
        task: "cloud_total",
        description: "Durée totale d'un run cloud.",
      },
      {
        task: "llm_local_total",
        description: "Durée totale d'une génération LLM locale.",
      },
      {
        task: "llm_cloud_total",
        description: "Durée totale d'une génération LLM cloud.",
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
                    Le filtre sélectionne la valeur brute enregistrée en base. Les libellés ci-dessous correspondent aux
                    tâches actuellement instrumentées.
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

export default function PerformancePage() {
  const queryClient = useQueryClient()
  const { isSuperAdmin, session } = useAdminSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [purgeConfirmationOpen, setPurgeConfirmationOpen] = useState(false)
  const from = searchParams.get("from") ?? daysAgoDayString(29)
  const to = searchParams.get("to") ?? todayDayString()
  const organizationId = isSuperAdmin ? searchParams.get("organizationId") ?? "" : session?.organization.id ?? ""
  const task = searchParams.get("task") ?? ""

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    enabled: isSuperAdmin,
  })

  const summaryQuery = useQuery({
    enabled: isSuperAdmin,
    queryKey: ["performance-summary", from, to, organizationId || "global", task || "all"],
    queryFn: () =>
      fetchPerformanceSummary({
        from,
        to,
        organizationId: organizationId || undefined,
        task: task || undefined,
      }),
  })

  const purgeMutation = useMutation({
    mutationFn: () =>
      purgePerformanceEvents({
        from,
        to,
        organizationId: organizationId || undefined,
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

    if (changed) {
      setSearchParams(next, { replace: true })
    }
  }, [from, searchParams, setSearchParams, to])

  const updatePerformanceSearchParams = (next: {
    from?: string
    to?: string
    organizationId?: string
    task?: string
  }) => {
    const params = new URLSearchParams()
    setSearchParam(params, "from", next.from ?? from)
    setSearchParam(params, "to", next.to ?? to)
    if (isSuperAdmin) {
      setSearchParam(params, "organizationId", next.organizationId ?? organizationId)
    }
    setSearchParam(params, "task", next.task ?? task)
    setSearchParams(params, { replace: true })
  }

  const summary = summaryQuery.data
  const slowestTask = summary?.topTasks[0]
  const isRefreshing = summaryQuery.isFetching || organizationsQuery.isFetching
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      summaryQuery.refetch(),
      isSuperAdmin ? organizationsQuery.refetch() : Promise.resolve(),
    ])
  }, [isSuperAdmin, organizationsQuery, summaryQuery])
  const taskOptions = useMemo(() => {
    const values = new Set(summary?.taskOptions ?? [])
    if (task && !values.has(task)) {
      values.add(task)
    }
    return Array.from(values)
  }, [summary?.taskOptions, task])
  const scopeLabel = useMemo(() => {
    if (!isSuperAdmin) {
      return "Administration"
    }
    if (!organizationId) {
      return "Toutes les organisations"
    }
    return organizationsQuery.data?.find((organization) => organization.id === organizationId)?.name ?? organizationId
  }, [isSuperAdmin, organizationId, organizationsQuery.data])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Fenêtre de performance</CardTitle>
          <CardDescription>
            Dashboard réservé aux super admin. Les timings backend HTTP et upstream sont agrégés par tâche et par jour.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="performance-from">Du</Label>
            <Input
              id="performance-from"
              onChange={(event) =>
                updatePerformanceSearchParams({
                  from: event.target.value,
                  to,
                  organizationId,
                  task,
                })
              }
              type="date"
              value={from}
            />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="performance-to">Au</Label>
            <Input
              id="performance-to"
              onChange={(event) =>
                updatePerformanceSearchParams({
                  from,
                  to: event.target.value,
                  organizationId,
                  task,
                })
              }
              type="date"
              value={to}
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
            <TaskHelpPopover />
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              id="performance-task"
              onChange={(event) =>
                updatePerformanceSearchParams({
                  from,
                  to,
                  organizationId,
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
                <Button className="gap-2" disabled={isRefreshing} onClick={() => handleRefresh()} variant="secondary">
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
                      from: daysAgoDayString(29),
                      to: todayDayString(),
                      organizationId: "",
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

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Tendance journalière</CardTitle>
            <CardDescription>Vue jour par jour des durées, succès et erreurs sur le scope sélectionné.</CardDescription>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <tr>
                    <th className="px-6 py-4">Jour</th>
                    <th className="px-6 py-4">Exécutions</th>
                    <th className="px-6 py-4">Succès</th>
                    <th className="px-6 py-4">Erreurs</th>
                    <th className="px-6 py-4">Moyenne</th>
                    <th className="px-6 py-4">Pic</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.byDay.length ? (
                    summary.byDay.map((item) => (
                      <tr className="border-t border-border/70" key={item.day}>
                        <td className="px-6 py-4 font-medium">{formatDay(item.day)}</td>
                        <td className="px-6 py-4">{item.events}</td>
                        <td className="px-6 py-4">{item.successes}</td>
                        <td className="px-6 py-4">{item.failures}</td>
                        <td className="px-6 py-4">{formatDurationMs(item.averageDurationMs)}</td>
                        <td className="px-6 py-4">{formatDurationMs(item.maxDurationMs)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-6 py-8 text-center text-muted-foreground" colSpan={6}>
                        Aucune donnée sur la fenêtre sélectionnée.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>

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
                </tr>
              </thead>
              <tbody>
                {summary?.recentEvents.length ? (
                  summary.recentEvents.map((event) => {
                    const taskDisplay = formatPerformanceTaskDisplay(event.task)
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
                          <Badge variant={statusVariant(event.status)}>{toTitleCase(event.status)}</Badge>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{event.route}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td className="px-6 py-8 text-center text-muted-foreground" colSpan={7}>
                      Aucun timing remonté sur la fenêtre sélectionnée.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </TableWrapper>
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
            {summary?.range.from ?? from} → {summary?.range.to ?? to}
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
