import { Link } from "react-router-dom"
import { ShieldAlert } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="max-w-xl">
        <CardHeader>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/12 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>
            Votre session est valide, mais vos droits effectifs ne vous autorisent pas à afficher cet écran.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            to="/dashboard"
          >
            Retour au dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
