import { Activity, Building2, Home, TriangleAlert, Users } from "lucide-react"
import { NavLink } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useAdminSession } from "@/lib/use-admin-session"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Home, superAdminOnly: false },
  { to: "/organizations", label: "Organisations", icon: Building2, superAdminOnly: true },
  { to: "/users", label: "Utilisateurs", icon: Users, superAdminOnly: false },
  { to: "/activity", label: "Activité", icon: Activity, superAdminOnly: false },
  { to: "/backend-errors", label: "Erreurs backend", icon: TriangleAlert, superAdminOnly: true },
]

export function Sidebar() {
  const { isSuperAdmin, session } = useAdminSession()

  return (
    <aside className="border-b border-border/70 bg-card/75 p-4 backdrop-blur md:min-h-screen md:w-72 md:border-b-0 md:border-r">
      <div className="mb-6 space-y-4">
        <img
          alt="Logo Demeter Santé"
          className="h-16 w-auto max-w-[220px] object-contain"
          src="/logo.png"
        />
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Transcode</p>
          <h1 className="text-xl font-semibold">Admin Panel</h1>
        </div>
      </div>

      <div className="mb-6 rounded-3xl border border-border/70 bg-background/80 p-4">
        <p className="text-sm font-medium">{session?.organization.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">{session?.user.email}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={isSuperAdmin ? "success" : "muted"}>{isSuperAdmin ? "Super admin" : "Admin org"}</Badge>
          <Badge variant="muted">{session?.organization.code}</Badge>
        </div>
      </div>

      <nav className="grid gap-1">
        {navItems
          .filter((item) => (item.superAdminOnly ? isSuperAdmin : true))
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
      </nav>
    </aside>
  )
}
