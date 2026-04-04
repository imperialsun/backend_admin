import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const backendErrorPageMocks = vi.hoisted(() => ({
  fetchBackendErrorEvents: vi.fn(),
  fetchOrganizations: vi.fn(),
  purgeBackendErrorEvents: vi.fn(),
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  fetchBackendErrorEvents: backendErrorPageMocks.fetchBackendErrorEvents,
  fetchOrganizations: backendErrorPageMocks.fetchOrganizations,
  purgeBackendErrorEvents: backendErrorPageMocks.purgeBackendErrorEvents,
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: backendErrorPageMocks.useAdminSession,
}))

import BackendErrorsPage from "@/routes/BackendErrorsPage"
import { renderWithProviders } from "@/test/test-utils"

const { fetchBackendErrorEvents, fetchOrganizations, purgeBackendErrorEvents, useAdminSession } =
  backendErrorPageMocks

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

describe("BackendErrorsPage", () => {
  beforeEach(() => {
    fetchBackendErrorEvents.mockReset()
    fetchOrganizations.mockReset()
    purgeBackendErrorEvents.mockReset()
    useAdminSession.mockReset()

    useAdminSession.mockReturnValue(sessionPayload)
    fetchBackendErrorEvents.mockResolvedValue({
      items: [
        {
          id: "event-1",
          traceId: "trace-alpha",
          userId: "user-1",
          organizationId: "org-1",
          component: "admin",
          route: "/admin/backend-errors",
          step: "load_error",
          title: "list_backend_errors",
          statusCode: 500,
          durationMs: 32,
          errorMessage: "boom alpha",
          payloadJson: JSON.stringify({ error: "boom alpha" }),
          annexJson: JSON.stringify({
            provider: "demeter_sante",
            retry: { attempted: true, succeeded: true, usedRawFile: true },
          }),
          recoveryStatus: "raw_retry_succeeded",
          createdAt: "2026-03-30T15:45:23Z",
        },
        {
          id: "event-2",
          traceId: "trace-beta",
          userId: "user-2",
          organizationId: "org-1",
          component: "store",
          route: "sqlite",
          step: "update_error",
          title: "store_backend_error",
          statusCode: 500,
          durationMs: 18,
          errorMessage: "boom beta",
          payloadJson: JSON.stringify({ error: "boom beta" }),
          createdAt: "2026-03-30T16:45:23Z",
        },
      ],
      total: 2,
      page: 1,
      pageSize: 25,
    })
    fetchOrganizations.mockResolvedValue([])
    purgeBackendErrorEvents.mockResolvedValue(undefined)
  })

  it("renders the backend error history and the selected detail", async () => {
    renderWithProviders(<BackendErrorsPage />, {
      route: "/backend-errors?from=2026-03-01&to=2026-03-31&org=org-1",
    })

    await screen.findByText("2 événement(s) sur 1 page(s).")
    expect(screen.getByText("trace-alpha")).toBeInTheDocument()
    expect(screen.getAllByText("boom alpha").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Récupéré après retry brut").length).toBeGreaterThan(0)
    expect(screen.getByText("Annexe frontend")).toBeInTheDocument()
    const payloadLabel = screen.getByText("Payload")
    expect(payloadLabel.nextElementSibling?.textContent).toContain('"error": "boom alpha"')
    expect(screen.getByText(/"usedRawFile": true/)).toBeInTheDocument()
  })

  it("opens the purge confirmation and submits the current filter", async () => {
    const user = userEvent.setup()

    renderWithProviders(<BackendErrorsPage />, {
      route: "/backend-errors?from=2026-03-01&to=2026-03-31&org=org-1",
    })

    await screen.findByText("2 événement(s) sur 1 page(s).")
    await user.click(screen.getByRole("button", { name: "Purger le filtre" }))
    await user.click(screen.getByRole("button", { name: "Confirmer" }))

    await waitFor(() =>
      expect(purgeBackendErrorEvents).toHaveBeenCalledWith({
        from: "2026-03-01",
        to: "2026-03-31",
        component: "",
        route: "",
        q: "",
        organizationId: "org-1",
      }),
    )
  })

  it("refreshes the current backend errors scope without changing filters", async () => {
    const user = userEvent.setup()

    renderWithProviders(<BackendErrorsPage />, {
      route: "/backend-errors?from=2026-03-01&to=2026-03-31&org=org-1",
    })

    await screen.findByText("2 événement(s) sur 1 page(s).")
    await user.click(screen.getByRole("button", { name: "Rafraîchir" }))

    await waitFor(() => expect(fetchBackendErrorEvents).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledTimes(2))
    expect(fetchBackendErrorEvents).toHaveBeenLastCalledWith({
      from: "2026-03-01",
      to: "2026-03-31",
      component: "",
      route: "",
      q: "",
      organizationId: "org-1",
      page: 1,
      pageSize: 25,
    })
    expect(screen.getByDisplayValue("2026-03-01")).toBeInTheDocument()
    expect(screen.getByDisplayValue("2026-03-31")).toBeInTheDocument()
  })

  it("disables the refresh button while backend errors are loading", async () => {
    const deferredEvents = createDeferred<Awaited<ReturnType<typeof fetchBackendErrorEvents>>>()
    fetchBackendErrorEvents.mockImplementation(() => deferredEvents.promise)

    renderWithProviders(<BackendErrorsPage />, {
      route: "/backend-errors?from=2026-03-01&to=2026-03-31&org=org-1",
    })

    const refreshButton = await screen.findByRole("button", { name: "Rafraîchissement..." })
    expect(refreshButton).toBeDisabled()

    deferredEvents.resolve({
      items: [
        {
          id: "event-1",
          traceId: "trace-alpha",
          userId: "user-1",
          organizationId: "org-1",
          component: "admin",
          route: "/admin/backend-errors",
          step: "load_error",
          title: "list_backend_errors",
          statusCode: 500,
          durationMs: 32,
          errorMessage: "boom alpha",
          payloadJson: JSON.stringify({ error: "boom alpha" }),
          annexJson: JSON.stringify({
            provider: "demeter_sante",
            retry: { attempted: true, succeeded: true, usedRawFile: true },
          }),
          recoveryStatus: "raw_retry_succeeded",
          createdAt: "2026-03-30T15:45:23Z",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
    })

    await waitFor(() => expect(screen.getByRole("button", { name: "Rafraîchir" })).toBeEnabled())
  })
})
