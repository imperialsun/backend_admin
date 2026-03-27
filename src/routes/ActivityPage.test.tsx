import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const activityPageMocks = vi.hoisted(() => ({
  fetchActivitySummary: vi.fn(),
  fetchOrganizations: vi.fn(),
  fetchUserActivitySummary: vi.fn(),
  fetchUsersByOrganization: vi.fn(),
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  fetchActivitySummary: activityPageMocks.fetchActivitySummary,
  fetchOrganizations: activityPageMocks.fetchOrganizations,
  fetchUserActivitySummary: activityPageMocks.fetchUserActivitySummary,
  fetchUsersByOrganization: activityPageMocks.fetchUsersByOrganization,
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: activityPageMocks.useAdminSession,
}))

import ActivityPage from "@/routes/ActivityPage"
import { renderWithProviders } from "@/test/test-utils"

const {
  fetchActivitySummary,
  fetchOrganizations,
  fetchUserActivitySummary,
  fetchUsersByOrganization,
  useAdminSession,
} = activityPageMocks

const sessionPayload = {
  loading: false,
  session: {
    user: { id: "admin-1", email: "admin@example.com", status: "active" },
    organization: { id: "org-1", name: "Clinique Alpha", code: "ALPHA", status: "active" },
    globalRoles: ["super_admin"],
    orgRoles: ["org_admin"],
    permissions: ["feature.admin"],
    runtimeMode: "admin",
  },
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  isSuperAdmin: true,
  isOrgAdmin: true,
  hasPermission: vi.fn().mockReturnValue(true),
}

describe("ActivityPage", () => {
  beforeEach(() => {
    fetchActivitySummary.mockReset()
    fetchOrganizations.mockReset()
    fetchUserActivitySummary.mockReset()
    fetchUsersByOrganization.mockReset()
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
        email: "medecin@example.com",
        status: "active",
        createdAt: "2026-03-01T09:00:00Z",
        updatedAt: "2026-03-01T09:00:00Z",
      },
    ])
    fetchActivitySummary.mockResolvedValue({
      organizationId: "org-1",
      range: {
        from: "2026-03-01",
        to: "2026-03-31",
      },
      totals: {
        transcriptions: 1,
        reports: 0,
      },
      byDay: [
        {
          day: "2026-03-01",
          transcriptions: 1,
          reports: 0,
        },
      ],
      byUser: [
        {
          userId: "user-1",
          email: "medecin@example.com",
          transcriptions: 1,
          reports: 0,
        },
      ],
      breakdown: {
        transcriptionsByMode: {
          local: 1,
        },
        transcriptionsByProvider: {
          local_upload: 1,
        },
        reportsByMode: {},
        reportsByProvider: {},
      },
    })
    fetchUserActivitySummary.mockResolvedValue({
      user: {
        id: "user-1",
        organizationId: "org-1",
        email: "medecin@example.com",
        status: "active",
        createdAt: "2026-03-01T09:00:00Z",
        updatedAt: "2026-03-01T09:00:00Z",
      },
      range: {
        from: "2026-03-01",
        to: "2026-03-31",
      },
      totals: {
        transcriptions: 1,
        reports: 0,
      },
      byDay: [
        {
          day: "2026-03-01",
          transcriptions: 1,
          reports: 0,
        },
      ],
      breakdown: {
        transcriptionsByMode: {
          local: 1,
        },
        transcriptionsByProvider: {
          local_upload: 1,
        },
        reportsByMode: {},
        reportsByProvider: {},
      },
    })
  })

  it("switches from organization activity to user activity after selection", async () => {
    const user = userEvent.setup()

    renderWithProviders(<ActivityPage />, {
      route: "/activity?org=org-1&from=2026-03-01&to=2026-03-31",
    })

    await screen.findByText("Filtres d’activité")
    await screen.findByRole("option", { name: "medecin@example.com" })
    await waitFor(() => expect((screen.getByLabelText("Utilisateur") as HTMLSelectElement).disabled).toBe(false))
    await user.selectOptions(screen.getByLabelText("Utilisateur"), "user-1")

    await waitFor(() =>
      expect(fetchUserActivitySummary).toHaveBeenCalledWith("user-1", {
        from: "2026-03-01",
        to: "2026-03-31",
      }),
    )
    await screen.findByText("Résumé d’activité pour le compte user-1.")
  })
})
