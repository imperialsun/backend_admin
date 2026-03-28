import { Route, Routes } from "react-router-dom"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const sessionMocks = vi.hoisted(() => ({
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: sessionMocks.useAdminSession,
}))

import LoginPage from "@/routes/LoginPage"
import { renderWithProviders } from "@/test/test-utils"

const { useAdminSession } = sessionMocks

function sessionMock(overrides?: Partial<ReturnType<typeof useAdminSession>>) {
  return {
    session: null,
    loading: false,
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    refresh: vi.fn(),
    isSuperAdmin: false,
    isOrgAdmin: false,
    hasPermission: vi.fn().mockReturnValue(false),
    ...overrides,
  }
}

describe("LoginPage", () => {
  beforeEach(() => {
    useAdminSession.mockReset()
  })

  it("submits trimmed credentials and redirects to the requested route", async () => {
    const login = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    useAdminSession.mockReturnValue(sessionMock({ login }))

    renderWithProviders(
      <LoginPage />,
      {
        route: "/login",
        wrapper: (children) => (
          <Routes>
            <Route path="/login" element={children} />
            <Route path="/dashboard" element={<div>dashboard-target</div>} />
            <Route path="/users" element={<div>users-target</div>} />
          </Routes>
        ),
      },
    )

    expect(screen.getByAltText("Logo Demeter Santé")).toHaveAttribute("src", "/logo.png")
    await user.type(screen.getByLabelText("Email"), " admin@example.com ")
    await user.type(screen.getByLabelText("Mot de passe"), "secret")
    await user.click(screen.getByRole("button", { name: "Ouvrir l’administration" }))

    await waitFor(() => expect(login).toHaveBeenCalledWith("admin@example.com", "secret"))
  })

  it("redirects immediately when a session already exists", () => {
    useAdminSession.mockReturnValue(
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
      <LoginPage />,
      {
        route: "/login",
        wrapper: (children) => (
          <Routes>
            <Route path="/login" element={children} />
            <Route path="/dashboard" element={<div>dashboard-target</div>} />
          </Routes>
        ),
      },
    )

    expect(screen.getByText("dashboard-target")).toBeInTheDocument()
  })

  it("exposes the forgot password link", () => {
    useAdminSession.mockReturnValue(sessionMock())

    renderWithProviders(
      <LoginPage />,
      {
        route: "/login",
        wrapper: (children) => (
          <Routes>
            <Route path="/login" element={children} />
            <Route path="/forgot-password" element={<div>forgot-target</div>} />
          </Routes>
        ),
      },
    )

    expect(screen.getByRole("link", { name: "Mot de passe oublié ?" })).toHaveAttribute("href", "/forgot-password")
  })
})
