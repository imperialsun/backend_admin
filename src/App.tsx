import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom"

import { AppShell } from "@/components/layout/AppShell"
import { useAdminSession } from "@/lib/use-admin-session"
import ActivityPage from "@/routes/ActivityPage"
import BackendErrorsPage from "@/routes/BackendErrorsPage"
import DashboardPage from "@/routes/DashboardPage"
import ForbiddenPage from "@/routes/ForbiddenPage"
import ForgotPasswordPage from "@/routes/ForgotPasswordPage"
import LoginPage from "@/routes/LoginPage"
import OrganizationsPage from "@/routes/OrganizationsPage"
import PerformancePage from "@/routes/PerformancePage"
import ResetPasswordPage from "@/routes/ResetPasswordPage"
import UsersPage from "@/routes/UsersPage"

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Initialisation</p>
        <h1 className="mt-3 text-3xl font-semibold">Chargement du contexte administrateur</h1>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { loading, session } = useAdminSession()

  if (loading) {
    return <LoadingScreen />
  }

  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />
  }

  return <>{children}</>
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = useAdminSession()
  if (!isSuperAdmin) {
    return <Navigate replace to="/forbidden" />
  }
  return <>{children}</>
}

function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppShell>
        <Outlet />
      </AppShell>
    </RequireAuth>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<Navigate replace to="/dashboard" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/organizations"
          element={
            <RequireSuperAdmin>
              <OrganizationsPage />
            </RequireSuperAdmin>
          }
        />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route
          path="/performance"
          element={
            <RequireSuperAdmin>
              <PerformancePage />
            </RequireSuperAdmin>
          }
        />
        <Route
          path="/backend-errors"
          element={
            <RequireSuperAdmin>
              <BackendErrorsPage />
            </RequireSuperAdmin>
          }
        />
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>
    </Routes>
  )
}
