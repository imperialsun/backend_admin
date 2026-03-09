export interface SessionUser {
  id: string
  email: string
  status: string
}

export interface SessionOrganization {
  id: string
  name: string
  code: string
  status: string
}

export interface AdminSessionPayload {
  user: SessionUser
  organization: SessionOrganization
  globalRoles: string[]
  orgRoles: string[]
  permissions: string[]
  csrfToken?: string
  runtimeMode: string
}

export interface Organization {
  id: string
  name: string
  code: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  organizationId: string
  email: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface RoleCatalogItem {
  code: string
  label: string
}

export interface RolesCatalog {
  global: RoleCatalogItem[]
  organization: RoleCatalogItem[]
}

export interface PermissionCatalogItem {
  code: string
  label: string
  scope: string
}

export interface PermissionOverride {
  permissionCode: string
  effect: "allow" | "deny"
}

export interface UserAccessResponse {
  user: User
  globalRoles: string[]
  orgRoles: string[]
  overrides: PermissionOverride[]
  effectivePermissions: string[]
}

export interface ActivitySummary {
  organizationId: string
  range: {
    from: string
    to: string
  }
  totals: {
    transcriptions: number
    reports: number
  }
  byDay: Array<{
    day: string
    transcriptions: number
    reports: number
  }>
  byUser: Array<{
    userId: string
    email: string
    transcriptions: number
    reports: number
  }>
  breakdown: {
    transcriptionsByMode: Record<string, number>
    transcriptionsByProvider: Record<string, number>
    reportsByMode: Record<string, number>
    reportsByProvider: Record<string, number>
  }
}
