import { clearAdminCsrfToken, setAdminCsrfToken } from "@/lib/admin-security"
import { AdminHttpError, requestJson, requestNoContent } from "@/lib/admin-api"
import {
  publishAdminSessionState,
  setAdminSessionRefreshHandler,
} from "@/lib/admin-session-refresh"
import type {
  BackendErrorEventsResponse,
  DemeterQueueSnapshot,
  DemeterReportQueueSnapshot,
  BulkCreateUsersResponse,
  ActivitySummary,
  AdminSessionPayload,
  Organization,
  PermissionCatalogItem,
  PermissionOverride,
  PerformanceSummary,
  RolesCatalog,
  User,
  UserActivitySummary,
  UserAccessResponse,
  UserSettingsEnvelope,
} from "@/lib/types"

type LoginRequest = {
  email: string
  password: string
}

type CreateOrganizationInput = {
  name: string
  code: string
  status: string
}

type UpdateOrganizationInput = Partial<CreateOrganizationInput>

type CreateUserInput = {
  email: string
  password: string
  status: string
}

type UpdateUserInput = {
  email?: string
  status?: string
  organizationId?: string
}

type BackendErrorEventsInput = {
  from?: string
  to?: string
  component?: string
  route?: string
  q?: string
  organizationId?: string
  userId?: string
  page?: number
  pageSize?: number
}

type PerformanceSummaryInput = {
  from: string
  to: string
  organizationId?: string
  userId?: string
  task?: string
  page?: number
  pageSize?: number
}

type DemeterQueueSettingsInput = {
  parallelism: number
}

type DemeterQueuePurgeScope = "completed" | "all"

function rememberSession(payload: AdminSessionPayload) {
  setAdminCsrfToken(payload.csrfToken)
  publishAdminSessionState(payload)
  return payload
}

export async function adminLogin(input: LoginRequest) {
  return rememberSession(
    await requestJson<AdminSessionPayload>("/admin/auth/login", {
      method: "POST",
      allowSessionRefresh: false,
      body: JSON.stringify(input),
    }),
  )
}

export async function adminRequestPasswordReset(email: string) {
  return requestNoContent("/admin/auth/forgot-password", {
    method: "POST",
    allowSessionRefresh: false,
    body: JSON.stringify({ email }),
  })
}

export async function adminResetPassword(token: string, password: string) {
  return requestNoContent("/admin/auth/reset-password", {
    method: "POST",
    allowSessionRefresh: false,
    body: JSON.stringify({ token, password }),
  })
}

export async function adminMe() {
  return rememberSession(await requestJson<AdminSessionPayload>("/admin/auth/me"))
}

export async function adminRefresh() {
  try {
    return rememberSession(
      await requestJson<AdminSessionPayload>("/admin/auth/refresh", {
        method: "POST",
        allowSessionRefresh: false,
      }),
    )
  } catch (error) {
    clearAdminCsrfToken()
    publishAdminSessionState(null)
    if (error instanceof AdminHttpError && error.status === 401) {
      return null
    }
    throw error
  }
}

export async function initializeAdminSession() {
  return adminMe()
}

export async function adminLogout() {
  try {
    await requestNoContent("/admin/auth/logout", { method: "POST", allowSessionRefresh: false })
  } finally {
    clearAdminCsrfToken()
    publishAdminSessionState(null)
  }
}

export async function fetchOrganizations() {
  return requestJson<Organization[]>("/admin/organizations")
}

