import { useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminRequestPasswordReset } from "@/lib/admin-client"
import { useAdminSession } from "@/lib/use-admin-session"

const GENERIC_SUCCESS_MESSAGE =
  "Si un compte administrateur actif correspond a cet email, un lien de reinitialisation vient d etre envoye."

export default function ForgotPasswordPage() {
  const { session } = useAdminSession()
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  if (session) {
    return <Navigate replace to="/dashboard" />
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email.trim()) {
      setError("Veuillez saisir votre email.")
      return
    }

    setSubmitting(true)
    try {
      await adminRequestPasswordReset(email.trim())
      setSuccess(GENERIC_SUCCESS_MESSAGE)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Envoi impossible.")
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
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>Entrez votre email administrateur pour recevoir un lien de reinitialisation.</CardDescription>
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

            {success ? <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">{success}</p> : null}
            {error ? <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p> : null}

            <div className="flex items-center justify-between gap-4">
              <Link className="text-sm text-muted-foreground underline-offset-4 hover:underline" to="/login">
                Retour a la connexion
              </Link>
              <Button disabled={submitting} type="submit">
                {submitting ? "Envoi..." : "Envoyer le lien"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
