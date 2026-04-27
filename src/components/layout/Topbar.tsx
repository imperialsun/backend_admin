import { LogOut, ShieldCheck } from "lucide-react"
import { useLocation } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAdminSession } from "@/lib/use-admin-session"

const titles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Pilotage global", subtitle: "Vue synthétique de l’activité et des organisations accessibles." },
  "/organizations": { title: "Organisations", subtitle: "Création, activation et édition des tenants." },
  "/users": { title: "Utilisateurs & droits", subtitle: "Gestion des comptes, des rôles et des overrides de permissions." },
  "/activity": { title: "Activité", subtitle: "Analyse de l’usage par période, utilisateur et provider." },
  "/performance": { title: "Performance", subtitle: "Timings backend et frontend, visibles uniquement par les super admin." },
  "/report-queue": { title: "Queue Rapport", subtitle: "Suivi des opérations CR asynchrones avec contrôle du parallélisme." },
  "/backend-errors": { title: "Console d’erreurs", subtitle: "Historique persistant des erreurs backend, avec filtre et purge." },
}

export function Topbar() {
  const location = useLocation()
  const { logout } = useAdminSession()
  const meta = titles[location.pathname] ?? titles["/dashboard"]

  return (
    <header className="border-b border-border/70 bg-background/80 px-6 py-5 backdrop-blur">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Administration sécurisée
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{meta.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
        </div>

        <Button className="gap-2 self-start md:self-auto" variant="secondary" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </header>
  )
}
