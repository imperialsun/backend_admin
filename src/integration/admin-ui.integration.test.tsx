import { type ReactNode, useMemo, useState } from "react"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Route, Routes } from "react-router-dom"
import { within } from "@testing-library/react"

import type { AdminSessionPayload } from "@/lib/types"
import { clearAdminCsrfToken, setAdminCsrfToken } from "@/lib/admin-security"
import { adminLogin, adminLogout } from "@/lib/admin-client"
import { AdminSessionContext, type AdminSessionContextValue } from "@/lib/admin-session-store"
import { resetRuntimeConfigForTests } from "@/lib/runtime-config"
import ActivityPage from "@/routes/ActivityPage"
import LoginPage from "@/routes/LoginPage"
import OrganizationsPage from "@/routes/OrganizationsPage"
import PerformancePage from "@/routes/PerformancePage"
import UsersPage from "@/routes/UsersPage"
import { renderWithProviders } from "@/test/test-utils"
import {
  createOrganizationDirect,
  createUserDirect,
  loginAdminDirect,
  loginAppDirect,
  postActivityEventsDirect,
  startRealBackend,
  type CookieJarTransport,
  type RealBackendHandle,
  uniqueSuffix,
} from "@/test/integration/backend-harness"

function createStaticSessionValue(session: AdminSessionPayload): AdminSessionContextValue {
  const permissions = new Set(session.permissions)
  return {
    hasPermission: (permission: string) => permissions.has(permission),
    isOrgAdmin: session.orgRoles.includes("org_admin"),
    isSuperAdmin: session.globalRoles.includes("super_admin"),
    loading: false,
    login: async () => {
      throw new Error("login should not be called in static session tests")
    },
    logout: async () => {
      throw new Error("logout should not be called in static session tests")
    },
    refresh: async () => {
      throw new Error("refresh should not be called in static session tests")
    },
    session,
  }
}

function RealSessionHarness(props: { children: ReactNode; initialSession?: AdminSessionPayload | null }) {
  const { children, initialSession = null } = props
  const [session, setSession] = useState<AdminSessionPayload | null>(initialSession)

  const value = useMemo<AdminSessionContextValue>(() => {
    const permissions = new Set(session?.permissions ?? [])
    return {
      hasPermission: (permission: string) => permissions.has(permission),
      isOrgAdmin: (session?.orgRoles ?? []).includes("org_admin"),
      isSuperAdmin: (session?.globalRoles ?? []).includes("super_admin"),
      loading: false,
      login: async (email: string, password: string) => {
        const nextSession = await adminLogin({ email, password })
        setSession(nextSession)
      },
      logout: async () => {
        await adminLogout()
        setSession(null)
      },
      refresh: async () => {},
      session,
    }
  }, [session])

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}

