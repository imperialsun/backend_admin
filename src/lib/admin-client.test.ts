import { beforeEach, describe, expect, it, vi } from "vitest"

const adminApiMocks = vi.hoisted(() => {
  class MockAdminHttpError extends Error {
    status: number
    path: string
    code: string

    constructor(params: { status: number; path: string; message: string; code: string }) {
      super(params.message)
      this.name = "AdminHttpError"
      this.status = params.status
      this.path = params.path
      this.code = params.code
    }
  }

  return {
    requestJson: vi.fn(),
    requestNoContent: vi.fn(),
    MockAdminHttpError,
  }
})

vi.mock("@/lib/admin-api", () => ({
  AdminHttpError: adminApiMocks.MockAdminHttpError,
  requestJson: adminApiMocks.requestJson,
  requestNoContent: adminApiMocks.requestNoContent,
}))

import { clearAdminCsrfToken, getAdminCsrfToken } from "@/lib/admin-security"
import {
  adminRequestPasswordReset,
  adminResetPassword,
  adminLogin,
  deleteUser,
  deleteUserActivity,
  adminLogout,
  adminRefresh,
  initializeAdminSession,
  fetchBackendErrorEvents,
  createUsersBulk,
  fetchUserActivitySummary,
  purgeBackendErrorEvents,
  sendUserPasswordResetEmail,
} from "@/lib/admin-client"

const { MockAdminHttpError, requestJson, requestNoContent } = adminApiMocks

const baseSession = {
  user: { id: "user-1", email: "admin@example.com", status: "active" },
  organization: { id: "org-1", name: "Org 1", code: "ORG1", status: "active" },
  globalRoles: ["super_admin"],
  orgRoles: ["org_admin"],
  permissions: ["feature.admin"],
  runtimeMode: "admin",
}

