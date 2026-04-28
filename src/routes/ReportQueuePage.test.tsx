import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const adminClientMocks = vi.hoisted(() => ({
  adminRefresh: vi.fn(),
  fetchDemeterReportQueueSnapshot: vi.fn(),
  purgeDemeterReportQueueOperations: vi.fn(),
  updateDemeterReportQueueSettings: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  adminRefresh: adminClientMocks.adminRefresh,
  fetchDemeterReportQueueSnapshot: adminClientMocks.fetchDemeterReportQueueSnapshot,
  purgeDemeterReportQueueOperations: adminClientMocks.purgeDemeterReportQueueOperations,
  updateDemeterReportQueueSettings: adminClientMocks.updateDemeterReportQueueSettings,
}))

import ReportQueuePage from "@/routes/ReportQueuePage"
import { clearAdminCsrfToken } from "@/lib/admin-security"
import { renderWithProviders } from "@/test/test-utils"

const {
  adminRefresh,
  fetchDemeterReportQueueSnapshot,
  purgeDemeterReportQueueOperations,
  updateDemeterReportQueueSettings,
} = adminClientMocks

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

const reportSnapshot = {
  settings: {
    parallelism: 2,
    updatedAt: "2026-04-23T16:00:00Z",
  },
  summary: {
    parallelism: 2,
    openWorkers: 1,
    drainingWorkers: 0,
    coolingWorkers: 0,
    pendingOperations: 1,
    runningOperations: 0,
    unassignedOperations: 0,
  },
  workers: [
    {
      queueId: 1,
      open: true,
      draining: false,
      workerRunning: true,
      load: 1,
      pendingCount: 1,
      runningCount: 0,
      currentOperationId: "report-1",
      currentStatus: "running",
      currentStage: "running",
      currentFormatIndex: 0,
      currentFormatCount: 1,
      currentProgress: 0.5,
      lastError: "",
      cooldownUntil: "",
    },
  ],
  operations: [
    {
      operationId: "report-1",
      queueId: 1,
      status: "running",
      formatIndex: 0,
      formatCount: 1,
      progress: 0.5,
      statusCode: 202,
      createdAt: "2026-04-23T15:55:00Z",
      updatedAt: "2026-04-23T16:02:00Z",
      lastError: "",
    },
  ],
}

describe("ReportQueuePage", () => {
  beforeEach(() => {
    MockWebSocket.instances = []
    vi.stubGlobal("WebSocket", MockWebSocket)
    adminRefresh.mockReset()
    fetchDemeterReportQueueSnapshot.mockReset()
    purgeDemeterReportQueueOperations.mockReset()
    updateDemeterReportQueueSettings.mockReset()
    clearAdminCsrfToken()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearAdminCsrfToken()
  })

  it("exposes both purge scopes through confirmation panels", async () => {
    const user = userEvent.setup()
    fetchDemeterReportQueueSnapshot.mockResolvedValue(reportSnapshot)
    purgeDemeterReportQueueOperations.mockResolvedValue(undefined)

    renderWithProviders(<ReportQueuePage />, { route: "/report-queue" })

    expect(await screen.findByText("Purge de la queue report")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Vider les jobs terminés" }))
    expect(await screen.findByText("Confirmer la purge des jobs terminés ?")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Confirmer" }))
    expect(purgeDemeterReportQueueOperations).toHaveBeenCalledWith("completed")
    expect(await screen.findByText("Les jobs terminés ont été supprimés.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Vider toute la table" }))
    expect(await screen.findByText("Confirmer la purge complète ?")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Confirmer" }))
    expect(purgeDemeterReportQueueOperations).toHaveBeenCalledWith("all")
    expect(await screen.findByText("Toute la table de report a été vidée.")).toBeInTheDocument()
  })

  it("keeps the websocket snapshot flow intact", async () => {
    fetchDemeterReportQueueSnapshot.mockResolvedValue(reportSnapshot)

    renderWithProviders(<ReportQueuePage />, { route: "/report-queue" })

    expect(await screen.findByText("Queue Rapport")).toBeInTheDocument()
    MockWebSocket.instances[0].open()

    await waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThan(0))
  })
})