export async function createOrganization(input: CreateOrganizationInput) {
  return requestJson<Organization>("/admin/organizations", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function updateOrganization(id: string, input: UpdateOrganizationInput) {
  return requestJson<Organization>(`/admin/organizations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export async function fetchUsersByOrganization(organizationId: string) {
  return requestJson<User[]>(`/admin/organizations/${organizationId}/users`)
}

export async function createUser(organizationId: string, input: CreateUserInput) {
  return requestJson<User>(`/admin/organizations/${organizationId}/users`, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function createUsersBulk(
  organizationId: string,
  emails: string[],
  overrides: PermissionOverride[] = [],
) {
  return requestJson<BulkCreateUsersResponse>(`/admin/organizations/${organizationId}/users/bulk`, {
    method: "POST",
    body: JSON.stringify({ emails, overrides }),
  })
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  return requestJson<User>(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export async function updateUserPassword(userId: string, password: string) {
  return requestNoContent(`/admin/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify({ password }),
  })
}

export async function sendUserPasswordResetEmail(userId: string) {
  return requestNoContent(`/admin/users/${userId}/password-reset-email`, {
    method: "POST",
  })
}

export async function deleteUser(userId: string) {
  return requestNoContent(`/admin/users/${userId}`, {
    method: "DELETE",
  })
}

export async function updateUserGlobalRoles(userId: string, codes: string[]) {
  return requestNoContent(`/admin/users/${userId}/global-roles`, {
    method: "PUT",
    body: JSON.stringify({ codes }),
  })
}

export async function updateUserOrgRoles(userId: string, codes: string[]) {
  return requestNoContent(`/admin/users/${userId}/org-roles`, {
    method: "PUT",
    body: JSON.stringify({ codes }),
  })
}

export async function updateUserEntitlements(userId: string, overrides: PermissionOverride[]) {
  return requestNoContent(`/admin/users/${userId}/entitlements`, {
    method: "PUT",
    body: JSON.stringify({ overrides }),
  })
}

export async function fetchUserAccess(userId: string) {
  return requestJson<UserAccessResponse>(`/admin/users/${userId}/access`)
}

export async function fetchUserSettings(userId: string) {
  return requestJson<UserSettingsEnvelope>(`/admin/users/${userId}/settings`)
}

export async function updateUserSettings(
  userId: string,
  input: { schemaVersion: number; settings: Record<string, unknown> },
) {
  return requestJson<UserSettingsEnvelope>(`/admin/users/${userId}/settings`, {
    method: "PUT",
    body: JSON.stringify(input),
  })
}

export async function resetUserSettings(userId: string) {
  return requestJson<UserSettingsEnvelope>(`/admin/users/${userId}/settings/reset`, {
    method: "POST",
  })
}

export async function fetchRolesCatalog() {
  return requestJson<RolesCatalog>("/admin/catalog/roles")
}

export async function fetchPermissionsCatalog() {
  return requestJson<PermissionCatalogItem[]>("/admin/catalog/permissions")
}

export async function fetchActivitySummary(input: { from: string; to: string; organizationId?: string }) {
  const params = new URLSearchParams({
    from: input.from,
    to: input.to,
  })
  if (input.organizationId) {
    params.set("organizationId", input.organizationId)
  }
  return requestJson<ActivitySummary>(`/admin/activity/summary?${params.toString()}`)
}

function buildPerformanceSummaryParams(input: PerformanceSummaryInput) {
  const params = new URLSearchParams({
    from: input.from,
    to: input.to,
  })
  if (input.organizationId?.trim()) {
    params.set("organizationId", input.organizationId.trim())
  }
  if (input.userId?.trim()) {
    params.set("userId", input.userId.trim())
  }
  if (input.task?.trim()) {
    params.set("task", input.task.trim())
  }
  if (typeof input.page === "number" && input.page > 0) {
    params.set("page", String(input.page))
  }
  if (typeof input.pageSize === "number" && input.pageSize > 0) {
    params.set("pageSize", String(input.pageSize))
  }
  return params
}

export async function fetchPerformanceSummary(input: PerformanceSummaryInput) {
  const params = buildPerformanceSummaryParams(input)
  return requestJson<PerformanceSummary>(`/admin/performance/summary?${params.toString()}`)
}

export async function purgePerformanceEvents(input: PerformanceSummaryInput) {
  const params = buildPerformanceSummaryParams(input)
  const suffix = params.toString()
  return requestNoContent(`/admin/performance${suffix ? `?${suffix}` : ""}`, {
    method: "DELETE",
  })
}

export async function fetchDemeterQueueSnapshot(limit = 200) {
  const params = new URLSearchParams()
  if (Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(Math.min(500, Math.trunc(limit))))
  }
  const suffix = params.toString()
  return requestJson<DemeterQueueSnapshot>(`/admin/providers/demeter-sante/queue${suffix ? `?${suffix}` : ""}`)
}

