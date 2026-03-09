import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const userPageMocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  fetchOrganizations: vi.fn(),
  fetchPermissionsCatalog: vi.fn(),
  fetchRolesCatalog: vi.fn(),
  fetchUserAccess: vi.fn(),
  fetchUsersByOrganization: vi.fn(),
  updateUser: vi.fn(),
  updateUserEntitlements: vi.fn(),
  updateUserGlobalRoles: vi.fn(),
  updateUserOrgRoles: vi.fn(),
  updateUserPassword: vi.fn(),
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  createUser: userPageMocks.createUser,
  fetchOrganizations: userPageMocks.fetchOrganizations,
  fetchPermissionsCatalog: userPageMocks.fetchPermissionsCatalog,
  fetchRolesCatalog: userPageMocks.fetchRolesCatalog,
  fetchUserAccess: userPageMocks.fetchUserAccess,
  fetchUsersByOrganization: userPageMocks.fetchUsersByOrganization,
  updateUser: userPageMocks.updateUser,
  updateUserEntitlements: userPageMocks.updateUserEntitlements,
  updateUserGlobalRoles: userPageMocks.updateUserGlobalRoles,
  updateUserOrgRoles: userPageMocks.updateUserOrgRoles,
  updateUserPassword: userPageMocks.updateUserPassword,
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: userPageMocks.useAdminSession,
}))

import UsersPage from "@/routes/UsersPage"
import { renderWithProviders } from "@/test/test-utils"

const {
  createUser,
  fetchOrganizations,
  fetchPermissionsCatalog,
  fetchRolesCatalog,
  fetchUserAccess,
  fetchUsersByOrganization,
  updateUser,
  updateUserEntitlements,
  updateUserGlobalRoles,
  updateUserOrgRoles,
  updateUserPassword,
  useAdminSession,
} = userPageMocks

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

const organizations = [
  {
    id: "org-1",
    name: "Clinique Alpha",
    code: "ALPHA",
    status: "active",
    createdAt: "2026-03-01T09:00:00Z",
    updatedAt: "2026-03-01T09:00:00Z",
  },
]

const users = [
  {
    id: "user-1",
    organizationId: "org-1",
    email: "medecin@example.com",
    status: "active",
    createdAt: "2026-03-01T09:00:00Z",
    updatedAt: "2026-03-01T09:00:00Z",
  },
]

const rolesCatalog = {
  global: [
    { code: "user", label: "Utilisateur" },
    { code: "super_admin", label: "Super Admin" },
  ],
  organization: [
    { code: "org_member", label: "Membre org" },
    { code: "org_admin", label: "Admin org" },
  ],
}

const permissionsCatalog = [
  { code: "feature.admin", label: "Admin panel", scope: "global" },
  { code: "feature.settings", label: "Settings", scope: "organization" },
]

const userAccess = {
  user: users[0],
  globalRoles: ["user"],
  orgRoles: ["org_member"],
  overrides: [],
  effectivePermissions: ["feature.settings"],
}

describe("UsersPage", () => {
  beforeEach(() => {
    createUser.mockReset()
    fetchOrganizations.mockReset()
    fetchPermissionsCatalog.mockReset()
    fetchRolesCatalog.mockReset()
    fetchUserAccess.mockReset()
    fetchUsersByOrganization.mockReset()
    updateUser.mockReset()
    updateUserEntitlements.mockReset()
    updateUserGlobalRoles.mockReset()
    updateUserOrgRoles.mockReset()
    updateUserPassword.mockReset()
    useAdminSession.mockReset()

    useAdminSession.mockReturnValue(sessionPayload)
    fetchOrganizations.mockResolvedValue(organizations)
    fetchUsersByOrganization.mockResolvedValue(users)
    fetchRolesCatalog.mockResolvedValue(rolesCatalog)
    fetchPermissionsCatalog.mockResolvedValue(permissionsCatalog)
    fetchUserAccess.mockResolvedValue(userAccess)
    createUser.mockResolvedValue({
      ...users[0],
      id: "user-2",
      email: "nouveau@example.com",
    })
    updateUser.mockResolvedValue(undefined)
    updateUserPassword.mockResolvedValue(undefined)
    updateUserGlobalRoles.mockResolvedValue(undefined)
    updateUserOrgRoles.mockResolvedValue(undefined)
    updateUserEntitlements.mockResolvedValue(undefined)
  })

  it("creates a user in the selected organization", async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1&user=user-1",
    })

    await screen.findByText("medecin@example.com")
    await user.type(screen.getByLabelText("Email", { selector: "#create-user-email" }), "nouveau@example.com")
    await user.type(screen.getByLabelText("Mot de passe initial"), "secret-123")
    await user.click(screen.getByRole("button", { name: "Créer l’utilisateur" }))

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith("org-1", {
        email: "nouveau@example.com",
        password: "secret-123",
        status: "active",
      }),
    )
  })

  it("updates profile, password, global roles and overrides", async () => {
    const user = userEvent.setup()
    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1&user=user-1",
    })

    await screen.findByText("Permissions effectives")

    const emailInput = screen.getByLabelText("Email", { selector: "#user-email" })
    await user.clear(emailInput)
    await user.type(emailInput, "medecin-chef@example.com")
    await user.click(screen.getByRole("button", { name: "Enregistrer le profil" }))

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith("user-1", {
        email: "medecin-chef@example.com",
        status: "active",
        organizationId: "org-1",
      }),
    )

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "reset-456")
    await user.click(screen.getByRole("button", { name: "Réinitialiser" }))
    await waitFor(() => expect(updateUserPassword).toHaveBeenCalledWith("user-1", "reset-456"))

    await user.click(screen.getByText("Super Admin"))
    await user.click(screen.getByRole("button", { name: "Enregistrer les rôles globaux" }))
    await waitFor(() => expect(updateUserGlobalRoles).toHaveBeenCalledWith("user-1", ["super_admin", "user"]))

    await user.selectOptions(screen.getByLabelText("Override feature.admin"), "allow")
    await user.click(screen.getByRole("button", { name: "Enregistrer les overrides" }))
    await waitFor(() =>
      expect(updateUserEntitlements).toHaveBeenCalledWith("user-1", [
        { permissionCode: "feature.admin", effect: "allow" },
      ]),
    )
  })

  it("hides global role editing for org admins", async () => {
    useAdminSession.mockReturnValue({
      ...sessionPayload,
      isSuperAdmin: false,
      session: {
        ...sessionPayload.session,
        globalRoles: ["user"],
      },
    })

    renderWithProviders(<UsersPage />, {
      route: "/users?user=user-1",
    })

    await screen.findByText("Permissions effectives")
    expect(screen.queryByText("Rôles globaux")).not.toBeInTheDocument()
  })
})