describe("admin-client", () => {
  beforeEach(() => {
    clearAdminCsrfToken()
    requestJson.mockReset()
    requestNoContent.mockReset()
  })

  it("stores the admin csrf token on login", async () => {
    requestJson.mockResolvedValue({
      ...baseSession,
      csrfToken: "csrf-login",
    })

    await expect(adminLogin({ email: "admin@example.com", password: "secret" })).resolves.toMatchObject(baseSession)
    expect(getAdminCsrfToken()).toBe("csrf-login")
  })

  it("falls back to refresh when /me returns 401", async () => {
    requestJson
      .mockRejectedValueOnce(
        new MockAdminHttpError({
          status: 401,
          path: "/admin/auth/me",
          message: "unauthorized",
          code: "http_401",
        }),
      )
      .mockResolvedValueOnce({
        ...baseSession,
        csrfToken: "csrf-refresh",
      })

    await expect(initializeAdminSession()).resolves.toMatchObject(baseSession)
    expect(getAdminCsrfToken()).toBe("csrf-refresh")
    expect(requestJson).toHaveBeenNthCalledWith(1, "/admin/auth/me")
    expect(requestJson).toHaveBeenNthCalledWith(
      2,
      "/admin/auth/refresh",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("returns null and clears csrf token when refresh returns 401", async () => {
    clearAdminCsrfToken()
    requestJson.mockRejectedValueOnce(
      new MockAdminHttpError({
        status: 401,
        path: "/admin/auth/refresh",
        message: "expired",
        code: "http_401",
      }),
    )

    await expect(adminRefresh()).resolves.toBeNull()
    expect(getAdminCsrfToken()).toBe("")
  })

  it("always clears csrf state on logout", async () => {
    requestNoContent.mockRejectedValueOnce(new Error("network down"))
    requestJson.mockResolvedValue({
      ...baseSession,
      csrfToken: "csrf-login",
    })

    await adminLogin({ email: "admin@example.com", password: "secret" })
    await expect(adminLogout()).rejects.toThrow("network down")
    expect(getAdminCsrfToken()).toBe("")
  })

  it("requests an admin password reset email through the public auth namespace", async () => {
    requestNoContent.mockResolvedValue(undefined)

    await expect(adminRequestPasswordReset("admin@example.com")).resolves.toBeUndefined()
    expect(requestNoContent).toHaveBeenCalledWith(
      "/admin/auth/forgot-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "admin@example.com" }),
      }),
    )
  })

  it("submits a new admin password with the reset token", async () => {
    requestNoContent.mockResolvedValue(undefined)

    await expect(adminResetPassword("reset-token", "NewPass123!")).resolves.toBeUndefined()
    expect(requestNoContent).toHaveBeenCalledWith(
      "/admin/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "reset-token", password: "NewPass123!" }),
      }),
    )
  })

  it("sends a back-office password reset email for a managed user", async () => {
    requestNoContent.mockResolvedValue(undefined)

    await expect(sendUserPasswordResetEmail("user-42")).resolves.toBeUndefined()
    expect(requestNoContent).toHaveBeenCalledWith(
      "/admin/users/user-42/password-reset-email",
      expect.objectContaining({ method: "POST" }),
    )
  })

  it("deletes a managed user through the admin namespace", async () => {
    requestNoContent.mockResolvedValue(undefined)

    await expect(deleteUser("user-42")).resolves.toBeUndefined()
    expect(requestNoContent).toHaveBeenCalledWith(
      "/admin/users/user-42",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("creates users in bulk through the admin namespace", async () => {
    requestJson.mockResolvedValue({
      created: [{ id: "user-1", email: "bulk@example.com", status: "active" }],
      failed: [],
    })

    await expect(
      createUsersBulk("org-1", ["bulk@example.com"], [
        { permissionCode: "feature.settings", effect: "deny" },
      ]),
    ).resolves.toMatchObject({
      created: [{ email: "bulk@example.com" }],
    })
    expect(requestJson).toHaveBeenCalledWith(
      "/admin/organizations/org-1/users/bulk",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          emails: ["bulk@example.com"],
          overrides: [{ permissionCode: "feature.settings", effect: "deny" }],
        }),
      }),
    )
  })

  it("fetches user activity summaries through the admin namespace", async () => {
    requestJson.mockResolvedValue({
      user: {
        id: "user-42",
        organizationId: "org-1",
        email: "user@example.com",
        status: "active",
        createdAt: "2026-03-01T09:00:00Z",
        updatedAt: "2026-03-01T09:00:00Z",
      },
      range: {
        from: "2026-03-01",
        to: "2026-03-31",
      },
      totals: {
        transcriptions: 2,
        reports: 1,
      },
      byDay: [],
      breakdown: {
        transcriptionsByMode: {},
        transcriptionsByProvider: {},
        reportsByMode: {},
        reportsByProvider: {},
      },
    })

    await expect(fetchUserActivitySummary("user-42", { from: "2026-03-01", to: "2026-03-31" })).resolves.toMatchObject({
      user: expect.objectContaining({ id: "user-42" }),
    })
    expect(requestJson).toHaveBeenCalledWith(
      "/admin/users/user-42/activity/summary?from=2026-03-01&to=2026-03-31",
    )
  })

  it("purges user activity through the admin namespace", async () => {
    requestNoContent.mockResolvedValue(undefined)

    await expect(deleteUserActivity("user-42")).resolves.toBeUndefined()
    expect(requestNoContent).toHaveBeenCalledWith(
      "/admin/users/user-42/activity",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("fetches backend errors through the admin namespace", async () => {
    requestJson.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 25,
    })

    await expect(
      fetchBackendErrorEvents({
        from: "2026-03-01",
        to: "2026-03-31",
        component: "admin",
        route: "/admin/backend-errors",
        q: "boom",
        organizationId: "org-1",
        page: 2,
        pageSize: 50,
      }),
    ).resolves.toMatchObject({ total: 0 })

    expect(requestJson).toHaveBeenCalledWith(
      "/admin/backend-errors?from=2026-03-01&to=2026-03-31&component=admin&route=%2Fadmin%2Fbackend-errors&q=boom&organizationId=org-1&page=2&pageSize=50",
    )
  })

  it("purges backend errors through the admin namespace", async () => {
    requestNoContent.mockResolvedValue(undefined)

    await expect(
      purgeBackendErrorEvents({
        from: "2026-03-01",
        to: "2026-03-31",
        component: "admin",
        route: "/admin/backend-errors",
        q: "boom",
        organizationId: "org-1",
      }),
    ).resolves.toBeUndefined()

    expect(requestNoContent).toHaveBeenCalledWith(
      "/admin/backend-errors?from=2026-03-01&to=2026-03-31&component=admin&route=%2Fadmin%2Fbackend-errors&q=boom&organizationId=org-1",
      expect.objectContaining({ method: "DELETE" }),
    )
  })
})
