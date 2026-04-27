import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCcw, Save, Server, Waves } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  adminRefresh,
  fetchDemeterReportQueueSnapshot,
  updateDemeterReportQueueSettings,
} from "@/lib/admin-client"
import type { DemeterReportQueueOperationSnapshot, DemeterReportQueueSnapshot } from "@/lib/types"
import { useDemeterReportQueueWebSocket } from "@/lib/use-demeter-report-queue-websocket"
import { formatDateTime } from "@/lib/utils"

const QUEUE_SNAPSHOT_LIMIT = 500
const MAX_PARALLELISM = 8

function statusBadgeVariant(status: string) {
  switch (status.trim().toLowerCase()) {
    case "completed":
      return "success"
    case "failed":
    case "cancelled":
      return "danger"
    case "running":
      return "default"
    default:
      return "muted"
  }
}

function laneStateVariant(worker: DemeterReportQueueSnapshot["workers"][number]) {
  if (worker.draining) return "danger"
  if (!worker.open) return "muted"
  if (worker.workerRunning) return "success"
  return "default"
}

function laneStateLabel(worker: DemeterReportQueueSnapshot["workers"][number]) {
  if (worker.draining) return "Drain"
  if (!worker.open) return "Fermée"
  if (worker.workerRunning) return "Active"
  return "Ouverte"
}

function formatProgress(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 %"
  }
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)} %`
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

function QueueStatCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{helper}</CardContent>
    </Card>
  )
}

function OperationRow({ operation }: { operation: DemeterReportQueueOperationSnapshot }) {
  return (
    <tr className="border-b border-border/60 text-sm">
      <td className="px-3 py-2 align-top">
        <div className="font-medium">{operation.operationId}</div>
        <div className="text-xs text-muted-foreground">{formatDateTime(operation.createdAt)}</div>
      </td>
      <td className="px-3 py-2 align-top">{operation.queueId > 0 ? `Lane #${operation.queueId}` : "Non assignée"}</td>
      <td className="px-3 py-2 align-top">
        <Badge variant={statusBadgeVariant(operation.status)}>{operation.status}</Badge>
      </td>
      <td className="px-3 py-2 align-top">{`${operation.formatIndex} / ${operation.formatCount}`}</td>
      <td className="px-3 py-2 align-top">{formatProgress(operation.progress)}</td>
      <td className="px-3 py-2 align-top">{operation.statusCode || "—"}</td>
      <td className="px-3 py-2 align-top">{formatDateTime(operation.updatedAt)}</td>
      <td className="px-3 py-2 align-top text-rose-700">{operation.lastError || "—"}</td>
    </tr>
  )
}

