import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const adminClientMocks = vi.hoisted(() => ({
  adminRefresh: vi.fn(),
  fetchDemeterQueueSnapshot: vi.fn(),
  updateDemeterQueueSettings: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  adminRefresh: adminClientMocks.adminRefresh,
  fetchDemeterQueueSnapshot: adminClientMocks.fetchDemeterQueueSnapshot,
  updateDemeterQueueSettings: adminClientMocks.updateDemeterQueueSettings,
}))

import DemeterQueuePage from "@/routes/DemeterQueuePage"
import { clearAdminCsrfToken, setAdminCsrfToken } from "@/lib/admin-security"
import { renderWithProviders } from "@/test/test-utils"

const { adminRefresh, fetchDemeterQueueSnapshot, updateDemeterQueueSettings } = adminClientMocks

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: MockWebSocket[] = []

  readonly sent: string[] = []
  readonly url: string
  readyState = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send(payload: string) {
    this.sent.push(payload)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.(new Event("close"))
  }

  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.(new Event("open"))
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)
  }
}

const baseSnapshot = {
  settings: {
    parallelism: 2,
    updatedAt: "2026-04-23T16:00:00Z",
  },
  summary: {
    parallelism: 2,
    openWorkers: 2,
    drainingWorkers: 0,
    coolingWorkers: 1,
    pendingOperations: 3,
    runningOperations: 1,
    unassignedOperations: 0,
    retryPaused: true,
    retryPausedLaneId: 1,
    retryPausedOperationId: "op-1",
    retryPausedChunkIndex: 4,
    retryPausedSince: "2026-04-23T16:02:00Z",
  },
  workers: [
    {
      queueId: 1,
      open: true,
      draining: false,
      workerRunning: true,
      cooldownUntil: "2026-04-23T16:05:00Z",
      currentOperationId: "op-1",
      currentStatus: "running",
      currentStage: "running",
      currentChunkIndex: 0,
      currentChunkCount: 10,
      currentProgress: 0,
      load: 3,
      pendingCount: 2,
      runningCount: 1,
      lastError: "",
    },
    {
      queueId: 2,
      open: true,
      draining: false,
      workerRunning: true,
      load: 1,
      pendingCount: 1,
      runningCount: 0,
    },
  ],
  operations: [
    {
      operationId: "op-1",
      queueId: 1,
      status: "running",
      stage: "chunk_completed",
      chunkIndex: 4,
      chunkCount: 10,
      progress: 0.3,
      statusCode: 202,
      createdAt: "2026-04-23T15:55:00Z",
      updatedAt: "2026-04-23T16:02:00Z",
      lastError: "",
    },
    {
      operationId: "op-2",
      queueId: 2,
      status: "pending",
      stage: "queued",
      chunkIndex: 0,
      chunkCount: 2,
      progress: 0,
      statusCode: 202,
      createdAt: "2026-04-23T15:50:00Z",
      updatedAt: "2026-04-23T15:50:00Z",
    },
  ],
  allOperations: [
    {
      operationId: "op-1",
      queueId: 1,
      status: "running",
      stage: "chunk_completed",
      chunkIndex: 4,
      chunkCount: 10,
      progress: 0.3,
      statusCode: 202,
      createdAt: "2026-04-23T15:55:00Z",
      updatedAt: "2026-04-23T16:02:00Z",
      lastError: "",
    },
    {
      operationId: "op-2",
      queueId: 2,
      status: "pending",
      stage: "queued",
      chunkIndex: 0,
      chunkCount: 2,
      progress: 0,
      statusCode: 202,
      createdAt: "2026-04-23T15:50:00Z",
      updatedAt: "2026-04-23T15:50:00Z",
    },
    {
      operationId: "op-3",
      organizationId: "org-full-1",
      userId: "user-full-1",
      queueId: 0,
      status: "completed",
      stage: "completed",
      chunkIndex: 10,
      chunkCount: 10,
      progress: 1,
      statusCode: 200,
      createdAt: "2026-04-23T15:30:00Z",
      updatedAt: "2026-04-23T16:05:00Z",
      finishedAt: "2026-04-23T16:05:00Z",
      queuePayloadJson: JSON.stringify({
        sourceMode: "backend",
        nested: {
          foo: "bar",
        },
      }),
      responseJson: JSON.stringify({
        text: "Transcription complète",
        segments: [],
      }),
      lastError: "",
    },
  ],
}

