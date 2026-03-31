import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const adminClientMocks = vi.hoisted(() => ({
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
  adminRefresh: vi.fn(),
  initializeAdminSession: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  adminLogin: adminClientMocks.adminLogin,
  adminLogout: adminClientMocks.adminLogout,
  adminRefresh: adminClientMocks.adminRefresh,
  initializeAdminSession: adminClientMocks.initializeAdminSession,
}))

import { AdminSessionProvider } from "@/lib/admin-session-context"
import { useAdminSession } from "@/lib/use-admin-session"
import { renderWithProviders } from "@/test/test-utils"

const { adminLogin, adminLogout, initializeAdminSession } = adminClientMocks

function SessionProbe() {
  const { loading, session, isSuperAdmin, isOrgAdmin, login, logout, refresh } = useAdminSession()

  return (
    <div>
      <p data-testid="loading">{String(loading)}</p>
      <p data-testid="email">{session?.user.email ?? "none"}</p>
      <p data-testid="super">{String(isSuperAdmin)}</p>
      <p data-testid="org">{String(isOrgAdmin)}</p>
      <button onClick={() => void login("admin@example.com", "secret")} type="button">
        login
      </button>
      <button onClick={() => void logout()} type="button">
        logout
      </button>
      <button onClick={() => void refresh().catch(() => {})} type="button">
        refresh
      </button>
    </div>
  )
}

const sessionPayload = {
  user: { id: "user-1", email: "admin@example.com", status: "active" },
  organization: { id: "org-1", name: "Org 1", code: "ORG1", status: "active" },
  globalRoles: ["super_admin"],
  orgRoles: ["org_admin"],
  permissions: ["feature.admin"],
  runtimeMode: "admin",
  csrfToken: "csrf",
}

describe("AdminSessionProvider", () => {
  beforeEach(() => {
    adminLogin.mockReset()
    adminLogout.mockReset()
    initializeAdminSession.mockReset()
  })

  it("boots the admin session and derives role flags", async () => {
    initializeAdminSession.mockResolvedValue(sessionPayload)

    renderWithProviders(
      <AdminSessionProvider>
        <SessionProbe />
      </AdminSessionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"))
    expect(screen.getByTestId("email")).toHaveTextContent("admin@example.com")
    expect(screen.getByTestId("super")).toHaveTextContent("true")
    expect(screen.getByTestId("org")).toHaveTextContent("true")
  })

  it("updates session state on login and logout", async () => {
    initializeAdminSession.mockResolvedValue(null)
    adminLogin.mockResolvedValue(sessionPayload)
    adminLogout.mockResolvedValue(undefined)
    const user = userEvent.setup()

    renderWithProviders(
      <AdminSessionProvider>
        <SessionProbe />
      </AdminSessionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"))
    expect(screen.getByTestId("email")).toHaveTextContent("none")

    await user.click(screen.getByRole("button", { name: "login" }))
    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("admin@example.com"))

    await user.click(screen.getByRole("button", { name: "logout" }))
    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("none"))
  })

  it("clears the session when refresh fails", async () => {
    initializeAdminSession.mockResolvedValueOnce(sessionPayload)
    initializeAdminSession.mockRejectedValueOnce(new Error("refresh failed"))
    const user = userEvent.setup()

    renderWithProviders(
      <AdminSessionProvider>
        <SessionProbe />
      </AdminSessionProvider>,
    )

    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"))
    expect(screen.getByTestId("email")).toHaveTextContent("admin@example.com")

    await user.click(screen.getByRole("button", { name: "refresh" }))
    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("none"))
  })
})
