import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const performancePageMocks = vi.hoisted(() => ({
  fetchOrganizations: vi.fn(),
  fetchPerformanceSummary: vi.fn(),
  purgePerformanceEvents: vi.fn(),
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  fetchOrganizations: performancePageMocks.fetchOrganizations,
  fetchPerformanceSummary: performancePageMocks.fetchPerformanceSummary,
  purgePerformanceEvents: performancePageMocks.purgePerformanceEvents,
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: performancePageMocks.useAdminSession,
}))

import PerformancePage from "@/routes/PerformancePage"
import { renderWithProviders } from "@/test/test-utils"

const { fetchOrganizations, fetchPerformanceSummary, purgePerformanceEvents, useAdminSession } = performancePageMocks

const sessionPayload = {
  loading: false,
  session: {
    user: { id: "admin-1", email: "admin@example.com", status: "active" },
    organization: { id: "org-1", name: "Clinique Alpha", code: "ALPHA", status: "active" },
    globalRoles: ["super_admin"],
    orgRoles: [],
    permissions: ["feature.admin"],
    runtimeMode: "admin",
  },
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  isSuperAdmin: true,
  isOrgAdmin: false,
  hasPermission: vi.fn().mockReturnValue(true),
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("PerformancePage", () => {
  beforeEach(() => {
    fetchOrganizations.mockReset()
    fetchPerformanceSummary.mockReset()
    purgePerformanceEvents.mockReset()
    useAdminSession.mockReset()

    useAdminSession.mockReturnValue(sessionPayload)
    fetchOrganizations.mockResolvedValue([
      {
        id: "org-1",
        name: "Clinique Alpha",
        code: "ALPHA",
        status: "active",
        createdAt: "2026-03-01T09:00:00Z",
        updatedAt: "2026-03-01T09:00:00Z",
      },
    ])
    fetchPerformanceSummary.mockResolvedValue({
      organizationId: "org-1",
      range: {
        from: "2026-03-01",
        to: "2026-03-31",
      },
      totals: {
        events: 3,
        successes: 2,
        failures: 1,
        totalDurationMs: 6_900,
        averageDurationMs: 2_300,
        maxDurationMs: 4_200,
      },
      taskOptions: ["cloud_total", "request", "response_received"],
      byDay: [
        {
          day: "2026-03-30",
          events: 2,
          successes: 2,
          failures: 0,
          totalDurationMs: 5_200,
          averageDurationMs: 2_600,
          maxDurationMs: 4_200,
        },
      ],
      topTasks: [
        {
          surface: "frontend",
          component: "cloud",
          task: "cloud_total",
          route: "/cloudupload",
          events: 2,
          successes: 2,
          failures: 0,
          totalDurationMs: 5_200,
          averageDurationMs: 2_600,
          maxDurationMs: 4_200,
          lastOccurredAt: "2026-03-30T16:45:23Z",
        },
      ],
      recentEvents: [
        {
          eventId: "perf-1",
          traceId: "trace-1",
          organizationId: "org-1",
          surface: "frontend",
          component: "cloud",
          task: "cloud_total",
          status: "success",
          durationMs: 4_200,
          route: "/cloudupload",
          metaJson: JSON.stringify({ provider: "whisper" }),
          occurredAt: "2026-03-30T16:45:23Z",
          day: "2026-03-30",
          createdAt: "2026-03-30T16:45:23Z",
        },
      ],
    })
    purgePerformanceEvents.mockResolvedValue(undefined)
  })

  it("renders the performance dashboard for super admins", async () => {
    renderWithProviders(<PerformancePage />, {
      route: "/performance?from=2026-03-01&to=2026-03-31&organizationId=org-1",
    })

    expect(await screen.findByText("Fenêtre de performance")).toBeInTheDocument()
    await waitFor(() => expect(fetchPerformanceSummary).toHaveBeenCalledTimes(1))
    expect(fetchPerformanceSummary).toHaveBeenCalledWith({
      from: "2026-03-01",
      to: "2026-03-31",
      organizationId: "org-1",
      task: undefined,
    })
    const helperButton = screen.getByRole("button", { name: /aide sur les tâches de performance/i })
    fireEvent.click(helperButton)
    const taskHelp = screen.getByRole("tooltip")
    expect(taskHelp.parentElement).toBe(document.body)
    expect(taskHelp).toHaveClass("fixed")
    expect(within(taskHelp).getByText("request")).toBeInTheDocument()
    expect(within(taskHelp).getByText("audio_transcription")).toBeInTheDocument()
    expect(within(taskHelp).getByText("timeout")).toBeInTheDocument()
    expect(within(taskHelp).getByText("llm_cloud_total")).toBeInTheDocument()

    fireEvent.keyDown(helperButton, { key: "Escape" })
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    fireEvent.focus(helperButton)
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    const taskSelect = await screen.findByLabelText("Tâche")
    fireEvent.change(taskSelect, { target: { value: "response_received" } })
    await waitFor(() =>
      expect(fetchPerformanceSummary).toHaveBeenLastCalledWith({
        from: "2026-03-01",
        to: "2026-03-31",
        organizationId: "org-1",
        task: "response_received",
      }),
    )
    expect(await screen.findByRole("heading", { name: "Cloud Total" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "3" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "/cloudupload" })).toBeInTheDocument()

    const purgeButton = screen.getByRole("button", { name: /purger les données/i })
    fireEvent.click(purgeButton)
    expect(screen.getByText("Confirmer la purge")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))
    await waitFor(() =>
      expect(purgePerformanceEvents).toHaveBeenCalledWith({
        from: "2026-03-01",
        to: "2026-03-31",
        organizationId: "org-1",
        task: "response_received",
      }),
    )
    await waitFor(() => expect(fetchPerformanceSummary.mock.calls.length).toBeGreaterThanOrEqual(3))
  })

  it("does not expose purge actions to non super admins", async () => {
    useAdminSession.mockReturnValue({
      ...sessionPayload,
      isSuperAdmin: false,
      isOrgAdmin: true,
    })

    renderWithProviders(<PerformancePage />, {
      route: "/performance?from=2026-03-01&to=2026-03-31",
    })

    expect(await screen.findByText("Fenêtre de performance")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /purger les données/i })).not.toBeInTheDocument()
  })

  it("refreshes the current performance scope without changing filters", async () => {
    const user = userEvent.setup()

    renderWithProviders(<PerformancePage />, {
      route: "/performance?from=2026-03-01&to=2026-03-31&organizationId=org-1",
    })

    expect(await screen.findByText("Fenêtre de performance")).toBeInTheDocument()
    await waitFor(() => expect(fetchPerformanceSummary).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole("button", { name: "Rafraîchir" }))

    await waitFor(() => expect(fetchPerformanceSummary).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(2))
    expect(fetchPerformanceSummary).toHaveBeenLastCalledWith({
      from: "2026-03-01",
      to: "2026-03-31",
      organizationId: "org-1",
      task: undefined,
    })
    expect(screen.getByDisplayValue("2026-03-01")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2026-03-31")).toBeInTheDocument()
  })

  it("keeps long routes on their own line in the slow tasks card", async () => {
    const longRoute = "/api/v1/transcriptions/demeter/sessions/very-long-route-name-with-many-segments/and-a-final-tail"

    fetchPerformanceSummary.mockResolvedValueOnce({
      organizationId: "org-1",
      range: {
        from: "2026-03-01",
        to: "2026-03-31",
      },
      totals: {
        events: 3,
        successes: 2,
        failures: 1,
        totalDurationMs: 6_900,
        averageDurationMs: 2_300,
        maxDurationMs: 4_200,
      },
      taskOptions: ["cloud_total", "request", "response_received"],
      byDay: [
        {
          day: "2026-03-30",
          events: 2,
          successes: 2,
          failures: 0,
          totalDurationMs: 5_200,
          averageDurationMs: 2_600,
          maxDurationMs: 4_200,
        },
      ],
      topTasks: [
        {
          surface: "frontend",
          component: "cloud",
          task: "cloud_total",
          route: longRoute,
          events: 2,
          successes: 2,
          failures: 0,
          totalDurationMs: 5_200,
          averageDurationMs: 2_600,
          maxDurationMs: 4_200,
          lastOccurredAt: "2026-03-30T16:45:23Z",
        },
      ],
      recentEvents: [
        {
          eventId: "perf-1",
          traceId: "trace-1",
          organizationId: "org-1",
          surface: "frontend",
          component: "cloud",
          task: "cloud_total",
          status: "success",
          durationMs: 4_200,
          route: "/cloudupload",
          metaJson: JSON.stringify({ provider: "whisper" }),
          occurredAt: "2026-03-30T16:45:23Z",
          day: "2026-03-30",
          createdAt: "2026-03-30T16:45:23Z",
        },
      ],
    })

    renderWithProviders(<PerformancePage />, {
      route: "/performance?from=2026-03-01&to=2026-03-31&organizationId=org-1",
    })

    expect(await screen.findByText(longRoute)).toBeInTheDocument()
    const routeNode = screen.getByText(longRoute)
    expect(routeNode).toHaveClass("break-words")
    expect(routeNode).toHaveClass("[overflow-wrap:anywhere]")

    const routeBlock = routeNode.parentElement
    if (!routeBlock) {
      throw new Error("Expected the long route to be wrapped in its own block")
    }
    expect(routeBlock).toHaveClass("min-w-0")

    const statsGrid = routeBlock?.nextElementSibling
    if (!(statsGrid instanceof HTMLElement)) {
      throw new Error("Expected the metrics grid immediately after the route block")
    }
    expect(statsGrid).toHaveClass("grid")
    expect(within(statsGrid).getByText("Moyenne")).toBeInTheDocument()
    expect(within(statsGrid).getByText("Pic")).toBeInTheDocument()
    expect(within(statsGrid).getByText("Exécutions")).toBeInTheDocument()
  })

  it("disables the refresh button while the performance summary is loading", async () => {
    const deferredSummary = createDeferred<Awaited<ReturnType<typeof fetchPerformanceSummary>>>()
    fetchPerformanceSummary.mockImplementation(() => deferredSummary.promise)

    renderWithProviders(<PerformancePage />, {
      route: "/performance?from=2026-03-01&to=2026-03-31&organizationId=org-1",
    })

    const refreshButton = await screen.findByRole("button", { name: "Rafraîchissement..." })
    expect(refreshButton).toBeDisabled()

    deferredSummary.resolve({
      organizationId: "org-1",
      range: {
        from: "2026-03-01",
        to: "2026-03-31",
      },
      totals: {
        events: 3,
        successes: 2,
        failures: 1,
        totalDurationMs: 6_900,
        averageDurationMs: 2_300,
        maxDurationMs: 4_200,
      },
      taskOptions: ["cloud_total", "request", "response_received"],
      byDay: [
        {
          day: "2026-03-30",
          events: 2,
          successes: 2,
          failures: 0,
          totalDurationMs: 5_200,
          averageDurationMs: 2_600,
          maxDurationMs: 4_200,
        },
      ],
      topTasks: [
        {
          surface: "frontend",
          component: "cloud",
          task: "cloud_total",
          route: "/cloudupload",
          events: 2,
          successes: 2,
          failures: 0,
          totalDurationMs: 5_200,
          averageDurationMs: 2_600,
          maxDurationMs: 4_200,
          lastOccurredAt: "2026-03-30T16:45:23Z",
        },
      ],
      recentEvents: [
        {
          eventId: "perf-1",
          traceId: "trace-1",
          organizationId: "org-1",
          surface: "frontend",
          component: "cloud",
          task: "cloud_total",
          status: "success",
          durationMs: 4_200,
          route: "/cloudupload",
          metaJson: JSON.stringify({ provider: "whisper" }),
          occurredAt: "2026-03-30T16:45:23Z",
          day: "2026-03-30",
          createdAt: "2026-03-30T16:45:23Z",
        },
      ],
    })

    await waitFor(() => expect(screen.getByRole("button", { name: "Rafraîchir" })).toBeEnabled())
  })
})