export default function ReportQueuePage() {
  const queryClient = useQueryClient()
  const queueQueryKey = ["demeter-report-queue", QUEUE_SNAPSHOT_LIMIT] as const
  const [parallelism, setParallelism] = useState<number>(1)
  const [parallelismError, setParallelismError] = useState<string | null>(null)
  const [parallelismSuccess, setParallelismSuccess] = useState<string | null>(null)

  const queueWebSocket = useDemeterReportQueueWebSocket({
    limit: QUEUE_SNAPSHOT_LIMIT,
    refreshSession: adminRefresh,
    onSnapshot: (snapshot) => {
      queryClient.setQueryData(queueQueryKey, snapshot)
    },
  })

  const queueQuery = useQuery({
    queryKey: queueQueryKey,
    queryFn: () => fetchDemeterReportQueueSnapshot(QUEUE_SNAPSHOT_LIMIT),
    refetchInterval: queueWebSocket.isAuthenticated || queueWebSocket.mode === "websocket_auth" ? false : 2000,
    refetchIntervalInBackground: true,
  })

  const settingsMutation = useMutation({
    mutationFn: async (nextParallelism: number) => {
      if (queueWebSocket.isAuthenticated) {
        return queueWebSocket.updateSettings({ parallelism: nextParallelism })
      }
      return updateDemeterReportQueueSettings({ parallelism: nextParallelism })
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(queueQueryKey, snapshot)
      setParallelism(snapshot.settings.parallelism)
      setParallelismSuccess("Le parallélisme a été enregistré et les lanes ont été recalculées")
      setParallelismError(null)
    },
    onError: (error) => {
      setParallelismSuccess(null)
      setParallelismError(error instanceof Error ? error.message : "Impossible d’enregistrer le parallélisme")
    },
  })

  const snapshot = queueQuery.data
  const summary = snapshot?.summary

  const workers = useMemo(() => snapshot?.workers ?? [], [snapshot])
  const operations = useMemo(() => snapshot?.operations ?? [], [snapshot])

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-gradient-to-br from-background via-background to-primary/5">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-2xl">Queue Rapport</CardTitle>
            <CardDescription>
              Supervision des opérations CR Demeter: lanes, progression, erreurs et réglage du parallélisme.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default">Queue rapport</Badge>
            <Badge variant="muted">{queueWebSocket.mode === "websocket" ? "WebSocket" : queueWebSocket.mode === "websocket_auth" ? "WebSocket auth" : "Polling"}</Badge>
            <Button variant="secondary" onClick={() => queueQuery.refetch()} disabled={queueQuery.isFetching}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Rafraîchir
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <QueueStatCard label="Parallélisme" value={summary?.parallelism ?? "—"} helper="Nombre de lanes actives configurées" />
        <QueueStatCard label="Workers ouverts" value={summary?.openWorkers ?? "—"} helper="Lanes capables d’accepter de nouvelles opérations" />
        <QueueStatCard label="En attente" value={summary?.pendingOperations ?? "—"} helper="Opérations en file non claimées" />
        <QueueStatCard label="En cours" value={summary?.runningOperations ?? "—"} helper="Opérations actuellement exécutées" />
        <QueueStatCard label="En cooldown" value={summary?.coolingWorkers ?? "—"} helper="Workers freinés après erreur Mistral" />
        <QueueStatCard label="Sans queue" value={summary?.unassignedOperations ?? "—"} helper="Opérations à réaffecter après reconciliation" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Réglages
          </CardTitle>
          <CardDescription>Parallélisme séparé de la queue transcription, avec mêmes bornes (0-8).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 max-w-xs">
            <Label htmlFor="report-queue-parallelism">Workers parallèles</Label>
            <Input
              id="report-queue-parallelism"
              type="number"
              min={0}
              max={MAX_PARALLELISM}
              step={1}
              value={parallelism}
              onChange={(event) => setParallelism(Number(event.target.value))}
            />
          </div>
          <Button
            onClick={() => {
              setParallelismSuccess(null)
              setParallelismError(null)
              settingsMutation.mutate(parallelism)
            }}
            disabled={settingsMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            Appliquer
          </Button>
          {parallelismError ? <p className="text-sm text-rose-700">{parallelismError}</p> : null}
          {parallelismSuccess ? <p className="text-sm text-emerald-700">{parallelismSuccess}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Waves className="h-4 w-4" />
            Lanes
          </CardTitle>
          <CardDescription>État de chaque lane de traitement des rapports.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          {workers.map((worker) => (
            <Card key={worker.queueId}>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Lane #{worker.queueId}</CardTitle>
                  <Badge variant={laneStateVariant(worker)}>{laneStateLabel(worker)}</Badge>
                </div>
                <CardDescription>
                  Charge {worker.load} · pending {worker.pendingCount} · running {worker.runningCount}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>Opération: {worker.currentOperationId || "—"}</p>
                <p>Statut: {worker.currentStatus || "—"}</p>
                <p>Étape: {worker.currentStage || "—"}</p>
                <p>Format: {worker.currentFormatIndex ?? 0} / {worker.currentFormatCount ?? 0}</p>
                <p>Progression: {formatProgress(worker.currentProgress ?? 0)}</p>
                <p className="text-rose-700">Erreur: {worker.lastError || "—"}</p>
                <p>Cooldown: {worker.cooldownUntil ? formatDateTime(worker.cooldownUntil) : "—"}</p>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Opérations en queue</CardTitle>
          <CardDescription>Table en temps réel des opérations pending/running.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Operation</th>
                <th className="px-3 py-2">Queue</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Format</th>
                <th className="px-3 py-2">Progression</th>
                <th className="px-3 py-2">HTTP</th>
                <th className="px-3 py-2">Mis à jour</th>
                <th className="px-3 py-2">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {operations.map((operation) => (
                <OperationRow key={operation.operationId} operation={operation} />
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les opérations</CardTitle>
          <CardDescription>Derniers enregistrements, payload et réponse pour debug.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(snapshot?.allOperations ?? []).map((operation) => (
            <div key={operation.operationId} className="rounded-md border border-border/60 p-3 text-sm space-y-2">
              <div className="font-medium">{operation.operationId}</div>
              <div className="text-muted-foreground">
                queue {operation.queueId} · {operation.status} · {operation.stage} · {formatProgress(operation.progress)}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 text-xs">{prettyJson(operation.queuePayloadJson)}</pre>
                <pre className="max-h-48 overflow-auto rounded bg-muted/40 p-2 text-xs">{prettyJson(operation.responseJson)}</pre>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
