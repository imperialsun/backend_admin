import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const sessionMocks = vi.hoisted(() => ({
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: sessionMocks.useAdminSession,
}))

vi.mock("@/components/layout/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock("@/routes/LoginPage", () => ({ default: () => <div>login-page</div> }))
vi.mock("@/routes/DashboardPage", () => ({ default: () => <div>dashboard-page</div> }))
vi.mock("@/routes/OrganizationsPage", () => ({ default: () => <div>organizations-page</div> }))
vi.mock("@/routes/UsersPage", () => ({ default: () => <div>users-page</div> }))
vi.mock("@/routes/ActivityPage", () => ({ default: () => <div>activity-page</div> }))
vi.mock("@/routes/PerformancePage", () => ({ default: () => <div>performance-page</div> }))
vi.mock("@/routes/BackendErrorsPage", () => ({ default: () => <div>backend-errors-page</div> }))
vi.mock("@/routes/ForbiddenPage", () => ({ default: () => <div>forbidden-page</div> }))

import App from "@/App"

const { useAdminSession } = sessionMocks

function sessionMock(overrides?: Partial<ReturnType<typeof useAdminSession>>) {
  return {
    loading: false,
    session: {
      user: { id: "user-1", email: "admin@example.com", status: "active" },
      organization: { id: "org-1", name: "Org 1", code: "ORG1", status: "active" },
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
    ...overrides,
  }
}

describe("App routes", () => {
  it("shows a loading screen while session bootstraps", () => {
    useAdminSession.mockReturnValue(sessionMock({ loading: true }))

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText("Chargement du contexte administrateur")).toBeInTheDocument()
  })

  it("redirects anonymous users to login", () => {
    useAdminSession.mockReturnValue(sessionMock({ session: null, isSuperAdmin: false, isOrgAdmin: false }))

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText("login-page")).toBeInTheDocument()
  })

  it("redirects non super admin users away from organizations", () => {
    useAdminSession.mockReturnValue(sessionMock({ isSuperAdmin: false, globalRoles: ["user"] }))

    render(
      <MemoryRouter initialEntries={["/organizations"]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText("forbidden-page")).toBeInTheDocument()
  })

  it("renders the organizations screen for super admins", () => {
    useAdminSession.mockReturnValue(sessionMock())

    render(
      <MemoryRouter initialEntries={["/organizations"]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText("organizations-page")).toBeInTheDocument()
  })

  it("renders the backend error console route for super admins", () => {
    useAdminSession.mockReturnValue(sessionMock())

    render(
      <MemoryRouter initialEntries={["/backend-errors"]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText("backend-errors-page")).toBeInTheDocument()
  })

  it("renders the performance dashboard for super admins", () => {
    useAdminSession.mockReturnValue(sessionMock())

    render(
      <MemoryRouter initialEntries={["/performance"]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText("performance-page")).toBeInTheDocument()
  })

  it("redirects non super admin users away from performance", () => {
    useAdminSession.mockReturnValue(sessionMock({ isSuperAdmin: false, globalRoles: ["user"] }))

    render(
      <MemoryRouter initialEntries={["/performance"]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText("forbidden-page")).toBeInTheDocument()
  })

  it("redirects non super admin users away from backend errors", () => {
    useAdminSession.mockReturnValue(sessionMock({ isSuperAdmin: false, globalRoles: ["user"] }))

    render(
      <MemoryRouter initialEntries={["/backend-errors"]}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText("forbidden-page")).toBeInTheDocument()
  })
})
