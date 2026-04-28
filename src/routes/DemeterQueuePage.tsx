import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronRight, FileText, RefreshCcw, Save, Server, Trash2, Waves } from "lucide-react"
import { useState, type FormEvent } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableWrapper } from "@/components/ui/table"
import { adminRefresh, fetchDemeterQueueSnapshot, purgeDemeterQueueOperations, updateDemeterQueueSettings } from "@/lib/admin-client"
import type { DemeterQueueOperationSnapshot, DemeterQueueSummarySnapshot, DemeterQueueWorkerSnapshot } from "@/lib/types"
import { useDemeterQueueWebSocket } from "@/lib/use-demeter-queue-websocket"
import { formatDateTime } from "@/lib/utils"

const QUEUE_SNAPSHOT_LIMIT = 500
const MAX_PARALLELISM = 8

type QueuePurgeScope = "completed" | "all"

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

function formatProgress(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 %"
  }
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)} %`
}

function formatMaybeDateTime(value?: string) {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) {
    return "—"
  }
  return formatDateTime(trimmed)
}

function formatMaybeText(value?: string) {
  const trimmed = value?.trim() ?? ""
  return trimmed || "—"
}

function prettyJson(value?: string) {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) {
    return "—"
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2)
  } catch {
    return trimmed
  }
}

function laneStateLabel(worker: DemeterQueueWorkerSnapshot) {
  if (worker.draining) {
    return "Drain"
  }
  if (!worker.open) {
    return "Fermée"
  }
  if (worker.workerRunning) {
    return "Active"
  }
  return "Ouverte"
}

function laneStateVariant(worker: DemeterQueueWorkerSnapshot) {
  if (worker.draining) {
    return "danger" as const
  }
  if (!worker.open) {
    return "muted" as const
  }
  if (worker.workerRunning) {
    return "success" as const
  }
  return "default" as const
}

function statusBadgeVariant(status: string) {
  switch (status.trim().toLowerCase()) {
    case "completed":
      return "success" as const
    case "failed":
    case "cancelled":
      return "danger" as const
    case "running":
      return "default" as const
    case "pending":
      return "muted" as const
    default:
      return "muted" as const
  }
}

function stepLabel(stage: string) {
  const normalized = stage.trim().toLowerCase()
  switch (normalized) {
    case "queued":
      return "En file"
    case "running":
      return "En cours"
    case "chunk_completed":
      return "Chunk terminé"
    case "chunk_running":
      return "Chunk en cours"
    case "completed":
      return "Terminé"
    case "failed":
      return "Erreur"
    case "cancelled":
      return "Annulé"
    default:
      return stage || "—"
  }
}

function QueueProgressBar({ value }: { value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div aria-label={`Progression ${percent} %`} className="h-2 rounded-full bg-muted">
      <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
    </div>
  )
}

function resolveWorkerOperation(
  worker: DemeterQueueWorkerSnapshot,
  operations: DemeterQueueOperationSnapshot[],
): DemeterQueueOperationSnapshot | undefined {
  const currentOperationId = worker.currentOperationId?.trim() ?? ""
  if (currentOperationId) {
    const directMatch = operations.find((operation) => operation.operationId === currentOperationId)
    if (directMatch) {
      return directMatch
    }
  }

  const runningMatch = operations.find((operation) => operation.queueId === worker.queueId && operation.status === "running")
  if (runningMatch) {
    return runningMatch
  }

  return operations.find((operation) => operation.queueId === worker.queueId)
}

function RetryPauseBanner({ summary }: { summary?: DemeterQueueSummarySnapshot }) {
  if (!summary?.retryPaused) {
    return null
  }

  const pausedChunkIndex = summary.retryPausedChunkIndex ?? -1
  const chunkLabel = pausedChunkIndex >= 0 ? pausedChunkIndex + 1 : 0

  return (
    <Card className="border-amber-500/25 bg-amber-500/5">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardDescription>Pause globale Mistral</CardDescription>
            <CardTitle className="text-xl">La file attend la reprise du retry en cours</CardTitle>
          </div>
          <Badge variant="danger">Bloque toutes les lanes</Badge>
        </div>
        <CardDescription>
          Quand un chunk passe en retry Mistral, les autres workers se figent jusqu&apos;à la fin de ce chunk.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Lane concernée</p>
          <p className="mt-2 text-sm font-medium">Lane #{summary.retryPausedLaneId || "—"}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Opération</p>
          <p className="mt-2 break-words text-sm font-medium">{summary.retryPausedOperationId || "—"}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Chunk</p>
          <p className="mt-2 text-sm font-medium">{chunkLabel || "—"}</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Depuis</p>
          <p className="mt-2 text-sm font-medium">{summary.retryPausedSince ? formatDateTime(summary.retryPausedSince) : "—"}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function WorkerCard({
  worker,
  operation,
  retryPause,
}: {
  worker: DemeterQueueWorkerSnapshot
  operation?: DemeterQueueOperationSnapshot
  retryPause?: DemeterQueueSummarySnapshot
}) {
  const progress = Number.isFinite(operation?.progress ?? worker.currentProgress ?? Number.NaN)
    ? operation?.progress ?? worker.currentProgress ?? 0
    : 0
  const hasCooldown = Boolean(worker.cooldownUntil)
  const currentLabel = operation?.operationId?.trim() || worker.currentOperationId?.trim() || "Aucun job courant"
  const currentStage = operation?.stage || worker.currentStage
  const currentStatus = operation?.status || worker.currentStatus || "pending"
  const currentChunkIndex = operation?.chunkIndex ?? worker.currentChunkIndex ?? 0
  const currentChunkCount = operation?.chunkCount ?? worker.currentChunkCount ?? 0
  const lastError = operation?.lastError ?? worker.lastError
  const isRetryPausedLane = Boolean(retryPause?.retryPaused && retryPause.retryPausedLaneId === worker.queueId)

  return (
    <Card className="border-border/70 bg-card/90">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardDescription>Lane #{worker.queueId}</CardDescription>
            <CardTitle className="text-2xl">Worker séquentiel</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={laneStateVariant(worker)}>{laneStateLabel(worker)}</Badge>
            {retryPause?.retryPaused ? (
              <Badge variant={isRetryPausedLane ? "success" : "danger"}>
                {isRetryPausedLane ? "Retry actif" : "Bloqué par retry"}
              </Badge>
            ) : null}
            {hasCooldown ? <Badge variant="danger">Cooldown</Badge> : null}
          </div>
        </div>
        <CardDescription>
          Charge {worker.load} · en attente {worker.pendingCount} · en cours {worker.runningCount}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Opération courante</p>
            <p className="mt-2 break-words text-sm font-medium">{currentLabel}</p>
            {currentStage ? <p className="mt-1 text-xs text-muted-foreground">{stepLabel(currentStage)}</p> : null}
            {operation?.updatedAt ? (
              <p className="mt-1 text-xs text-muted-foreground">Maj {formatDateTime(operation.updatedAt)}</p>
            ) : null}
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Progression</p>
            <p className="mt-2 text-sm font-medium">{formatProgress(progress)}</p>
            <div className="mt-3">
              <QueueProgressBar value={progress} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Statut</p>
            <Badge className="mt-2" variant={statusBadgeVariant(currentStatus)}>
              {currentStatus}
            </Badge>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Chunks</p>
            <p className="mt-2 text-sm font-medium">
              {currentChunkIndex}/{currentChunkCount}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Worker</p>
            <p className="mt-2 text-sm font-medium">{worker.workerRunning ? "En exécution" : "En attente"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {worker.open ? "Accepte de nouveaux jobs" : worker.draining ? "Se vide avant fermeture" : "N'accepte plus de nouveaux jobs"}
            </p>
          </div>
        </div>

        {hasCooldown ? (
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Cooldown jusqu&apos;au</p>
            <p className="mt-2 font-medium text-amber-800">{formatDateTime(worker.cooldownUntil ?? "")}</p>
          </div>
        ) : null}

        {lastError ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm text-rose-800">
            <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Dernière erreur</p>
            <p className="mt-2 break-words">{lastError}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function OperationRow({ operation }: { operation: DemeterQueueOperationSnapshot }) {
  const queueLabel = operation.queueId > 0 ? `Lane #${operation.queueId}` : "Non assignée"
  const progress = formatProgress(operation.progress)

  return (
    <tr className="border-t border-border/70">
      <td className="px-6 py-4">
        <p className="font-medium">{operation.operationId}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(operation.createdAt)}</p>
      </td>
      <td className="px-6 py-4">
        <Badge variant={operation.queueId > 0 ? "default" : "danger"}>{queueLabel}</Badge>
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusBadgeVariant(operation.status)}>{operation.status}</Badge>
          <Badge variant="muted">{stepLabel(operation.stage)}</Badge>
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="font-medium">{operation.chunkIndex + 1}</p>
        <p className="text-xs text-muted-foreground">sur {operation.chunkCount}</p>
      </td>
      <td className="px-6 py-4">
        <p className="font-medium">{progress}</p>
      </td>
      <td className="px-6 py-4">
        <Badge variant={operation.statusCode >= 500 || operation.statusCode >= 400 ? "danger" : "muted"}>
          {operation.statusCode}
        </Badge>
      </td>
      <td className="px-6 py-4 text-sm text-muted-foreground">{formatDateTime(operation.updatedAt)}</td>
      <td className="px-6 py-4 text-sm text-muted-foreground">
        {operation.lastError ? <span className="break-words text-rose-700">{operation.lastError}</span> : "—"}
      </td>
    </tr>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-medium">{value}</p>
    </div>
  )
}

