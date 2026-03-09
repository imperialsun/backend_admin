import * as React from "react"

import type { AdminSessionPayload } from "@/lib/types"

export type AdminSessionContextValue = {
  loading: boolean
  session: AdminSessionPayload | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  isSuperAdmin: boolean
  isOrgAdmin: boolean
  hasPermission: (permission: string) => boolean
}

export const AdminSessionContext = React.createContext<AdminSessionContextValue | undefined>(undefined)
