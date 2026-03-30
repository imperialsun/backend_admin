import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useLocation } from "react-router-dom"

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
  { code: "feature.localupload", label: "Local upload", scope: "feature" },
  { code: "feature.cloudupload", label: "Cloud upload", scope: "feature" },
  { code: "feature.llmlocal", label: "LLM local", scope: "feature" },
  { code: "feature.llmapi", label: "LLM cloud", scope: "feature" },
  { code: "feature.admin", label: "Admin panel", scope: "global" },
  { code: "feature.settings", label: "Settings", scope: "organization" },
  { code: "feature.telemetry", label: "Telemetry", scope: "organization" },
  { code: "provider.cloud.whisper", label: "Cloud Whisper", scope: "provider_cloud" },
  { code: "provider.cloud.mistral", label: "Cloud Mistral", scope: "provider_cloud" },
  { code: "provider.cloud.demeter_sante", label: "Cloud Demeter Sante", scope: "provider_cloud" },
  { code: "provider.llm.huggingface", label: "LLM Hugging Face", scope: "provider_llm" },
  { code: "provider.llm.mistral", label: "LLM Mistral", scope: "provider_llm" },
  { code: "provider.llm.demeter_sante", label: "LLM Demeter Sante", scope: "provider_llm" },
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

function LocationProbe() {
  const location = useLocation()

  return <div data-testid="location-search">{location.search}</div>
}

