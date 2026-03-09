import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const organizationClientMocks = vi.hoisted(() => ({
  createOrganization: vi.fn(),
  fetchOrganizations: vi.fn(),
  updateOrganization: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  createOrganization: organizationClientMocks.createOrganization,
  fetchOrganizations: organizationClientMocks.fetchOrganizations,
  updateOrganization: organizationClientMocks.updateOrganization,
}))

import OrganizationsPage from "@/routes/OrganizationsPage"
import { renderWithProviders } from "@/test/test-utils"

const { createOrganization, fetchOrganizations, updateOrganization } = organizationClientMocks

const orgRecord = {
  id: "org-1",
  name: "Clinique Alpha",
  code: "ALPHA",
  status: "active",
  createdAt: "2026-03-01T09:00:00Z",
  updatedAt: "2026-03-01T09:00:00Z",
}

describe("OrganizationsPage", () => {
  beforeEach(() => {
    createOrganization.mockReset()
    fetchOrganizations.mockReset()
    updateOrganization.mockReset()
    fetchOrganizations.mockResolvedValue([orgRecord])
    createOrganization.mockResolvedValue({
      ...orgRecord,
      id: "org-2",
      name: "Clinique Beta",
      code: "BETA",
    })
    updateOrganization.mockResolvedValue({
      ...orgRecord,
      name: "Clinique Alpha 2",
    })
  })

  it("creates a new organization", async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrganizationsPage />)

    await screen.findByText("Clinique Alpha")
    await user.type(screen.getByLabelText("Nom"), "Clinique Beta")
    await user.type(screen.getByLabelText("Code"), "BETA")
    await user.click(screen.getByRole("button", { name: "Créer" }))

    await waitFor(() =>
      expect(createOrganization).toHaveBeenCalledWith(
        {
          name: "Clinique Beta",
          code: "BETA",
          status: "active",
        },
        expect.anything(),
      ),
    )
  })

  it("updates an existing organization", async () => {
    const user = userEvent.setup()
    renderWithProviders(<OrganizationsPage />)

    await screen.findByText("Clinique Alpha")
    await user.click(screen.getByRole("button", { name: "Éditer" }))

    const editableName = screen.getAllByDisplayValue("Clinique Alpha")[0]
    await user.clear(editableName)
    await user.type(editableName, "Clinique Alpha 2")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))

    await waitFor(() =>
      expect(updateOrganization).toHaveBeenCalledWith("org-1", {
        name: "Clinique Alpha 2",
        code: "ALPHA",
        status: "active",
      }),
    )
  })
})