// The audio and report queues are intentionally separate backend resources:
// changing one parallelism setting must not resize the other lane pool.
export async function updateDemeterQueueSettings(input: DemeterQueueSettingsInput) {
  return requestJson<DemeterQueueSnapshot>("/admin/providers/demeter-sante/queue/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  })
}

export async function purgeDemeterQueueOperations(scope: DemeterQueuePurgeScope = "completed") {
  const suffix = scope === "all" ? "?scope=all" : ""
  return requestNoContent(`/admin/providers/demeter-sante/queue${suffix}`, {
    method: "DELETE",
  })
}

export async function fetchDemeterReportQueueSnapshot(limit = 200) {
  const params = new URLSearchParams()
  if (Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(Math.min(500, Math.trunc(limit))))
  }
  const suffix = params.toString()
  return requestJson<DemeterReportQueueSnapshot>(
    `/admin/providers/demeter-sante/report-queue${suffix ? `?${suffix}` : ""}`,
  )
}

export async function updateDemeterReportQueueSettings(input: DemeterQueueSettingsInput) {
  return requestJson<DemeterReportQueueSnapshot>("/admin/providers/demeter-sante/report-queue/settings", {
    method: "PUT",
    body: JSON.stringify(input),
  })
}

export async function purgeDemeterReportQueueOperations(scope: DemeterQueuePurgeScope = "completed") {
  const suffix = scope === "all" ? "?scope=all" : ""
  return requestNoContent(`/admin/providers/demeter-sante/report-queue${suffix}`, {
    method: "DELETE",
  })
}

function buildBackendErrorEventParams(input: BackendErrorEventsInput) {
  const params = new URLSearchParams()
  if (input.from?.trim()) {
    params.set("from", input.from.trim())
  }
  if (input.to?.trim()) {
    params.set("to", input.to.trim())
  }
  if (input.component?.trim()) {
    params.set("component", input.component.trim())
  }
  if (input.route?.trim()) {
    params.set("route", input.route.trim())
  }
  if (input.q?.trim()) {
    params.set("q", input.q.trim())
  }
  if (input.organizationId?.trim()) {
    params.set("organizationId", input.organizationId.trim())
  }
  if (input.userId?.trim()) {
    params.set("userId", input.userId.trim())
  }
  if (typeof input.page === "number" && input.page > 0) {
    params.set("page", String(input.page))
  }
  if (typeof input.pageSize === "number" && input.pageSize > 0) {
    params.set("pageSize", String(input.pageSize))
  }
  return params
}

export async function fetchBackendErrorEvents(input: BackendErrorEventsInput) {
  const params = buildBackendErrorEventParams(input)
  const suffix = params.toString()
  return requestJson<BackendErrorEventsResponse>(`/admin/backend-errors${suffix ? `?${suffix}` : ""}`)
}

export async function purgeBackendErrorEvents(input: BackendErrorEventsInput) {
  const params = buildBackendErrorEventParams(input)
  const suffix = params.toString()
  return requestNoContent(`/admin/backend-errors${suffix ? `?${suffix}` : ""}`, {
    method: "DELETE",
  })
}

export async function fetchUserActivitySummary(userId: string, input: { from: string; to: string }) {
  const params = new URLSearchParams({
    from: input.from,
    to: input.to,
  })
  return requestJson<UserActivitySummary>(`/admin/users/${userId}/activity/summary?${params.toString()}`)
}

export async function deleteUserActivity(userId: string) {
  return requestNoContent(`/admin/users/${userId}/activity`, {
    method: "DELETE",
  })
}

setAdminSessionRefreshHandler(adminRefresh)
