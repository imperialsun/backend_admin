import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const userPageMocks = vi.hoisted(() => ({
  createUser: vi.fn(),
  createUsersBulk: vi.fn(),
  deleteUser: vi.fn(),
  deleteUserActivity: vi.fn(),
  fetchOrganizations: vi.fn(),
  fetchPermissionsCatalog: vi.fn(),
  fetchRolesCatalog: vi.fn(),
  fetchUserActivitySummary: vi.fn(),
  fetchUserAccess: vi.fn(),
  fetchUsersByOrganization: vi.fn(),
  sendUserPasswordResetEmail: vi.fn(),
  updateUser: vi.fn(),
  updateUserEntitlements: vi.fn(),
  updateUserGlobalRoles: vi.fn(),
  updateUserOrgRoles: vi.fn(),
  updateUserPassword: vi.fn(),
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  createUser: userPageMocks.createUser,
  createUsersBulk: userPageMocks.createUsersBulk,
  deleteUser: userPageMocks.deleteUser,
  deleteUserActivity: userPageMocks.deleteUserActivity,
  fetchOrganizations: userPageMocks.fetchOrganizations,
  fetchPermissionsCatalog: userPageMocks.fetchPermissionsCatalog,
  fetchRolesCatalog: userPageMocks.fetchRolesCatalog,
  fetchUserActivitySummary: userPageMocks.fetchUserActivitySummary,
  fetchUserAccess: userPageMocks.fetchUserAccess,
  fetchUsersByOrganization: userPageMocks.fetchUsersByOrganization,
  sendUserPasswordResetEmail: userPageMocks.sendUserPasswordResetEmail,
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
  createUsersBulk,
  deleteUser,
  deleteUserActivity,
  fetchOrganizations,
  fetchPermissionsCatalog,
  fetchRolesCatalog,
  fetchUserActivitySummary,
  fetchUserAccess,
  fetchUsersByOrganization,
  sendUserPasswordResetEmail,
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

const secondaryUser = {
  id: "user-2",
  organizationId: "org-1",
  email: "assistant@example.com",
  status: "active",
  createdAt: "2026-03-02T09:00:00Z",
  updatedAt: "2026-03-02T09:00:00Z",
}

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

const secondaryUserAccess = {
  user: secondaryUser,
  globalRoles: ["user"],
  orgRoles: ["org_member"],
  overrides: [],
  effectivePermissions: ["feature.settings"],
}

function buildActivitySummary(user: { id: string; organizationId: string; email: string; status: string; createdAt: string; updatedAt: string }) {
  return {
    user,
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
  }
}

describe("UsersPage", () => {
  beforeEach(() => {
    createUser.mockReset()
    createUsersBulk.mockReset()
    deleteUser.mockReset()
    deleteUserActivity.mockReset()
    fetchOrganizations.mockReset()
    fetchPermissionsCatalog.mockReset()
    fetchRolesCatalog.mockReset()
    fetchUserActivitySummary.mockReset()
    fetchUserAccess.mockReset()
    fetchUsersByOrganization.mockReset()
    sendUserPasswordResetEmail.mockReset()
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
    fetchUserActivitySummary.mockImplementation(async (userId: string) =>
      Promise.resolve(userId === users[0].id ? buildActivitySummary(users[0]) : buildActivitySummary(secondaryUser)),
    )
    fetchUserAccess.mockImplementation(async (userId: string) =>
      Promise.resolve(userId === users[0].id ? userAccess : secondaryUserAccess),
    )
    createUser.mockResolvedValue({
      ...users[0],
      id: "user-2",
      email: "nouveau@example.com",
    })
    createUsersBulk.mockResolvedValue({
      created: [],
      failed: [],
    })
    deleteUser.mockResolvedValue(undefined)
    sendUserPasswordResetEmail.mockResolvedValue(undefined)
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

  it("creates multiple users from the bulk textarea and displays the result", async () => {
    const user = userEvent.setup()
    createUsersBulk.mockResolvedValue({
      created: [
        {
          id: "user-2",
          email: "bulk.one@example.com",
          status: "active",
        },
        {
          id: "user-3",
          email: "bulk.two@example.com",
          status: "active",
        },
      ],
      failed: [
        {
          email: "bad@example.com",
          error: "invalid email",
        },
      ],
    })

    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1&user=user-1",
    })

    await screen.findByText("medecin@example.com")
    await user.type(
      screen.getByLabelText("Emails", { selector: "#bulk-user-emails" }),
      "bulk.one@example.com\nbulk.two@example.com, bulk.one@example.com;bad@example.com",
    )
    await user.click(screen.getByRole("button", { name: "Créer les comptes" }))

    await waitFor(() =>
      expect(createUsersBulk).toHaveBeenCalledWith("org-1", [
        "bulk.one@example.com",
        "bulk.two@example.com",
        "bad@example.com",
      ]),
    )
    await screen.findByText("2 comptes créés, 1 échec.")
    expect(screen.getByText("Comptes créés")).toBeInTheDocument()
    expect(screen.getByText("Échecs")).toBeInTheDocument()
    expect(screen.getByText("bulk.one@example.com")).toBeInTheDocument()
    expect(screen.getByText("bad@example.com")).toBeInTheDocument()
  })

  it("deletes a user from the table and selects the next visible user", async () => {
    const user = userEvent.setup()
    fetchUsersByOrganization.mockResolvedValueOnce([users[0], secondaryUser]).mockResolvedValueOnce([secondaryUser])

    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1&user=user-1",
    })

    const firstUserEmail = await screen.findByText("medecin@example.com")
    const row = firstUserEmail.closest("tr")
    expect(row).not.toBeNull()
    const rowElement = row as HTMLTableRowElement

    await user.click(within(rowElement).getByRole("button", { name: "Supprimer" }))
    expect(within(rowElement).getByRole("button", { name: "Annuler" })).toBeInTheDocument()
    expect(
      within(rowElement).getByRole("button", { name: "Confirmer la suppression" }),
    ).toBeInTheDocument()

    await user.click(within(rowElement).getByRole("button", { name: "Confirmer la suppression" }))

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith("user-1"))
    await screen.findByText("Utilisateur supprimé.")
    expect(screen.queryByText("medecin@example.com")).not.toBeInTheDocument()
    expect(screen.getByText(/Compte ciblé: user-2\./)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sélectionné" })).toBeInTheDocument()
  })

  it("surfaces backend delete errors from the table action", async () => {
    const user = userEvent.setup()
    deleteUser.mockRejectedValueOnce(new Error("cannot delete the last active super admin"))

    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1&user=user-1",
    })

    const firstUserEmail = await screen.findByText("medecin@example.com")
    const row = firstUserEmail.closest("tr")
    expect(row).not.toBeNull()
    const rowElement = row as HTMLTableRowElement

    await user.click(within(rowElement).getByRole("button", { name: "Supprimer" }))
    await user.click(within(rowElement).getByRole("button", { name: "Confirmer la suppression" }))

    await screen.findByText("cannot delete the last active super admin")
    expect(within(rowElement).getByRole("button", { name: "Annuler" })).toBeInTheDocument()
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

    await user.click(screen.getByRole("button", { name: "Envoyer un email de réinitialisation" }))
    await waitFor(() => expect(sendUserPasswordResetEmail).toHaveBeenCalledWith("user-1"))

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

  it("confirms and deletes the selected user", async () => {
    const user = userEvent.setup()
    fetchUsersByOrganization.mockResolvedValueOnce(users).mockResolvedValueOnce([])

    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1&user=user-1",
    })

    await screen.findByText("Permissions effectives")
    await user.click(screen.getByRole("button", { name: "Supprimer l’utilisateur" }))

    expect(screen.getByText(/Cette action est irréversible/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Confirmer la suppression" }))

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith("user-1"))
    await screen.findByText("Utilisateur supprimé.")
    expect(
      screen.getByText("Sélectionnez un utilisateur pour modifier ses rôles, son rattachement ou ses overrides."),
    ).toBeInTheDocument()
  })

  it("surfaces backend delete errors without leaving the page", async () => {
    const user = userEvent.setup()
    deleteUser.mockRejectedValueOnce(new Error("cannot delete the last active super admin"))

    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1&user=user-1",
    })

    await screen.findByText("Permissions effectives")
    await user.click(screen.getByRole("button", { name: "Supprimer l’utilisateur" }))
    await user.click(screen.getByRole("button", { name: "Confirmer la suppression" }))

    await screen.findByText("cannot delete the last active super admin")
    expect(screen.getByRole("button", { name: "Confirmer la suppression" })).toBeInTheDocument()
  })

  it("renders activity data and purges it from the user panel", async () => {
    const user = userEvent.setup()
    deleteUserActivity.mockResolvedValue(undefined)

    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1&user=user-1",
    })

    await screen.findByText("Activité utilisateur")
    await screen.findByText("2026-03-01")

    await user.click(screen.getByRole("button", { name: "Purger l’activité" }))
    expect(screen.getByText(/effacer définitivement l’historique de ce compte/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Confirmer la purge" }))

    await waitFor(() => expect(deleteUserActivity).toHaveBeenCalledWith("user-1"))
    await screen.findByText("Activité utilisateur supprimée.")
  })
})
