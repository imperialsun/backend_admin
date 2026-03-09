import * as React from "react"

import { AdminSessionContext } from "@/lib/admin-session-store"

export function useAdminSession() {
  const context = React.useContext(AdminSessionContext)
  if (!context) {
    throw new Error("useAdminSession must be used inside AdminSessionProvider")
  }
  return context
}
