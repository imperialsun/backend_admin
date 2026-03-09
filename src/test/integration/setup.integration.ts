import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

import { clearAdminCsrfToken } from "@/lib/admin-security"
import { resetRuntimeConfigForTests } from "@/lib/runtime-config"

afterEach(() => {
  cleanup()
  clearAdminCsrfToken()
  resetRuntimeConfigForTests()
  if (typeof window !== "undefined") {
    window.__APP_RUNTIME_CONFIG__ = undefined
  }
})
