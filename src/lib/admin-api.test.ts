import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearAdminCsrfToken, setAdminCsrfToken } from "@/lib/admin-security"
import { adminFetch, parseJson, requestJson, toAdminHttpError } from "@/lib/admin-api"
import { resetRuntimeConfigForTests } from "@/lib/runtime-config"

describe("admin-api", () => {
  beforeEach(() => {
    resetRuntimeConfigForTests()
    clearAdminCsrfToken()
    window.__APP_RUNTIME_CONFIG__ = {
      backendBaseUrl: "https://admin-api.example.test/api/v1",
    }
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetRuntimeConfigForTests()
    clearAdminCsrfToken()
  })

  it("adds credentials and admin csrf header on mutating requests", async () => {
    setAdminCsrfToken("csrf-admin-123")
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await requestJson("/admin/users/user-1", {
      method: "PUT",
      body: JSON.stringify({ status: "inactive" }),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://admin-api.example.test/api/v1/admin/users/user-1",
      expect.objectContaining({
        credentials: "include",
        method: "PUT",
        headers: expect.any(Headers),
      }),
    )

    const [, init] = fetchMock.mock.calls[0]
    const headers = init?.headers as Headers
    expect(headers.get("Accept")).toBe("application/json")
    expect(headers.get("Content-Type")).toBe("application/json")
    expect(headers.get("X-Admin-CSRF")).toBe("csrf-admin-123")
  })

  it("does not add csrf header on read requests", async () => {
    setAdminCsrfToken("csrf-admin-123")
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    await adminFetch("/admin/auth/me")

    const [, init] = fetchMock.mock.calls[0]
    const headers = init?.headers as Headers
    expect(headers.get("X-Admin-CSRF")).toBeNull()
  })

  it("parses structured backend errors", async () => {
    const error = await toAdminHttpError(
      new Response(JSON.stringify({ error: "forbidden organization scope" }), {
        status: 403,
      }),
      "/admin/users/user-1",
    )

    expect(error.status).toBe(403)
    expect(error.path).toBe("/admin/users/user-1")
    expect(error.code).toBe("forbidden_organization_scope")
    expect(error.message).toBe("forbidden organization scope")
  })

  it("wraps network failures in a typed admin error", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"))

    await expect(requestJson("/admin/auth/login", { method: "POST" })).rejects.toMatchObject({
      name: "AdminHttpError",
      status: 0,
      path: "/admin/auth/login",
      code: "network_error",
    })
  })

  it("returns an empty object when parsing an empty body", async () => {
    await expect(parseJson(new Response(null, { status: 204 }))).resolves.toEqual({})
  })
})
