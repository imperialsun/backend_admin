import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AdminHttpError } from "@/lib/admin-api"
import {
  adminLogin,
  adminLogout,
  adminMe,
  adminRefresh,
  createOrganization,
  createUser,
  fetchActivitySummary,
  fetchOrganizations,
  fetchPermissionsCatalog,
  fetchRolesCatalog,
  fetchUserAccess,
  fetchUsersByOrganization,
  updateOrganization,
  updateUser,
  updateUserEntitlements,
  updateUserGlobalRoles,
  updateUserOrgRoles,
  updateUserPassword,
} from "@/lib/admin-client"
import { clearAdminCsrfToken, getAdminCsrfToken } from "@/lib/admin-security"
import { resetRuntimeConfigForTests } from "@/lib/runtime-config"
import {
  loginAppDirect,
  postActivityEventsDirect,
  startRealBackend,
  type CookieJarTransport,
  type RealBackendHandle,
  uniqueSuffix,
} from "@/test/integration/backend-harness"

describe("admin api/client integration", () => {
  let backend: RealBackendHandle
  let transport: CookieJarTransport
  let restoreFetch: (() => void) | null = null

  beforeAll(async () => {
    backend = await startRealBackend()
  })

  afterAll(async () => {
    await backend.stop()
  })

  beforeEach(() => {
    backend.configureRuntime()
    transport = backend.createTransport()
    restoreFetch = transport.installAsGlobalFetch()
    clearAdminCsrfToken()
  })

  afterEach(() => {
    restoreFetch?.()
    restoreFetch = null
    clearAdminCsrfToken()
    resetRuntimeConfigForTests()
  })

  it("authenticates, refreshes and logs out against the real admin backend", async () => {
    const loginSession = await adminLogin(backend.credentials)

    expect(loginSession.runtimeMode).toBe("admin")
    expect(loginSession.user.email).toBe(backend.credentials.email)
    expect(loginSession.csrfToken).toBeTruthy()
    expect(getAdminCsrfToken()).toBe(loginSession.csrfToken)

    const meSession = await adminMe()
    expect(meSession.user.id).toBe(loginSession.user.id)
    expect(meSession.organization.id).toBe(loginSession.organization.id)

    transport.deleteCookieByExactPath("/api/v1/admin")
    clearAdminCsrfToken()

    const refreshedSession = await adminRefresh()
    expect(refreshedSession).not.toBeNull()
    expect(refreshedSession?.runtimeMode).toBe("admin")
    expect(refreshedSession?.user.email).toBe(backend.credentials.email)
    expect(getAdminCsrfToken()).toBe(refreshedSession?.csrfToken ?? "")

    const meAfterRefresh = await adminMe()
    expect(meAfterRefresh.user.id).toBe(loginSession.user.id)

    await adminLogout()

    expect(getAdminCsrfToken()).toBe("")
    await expect(adminRefresh()).resolves.toBeNull()
    await expect(adminMe()).rejects.toMatchObject({
      status: 401,
    } satisfies Partial<AdminHttpError>)
  })

  it("enforces real csrf and persists organization changes", async () => {
    await adminLogin(backend.credentials)

    clearAdminCsrfToken()
    await expect(
      createOrganization({
        code: uniqueSuffix("csrf-org"),
        name: "Missing CSRF org",
        status: "active",
      }),
    ).rejects.toMatchObject({
      code: "invalid_csrf_token",
      status: 403,
    } satisfies Partial<AdminHttpError>)

    await adminMe()

    const suffix = uniqueSuffix("org")
    const created = await createOrganization({
      code: `admin-${suffix}`,
      name: `Admin Org ${suffix}`,
      status: "active",
    })

    expect(created.name).toBe(`Admin Org ${suffix}`)
    expect(created.status).toBe("active")

    const updated = await updateOrganization(created.id, {
      code: `admin-updated-${suffix}`,
      status: "inactive",
    })

    expect(updated.code).toBe(`admin-updated-${suffix}`)
    expect(updated.status).toBe("inactive")

    const organizations = await fetchOrganizations()
    expect(
      organizations.some(
        (organization) =>
          organization.id === created.id &&
          organization.code === `admin-updated-${suffix}` &&
          organization.status === "inactive",
      ),
    ).toBe(true)
  })

  it("covers users, catalogs and activity summary against the real backend", async () => {
    const adminSession = await adminLogin(backend.credentials)
    const rolesCatalog = await fetchRolesCatalog()
    const permissionsCatalog = await fetchPermissionsCatalog()

    expect(rolesCatalog.global.some((role) => role.code === "super_admin")).toBe(true)
    expect(rolesCatalog.organization.some((role) => role.code === "org_admin")).toBe(true)
    expect(permissionsCatalog.some((permission) => permission.code === "feature.admin")).toBe(true)

    const suffix = uniqueSuffix("user")
    const sourceOrganization = await createOrganization({
      code: `source-${suffix}`,
      name: `Source Org ${suffix}`,
      status: "active",
    })
    const targetOrganization = await createOrganization({
      code: `target-${suffix}`,
      name: `Target Org ${suffix}`,
      status: "active",
    })

    const createdUser = await createUser(sourceOrganization.id, {
      email: `operator-${suffix}@example.com`,
      password: "InitialPass123!",
      status: "active",
    })

    const sourceUsers = await fetchUsersByOrganization(sourceOrganization.id)
    expect(sourceUsers.some((user) => user.id === createdUser.id)).toBe(true)

    const updatedUser = await updateUser(createdUser.id, {
      email: `operator-updated-${suffix}@example.com`,
      organizationId: targetOrganization.id,
      status: "active",
    })

    expect(updatedUser.email).toBe(`operator-updated-${suffix}@example.com`)
    expect(updatedUser.organizationId).toBe(targetOrganization.id)

    const targetUsers = await fetchUsersByOrganization(targetOrganization.id)
    expect(targetUsers.some((user) => user.id === createdUser.id)).toBe(true)

    await updateUserPassword(createdUser.id, "ResetPass123!")
    await updateUserGlobalRoles(createdUser.id, ["super_admin", "user"])
    await updateUserOrgRoles(createdUser.id, ["org_admin"])
    await updateUserEntitlements(createdUser.id, [
      {
        effect: "deny",
        permissionCode: "feature.telemetry",
      },
    ])

    const access = await fetchUserAccess(createdUser.id)
    expect(access.globalRoles).toEqual(expect.arrayContaining(["super_admin", "user"]))
    expect(access.orgRoles).toEqual(expect.arrayContaining(["org_admin"]))
    expect(access.overrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          effect: "deny",
          permissionCode: "feature.telemetry",
        }),
      ]),
    )
    expect(access.effectivePermissions).not.toContain("feature.telemetry")

    const appSession = await loginAppDirect(transport, {
      email: updatedUser.email,
      password: "ResetPass123!",
    })
    expect(appSession.runtimeMode).toBe("backend")
    expect(appSession.organization.id).toBe(targetOrganization.id)

    const ingested = await postActivityEventsDirect(transport, [
      {
        eventId: uniqueSuffix("activity"),
        eventKind: "transcription",
        occurredAt: new Date().toISOString(),
        provider: "local_upload",
        sourceMode: "local",
        status: "success",
      },
    ])
    expect(ingested.accepted).toBe(1)
    expect(ingested.rejected).toHaveLength(0)

    const today = new Date().toISOString().slice(0, 10)
    const summary = await fetchActivitySummary({
      from: today,
      organizationId: targetOrganization.id,
      to: today,
    })

    expect(summary.organizationId).toBe(targetOrganization.id)
    expect(summary.totals.transcriptions).toBeGreaterThanOrEqual(1)
    expect(summary.breakdown.transcriptionsByProvider.local_upload).toBeGreaterThanOrEqual(1)
    expect(summary.byUser.some((item) => item.email === updatedUser.email)).toBe(true)
    expect(summary.range.from).toBe(today)
    expect(summary.range.to).toBe(today)

    expect(adminSession.organization.id).not.toBe("")
  })
})