function JsonPanel({ title, value }: { title: string; value?: string }) {
  return (
    <section className="rounded-3xl border border-border/70 bg-background/80 p-4">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border/70 bg-muted/40 p-4 text-[11px] leading-6 text-muted-foreground">
        {prettyJson(value)}
      </pre>
    </section>
  )
}

function CompactOperationRow({ operation }: { operation: DemeterQueueOperationSnapshot }) {
  const [open, setOpen] = useState(false)
  const queueLabel = operation.queueId > 0 ? `Lane #${operation.queueId}` : "Non assignée"
  const progress = formatProgress(operation.progress)
  const detailId = `demeter-operation-details-${operation.operationId}`

  return (
    <>
      <tr className={open ? "border-t border-border/70 bg-muted/20" : "border-t border-border/70"}>
        <td className="px-6 py-4 align-top">
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-medium break-words">{operation.operationId}</p>
              <p className="text-xs text-muted-foreground">Créée {formatMaybeDateTime(operation.createdAt)}</p>
            </div>
            <Button
              aria-controls={detailId}
              aria-expanded={open}
              aria-label={`${open ? "Masquer" : "Afficher"} les détails de ${operation.operationId}`}
              className="justify-start gap-2 px-3 text-xs"
              onClick={() => setOpen((value) => !value)}
              size="sm"
              variant="ghost"
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              {open ? "Masquer" : "Détails"}
            </Button>
          </div>
        </td>
        <td className="px-6 py-4 align-top">
          <Badge variant={operation.queueId > 0 ? "default" : "danger"}>{queueLabel}</Badge>
        </td>
        <td className="px-6 py-4 align-top">
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusBadgeVariant(operation.status)}>{operation.status}</Badge>
            <Badge variant="muted">{stepLabel(operation.stage)}</Badge>
          </div>
        </td>
        <td className="px-6 py-4 align-top">
          <p className="font-medium">{operation.chunkIndex + 1}</p>
          <p className="text-xs text-muted-foreground">sur {operation.chunkCount}</p>
        </td>
        <td className="px-6 py-4 align-top">
          <p className="font-medium">{progress}</p>
        </td>
        <td className="px-6 py-4 align-top">
          <Badge variant={operation.statusCode >= 500 || operation.statusCode >= 400 ? "danger" : "muted"}>
            {operation.statusCode}
          </Badge>
        </td>
        <td className="px-6 py-4 align-top text-sm text-muted-foreground">{formatMaybeDateTime(operation.updatedAt)}</td>
      </tr>
      {open ? (
        <tr className="border-t border-border/70 bg-muted/20" id={detailId}>
          <td className="px-6 py-5" colSpan={7}>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Organisation" value={formatMaybeText(operation.organizationId)} />
                <DetailField label="Utilisateur" value={formatMaybeText(operation.userId)} />
                <DetailField label="Queue" value={queueLabel} />
                <DetailField label="Statut" value={operation.status} />
                <DetailField label="Étape" value={stepLabel(operation.stage)} />
                <DetailField label="HTTP" value={String(operation.statusCode)} />
                <DetailField label="Chunk" value={`${operation.chunkIndex + 1}/${operation.chunkCount}`} />
                <DetailField label="Progression" value={progress} />
                <DetailField label="Créée le" value={formatMaybeDateTime(operation.createdAt)} />
                <DetailField label="Terminée le" value={formatMaybeDateTime(operation.finishedAt)} />
                <DetailField label="Dernière mise à jour" value={formatMaybeDateTime(operation.updatedAt)} />
                <DetailField label="Dernière erreur" value={formatMaybeText(operation.lastError)} />
              </div>
              <div className="grid gap-4">
                <JsonPanel title="Queue payload JSON" value={operation.queuePayloadJson} />
                <JsonPanel title="Response JSON" value={operation.responseJson} />
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  )
}

export default function DemeterQueuePage() {
  const queryClient = useQueryClient()
  const queueQueryKey = ["demeter-queue", QUEUE_SNAPSHOT_LIMIT] as const
  const [parallelismDraft, setParallelismDraft] = useState("1")
  const [parallelismDraftFocused, setParallelismDraftFocused] = useState(false)
  const [parallelismError, setParallelismError] = useState<string | null>(null)
  const [purgeCompletedConfirmationOpen, setPurgeCompletedConfirmationOpen] = useState(false)
  const [purgeAllConfirmationOpen, setPurgeAllConfirmationOpen] = useState(false)
  const [purgeError, setPurgeError] = useState<string | null>(null)
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null)

  const queueWebSocket = useDemeterQueueWebSocket({
    limit: QUEUE_SNAPSHOT_LIMIT,
    refreshSession: adminRefresh,
    onSnapshot: (snapshot) => {
      queryClient.setQueryData(queueQueryKey, snapshot)
    },
  })

  const snapshotQuery = useQuery({
    queryKey: queueQueryKey,
    queryFn: () => fetchDemeterQueueSnapshot(QUEUE_SNAPSHOT_LIMIT),
    refetchInterval: queueWebSocket.isAuthenticated || queueWebSocket.mode === "websocket_auth" ? false : 2000,
    refetchIntervalInBackground: true,
  })

  const snapshotParallelism = snapshotQuery.data?.settings.parallelism
  const parallelismInputValue = parallelismDraftFocused ? parallelismDraft : String(snapshotParallelism ?? 1)

  const updateSettingsMutation = useMutation({
    mutationFn: async (parallelism: number) => {
      if (queueWebSocket.isAuthenticated) {
        return queueWebSocket.updateSettings({ parallelism })
      }
      return updateDemeterQueueSettings({ parallelism })
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(queueQueryKey, snapshot)
      setParallelismDraft(String(snapshot.settings.parallelism))
      setParallelismError(null)
    },
    onError: (error) => {
      setParallelismError(error instanceof Error ? error.message : "Impossible de mettre à jour la file Demeter")
    },
  })

  const purgeMutation = useMutation({
    mutationFn: async (scope: QueuePurgeScope) => {
      return purgeDemeterQueueOperations(scope)
    },
    onMutate: () => {
      setPurgeError(null)
      setPurgeSuccess(null)
    },
    onSuccess: async (_snapshot, scope) => {
      setPurgeCompletedConfirmationOpen(false)
      setPurgeAllConfirmationOpen(false)
      setPurgeSuccess(scope === "all" ? "Toute la table a été vidée." : "Les jobs terminés ont été supprimés.")
      await queryClient.invalidateQueries({ queryKey: queueQueryKey })
    },
    onError: (error) => {
      setPurgeSuccess(null)
      setPurgeError(error instanceof Error ? error.message : "Impossible de purger la queue Demeter")
    },
  })

  const summary = snapshotQuery.data?.summary
  const workers = snapshotQuery.data?.workers ?? []
  const queueOperations = snapshotQuery.data?.operations ?? []
  const allOperations = snapshotQuery.data?.allOperations ?? []

  const statCards = [
    {
      label: "Parallélisme",
      value: snapshotQuery.data?.settings.parallelism ?? 0,
      helper: "Nombre de lanes actives configurées dans le backend.",
    },
    {
      label: "Workers ouverts",
      value: summary?.openWorkers ?? 0,
      helper: "Lanes capables d’accepter de nouvelles transcriptions.",
    },
    {
      label: "En attente",
      value: summary?.pendingOperations ?? 0,
      helper: "Transcriptions déjà en file mais pas encore claimées.",
    },
    {
      label: "En cours",
      value: summary?.runningOperations ?? 0,
      helper: "Transcriptions actuellement exécutées par un worker.",
    },
    {
      label: "En cooldown",
      value: summary?.coolingWorkers ?? 0,
      helper: "Workers temporairement freinés après une erreur Mistral.",
    },
    {
      label: "Sans queue",
      value: summary?.unassignedOperations ?? 0,
      helper: "Opérations à réaffecter après une réconciliation.",
    },
  ]

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = Number.parseInt(parallelismDraft.trim(), 10)
    if (!Number.isFinite(parsed) || parsed < 0) {
      setParallelismError("Le parallélisme doit être un entier positif ou nul.")
      return
    }
    if (parsed > MAX_PARALLELISM) {
      setParallelismError(`Le parallélisme maximal supporté est ${MAX_PARALLELISM}.`)
      return
    }
    updateSettingsMutation.mutate(parsed)
  }

  const liveModeLabel =
    queueWebSocket.mode === "websocket"
      ? "WebSocket"
      : queueWebSocket.mode === "websocket_auth"
        ? "WebSocket auth"
        : "Polling"

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-2xl">
        <CardHeader className="relative gap-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.28),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.18),transparent_26%)] opacity-80" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-white/15 bg-white/10 text-white">Queue Demeter</Badge>
                <Badge className="border border-white/15 bg-white/10 text-white">
                  {snapshotQuery.isFetching ? "Synchronisation" : "Snapshot live"}
                </Badge>
                <Badge className="border border-white/15 bg-white/10 text-white">{liveModeLabel}</Badge>
              </div>
              <CardTitle className="text-3xl leading-tight">Lane worker queue</CardTitle>
              <CardDescription className="max-w-2xl text-slate-300">
                Une transcription est envoyée dans la lane la moins chargée, puis ses chunks restent séquentiels dans la
                même file. Le front admin visualise l’état de chaque lane, et le réglage de parallélisme agit à chaud.
              </CardDescription>
            </div>
            <div className="relative flex flex-wrap gap-2">
              <Button
                className="gap-2"
                disabled={snapshotQuery.isFetching}
                onClick={() => snapshotQuery.refetch()}
                variant="secondary"
              >
                <RefreshCcw className={`h-4 w-4 ${snapshotQuery.isFetching ? "animate-spin" : ""}`} />
                Rafraîchir
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => (
          <StatCard helper={card.helper} key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      <RetryPauseBanner summary={summary} />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Réglage du parallélisme</CardTitle>
            <CardDescription>
              0 met la file en pause pour les nouvelles attributions. Le backend garde les jobs déjà assignés jusqu’à la
              fin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="demeter-queue-parallelism">Workers parallèles</Label>
                <Input
                  id="demeter-queue-parallelism"
                  max={MAX_PARALLELISM}
                  min={0}
                  onBlur={() => {
                    setParallelismDraftFocused(false)
                  }}
                  onChange={(event) => {
                    setParallelismDraft(event.target.value)
                    setParallelismError(null)
                  }}
                  onFocus={() => {
                    setParallelismDraftFocused(true)
                    setParallelismDraft(String(snapshotParallelism ?? 1))
                  }}
                  step={1}
                  type="number"
                  value={parallelismInputValue}
                />
              </div>
              <Button className="gap-2" disabled={updateSettingsMutation.isPending} type="submit">
                <Save className="h-4 w-4" />
                {updateSettingsMutation.isPending ? "Mise à jour..." : "Appliquer"}
              </Button>
            </form>
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-muted-foreground">
                Dernière mise à jour:{" "}
                <span className="font-medium text-foreground">
                  {snapshotQuery.data?.settings.updatedAt ? formatDateTime(snapshotQuery.data.settings.updatedAt) : "—"}
                </span>
              </p>
              <p className="text-muted-foreground">Valeur max supportée côté backend: {MAX_PARALLELISM}.</p>
              {parallelismError ? <p className="text-sm text-rose-700">{parallelismError}</p> : null}
              {updateSettingsMutation.isSuccess ? (
                <p className="text-sm text-emerald-700">Le parallélisme a été enregistré et les lanes ont été recalculées.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Résumé de file</CardTitle>
            <CardDescription>Vue agrégée des lanes et de l’état de la file Demeter.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workers en drain</p>
                <p className="mt-2 text-2xl font-semibold">{summary?.drainingWorkers ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Workers en cooldown</p>
                <p className="mt-2 text-2xl font-semibold">{summary?.coolingWorkers ?? 0}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Server className="h-4 w-4 text-muted-foreground" />
                Worker total: {workers.length}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Les lanes sont évaluées par charge effective `pending + running` et la moins chargée reçoit la prochaine
                transcription.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 via-background to-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Purge de la queue
          </CardTitle>
          <CardDescription>
            Deux options sont disponibles: supprimer uniquement les jobs terminés, ou vider toute la table y compris
            les jobs en cours et en attente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {purgeError ? <p className="text-sm text-rose-700">{purgeError}</p> : null}
          {purgeSuccess ? <p className="text-sm text-emerald-700">{purgeSuccess}</p> : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
              <div className="space-y-2">
                <p className="font-semibold">Vider les jobs terminés</p>
                <p className="text-sm text-muted-foreground">
                  Supprime uniquement les opérations déjà finalisées et conserve les jobs en cours.
                </p>
              </div>
              {purgeCompletedConfirmationOpen ? (
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <p className="font-semibold">Confirmer la purge des jobs terminés ?</p>
                  <p className="mt-1 text-sm text-muted-foreground">Cette action ne touche pas les jobs encore actifs.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setPurgeCompletedConfirmationOpen(false)}>
                      Annuler
                    </Button>
                    <Button
                      className="gap-2"
                      disabled={purgeMutation.isPending}
                      onClick={() => purgeMutation.mutate("completed")}
                      variant="danger"
                    >
                      <Trash2 className="h-4 w-4" />
                      {purgeMutation.isPending ? "Purge..." : "Confirmer"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button className="mt-4 gap-2" onClick={() => setPurgeCompletedConfirmationOpen(true)} variant="danger">
                  <Trash2 className="h-4 w-4" />
                  Vider les jobs terminés
                </Button>
              )}
            </div>

            <div className="rounded-3xl border border-border/70 bg-background/80 p-4">
              <div className="space-y-2">
                <p className="font-semibold">Vider toute la table</p>
                <p className="text-sm text-muted-foreground">
                  Supprime tous les enregistrements de queue, y compris les jobs en attente et en cours.
                </p>
              </div>
              {purgeAllConfirmationOpen ? (
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <p className="font-semibold">Confirmer la purge complète ?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cette action vide entièrement la table, y compris les jobs encore actifs.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setPurgeAllConfirmationOpen(false)}>
                      Annuler
                    </Button>
                    <Button
                      className="gap-2"
                      disabled={purgeMutation.isPending}
                      onClick={() => purgeMutation.mutate("all")}
                      variant="danger"
                    >
                      <Trash2 className="h-4 w-4" />
                      {purgeMutation.isPending ? "Purge..." : "Confirmer"}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button className="mt-4 gap-2" onClick={() => setPurgeAllConfirmationOpen(true)} variant="danger">
                  <Trash2 className="h-4 w-4" />
                  Vider toute la table
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Waves className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">Lanes actives</h2>
            <p className="text-sm text-muted-foreground">Chaque lane consomme sa file de façon séquentielle.</p>
          </div>
        </div>
        {workers.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Aucune lane visible pour le moment. Le backend créera les workers dès qu’un parallélisme non nul sera
              appliqué.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {workers.map((worker) => (
              <WorkerCard
                key={worker.queueId}
                operation={resolveWorkerOperation(worker, queueOperations)}
                retryPause={summary}
                worker={worker}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <RefreshCcw className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">Opérations en file</h2>
            <p className="text-sm text-muted-foreground">
              Les opérations affichées ici sont celles encore en attente ou en cours d’exécution.
            </p>
          </div>
        </div>
        <TableWrapper>
          <Table>
            <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Opération</th>
                <th className="px-6 py-4">Queue</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Chunk</th>
                <th className="px-6 py-4">Progression</th>
                <th className="px-6 py-4">HTTP</th>
                <th className="px-6 py-4">Mis à jour</th>
                <th className="px-6 py-4">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {queueOperations.length === 0 ? (
                <tr className="border-t border-border/70">
                  <td className="px-6 py-8 text-sm text-muted-foreground" colSpan={8}>
                    Aucune opération Demeter en file.
                  </td>
                </tr>
              ) : (
                queueOperations.map((operation) => <OperationRow key={operation.operationId} operation={operation} />)
              )}
            </tbody>
          </Table>
        </TableWrapper>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-semibold">Toutes les opérations</h2>
            <p className="text-sm text-muted-foreground">
              Vue compacte des enregistrements stockés, avec détail dépliable pour les payloads et les réponses.
            </p>
          </div>
        </div>
        <TableWrapper>
          <Table>
            <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Opération</th>
                <th className="px-6 py-4">Queue</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Chunk</th>
                <th className="px-6 py-4">Progression</th>
                <th className="px-6 py-4">HTTP</th>
                <th className="px-6 py-4">Mis à jour</th>
              </tr>
            </thead>
            <tbody>
              {allOperations.length === 0 ? (
                <tr className="border-t border-border/70">
                  <td className="px-6 py-8 text-sm text-muted-foreground" colSpan={7}>
                    Aucune opération enregistrée dans la table.
                  </td>
                </tr>
              ) : (
                allOperations.map((operation) => <CompactOperationRow key={operation.operationId} operation={operation} />)
              )}
            </tbody>
          </Table>
        </TableWrapper>
      </section>
    </div>
  )
}
