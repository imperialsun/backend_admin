import type { AdminSessionPayload } from "@/lib/types"

export type AdminSessionRefreshHandler = () => Promise<AdminSessionPayload | null>
export type AdminSessionObserver = (session: AdminSessionPayload | null) => void

let refreshHandler: AdminSessionRefreshHandler | null = null
let sessionObserver: AdminSessionObserver | null = null
let refreshInFlight: Promise<AdminSessionPayload | null> | null = null

export function setAdminSessionRefreshHandler(handler: AdminSessionRefreshHandler | null) {
  refreshHandler = handler
}

export function setAdminSessionObserver(observer: AdminSessionObserver | null) {
  sessionObserver = observer
}

export function publishAdminSessionState(session: AdminSessionPayload | null) {
  sessionObserver?.(session)
}

export async function requestAdminSessionRefresh() {
  if (!refreshHandler) {
    return null
  }

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        return await refreshHandler()
      } finally {
        refreshInFlight = null
      }
    })()
  }

  return refreshInFlight
}

export function resetAdminSessionRefreshBridgeForTests() {
  refreshHandler = null
  sessionObserver = null
  refreshInFlight = null
}
