import { useState } from "react"
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom"
import { ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminResetPassword } from "@/lib/admin-client"
import { useAdminSession } from "@/lib/use-admin-session"

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session } = useAdminSession()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) {
    return <Navigate replace to="/dashboard" />
  }

  const token = searchParams.get("token")?.trim() ?? ""

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!token) {
      setError("Le lien de reinitialisation est invalide ou incomplet.")
      return
    }
    if (!password.trim() || !confirmPassword.trim()) {
      setError("Veuillez saisir puis confirmer votre nouveau mot de passe.")
      return
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }

    setSubmitting(true)
    try {
      await adminResetPassword(token, password)
      navigate("/login", { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Reinitialisation impossible.")
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
          <CardTitle>Nouveau mot de passe</CardTitle>
          <CardDescription>Choisissez un nouveau mot de passe pour votre compte administrateur.</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                autoComplete="new-password"
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input
                autoComplete="new-password"
                id="confirm-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                type="password"
                value={confirmPassword}
              />
            </div>

            {error ? <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}

            <div className="flex items-center justify-between gap-4">
              <Link className="text-sm text-muted-foreground underline-offset-4 hover:underline" to="/login">
                Retour a la connexion
              </Link>
              <Button disabled={submitting} type="submit">
                {submitting ? "Validation..." : "Mettre a jour"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