async function openUserDetail(user: ReturnType<typeof userEvent.setup>, email: string) {
  const userEmail = await screen.findByText(email)
  const row = userEmail.closest("tr")
  expect(row).not.toBeNull()

  await user.click(within(row as HTMLTableRowElement).getByRole("button", { name: "Gérer" }))

  const dialog = await screen.findByRole("dialog", { name: email })
  await screen.findByText("Permissions effectives")
  return dialog
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
      route: "/users?org=org-1",
    })

    await screen.findByText("medecin@example.com")
    expect(screen.getByRole("progressbar", { name: "Sécurité du mot de passe" })).toHaveAttribute("aria-valuenow", "0")
    await user.type(screen.getByLabelText("Email", { selector: "#create-user-email" }), "nouveau@example.com")
    await user.type(screen.getByLabelText("Mot de passe initial"), "secret-123")
    expect(screen.getByRole("progressbar", { name: "Sécurité du mot de passe" })).toHaveAttribute("aria-valuenow", "3")
    await user.click(screen.getByRole("button", { name: "Créer l’utilisateur" }))

    await waitFor(() =>
      expect(createUser).toHaveBeenCalledWith("org-1", {
        email: "nouveau@example.com",
        password: "secret-123",
        status: "active",
      }),
    )
  })

  it("defaults the bulk permission template to Cloud Demeter Only", async () => {
    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1",
    })

    await screen.findByText("medecin@example.com")
    expect(screen.getByLabelText("Modèle de permissions")).toHaveValue("cloud_demeter_only")
    expect(screen.getByLabelText("Override feature.cloudupload")).toHaveValue("allow")
    expect(screen.getByLabelText("Override feature.settings")).toHaveValue("deny")
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
      route: "/users?org=org-1",
    })

    await screen.findByText("medecin@example.com")
    await user.selectOptions(screen.getByLabelText("Modèle de permissions"), "full")
    expect(screen.getByLabelText("Override feature.settings")).toHaveValue("allow")
    await user.selectOptions(screen.getByLabelText("Override feature.settings"), "deny")
    await user.type(
      screen.getByLabelText("Emails", { selector: "#bulk-user-emails" }),
      "bulk.one@example.com\nbulk.two@example.com, bulk.one@example.com;bad@example.com",
    )
    await user.click(screen.getByRole("button", { name: "Créer les comptes" }))

    await waitFor(() =>
      expect(createUsersBulk).toHaveBeenCalledWith(
        "org-1",
        ["bulk.one@example.com", "bulk.two@example.com", "bad@example.com"],
        expect.arrayContaining([
          { permissionCode: "feature.cloudupload", effect: "allow" },
          { permissionCode: "feature.settings", effect: "deny" },
        ]),
      ),
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
      route: "/users?org=org-1",
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
    await screen.findByText(/Compte ciblé: user-2\./)
    await screen.findByRole("dialog", { name: "assistant@example.com" })
  })

  it("surfaces backend delete errors from the table action", async () => {
    const user = userEvent.setup()
    deleteUser.mockRejectedValueOnce(new Error("cannot delete the last active super admin"))

    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1",
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
      route: "/users?org=org-1",
    })

    const dialog = await openUserDetail(user, "medecin@example.com")

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

    expect(screen.getAllByRole("progressbar", { name: "Sécurité du mot de passe" })).toHaveLength(2)
    await user.type(screen.getByLabelText("Nouveau mot de passe"), "reset-456")
    expect(
      screen.getAllByRole("progressbar", { name: "Sécurité du mot de passe" }).some(
        (element) => element.getAttribute("aria-valuenow") === "3",
      ),
    ).toBe(true)
    await user.click(screen.getByRole("button", { name: "Réinitialiser" }))
    await waitFor(() => expect(updateUserPassword).toHaveBeenCalledWith("user-1", "reset-456"))

    await user.click(screen.getByRole("button", { name: "Envoyer un email de réinitialisation" }))
    await waitFor(() => expect(sendUserPasswordResetEmail).toHaveBeenCalledWith("user-1"))

    await user.click(screen.getByText("Super Admin"))
    await user.click(screen.getByRole("button", { name: "Enregistrer les rôles globaux" }))
    await waitFor(() => expect(updateUserGlobalRoles).toHaveBeenCalledWith("user-1", ["super_admin", "user"]))

    await user.selectOptions(within(dialog).getByLabelText("Override feature.admin"), "allow")
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
      route: "/users?org=org-1",
    })

    await openUserDetail(user, "medecin@example.com")
    await user.click(screen.getByRole("button", { name: "Supprimer l’utilisateur" }))

    expect(screen.getByText(/Cette action est irréversible/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Confirmer la suppression" }))

    await waitFor(() => expect(deleteUser).toHaveBeenCalledWith("user-1"))
    await screen.findByText("Utilisateur supprimé.")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByText("Aucun utilisateur trouvé pour ce filtre.")).toBeInTheDocument()
  })

  it("surfaces backend delete errors without leaving the page", async () => {
    const user = userEvent.setup()
    deleteUser.mockRejectedValueOnce(new Error("cannot delete the last active super admin"))

    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1",
    })

    await openUserDetail(user, "medecin@example.com")
    await user.click(screen.getByRole("button", { name: "Supprimer l’utilisateur" }))
    await user.click(screen.getByRole("button", { name: "Confirmer la suppression" }))

    await screen.findByText("cannot delete the last active super admin")
    expect(screen.getByRole("button", { name: "Confirmer la suppression" })).toBeInTheDocument()
  })

  it("renders activity data and purges it from the user panel", async () => {
    const user = userEvent.setup()
    deleteUserActivity.mockResolvedValue(undefined)

    renderWithProviders(<UsersPage />, {
      route: "/users?org=org-1",
    })

    await openUserDetail(user, "medecin@example.com")
    await screen.findByText("Activité utilisateur")
    await screen.findByText("2026-03-01")

    await user.click(screen.getByRole("button", { name: "Purger l’activité" }))
    expect(screen.getByText(/effacer définitivement l’historique de ce compte/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Confirmer la purge" }))

    await waitFor(() => expect(deleteUserActivity).toHaveBeenCalledWith("user-1"))
    await screen.findByText("Activité utilisateur supprimée.")
  })

  it("opens the user modal from Gérer and preserves org and search filters when closing", async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <>
        <LocationProbe />
        <UsersPage />
      </>,
      {
        route: "/users?org=org-1&q=medecin",
      },
    )

    const dialog = await openUserDetail(user, "medecin@example.com")
    expect(dialog).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: "Fermer" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByTestId("location-search")).toHaveTextContent("?org=org-1&q=medecin")
    expect(screen.getByRole("button", { name: "Gérer" })).toBeInTheDocument()
  })
})
