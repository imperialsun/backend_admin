import * as React from "react"

import { adminLogin, adminLogout, initializeAdminSession } from "@/lib/admin-client"
import { AdminSessionContext, type AdminSessionContextValue } from "@/lib/admin-session-store"

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true)
  const [session, setSession] = React.useState<AdminSessionContextValue["session"]>(null)

  const refresh = React.useCallback(async () => {
    const nextSession = await initializeAdminSession()
    setSession(nextSession)
  }, [])

  React.useEffect(() => {
    let active = true

    const boot = async () => {
      try {
        const nextSession = await initializeAdminSession()
        if (active) {
          setSession(nextSession)
        }
      } catch {
        if (active) {
          setSession(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void boot()

    return () => {
      active = false
    }
  }, [])

  const login = React.useCallback(async (email: string, password: string) => {
    const nextSession = await adminLogin({ email, password })
    setSession(nextSession)
  }, [])

  const logout = React.useCallback(async () => {
    await adminLogout()
    setSession(null)
  }, [])

  const value = React.useMemo<AdminSessionContextValue>(() => {
    const globalRoles = session?.globalRoles ?? []
    const orgRoles = session?.orgRoles ?? []
    const permissions = new Set(session?.permissions ?? [])

    return {
      loading,
      session,
      login,
      logout,
      refresh,
      isSuperAdmin: globalRoles.includes("super_admin"),
      isOrgAdmin: orgRoles.includes("org_admin"),
      hasPermission: (permission: string) => permissions.has(permission),
    }
  }, [loading, login, logout, refresh, session])

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}
