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

export interface BulkCreatedUser {
  id: string
  email: string
  status: string
}

export interface BulkFailedUser {
  email: string
  error: string
  userId?: string
}

export interface BulkCreateUsersResponse {
  created: BulkCreatedUser[]
  failed: BulkFailedUser[]
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

export interface UserSettingsEnvelope {
  version: number
  schemaVersion: number
  updatedAt: string
  settings: Record<string, unknown>
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

export interface UserActivitySummary {
  user: User
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
  breakdown: {
    transcriptionsByMode: Record<string, number>
    transcriptionsByProvider: Record<string, number>
    reportsByMode: Record<string, number>
    reportsByProvider: Record<string, number>
  }
}

export interface BackendErrorEvent {
  id: string
  traceId: string
  userId?: string
  organizationId?: string
  component: string
  route: string
  step: string
  title: string
  statusCode?: number
  durationMs?: number
  errorMessage?: string
  payloadJson: string
  annexJson?: string
  recoveryStatus?: string
  createdAt: string
}

export interface BackendErrorEventsResponse {
  items: BackendErrorEvent[]
  total: number
  page: number
  pageSize: number
}

export interface PerformanceEvent {
  eventId: string
  traceId: string
  userId?: string
  organizationId?: string
  surface: string
  component: string
  task: string
  status: string
  durationMs: number
  route: string
  metaJson: string
  occurredAt: string
  day: string
  createdAt: string
}

export interface PerformanceSummary {
  organizationId: string
  range: {
    from: string
    to: string
  }
  totals: {
    events: number
    successes: number
    failures: number
    totalDurationMs: number
    averageDurationMs: number
    maxDurationMs: number
  }
  taskOptions: string[]
  userId?: string
  topTasks: Array<{
    surface: string
    component: string
    task: string
    route: string
    events: number
    successes: number
    failures: number
    totalDurationMs: number
    averageDurationMs: number
    maxDurationMs: number
    lastOccurredAt: string
  }>
  recentEvents: PerformanceEvent[]
}

export interface DemeterQueueSettingsSnapshot {
  parallelism: number
  updatedAt: string
}

export interface DemeterQueueSummarySnapshot {
  parallelism: number
  openWorkers: number
  drainingWorkers: number
  coolingWorkers: number
  pendingOperations: number
  runningOperations: number
  unassignedOperations: number
  retryPaused: boolean
  retryPausedLaneId?: number
  retryPausedOperationId?: string
  retryPausedChunkIndex?: number
  retryPausedSince?: string
}

export interface DemeterQueueWorkerSnapshot {
  queueId: number
  open: boolean
  draining: boolean
  workerRunning: boolean
  cooldownUntil?: string
  currentOperationId?: string
  currentStatus?: string
  currentStage?: string
  currentChunkIndex?: number
  currentChunkCount?: number
  currentProgress?: number
  load: number
  pendingCount: number
  runningCount: number
  lastError?: string
}

export interface DemeterQueueOperationSnapshot {
  operationId: string
  queueId: number
  status: string
  stage: string
  chunkIndex: number
  chunkCount: number
  progress: number
  statusCode: number
  createdAt: string
  updatedAt: string
  lastError?: string
}

export interface DemeterQueueSnapshot {
  settings: DemeterQueueSettingsSnapshot
  summary: DemeterQueueSummarySnapshot
  workers: DemeterQueueWorkerSnapshot[]
  operations: DemeterQueueOperationSnapshot[]
}
