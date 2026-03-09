import { Navigate, useLocation, useNavigate } from "react-router-dom"
import { ShieldCheck } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAdminSession } from "@/lib/use-admin-session"

type LocationState = {
  from?: string
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, login } = useAdminSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as LocationState | null)?.from ?? "/dashboard"

  if (session) {
    return <Navigate replace to={from} />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion admin impossible.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(222,102,12,0.22),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(24,72,112,0.12),transparent_26%)]" />
      <Card className="relative z-10 w-full max-w-lg border-white/40 bg-white/92">
        <CardHeader>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <CardTitle>Connexion administrateur</CardTitle>
          <CardDescription>
            Cette interface n’utilise que la session admin dédiée du backend. Aucune donnée sensible n’est stockée dans le navigateur.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@demeter.local"
                type="email"
                value={email}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                autoComplete="current-password"
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Votre mot de passe"
                type="password"
                value={password}
              />
            </div>

            {error ? <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}

            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? "Connexion..." : "Ouvrir l’administration"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
