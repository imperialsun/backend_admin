import { fireEvent, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const performancePageMocks = vi.hoisted(() => ({
  fetchOrganizations: vi.fn(),
  fetchPerformanceSummary: vi.fn(),
  fetchUsersByOrganization: vi.fn(),
  purgePerformanceEvents: vi.fn(),
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils")
  return {
    ...actual,
    hoursAgoIsoString: vi.fn(() => "2026-04-04T12:00:00.000Z"),
    nowIsoString: vi.fn(() => "2026-04-05T12:00:00.000Z"),
  }
})

vi.mock("@/lib/admin-client", () => ({
  fetchOrganizations: performancePageMocks.fetchOrganizations,
  fetchPerformanceSummary: performancePageMocks.fetchPerformanceSummary,
  fetchUsersByOrganization: performancePageMocks.fetchUsersByOrganization,
  purgePerformanceEvents: performancePageMocks.purgePerformanceEvents,
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: performancePageMocks.useAdminSession,
}))

import PerformancePage from "@/routes/PerformancePage"
import { renderWithProviders } from "@/test/test-utils"

const {
  fetchOrganizations,
  fetchPerformanceSummary,
  fetchUsersByOrganization,
  purgePerformanceEvents,
  useAdminSession,
} = performancePageMocks

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
  const refreshedFrom = "2026-04-04T12:00:00.000Z"
  const refreshedTo = "2026-04-05T12:00:00.000Z"

  beforeEach(() => {
    fetchOrganizations.mockReset()
    fetchPerformanceSummary.mockReset()
    fetchUsersByOrganization.mockReset()
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
    fetchUsersByOrganization.mockResolvedValue([
      {
        id: "user-1",
        organizationId: "org-1",
        email: "alice@example.com",
        status: "active",
        createdAt: "2026-03-01T09:00:00Z",
        updatedAt: "2026-03-01T09:00:00Z",
      },
      {
        id: "user-2",
        organizationId: "org-1",
        email: "bob@example.com",
        status: "active",
        createdAt: "2026-03-01T09:00:00Z",
        updatedAt: "2026-03-01T09:00:00Z",
      },
    ])
    fetchPerformanceSummary.mockResolvedValue({
      organizationId: "org-1",
      userId: "",
      range: {
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-31T23:59:59.999Z",
      },
      totals: {
        events: 3,
        successes: 2,
        failures: 1,
        totalDurationMs: 6_900,
        averageDurationMs: 2_300,
        maxDurationMs: 4_200,
      },
      taskOptions: [
        "frontend_cloud_total",
        "mistral_models",
        "http_request",
        "mistral_audio_transcription",
      ],
      topTasks: [
        {
          surface: "backend",
          component: "mistral",
          task: "mistral_audio_transcription",
          route: "/v1/audio/transcriptions",
          events: 2,
          successes: 2,
          failures: 0,
          totalDurationMs: 5_200,
          averageDurationMs: 2_600,
          maxDurationMs: 4_200,
          lastOccurredAt: "2026-03-30T16:45:23Z",
        },
        {
          surface: "backend",
          component: "mistral",
          task: "mistral_report_generation",
          route: "/v1/chat/completions",
          events: 1,
          successes: 1,
          failures: 0,
          totalDurationMs: 1_700,
          averageDurationMs: 1_700,
          maxDurationMs: 1_700,
          lastOccurredAt: "2026-03-30T16:43:10Z",
        },
      ],
      recentEvents: [
        {
          eventId: "perf-1",
          traceId: "trace-1",
          organizationId: "org-1",
          surface: "backend",
          component: "mistral",
          task: "mistral_audio_transcription",
          status: "success",
          durationMs: 4_200,
          route: "/v1/audio/transcriptions",
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

    expect(await screen.findByText(/Fenêtre de performance/)).toBeInTheDocument()
    await waitFor(() => expect(fetchPerformanceSummary).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(fetchUsersByOrganization).toHaveBeenCalledWith("org-1"))
    expect(fetchPerformanceSummary).toHaveBeenCalledWith({
      from: "2026-03-01",
      to: "2026-03-31",
      organizationId: "org-1",
      userId: undefined,
      task: undefined,
    })
    const userSelect = screen.getByRole("combobox", { name: "Utilisateur" })
    expect(userSelect).toBeEnabled()
    expect(userSelect).toHaveDisplayValue("Tous les utilisateurs")
    expect(screen.getByLabelText("Du")).toHaveAttribute("type", "time")
    expect(screen.getByLabelText("Du")).toHaveDisplayValue("00:00")
    expect(screen.getByLabelText("Au")).toHaveAttribute("type", "time")
    expect(screen.getByLabelText("Au")).toHaveDisplayValue("00:00")
    const helperButton = screen.getByRole("button", { name: /aide sur les tâches de performance/i })
    fireEvent.click(helperButton)
    const taskHelp = screen.getByRole("tooltip")
    expect(taskHelp.parentElement).toBe(document.body)
    expect(taskHelp).toHaveClass("fixed")
    expect(within(taskHelp).getByRole("heading", { name: "Lecture générale" })).toBeInTheDocument()
    expect(within(taskHelp).getByRole("heading", { name: "Transcription et audio" })).toBeInTheDocument()
    expect(within(taskHelp).getByRole("heading", { name: "Génération de CR" })).toBeInTheDocument()
    expect(within(taskHelp).getByRole("heading", { name: "Frontend avancé" })).toBeInTheDocument()
    expect(within(taskHelp).getByText("http_request")).toBeInTheDocument()
    expect(within(taskHelp).getByText("mistral_models")).toBeInTheDocument()
    expect(within(taskHelp).getByText("mistral_audio_transcription")).toBeInTheDocument()
    expect(within(taskHelp).getByText("mistral_report_generation")).toBeInTheDocument()
    expect(within(taskHelp).getByText("mistral_report_cri")).toBeInTheDocument()

    fireEvent.keyDown(helperButton, { key: "Escape" })
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    fireEvent.focus(helperButton)
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    const taskSelect = await screen.findByLabelText("Tâche")
    expect(screen.getByRole("option", { name: "Client Mistral · Liste des modèles" })).toBeInTheDocument()
    fireEvent.change(taskSelect, { target: { value: "mistral_audio_transcription" } })
    await waitFor(() =>
      expect(fetchPerformanceSummary).toHaveBeenLastCalledWith({
        from: "2026-03-01",
        to: "2026-03-31",
        organizationId: "org-1",
        userId: undefined,
        task: "mistral_audio_transcription",
      }),
    )
    fireEvent.change(userSelect, { target: { value: "user-1" } })
    await waitFor(() =>
      expect(fetchPerformanceSummary).toHaveBeenLastCalledWith({
        from: "2026-03-01",
        to: "2026-03-31",
        organizationId: "org-1",
        userId: "user-1",
        task: "mistral_audio_transcription",
      }),
    )
    expect(screen.getByRole("heading", { name: "Client Mistral" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Dernières exécutions" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Top tâches lentes" })).toBeInTheDocument()
    const recentExecutionsHeading = screen.getByRole("heading", { name: "Dernières exécutions" })
    const slowTasksHeading = screen.getByRole("heading", { name: "Top tâches lentes" })
    expect(recentExecutionsHeading.compareDocumentPosition(slowTasksHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(screen.getByRole("button", { name: /purger les données/i })).toBeEnabled())

    const purgeButton = screen.getByRole("button", { name: /purger les données/i })
    fireEvent.click(purgeButton)
    expect(screen.getByText("Confirmer la purge")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }))
    await waitFor(() =>
      expect(purgePerformanceEvents).toHaveBeenCalledWith({
        from: "2026-03-01",
        to: "2026-03-31",
        organizationId: "org-1",
        userId: "user-1",
        task: "mistral_audio_transcription",
      }),
    )
    await waitFor(() => expect(fetchPerformanceSummary.mock.calls.length).toBeGreaterThanOrEqual(3))
    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }))
    expect(userSelect).toHaveDisplayValue("Sélectionnez une organisation")
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

    expect(await screen.findByText(/Fenêtre de performance/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /purger les données/i })).not.toBeInTheDocument()
  })

  it("refreshes the current performance scope without changing filters", async () => {
    const user = userEvent.setup()

    renderWithProviders(<PerformancePage />, {
      route: "/performance?from=2026-03-01&to=2026-03-31&organizationId=org-1",
    })

    expect(await screen.findByText(/Fenêtre de performance/)).toBeInTheDocument()
    await waitFor(() => expect(fetchPerformanceSummary).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole("button", { name: "Rafraîchir" }))

    await waitFor(() => expect(fetchPerformanceSummary).toHaveBeenCalledTimes(2))
    expect(fetchOrganizations).toHaveBeenCalledTimes(1)
    expect(fetchUsersByOrganization).toHaveBeenCalledTimes(1)
    expect(fetchPerformanceSummary).toHaveBeenLastCalledWith({
      from: refreshedFrom,
      to: refreshedTo,
      organizationId: "org-1",
      userId: undefined,
      task: undefined,
    })
    expect(screen.getByLabelText("Du")).toHaveAttribute("type", "time")
    expect(screen.getByLabelText("Au")).toHaveAttribute("type", "time")
  })

  it("refreshes the current performance scope while a user filter is active", async () => {
    const user = userEvent.setup()

    renderWithProviders(<PerformancePage />, {
      route: "/performance?from=2026-03-01&to=2026-03-31&organizationId=org-1",
    })

    expect(await screen.findByText(/Fenêtre de performance/)).toBeInTheDocument()
    await waitFor(() => expect(fetchPerformanceSummary).toHaveBeenCalledTimes(1))

    const userSelect = screen.getByRole("combobox", { name: "Utilisateur" })
    fireEvent.change(userSelect, { target: { value: "user-1" } })

    await waitFor(() =>
      expect(fetchPerformanceSummary).toHaveBeenLastCalledWith({
        from: "2026-03-01",
        to: "2026-03-31",
        organizationId: "org-1",
        userId: "user-1",
        task: undefined,
      }),
    )
    await waitFor(() => expect(screen.getByRole("button", { name: "Rafraîchir" })).toBeEnabled())

    const deferredSummary = createDeferred<Awaited<ReturnType<typeof fetchPerformanceSummary>>>()

    fetchPerformanceSummary.mockImplementation(() => deferredSummary.promise)

    await user.click(screen.getByRole("button", { name: "Rafraîchir" }))

    await waitFor(() => expect(screen.getByRole("button", { name: "Rafraîchissement..." })).toBeDisabled())

    deferredSummary.resolve({
      organizationId: "org-1",
      userId: "user-1",
      range: {
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-31T23:59:59.999Z",
      },
      totals: {
        events: 3,
        successes: 2,
        failures: 1,
        totalDurationMs: 6_900,
        averageDurationMs: 2_300,
        maxDurationMs: 4_200,
      },
      taskOptions: [
        "frontend_cloud_total",
        "mistral_models",
        "http_request",
        "mistral_audio_transcription",
      ],
      topTasks: [
        {
          surface: "backend",
          component: "mistral",
          task: "mistral_audio_transcription",
          route: "/v1/audio/transcriptions",
          events: 2,
          successes: 2,
          failures: 0,
          totalDurationMs: 5_200,
          averageDurationMs: 2_600,
          maxDurationMs: 4_200,
          lastOccurredAt: "2026-03-30T16:45:23Z",
        },
      ],
      userId: "user-1",
      organizationId: "org-1",
      recentEvents: [
        {
          eventId: "perf-1",
          traceId: "trace-1",
          organizationId: "org-1",
          surface: "backend",
          component: "mistral",
          task: "mistral_audio_transcription",
          status: "success",
          durationMs: 4_200,
          route: "/v1/audio/transcriptions",
          metaJson: JSON.stringify({ provider: "whisper" }),
          occurredAt: "2026-03-30T16:45:23Z",
          day: "2026-03-30",
          createdAt: "2026-03-30T16:45:23Z",
        },
      ],
    })

    await waitFor(() => expect(fetchPerformanceSummary).toHaveBeenCalledTimes(3))
    expect(fetchOrganizations).toHaveBeenCalledTimes(1)
    expect(fetchUsersByOrganization).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.getByRole("button", { name: "Rafraîchir" })).toBeEnabled())
    expect(fetchPerformanceSummary).toHaveBeenLastCalledWith({
      from: refreshedFrom,
      to: refreshedTo,
      organizationId: "org-1",
      userId: "user-1",
      task: undefined,
    })
    expect(screen.getByRole("combobox", { name: "Utilisateur" })).toHaveDisplayValue("alice@example.com")
  })

  it("keeps long routes on their own line in the slow tasks card", async () => {
    const longRoute = "/api/v1/transcriptions/demeter/sessions/very-long-route-name-with-many-segments/and-a-final-tail"

    fetchPerformanceSummary.mockResolvedValueOnce({
      organizationId: "org-1",
      range: {
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-31T23:59:59.999Z",
      },
      totals: {
        events: 3,
        successes: 2,
        failures: 1,
        totalDurationMs: 6_900,
        averageDurationMs: 2_300,
        maxDurationMs: 4_200,
      },
      taskOptions: ["frontend_cloud_total", "mistral_audio_transcription", "mistral_report_generation"],
      topTasks: [
        {
          surface: "backend",
          component: "mistral",
          task: "mistral_audio_transcription",
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
      userId: "",
      recentEvents: [
        {
          eventId: "perf-1",
          traceId: "trace-1",
          organizationId: "org-1",
          surface: "backend",
          component: "mistral",
          task: "mistral_audio_transcription",
          status: "success",
          durationMs: 4_200,
          route: "/v1/audio/transcriptions",
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
        from: "2026-03-01T00:00:00.000Z",
        to: "2026-03-31T23:59:59.999Z",
      },
      totals: {
        events: 3,
        successes: 2,
        failures: 1,
        totalDurationMs: 6_900,
        averageDurationMs: 2_300,
        maxDurationMs: 4_200,
      },
      taskOptions: ["frontend_cloud_total", "mistral_audio_transcription", "mistral_report_generation"],
      topTasks: [
        {
          surface: "backend",
          component: "mistral",
          task: "mistral_audio_transcription",
          route: "/v1/audio/transcriptions",
          events: 2,
          successes: 2,
          failures: 0,
          totalDurationMs: 5_200,
          averageDurationMs: 2_600,
          maxDurationMs: 4_200,
          lastOccurredAt: "2026-03-30T16:45:23Z",
        },
      ],
      userId: "",
      recentEvents: [
        {
          eventId: "perf-1",
          traceId: "trace-1",
          organizationId: "org-1",
          surface: "backend",
          component: "mistral",
          task: "mistral_audio_transcription",
          status: "success",
          durationMs: 4_200,
          route: "/v1/audio/transcriptions",
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
