import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const adminClientMocks = vi.hoisted(() => ({
  fetchDemeterQueueSnapshot: vi.fn(),
  updateDemeterQueueSettings: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  fetchDemeterQueueSnapshot: adminClientMocks.fetchDemeterQueueSnapshot,
  updateDemeterQueueSettings: adminClientMocks.updateDemeterQueueSettings,
}))

import DemeterQueuePage from "@/routes/DemeterQueuePage"
import { renderWithProviders } from "@/test/test-utils"

const { fetchDemeterQueueSnapshot, updateDemeterQueueSettings } = adminClientMocks

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
}

describe("DemeterQueuePage", () => {
  beforeEach(() => {
    fetchDemeterQueueSnapshot.mockReset()
    updateDemeterQueueSettings.mockReset()
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

    await user.clear(screen.getByLabelText("Workers parallèles"))
    await user.type(screen.getByLabelText("Workers parallèles"), "4")
    await user.click(screen.getByRole("button", { name: "Appliquer" }))

    expect(await screen.findByText("Le parallélisme a été enregistré et les lanes ont été recalculées.")).toBeInTheDocument()
    expect(screen.getByLabelText("Workers parallèles")).toHaveValue(4)
  })
})
