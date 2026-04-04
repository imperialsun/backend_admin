import { fireEvent, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Route, Routes } from "react-router-dom"

const settingsPageMocks = vi.hoisted(() => ({
  fetchOrganizations: vi.fn(),
  fetchUserAccess: vi.fn(),
  fetchUserSettings: vi.fn(),
  resetUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  fetchOrganizations: settingsPageMocks.fetchOrganizations,
  fetchUserAccess: settingsPageMocks.fetchUserAccess,
  fetchUserSettings: settingsPageMocks.fetchUserSettings,
  resetUserSettings: settingsPageMocks.resetUserSettings,
  updateUserSettings: settingsPageMocks.updateUserSettings,
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: settingsPageMocks.useAdminSession,
}))

import UserSettingsPage from "@/routes/UserSettingsPage"
import { renderWithProviders } from "@/test/test-utils"

const {
  fetchOrganizations,
  fetchUserAccess,
  fetchUserSettings,
  resetUserSettings,
  updateUserSettings,
  useAdminSession,
} = settingsPageMocks

describe("UserSettingsPage", () => {
  beforeEach(() => {
    fetchOrganizations.mockReset()
    fetchUserAccess.mockReset()
    fetchUserSettings.mockReset()
    resetUserSettings.mockReset()
    updateUserSettings.mockReset()
    useAdminSession.mockReset()

    useAdminSession.mockReturnValue({
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
    })

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
    fetchUserAccess.mockResolvedValue({
      user: {
        id: "user-1",
        organizationId: "org-1",
        email: "medecin@example.com",
        status: "active",
        createdAt: "2026-03-01T09:00:00Z",
        updatedAt: "2026-03-01T09:00:00Z",
      },
      globalRoles: ["user"],
      orgRoles: ["org_member"],
      overrides: [],
      effectivePermissions: ["feature.settings"],
    })
    fetchUserSettings.mockResolvedValue({
      version: 2,
      schemaVersion: 1,
      updatedAt: "2026-03-21T10:00:00.000Z",
      settings: {
        activePreset: "balanced",
        showSegments: true,
        chunkDurationSec: 15,
        progressiveSegmentDurationSec: 600,
        cloudTemperature: 0.2,
        cloudTopP: 0.9,
      },
    })
    updateUserSettings.mockResolvedValue({
      version: 3,
      schemaVersion: 1,
      updatedAt: "2026-03-21T11:00:00.000Z",
      settings: {
        activePreset: "custom",
        showSegments: true,
        chunkDurationSec: 15,
        progressiveSegmentDurationSec: 600,
        cloudTemperature: 0.2,
        cloudTopP: 0.9,
      },
    })
    resetUserSettings.mockResolvedValue({
      version: 4,
      schemaVersion: 1,
      updatedAt: "2026-03-21T11:30:00.000Z",
      settings: {},
    })
  })

  it("loads and saves user settings through the admin backend", async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/users/:id/settings" element={<UserSettingsPage />} />
      </Routes>,
      { route: "/users/user-1/settings" },
    )

    await screen.findByRole("heading", { name: "medecin@example.com" })
    expect(screen.getByLabelText("Preset actif")).toHaveValue("balanced")
    expect(screen.getByLabelText("Durée chunk (s)")).toHaveAttribute("min", "5")
    expect(screen.getByLabelText("Durée chunk (s)")).toHaveAttribute("max", "120")
    expect(screen.getByLabelText("Durée chunk (s)")).toHaveAttribute("step", "5")
    expect(screen.getByLabelText("Température cloud")).toHaveAttribute("min", "0")
    expect(screen.getByLabelText("Température cloud")).toHaveAttribute("max", "2")
    expect(screen.getByLabelText("Température cloud")).toHaveAttribute("step", "0.1")
    expect(screen.getByLabelText("Preset actif")).toHaveTextContent("Équilibre")

    await user.selectOptions(screen.getByLabelText("Preset actif"), "custom")
    fireEvent.change(screen.getByLabelText("Durée chunk (s)"), { target: { value: "3" } })
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    expect(updateUserSettings).toHaveBeenCalledWith("user-1", {
      schemaVersion: 1,
      settings: expect.objectContaining({
        activePreset: "custom",
        showSegments: true,
        chunkDurationSec: 5,
        progressiveSegmentDurationSec: 600,
        cloudTemperature: 0.2,
        cloudTopP: 0.9,
      }),
    })
  })

  it("resets user settings through the admin backend", async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/users/:id/settings" element={<UserSettingsPage />} />
      </Routes>,
      { route: "/users/user-1/settings" },
    )

    await screen.findByRole("heading", { name: "medecin@example.com" })
    await user.click(screen.getByRole("button", { name: "Réinitialiser" }))

    expect(resetUserSettings).toHaveBeenCalledWith("user-1")
  })

  it("rejects invalid JSON values outside the frontend schema", async () => {
    renderWithProviders(
      <Routes>
        <Route path="/users/:id/settings" element={<UserSettingsPage />} />
      </Routes>,
      { route: "/users/user-1/settings" },
    )

    await screen.findByRole("heading", { name: "medecin@example.com" })
    const jsonEditor = screen.getByLabelText("JSON complet")
    fireEvent.change(jsonEditor, {
      target: {
        value: JSON.stringify({
          activePreset: "unknown",
          progressiveSegmentDurationSec: 777,
        }),
      },
    })

    expect(screen.getByText(/JSON invalide pour les réglages/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled()
  })
})
