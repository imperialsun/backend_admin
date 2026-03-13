import { Route, Routes } from "react-router-dom"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  adminResetPassword: vi.fn(),
  useAdminSession: vi.fn(),
}))

vi.mock("@/lib/admin-client", () => ({
  adminResetPassword: mocks.adminResetPassword,
}))

vi.mock("@/lib/use-admin-session", () => ({
  useAdminSession: mocks.useAdminSession,
}))

import ResetPasswordPage from "@/routes/ResetPasswordPage"
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

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    mocks.adminResetPassword.mockReset()
    mocks.adminResetPassword.mockResolvedValue(undefined)
    mocks.useAdminSession.mockReset()
    mocks.useAdminSession.mockReturnValue(sessionMock())
  })

  it("rejects an invalid reset link", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ResetPasswordPage />,
      {
        route: "/reset-password",
        wrapper: (children) => (
          <Routes>
            <Route path="/reset-password" element={children} />
          </Routes>
        ),
      },
    )

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "NewPass123!")
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), "NewPass123!")
    await user.click(screen.getByRole("button", { name: "Mettre a jour" }))

    expect(screen.getByText("Le lien de reinitialisation est invalide ou incomplet.")).toBeInTheDocument()
    expect(mocks.adminResetPassword).not.toHaveBeenCalled()
  })

  it("submits the token and redirects to login on success", async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <ResetPasswordPage />,
      {
        route: "/reset-password?token=abc",
        wrapper: (children) => (
          <Routes>
            <Route path="/reset-password" element={children} />
            <Route path="/login" element={<div>login-target</div>} />
          </Routes>
        ),
      },
    )

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "NewPass123!")
    await user.type(screen.getByLabelText("Confirmer le mot de passe"), "NewPass123!")
    await user.click(screen.getByRole("button", { name: "Mettre a jour" }))

    await waitFor(() => expect(mocks.adminResetPassword).toHaveBeenCalledWith("abc", "NewPass123!"))
    expect(screen.getByText("login-target")).toBeInTheDocument()
  })
})
