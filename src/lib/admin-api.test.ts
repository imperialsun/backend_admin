import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitFor } from "@testing-library/react"

import { clearAdminCsrfToken, setAdminCsrfToken } from "@/lib/admin-security"
import { adminFetch, parseJson, requestJson, toAdminHttpError } from "@/lib/admin-api"
import {
  resetAdminSessionRefreshBridgeForTests,
  setAdminSessionRefreshHandler,
} from "@/lib/admin-session-refresh"
import { resetRuntimeConfigForTests } from "@/lib/runtime-config"

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe("admin-api", () => {
  beforeEach(() => {
    resetAdminSessionRefreshBridgeForTests()
    resetRuntimeConfigForTests()
    clearAdminCsrfToken()
    window.__APP_RUNTIME_CONFIG__ = {
      backendBaseUrl: "https://admin-api.example.test/api/v1",
    }
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetAdminSessionRefreshBridgeForTests()
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
    expect(init?.cache).toBe("no-store")
  })

  it("retries a 401 after refreshing the admin session and rebuilds the csrf header", async () => {
    const fetchMock = vi.mocked(fetch)
    const refreshedSession = {
      csrfToken: "csrf-refresh",
      globalRoles: ["super_admin"],
      organization: { id: "org-1", name: "Org 1", code: "ORG1", status: "active" },
      orgRoles: ["org_admin"],
      permissions: ["feature.admin"],
      runtimeMode: "admin",
      user: { id: "user-1", email: "admin@example.com", status: "active" },
    }

    setAdminCsrfToken("csrf-stale")
    fetchMock
      .mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const refreshHandler = vi.fn(async () => {
      setAdminCsrfToken(refreshedSession.csrfToken)
      return refreshedSession
    })
    setAdminSessionRefreshHandler(refreshHandler)

    await expect(
      requestJson("/admin/users/user-1", {
        method: "PUT",
        body: JSON.stringify({ status: "inactive" }),
      }),
    ).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(refreshHandler).toHaveBeenCalledTimes(1)

    const firstHeaders = fetchMock.mock.calls[0][1]?.headers as Headers
    const secondHeaders = fetchMock.mock.calls[1][1]?.headers as Headers
    expect(firstHeaders.get("X-Admin-CSRF")).toBe("csrf-stale")
    expect(secondHeaders.get("X-Admin-CSRF")).toBe("csrf-refresh")
  })

  it("does not recurse when the refresh endpoint itself returns 401", async () => {
    const fetchMock = vi.mocked(fetch)
    const refreshHandler = vi.fn()
    setAdminSessionRefreshHandler(refreshHandler)
    fetchMock.mockResolvedValue(new Response("Unauthorized", { status: 401 }))

    await expect(
      requestJson("/admin/auth/refresh", {
        method: "POST",
        allowSessionRefresh: false,
      }),
    ).rejects.toMatchObject({
      name: "AdminHttpError",
      status: 401,
      path: "/admin/auth/refresh",
    })

    expect(refreshHandler).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("throws the original 401 when session refresh fails", async () => {
    const fetchMock = vi.mocked(fetch)
    const refreshHandler = vi.fn(async () => {
      throw new Error("refresh failed")
    })
    setAdminSessionRefreshHandler(refreshHandler)
    fetchMock.mockResolvedValueOnce(new Response("Unauthorized", { status: 401 }))

    await expect(requestJson("/admin/organizations")).rejects.toMatchObject({
      name: "AdminHttpError",
      status: 401,
      path: "/admin/organizations",
    })

    expect(refreshHandler).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("deduplicates concurrent refresh attempts", async () => {
    const fetchMock = vi.mocked(fetch)
    let requestCount = 0
    const refreshDeferred = createDeferred<{
      csrfToken: string
      globalRoles: string[]
      orgRoles: string[]
      permissions: string[]
      runtimeMode: string
      user: { id: string; email: string; status: string }
      organization: { id: string; name: string; code: string; status: string }
    }>()

    fetchMock.mockImplementation(async () => {
      requestCount += 1
      if (requestCount <= 2) {
        return new Response("Unauthorized", { status: 401 })
      }
      return new Response(JSON.stringify([{ id: "org-1", name: "Org 1" }]), { status: 200 })
    })

    const refreshHandler = vi.fn(async () => refreshDeferred.promise)
    setAdminSessionRefreshHandler(refreshHandler)

    const firstRequest = requestJson("/admin/organizations")
    const secondRequest = requestJson("/admin/organizations")

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(refreshHandler).toHaveBeenCalledTimes(1))

    refreshDeferred.resolve({
      csrfToken: "csrf-refresh",
      globalRoles: ["super_admin"],
      orgRoles: ["org_admin"],
      permissions: ["feature.admin"],
      runtimeMode: "admin",
      organization: { id: "org-1", name: "Org 1", code: "ORG1", status: "active" },
      user: { id: "user-1", email: "admin@example.com", status: "active" },
    })

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      [{ id: "org-1", name: "Org 1" }],
      [{ id: "org-1", name: "Org 1" }],
    ])

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it("retries safe requests after a transient 404", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock
      .mockResolvedValueOnce(new Response("Not found", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const response = await adminFetch("/admin/auth/me", {
      retryAttempts: 1,
      retryInitialBackoffMs: 1,
    })

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
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

  it("fails fast when the configured timeout expires", async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const abortHandler = () => {
          const abortError = new Error("The operation was aborted.")
          abortError.name = "AbortError"
          reject(abortError)
        }

        if (init?.signal?.aborted) {
          abortHandler()
          return
        }

        init?.signal?.addEventListener("abort", abortHandler, { once: true })
      })
    })

    await expect(
      adminFetch("/admin/auth/me", {
        timeoutMs: 5,
        retryAttempts: 0,
      })
    ).rejects.toMatchObject({
      name: "AdminHttpError",
      status: 0,
      code: "timeout",
      message: expect.stringContaining("délai"),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns an empty object when parsing an empty body", async () => {
    await expect(parseJson(new Response(null, { status: 204 }))).resolves.toEqual({})
  })
})
