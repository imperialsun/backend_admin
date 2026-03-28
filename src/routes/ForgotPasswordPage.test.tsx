import { Route, Routes } from "react-router-dom"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  adminRequestPasswordReset: vi.fn(),
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  adminRequestPasswordReset: mocks.adminRequestPasswordReset,
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: mocks.useAdminSession,
}))

import ForgotPasswordPage from "@/routes/ForgotPasswordPage"
import { renderWithProviders } from "@/test/test-utils"

function sessionMock(overrides?: Record<string, unknown>) {
  return {
    session: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    isSuperAdmin: false,
    isOrgAdmin: false,
    hasPermission: vi.fn().mockReturnValue(false),
    ...overrides,
  }
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    mocks.adminRequestPasswordReset.mockReset()
    mocks.adminRequestPasswordReset.mockResolvedValue(undefined)
    mocks.useAdminSession.mockReset()
    mocks.useAdminSession.mockReturnValue(sessionMock())
  })

  it("submits the trimmed email and shows the generic success message", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ForgotPasswordPage />,
      {
        route: "/forgot-password",
        wrapper: (children) => (
          <Routes>
            <Route path="/forgot-password" element={children} />
          </Routes>
        ),
      },
    )

    await user.type(screen.getByLabelText("Email"), " admin@example.com ")
    await user.click(screen.getByRole("button", { name: "Envoyer le lien" }))

    await waitFor(() => expect(mocks.adminRequestPasswordReset).toHaveBeenCalledWith("admin@example.com"))
    expect(
      screen.getByText(
        "Si un compte administrateur actif correspond a cet email, un lien de reinitialisation vient d etre envoye.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole("progressbar", { name: "Sécurité du mot de passe" })).toBeNull()
  })

  it("redirects to the dashboard when an admin session already exists", () => {
    mocks.useAdminSession.mockReturnValue(
      sessionMock({
        session: {
          user: { id: "user-1", email: "admin@example.com", status: "active" },
          organization: { id: "org-1", name: "Org 1", code: "ORG1", status: "active" },
          globalRoles: ["super_admin"],
          orgRoles: ["org_admin"],
          permissions: ["feature.admin"],
          runtimeMode: "admin",
        },
      }),
    )

    renderWithProviders(
      <ForgotPasswordPage />,
      {
        route: "/forgot-password",
        wrapper: (children) => (
          <Routes>
            <Route path="/forgot-password" element={children} />
            <Route path="/dashboard" element={<div>dashboard-target</div>} />
          </Routes>
        ),
      },
    )

    expect(screen.getByText("dashboard-target")).toBeInTheDocument()
  })
})
