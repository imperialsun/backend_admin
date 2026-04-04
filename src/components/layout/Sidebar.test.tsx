import { screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const sessionMocks = vi.hoisted(() => ({
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: sessionMocks.useAdminSession,
}))

import { Sidebar } from "@/components/layout/Sidebar"
import { renderWithProviders } from "@/test/test-utils"

const { useAdminSession } = sessionMocks

function sessionMock(overrides?: Partial<ReturnType<typeof useAdminSession>>) {
  return {
    session: {
      user: { id: "user-1", email: "admin@example.com", status: "active" },
      organization: { id: "org-1", name: "Org 1", code: "ORG1", status: "active" },
      globalRoles: ["super_admin"],
      orgRoles: ["org_admin"],
      permissions: ["feature.admin"],
      runtimeMode: "admin",
    },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    isSuperAdmin: true,
    isOrgAdmin: true,
    hasPermission: vi.fn().mockReturnValue(true),
    ...overrides,
  }
}

describe("Sidebar", () => {
  beforeEach(() => {
    useAdminSession.mockReset()
  })

  it("renders the Demeter Santé logo in the branded header", () => {
    useAdminSession.mockReturnValue(sessionMock())

    renderWithProviders(<Sidebar />, {
      route: "/dashboard",
    })

    expect(screen.getByAltText("Logo Demeter Santé")).toHaveAttribute("src", "/logo.png")
    expect(screen.getByText("Admin Panel")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Performance" })).toHaveAttribute("href", "/performance")
    expect(screen.getByRole("link", { name: "Erreurs backend" })).toHaveAttribute("href", "/backend-errors")
  })

  it("hides backend errors for non super admins", () => {
    useAdminSession.mockReturnValue(sessionMock({ isSuperAdmin: false, globalRoles: ["user"] }))

    renderWithProviders(<Sidebar />, {
      route: "/dashboard",
    })

    expect(screen.queryByRole("link", { name: "Performance" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Erreurs backend" })).not.toBeInTheDocument()
  })
})
