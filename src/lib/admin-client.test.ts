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
  adminLogin,
  adminLogout,
  adminRefresh,
  initializeAdminSession,
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
})
