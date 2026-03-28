import { clearAdminCsrfToken, setAdminCsrfToken } from "@/lib/admin-security"
import { AdminHttpError, requestJson, requestNoContent } from "@/lib/admin-api"
import type {
  BulkCreateUsersResponse,
  ActivitySummary,
  AdminSessionPayload,
  Organization,
  PermissionCatalogItem,
  PermissionOverride,
  RolesCatalog,
  User,
  UserActivitySummary,
  UserAccessResponse,
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

function rememberSession(payload: AdminSessionPayload) {
  setAdminCsrfToken(payload.csrfToken)
  return payload
}

export async function adminLogin(input: LoginRequest) {
  return rememberSession(
    await requestJson<AdminSessionPayload>("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  )
}

export async function adminRequestPasswordReset(email: string) {
  return requestNoContent("/admin/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function adminResetPassword(token: string, password: string) {
  return requestNoContent("/admin/auth/reset-password", {
    method: "POST",
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
      }),
    )
  } catch (error) {
    clearAdminCsrfToken()
    if (error instanceof AdminHttpError && error.status === 401) {
      return null
    }
    throw error
  }
}

export async function initializeAdminSession() {
  try {
    return await adminMe()
  } catch (error) {
    if (error instanceof AdminHttpError && error.status === 401) {
      return adminRefresh()
    }
    throw error
  }
}

export async function adminLogout() {
  try {
    await requestNoContent("/admin/auth/logout", { method: "POST" })
  } finally {
    clearAdminCsrfToken()
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

export async function createUsersBulk(organizationId: string, emails: string[]) {
  return requestJson<BulkCreateUsersResponse>(`/admin/organizations/${organizationId}/users/bulk`, {
    method: "POST",
    body: JSON.stringify({ emails }),
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