describe("DemeterQueuePage", () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal("WebSocket", MockWebSocket)
    adminRefresh.mockReset()
    fetchDemeterQueueSnapshot.mockReset()
    updateDemeterQueueSettings.mockReset()
    clearAdminCsrfToken()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearAdminCsrfToken()
  })

  it("renders the snapshot and lets super admins update the parallelism", async () => {
    const user = userEvent.setup()
    fetchDemeterQueueSnapshot.mockResolvedValue(baseSnapshot)
    updateDemeterQueueSettings.mockResolvedValue({
      ...baseSnapshot,
      settings: {
        ...baseSnapshot.settings,
        parallelism: 4,
        updatedAt: "2026-04-23T16:10:00Z",
      },
      summary: {
        ...baseSnapshot.summary,
        parallelism: 4,
        openWorkers: 4,
      },
      workers: [...baseSnapshot.workers, { queueId: 3, open: true, draining: false, workerRunning: false, load: 0, pendingCount: 0, runningCount: 0 }],
    })

    renderWithProviders(<DemeterQueuePage />, { route: "/demeter-queue" })

    expect(await screen.findByText("Lane worker queue")).toBeInTheDocument()
    expect(await screen.findByText("Worker total: 2")).toBeInTheDocument()
    expect(screen.getByLabelText("Workers parallèles")).toHaveValue(2)
    expect(await screen.findByText("La file attend la reprise du retry en cours")).toBeInTheDocument()
    expect(screen.getAllByText("Lane #1").length).toBeGreaterThan(0)
    expect(screen.getAllByText("4/10").length).toBeGreaterThan(0)
    expect(screen.getAllByText("30 %").length).toBeGreaterThan(0)
    expect(screen.getByText("Toutes les opérations")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Afficher les détails de op-3" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Afficher les détails de op-3" }))
    expect(await screen.findByText("Queue payload JSON")).toBeInTheDocument()
    expect(screen.getByText("org-full-1")).toBeInTheDocument()
    expect(screen.getByText("user-full-1")).toBeInTheDocument()
    expect(screen.getByText(/"sourceMode": "backend"/)).toBeInTheDocument()
    expect(screen.getByText(/"text": "Transcription complète"/)).toBeInTheDocument()

    await user.clear(screen.getByLabelText("Workers parallèles"))
    await user.type(screen.getByLabelText("Workers parallèles"), "4")
    await user.click(screen.getByRole("button", { name: "Appliquer" }))

    expect(await screen.findByText("Le parallélisme a été enregistré et les lanes ont été recalculées.")).toBeInTheDocument()
    expect(screen.getByLabelText("Workers parallèles")).toHaveValue(4)
  })

  it("uses websocket snapshots when the admin channel is authenticated", async () => {
    setAdminCsrfToken("csrf-ws")
    fetchDemeterQueueSnapshot.mockResolvedValue(baseSnapshot)

    renderWithProviders(<DemeterQueuePage />, { route: "/demeter-queue" })

    expect(await screen.findByText("Lane worker queue")).toBeInTheDocument()
    const socket = MockWebSocket.instances[0]
    socket.open()

    expect(JSON.parse(socket.sent[0])).toEqual({ type: "auth", csrfToken: "csrf-ws" })
    socket.emitMessage({ type: "auth_ok" })
    expect(await screen.findByText("WebSocket")).toBeInTheDocument()

    socket.emitMessage({
      type: "snapshot",
      snapshot: {
        ...baseSnapshot,
        summary: { ...baseSnapshot.summary, openWorkers: 3 },
        workers: [...baseSnapshot.workers, { queueId: 3, open: true, draining: false, workerRunning: false, load: 0, pendingCount: 0, runningCount: 0 }],
      },
    })

    expect(await screen.findByText("Worker total: 3")).toBeInTheDocument()
  })

  it("sends parallelism updates through websocket while authenticated", async () => {
    const user = userEvent.setup()
    setAdminCsrfToken("csrf-ws")
    fetchDemeterQueueSnapshot.mockResolvedValue(baseSnapshot)

    renderWithProviders(<DemeterQueuePage />, { route: "/demeter-queue" })

    expect(await screen.findByText("Lane worker queue")).toBeInTheDocument()
    const socket = MockWebSocket.instances[0]
    socket.open()
    socket.emitMessage({ type: "auth_ok" })

    await user.clear(screen.getByLabelText("Workers parallèles"))
    await user.type(screen.getByLabelText("Workers parallèles"), "4")
    await user.click(screen.getByRole("button", { name: "Appliquer" }))

    await waitFor(() => expect(socket.sent.some((payload) => JSON.parse(payload).type === "update_settings")).toBe(true))
    const command = JSON.parse(socket.sent.find((payload) => JSON.parse(payload).type === "update_settings") ?? "{}")
    expect(command.settings).toEqual({ parallelism: 4 })
    expect(updateDemeterQueueSettings).not.toHaveBeenCalled()

    socket.emitMessage({
      type: "command_ok",
      commandId: command.commandId,
      snapshot: {
        ...baseSnapshot,
        settings: { ...baseSnapshot.settings, parallelism: 4, updatedAt: "2026-04-23T16:10:00Z" },
        summary: { ...baseSnapshot.summary, parallelism: 4, openWorkers: 4 },
      },
    })

    expect(await screen.findByText("Le parallélisme a été enregistré et les lanes ont été recalculées.")).toBeInTheDocument()
    expect(screen.getByLabelText("Workers parallèles")).toHaveValue(4)
  })

  it("refreshes the admin session and reconnects when websocket csrf is rejected", async () => {
    setAdminCsrfToken("stale-csrf")
    fetchDemeterQueueSnapshot.mockResolvedValue(baseSnapshot)
    adminRefresh.mockResolvedValue({
      csrfToken: "fresh-csrf",
      runtimeMode: "admin",
      user: { id: "admin-1", email: "admin@example.com", status: "active" },
      organization: { id: "org-1", name: "Org", code: "org", status: "active" },
      globalRoles: ["super_admin"],
      orgRoles: [],
      permissions: ["feature.admin"],
    })

    renderWithProviders(<DemeterQueuePage />, { route: "/demeter-queue" })

    expect(await screen.findByText("Lane worker queue")).toBeInTheDocument()
    MockWebSocket.instances[0].open()
    MockWebSocket.instances[0].emitMessage({ type: "auth_error", code: "invalid_csrf" })

    await waitFor(() => expect(adminRefresh).toHaveBeenCalled())
    await waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThan(1))
  })
})