describe("admin ui smoke integration", () => {
  let backend: RealBackendHandle | undefined
  let transport: CookieJarTransport
  let restoreFetch: (() => void) | null = null

  beforeAll(async () => {
    backend = await startRealBackend()
  })

  afterAll(async () => {
    await backend?.stop()
  })

  beforeEach(() => {
    if (!backend) {
      throw new Error("[integration] backend failed to start during setup")
    }
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

  it("logs in through the real login page and reaches the dashboard", async () => {
    const user = userEvent.setup()

    renderWithProviders(
      <RealSessionHarness>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>dashboard-target</div>} />
        </Routes>
      </RealSessionHarness>,
      { route: "/login" },
    )

    await screen.findByRole("heading", { name: "Connexion administrateur" })

    await user.type(screen.getByLabelText("Email"), backend.credentials.email)
    await user.type(screen.getByLabelText("Mot de passe"), backend.credentials.password)
    await user.click(screen.getByRole("button", { name: "Ouvrir l’administration" }))

    await screen.findByText("dashboard-target")
  })

  it("renders organizations and creates one through the real backend", async () => {
    const user = userEvent.setup()
    const adminSession = await loginAdminDirect(transport, backend.credentials)
    setAdminCsrfToken(adminSession.csrfToken)

    renderWithProviders(
      <AdminSessionContext.Provider value={createStaticSessionValue(adminSession)}>
        <OrganizationsPage />
      </AdminSessionContext.Provider>,
      { route: "/organizations" },
    )

    await screen.findByText("Créer une organisation")

    const suffix = uniqueSuffix("ui-org")
    await user.type(screen.getByLabelText("Nom"), `UI Org ${suffix}`)
    await user.type(screen.getByLabelText("Code"), `ui-org-${suffix}`)
    await user.click(screen.getByRole("button", { name: "Créer" }))

    await screen.findByText("Organisation créée.")
    expect(await screen.findAllByText(`UI Org ${suffix}`)).not.toHaveLength(0)
  })

  it("renders users and opens the access modal from real backend data", async () => {
    const user = userEvent.setup()
    const adminSession = await loginAdminDirect(transport, backend.credentials)
    setAdminCsrfToken(adminSession.csrfToken)
    const organization = await createOrganizationDirect(transport, adminSession.csrfToken ?? "", {
      code: `users-${uniqueSuffix("org")}`,
      name: `Users Org ${uniqueSuffix("name")}`,
      status: "active",
    })
    const createdUser = await createUserDirect(transport, adminSession.csrfToken ?? "", organization.id, {
      email: `ui-user-${uniqueSuffix("email")}@example.com`,
      password: "UiUserPass123!",
      status: "active",
    })

    renderWithProviders(
      <AdminSessionContext.Provider value={createStaticSessionValue(adminSession)}>
        <UsersPage />
      </AdminSessionContext.Provider>,
      { route: "/users" },
    )

    await screen.findByText("Filtrer et créer")
    await screen.findByRole("option", { name: organization.name })
    await user.selectOptions(screen.getByLabelText("Organisation"), organization.id)

    expect(await screen.findAllByText(createdUser.email)).not.toHaveLength(0)

    const row = await screen.findByText(createdUser.email)
    const rowElement = row.closest("tr")
    expect(rowElement).not.toBeNull()
    await user.click(within(rowElement as HTMLTableRowElement).getByRole("button", { name: "Gérer" }))

    await screen.findByRole("dialog", { name: createdUser.email })
    await screen.findByText("Permissions effectives")
  })

  it("renders activity aggregates after ingesting real backend events", async () => {
    const adminSession = await loginAdminDirect(transport, backend.credentials)
    const appSession = await loginAppDirect(transport, backend.credentials)

    expect(appSession.runtimeMode).toBe("backend")

    const ingested = await postActivityEventsDirect(transport, [
      {
        eventId: uniqueSuffix("ui-activity"),
        eventKind: "transcription",
        occurredAt: new Date().toISOString(),
        provider: "local_upload",
        sourceMode: "local",
        status: "success",
      },
    ])

    expect(ingested.accepted).toBe(1)

    renderWithProviders(
      <AdminSessionContext.Provider value={createStaticSessionValue(adminSession)}>
        <ActivityPage />
      </AdminSessionContext.Provider>,
      { route: "/activity" },
    )

    await screen.findByText("Filtres d’activité")
    await screen.findByText("Transcriptions par provider")
    await screen.findByText("Local Upload")
  })

  it("refreshes performance data after ingesting new real backend events", async () => {
    const user = userEvent.setup()
    const adminSession = await loginAdminDirect(transport, backend.credentials)
    const organization = await createOrganizationDirect(transport, adminSession.csrfToken ?? "", {
      code: `perf-${uniqueSuffix("org")}`,
      name: `Perf Org ${uniqueSuffix("name")}`,
      status: "active",
    })
    const appPassword = "UiPerfPass123!"
    const appUser = await createUserDirect(transport, adminSession.csrfToken ?? "", organization.id, {
      email: `perf-user-${uniqueSuffix("email")}@example.com`,
      password: appPassword,
      status: "active",
    })
    const appSession = await loginAppDirect(transport, {
      email: appUser.email,
      password: appPassword,
    })

    expect(appSession.runtimeMode).toBe("backend")

    const from = new Date(Date.now() - 60 * 60 * 1_000).toISOString()
    const to = new Date(Date.now() + 60 * 1_000).toISOString()

    const firstEvent = {
      eventId: uniqueSuffix("ui-performance-1"),
      traceId: uniqueSuffix("ui-performance-trace-1"),
      surface: "frontend",
      component: "cloud",
      task: "frontend_cloud_total",
      status: "success",
      durationMs: 420,
      route: "/performance-check",
      occurredAt: new Date().toISOString(),
      meta: { sourceMode: "cloud_direct" },
    }

    const secondEvent = {
      eventId: uniqueSuffix("ui-performance-2"),
      traceId: uniqueSuffix("ui-performance-trace-2"),
      surface: "frontend",
      component: "cloud",
      task: "frontend_cloud_total",
      status: "success",
      durationMs: 860,
      route: "/performance-check",
      occurredAt: new Date(Date.now() - 1_000).toISOString(),
      meta: { sourceMode: "cloud_direct" },
    }

    await transport.requestJson("/api/v1/performance/events", {
      body: JSON.stringify({ events: [firstEvent] }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    renderWithProviders(
      <AdminSessionContext.Provider value={createStaticSessionValue(adminSession)}>
        <PerformancePage />
      </AdminSessionContext.Provider>,
      { route: `/performance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&organizationId=${organization.id}` },
    )

    await screen.findByText("Fenêtre de performance 24 h")
    const recentExecutionsCard = screen.getByRole("heading", { name: "Dernières exécutions" }).closest("div.rounded-3xl")
    if (!recentExecutionsCard) {
      throw new Error("Expected the recent executions card to exist")
    }
    await waitFor(() => expect(within(recentExecutionsCard).getAllByText("/performance-check")).toHaveLength(1))

    await transport.requestJson("/api/v1/performance/events", {
      body: JSON.stringify({ events: [secondEvent] }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    })

    await user.click(screen.getByRole("button", { name: "Rafraîchir" }))

    await waitFor(() => {
      const refreshedRecentExecutionsCard = screen
        .getByRole("heading", { name: "Dernières exécutions" })
        .closest("div.rounded-3xl")
      if (!refreshedRecentExecutionsCard) {
        throw new Error("Expected the recent executions card to exist after refresh")
      }
      expect(within(refreshedRecentExecutionsCard).getAllByText("/performance-check")).toHaveLength(2)
    })
  })
})
