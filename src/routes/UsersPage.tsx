import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"

import { ActivitySummarySection } from "@/components/activity/ActivitySummarySection"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableWrapper } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  createUser,
  createUsersBulk,
  deleteUser,
  deleteUserActivity,
  fetchOrganizations,
  fetchPermissionsCatalog,
  fetchRolesCatalog,
  fetchUserActivitySummary,
  fetchUserAccess,
  fetchUsersByOrganization,
  sendUserPasswordResetEmail,
  updateUser,
  updateUserEntitlements,
  updateUserGlobalRoles,
  updateUserOrgRoles,
  updateUserPassword,
} from "@/lib/admin-client"
import type {
  PermissionCatalogItem,
  PermissionOverride,
  RoleCatalogItem,
  RolesCatalog,
  BulkCreateUsersResponse,
  User,
  UserAccessResponse,
} from "@/lib/types"
import { daysAgoDayString, formatDateTime, todayDayString } from "@/lib/utils"
import { useAdminSession } from "@/lib/use-admin-session"

type UserForm = {
  email: string
  password: string
  status: string
}

type ProfileUpdateInput = {
  email: string
  status: string
  organizationId: string
}

type OverrideState = Record<string, "inherit" | "allow" | "deny">
type BulkProvisioningResult = BulkCreateUsersResponse | null

const defaultUserForm: UserForm = {
  email: "",
  password: "",
  status: "active",
}

function setSearchValue(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  if (value && value.trim()) {
    params.set(key, value.trim())
    return
  }
  params.delete(key)
}

function toggleCode(codes: string[], code: string) {
  if (codes.includes(code)) {
    return codes.filter((value) => value !== code)
  }
  return [...codes, code].sort()
}

function parseBulkEmails(value: string) {
  const seen = new Set<string>()
  const emails: string[] = []

  for (const token of value.split(/[\n,;]+/)) {
    const trimmed = token.trim()
    if (!trimmed) {
      continue
    }
    const normalized = trimmed.toLowerCase()
    if (seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    emails.push(trimmed)
  }

  return emails
}

function toOverrideState(overrides: PermissionOverride[]) {
  return overrides.reduce<OverrideState>((accumulator, override) => {
    accumulator[override.permissionCode] = override.effect
    return accumulator
  }, {})
}

function toOverridePayload(state: OverrideState): PermissionOverride[] {
  return Object.entries(state)
    .filter(([, effect]) => effect !== "inherit")
    .map(([permissionCode, effect]) => ({
      permissionCode,
      effect: (effect === "allow" ? "allow" : "deny") as PermissionOverride["effect"],
    }))
    .sort((left, right) => left.permissionCode.localeCompare(right.permissionCode))
}

function matchesUserSearch(user: User, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true
  }
  return (
    user.email.toLowerCase().includes(normalizedQuery) ||
    user.id.toLowerCase().includes(normalizedQuery) ||
    user.status.toLowerCase().includes(normalizedQuery)
  )
}

function filterUsersBySearch(users: User[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  return users.filter((user) => matchesUserSearch(user, normalizedQuery))
}

function buildUserPanelKey(user: User, access: UserAccessResponse) {
  const overrides = access.overrides
    .map((item) => `${item.permissionCode}:${item.effect}`)
    .sort()
    .join("|")

  return [
    user.id,
    user.email,
    user.status,
    user.organizationId,
    access.globalRoles.join("|"),
    access.orgRoles.join("|"),
    overrides,
  ].join("::")
}

function RoleChecklist(props: {
  title: string
  description: string
  catalog: RoleCatalogItem[]
  selectedCodes: string[]
  disabled?: boolean
  onToggle: (code: string) => void
}) {
  const { title, description, catalog, selectedCodes, disabled = false, onToggle } = props

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {catalog.map((item) => {
          const selected = selectedCodes.includes(item.code)

          return (
            <label
              className="flex items-start justify-between gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3"
              key={item.code}
            >
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.code}</p>
              </div>
              <input
                checked={selected}
                disabled={disabled}
                onChange={() => onToggle(item.code)}
                type="checkbox"
              />
            </label>
          )
        })}
      </CardContent>
    </Card>
  )
}

function PermissionOverridesEditor(props: {
  catalog: PermissionCatalogItem[]
  disabled?: boolean
  overrides: OverrideState
  onChange: (permissionCode: string, nextEffect: "inherit" | "allow" | "deny") => void
}) {
  const { catalog, disabled = false, overrides, onChange } = props

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overrides de permissions</CardTitle>
        <CardDescription>
          Chaque permission peut rester héritée, être forcée en allow ou forcée en deny.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {catalog.map((permission) => (
          <div
            className="grid gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-3 md:grid-cols-[1.2fr_0.8fr]"
            key={permission.code}
          >
            <div>
              <p className="font-medium">{permission.label}</p>
              <p className="text-xs text-muted-foreground">
                {permission.code} · {permission.scope}
              </p>
            </div>
            <select
              aria-label={`Override ${permission.code}`}
              className="h-11 rounded-2xl border border-border bg-background px-4 text-sm"
              disabled={disabled}
              onChange={(event) =>
                onChange(permission.code, event.target.value as "inherit" | "allow" | "deny")
              }
              value={overrides[permission.code] ?? "inherit"}
            >
              <option value="inherit">Hériter</option>
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function UserDetailPanel(props: {
  user: User
  organizations: Array<{ id: string; name: string }>
  rolesCatalog: RolesCatalog
  permissionsCatalog: PermissionCatalogItem[]
  access: UserAccessResponse
  isSuperAdmin: boolean
  profilePending: boolean
  passwordPending: boolean
  passwordEmailPending: boolean
  deletePending: boolean
  globalRolesPending: boolean
  orgRolesPending: boolean
  entitlementsPending: boolean
  onSaveProfile: (input: ProfileUpdateInput) => Promise<void>
  onResetPassword: (password: string) => Promise<void>
  onSendResetEmail: () => Promise<void>
  onDeleteUser: () => Promise<void>
  onSaveGlobalRoles: (codes: string[]) => Promise<void>
  onSaveOrgRoles: (codes: string[]) => Promise<void>
  onSaveOverrides: (overrides: PermissionOverride[]) => Promise<void>
}) {
  const {
    user,
    organizations,
    rolesCatalog,
    permissionsCatalog,
    access,
    isSuperAdmin,
    profilePending,
    passwordPending,
    passwordEmailPending,
    deletePending,
    globalRolesPending,
    orgRolesPending,
    entitlementsPending,
    onSaveProfile,
    onResetPassword,
    onSendResetEmail,
    onDeleteUser,
    onSaveGlobalRoles,
    onSaveOrgRoles,
    onSaveOverrides,
  } = props

  const [email, setEmail] = useState(user.email)
  const [status, setStatus] = useState(user.status)
  const [organizationId, setOrganizationId] = useState(user.organizationId)
  const [password, setPassword] = useState("")
  const [globalRoles, setGlobalRoles] = useState(access.globalRoles)
  const [orgRoles, setOrgRoles] = useState(access.orgRoles)
  const [overrides, setOverrides] = useState<OverrideState>(toOverrideState(access.overrides))
  const [feedback, setFeedback] = useState<string | null>(null)
  const [activityFrom, setActivityFrom] = useState(daysAgoDayString(29))
  const [activityTo, setActivityTo] = useState(todayDayString())
  const [activityFeedback, setActivityFeedback] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false)
  const queryClient = useQueryClient()

  const activitySummaryQuery = useQuery({
    queryKey: ["user-activity-summary", user.id, activityFrom, activityTo],
    queryFn: () =>
      fetchUserActivitySummary(user.id, {
        from: activityFrom,
        to: activityTo,
      }),
  })

  const purgeActivityMutation = useMutation({
    mutationFn: async () => {
      await deleteUserActivity(user.id)
    },
  })

  const saveProfile = async () => {
    setFeedback(null)
    await onSaveProfile({ email, status, organizationId })
    setFeedback("Profil utilisateur mis à jour.")
  }

  const savePassword = async () => {
    if (!password.trim()) {
      return
    }
    setFeedback(null)
    await onResetPassword(password)
    setPassword("")
    setFeedback("Mot de passe réinitialisé. Toutes les sessions actives ont été révoquées.")
  }

  const sendResetEmail = async () => {
    setFeedback(null)
    await onSendResetEmail()
    setFeedback("Email de réinitialisation envoyé.")
  }

  const saveGlobalRoles = async () => {
    setFeedback(null)
    await onSaveGlobalRoles(globalRoles)
    setFeedback("Rôles globaux enregistrés.")
  }

  const saveOrgRoles = async () => {
    setFeedback(null)
    await onSaveOrgRoles(orgRoles)
    setFeedback("Rôles organisation enregistrés.")
  }

  const saveOverrides = async () => {
    setFeedback(null)
    await onSaveOverrides(toOverridePayload(overrides))
    setFeedback("Overrides de permissions enregistrés.")
  }

  const confirmDelete = async () => {
    setFeedback(null)
    try {
      await onDeleteUser()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Impossible de supprimer l’utilisateur.")
    }
  }

  const confirmPurgeActivity = async () => {
    setActivityFeedback(null)
    try {
      await purgeActivityMutation.mutateAsync()
      setPurgeConfirmOpen(false)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["user-activity-summary", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["activity-summary"] }),
      ])
      setActivityFeedback("Activité utilisateur supprimée.")
    } catch (error) {
      setActivityFeedback(error instanceof Error ? error.message : "Impossible de supprimer l’activité utilisateur.")
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{user.email}</CardTitle>
          <CardDescription>
            Compte ciblé: {user.id}. Les mutations déclenchent une révocation des sessions backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="user-email">Email</Label>
            <Input id="user-email" onChange={(event) => setEmail(event.target.value)} value={email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-status">Statut</Label>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              id="user-status"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="user-organization">Organisation</Label>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              disabled={!isSuperAdmin}
              id="user-organization"
              onChange={(event) => setOrganizationId(event.target.value)}
              value={organizationId}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end md:col-span-2">
            <Button disabled={profilePending || !email.trim()} onClick={() => void saveProfile()}>
              {profilePending ? "Enregistrement..." : "Enregistrer le profil"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Réinitialisation du mot de passe</CardTitle>
          <CardDescription>
            Le backend invalide les refresh sessions existantes après cette action.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <Label htmlFor="reset-password">Nouveau mot de passe</Label>
              <Input
                id="reset-password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>
            <div className="flex items-end">
              <Button disabled={passwordPending || !password.trim()} onClick={() => void savePassword()}>
                {passwordPending ? "Réinitialisation..." : "Réinitialiser"}
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled={passwordEmailPending} onClick={() => void sendResetEmail()} variant="secondary">
              {passwordEmailPending ? "Envoi..." : "Envoyer un email de réinitialisation"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isSuperAdmin ? (
        <RoleChecklist
          catalog={rolesCatalog.global}
          description="Réservé au super admin."
          disabled={globalRolesPending}
          onToggle={(code) => setGlobalRoles((current) => toggleCode(current, code))}
          selectedCodes={globalRoles}
          title="Rôles globaux"
        />
      ) : null}

      {isSuperAdmin ? (
        <div className="flex justify-end">
          <Button disabled={globalRolesPending} onClick={() => void saveGlobalRoles()}>
            {globalRolesPending ? "Enregistrement..." : "Enregistrer les rôles globaux"}
          </Button>
        </div>
      ) : null}

      <RoleChecklist
        catalog={rolesCatalog.organization}
        description="Rôles locaux à l’organisation de rattachement."
        disabled={orgRolesPending}
        onToggle={(code) => setOrgRoles((current) => toggleCode(current, code))}
        selectedCodes={orgRoles}
        title="Rôles organisation"
      />

      <div className="flex justify-end">
        <Button disabled={orgRolesPending} onClick={() => void saveOrgRoles()}>
          {orgRolesPending ? "Enregistrement..." : "Enregistrer les rôles organisation"}
        </Button>
      </div>

      <PermissionOverridesEditor
        catalog={permissionsCatalog}
        disabled={entitlementsPending}
        onChange={(permissionCode, nextEffect) =>
          setOverrides((current) => ({
            ...current,
            [permissionCode]: nextEffect,
          }))
        }
        overrides={overrides}
      />

      <div className="flex justify-end">
        <Button disabled={entitlementsPending} onClick={() => void saveOverrides()}>
          {entitlementsPending ? "Enregistrement..." : "Enregistrer les overrides"}
        </Button>
      </div>

      <Card className="border-destructive/40 bg-destructive/5">
        <CardHeader>
          <CardTitle>Suppression définitive</CardTitle>
          <CardDescription>
            Cette action supprime définitivement le compte, révoque ses sessions et efface ses données liées à
            l’utilisateur.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {deleteConfirmOpen ? (
            <>
              <p className="text-sm text-muted-foreground">
                Confirmez uniquement si vous voulez supprimer ce compte maintenant. Cette action est irréversible.
              </p>
              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  disabled={deletePending}
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setFeedback(null)
                  }}
                  variant="secondary"
                >
                  Annuler
                </Button>
                <Button disabled={deletePending} onClick={() => void confirmDelete()} variant="danger">
                  {deletePending ? "Suppression..." : "Confirmer la suppression"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex justify-end">
              <Button
                disabled={deletePending}
                onClick={() => {
                  setDeleteConfirmOpen(true)
                  setFeedback(null)
                }}
                variant="danger"
              >
                Supprimer l’utilisateur
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Permissions effectives</CardTitle>
          <CardDescription>
            Cette liste vient du backend après résolution des rôles et des overrides.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {access.effectivePermissions.map((permission) => (
            <Badge key={permission} variant="muted">
              {permission}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activité utilisateur</CardTitle>
          <CardDescription>
            Consultez les transcriptions et rapports liés à ce compte, puis purgez son historique sans supprimer le
            compte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-from">Du</Label>
              <Input
                id="activity-from"
                onChange={(event) => {
                  setActivityFeedback(null)
                  setActivityFrom(event.target.value)
                }}
                type="date"
                value={activityFrom}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-to">Au</Label>
              <Input
                id="activity-to"
                onChange={(event) => {
                  setActivityFeedback(null)
                  setActivityTo(event.target.value)
                }}
                type="date"
                value={activityTo}
              />
            </div>
          </div>

          {activitySummaryQuery.isError ? (
            <p className="text-sm text-destructive">
              {activitySummaryQuery.error instanceof Error
                ? activitySummaryQuery.error.message
                : "Impossible de charger l’activité utilisateur."}
            </p>
          ) : activitySummaryQuery.data ? (
            <ActivitySummarySection summary={activitySummaryQuery.data} showByUserTable={false} />
          ) : (
            <p className="text-sm text-muted-foreground">Chargement du résumé d’activité...</p>
          )}

          <div className="rounded-3xl border border-destructive/40 bg-destructive/5 p-5">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-destructive">Purge de l’activité</p>
                <p className="text-sm text-muted-foreground">
                  Cette action supprime tous les événements d’activité du compte, sans supprimer le compte lui-même.
                </p>
              </div>
              {purgeConfirmOpen ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Confirmez uniquement si vous voulez effacer définitivement l’historique de ce compte.
                  </p>
                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      disabled={purgeActivityMutation.isPending}
                      onClick={() => {
                        setPurgeConfirmOpen(false)
                        setActivityFeedback(null)
                      }}
                      variant="secondary"
                    >
                      Annuler
                    </Button>
                    <Button disabled={purgeActivityMutation.isPending} onClick={() => void confirmPurgeActivity()} variant="danger">
                      {purgeActivityMutation.isPending ? "Purge..." : "Confirmer la purge"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex justify-end">
                  <Button
                    disabled={purgeActivityMutation.isPending}
                    onClick={() => {
                      setPurgeConfirmOpen(true)
                      setActivityFeedback(null)
                    }}
                    variant="danger"
                  >
                    Purger l’activité
                  </Button>
                </div>
              )}
            </div>
          </div>

          {activityFeedback ? <p className="text-sm text-muted-foreground">{activityFeedback}</p> : null}
        </CardContent>
      </Card>

      {feedback ? <p className="text-sm text-muted-foreground">{feedback}</p> : null}
    </div>
  )
}

export default function UsersPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isSuperAdmin, session } = useAdminSession()
  const [createForm, setCreateForm] = useState<UserForm>(defaultUserForm)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [bulkEmailsInput, setBulkEmailsInput] = useState("")
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null)
  const [bulkResult, setBulkResult] = useState<BulkProvisioningResult>(null)
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null)

  const organizationFilter = isSuperAdmin ? searchParams.get("org") ?? "" : session?.organization.id ?? ""
  const searchFilter = searchParams.get("q") ?? ""
  const selectedUserId = searchParams.get("user") ?? ""
  const usersQueryKey = ["organization-users", organizationFilter] as const

  const setUsersSearchParams = (next: { org?: string; q?: string; user?: string }) => {
    const params = new URLSearchParams()

    if (isSuperAdmin) {
      setSearchValue(params, "org", next.org)
    }
    setSearchValue(params, "q", next.q)
    setSearchValue(params, "user", next.user)
    setSearchParams(params, { replace: true })
  }

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  })

  const rolesCatalogQuery = useQuery({
    queryKey: ["roles-catalog"],
    queryFn: fetchRolesCatalog,
  })

  const permissionsCatalogQuery = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: fetchPermissionsCatalog,
  })

  const usersQuery = useQuery({
    enabled: Boolean(organizationFilter),
    queryKey: usersQueryKey,
    queryFn: () => fetchUsersByOrganization(organizationFilter),
  })

  const filteredUsers = useMemo(() => {
    return filterUsersBySearch(usersQuery.data ?? [], searchFilter)
  }, [searchFilter, usersQuery.data])

  const selectedUser = useMemo(() => {
    if (!filteredUsers.length) {
      return null
    }
    return filteredUsers.find((user) => user.id === selectedUserId) ?? filteredUsers[0]
  }, [filteredUsers, selectedUserId])

  const accessQuery = useQuery({
    enabled: Boolean(selectedUser?.id),
    queryKey: ["user-access", selectedUser?.id],
    queryFn: () => fetchUserAccess(selectedUser!.id),
  })

  const bulkEmails = useMemo(() => parseBulkEmails(bulkEmailsInput), [bulkEmailsInput])

  const createMutation = useMutation({
    mutationFn: () => createUser(organizationFilter, createForm),
    onSuccess: async (created) => {
      setCreateForm(defaultUserForm)
      setFeedback("Utilisateur créé.")
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
      setUsersSearchParams({
        org: organizationFilter,
        q: searchFilter,
        user: created.id,
      })
    },
  })

  const bulkCreateMutation = useMutation({
    mutationFn: async () => {
      if (!organizationFilter) {
        throw new Error("Sélectionnez d abord une organisation.")
      }
      if (bulkEmails.length === 0) {
        throw new Error("Ajoutez au moins une adresse email.")
      }
      return createUsersBulk(organizationFilter, bulkEmails)
    },
    onSuccess: async (result) => {
      setBulkResult(result)
      setBulkEmailsInput("")
      setBulkFeedback(
        `${result.created.length} compte${result.created.length > 1 ? "s" : ""} créé${result.created.length > 1 ? "s" : ""}, ${result.failed.length} échec${result.failed.length > 1 ? "s" : ""}.`,
      )
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
      if (result.created[0]) {
        setUsersSearchParams({
          org: organizationFilter,
          q: searchFilter,
          user: result.created[0].id,
        })
      }
    },
    onError: (error) => {
      setBulkFeedback(error instanceof Error ? error.message : "Impossible de créer les utilisateurs en lot.")
    },
  })

  const profileMutation = useMutation({
    mutationFn: async (input: ProfileUpdateInput) => {
      await updateUser(selectedUser!.id, input)
    },
    onSuccess: async () => {
      setFeedback("Profil utilisateur mis à jour.")
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organization-users"] }),
        queryClient.invalidateQueries({ queryKey: ["user-access", selectedUser?.id] }),
      ])
    },
  })

  const passwordMutation = useMutation({
    mutationFn: async (password: string) => {
      await updateUserPassword(selectedUser!.id, password)
    },
    onSuccess: async () => {
      setFeedback("Mot de passe utilisateur réinitialisé.")
      await queryClient.invalidateQueries({ queryKey: ["user-access", selectedUser?.id] })
    },
  })

  const passwordResetEmailMutation = useMutation({
    mutationFn: async () => {
      await sendUserPasswordResetEmail(selectedUser!.id)
    },
    onSuccess: async () => {
      setFeedback("Email de réinitialisation envoyé.")
      await queryClient.invalidateQueries({ queryKey: ["user-access", selectedUser?.id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (user: User) => {
      await deleteUser(user.id)
      return user
    },
    onSuccess: async (deletedUser) => {
      setDeleteConfirmUserId(null)
      const currentUsers = queryClient.getQueryData<User[]>(usersQueryKey) ?? []
      const remainingUsers = currentUsers.filter((user) => user.id !== deletedUser.id)
      const nextVisibleUser = filterUsersBySearch(remainingUsers, searchFilter)[0]

      queryClient.setQueryData(usersQueryKey, remainingUsers)
      queryClient.removeQueries({ queryKey: ["user-access", deletedUser.id] })
      queryClient.removeQueries({ queryKey: ["user-activity-summary", deletedUser.id] })

      setUsersSearchParams({
        org: organizationFilter,
        q: searchFilter,
        user: nextVisibleUser?.id,
      })
      setFeedback("Utilisateur supprimé.")

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKey }),
        queryClient.invalidateQueries({ queryKey: ["activity-summary"] }),
      ])
    },
  })

  const globalRolesMutation = useMutation({
    mutationFn: async (codes: string[]) => {
      await updateUserGlobalRoles(selectedUser!.id, codes)
    },
    onSuccess: async () => {
      setFeedback("Rôles globaux mis à jour.")
      await queryClient.invalidateQueries({ queryKey: ["user-access", selectedUser?.id] })
    },
  })

  const orgRolesMutation = useMutation({
    mutationFn: async (codes: string[]) => {
      await updateUserOrgRoles(selectedUser!.id, codes)
    },
    onSuccess: async () => {
      setFeedback("Rôles organisation mis à jour.")
      await queryClient.invalidateQueries({ queryKey: ["user-access", selectedUser?.id] })
    },
  })

  const entitlementsMutation = useMutation({
    mutationFn: async (overrides: PermissionOverride[]) => {
      await updateUserEntitlements(selectedUser!.id, overrides)
    },
    onSuccess: async () => {
      setFeedback("Overrides de permissions mis à jour.")
      await queryClient.invalidateQueries({ queryKey: ["user-access", selectedUser?.id] })
    },
  })

  const organizationOptions = organizationsQuery.data ?? []
  const organizationSummary = organizationOptions.find((organization) => organization.id === organizationFilter)
  const userPanelKey =
    selectedUser && accessQuery.data ? buildUserPanelKey(selectedUser, accessQuery.data) : "empty-user-panel"

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filtrer et créer</CardTitle>
          <CardDescription>
            Les actions exposées ici restent limitées par le scope et les permissions résolus côté backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="users-query">Recherche</Label>
              <Input
                id="users-query"
                onChange={(event) =>
                  setUsersSearchParams({
                    org: organizationFilter,
                    q: event.target.value,
                    user: selectedUserId,
                  })
                }
                placeholder="Rechercher par email, identifiant ou statut"
                value={searchFilter}
              />
            </div>

            {isSuperAdmin ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="users-organization">Organisation</Label>
                <select
                  className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                  id="users-organization"
                  onChange={(event) =>
                    setUsersSearchParams({
                      org: event.target.value,
                      q: searchFilter,
                      user: "",
                    })
                  }
                  value={organizationFilter}
                >
                  <option value="">Choisir une organisation</option>
                  {organizationOptions.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="create-user-email">Email</Label>
              <Input
                id="create-user-email"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                type="email"
                value={createForm.email}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-user-password">Mot de passe initial</Label>
              <Input
                id="create-user-password"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                type="password"
                value={createForm.password}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-user-status">Statut</Label>
              <select
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
                id="create-user-status"
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                value={createForm.status}
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={
                  createMutation.isPending ||
                  !organizationFilter ||
                  !createForm.email.trim() ||
                  !createForm.password.trim()
                }
                onClick={() => void createMutation.mutateAsync()}
              >
                {createMutation.isPending ? "Création..." : "Créer l’utilisateur"}
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Scope courant</p>
            <h3 className="mt-3 text-xl font-semibold">
              {organizationSummary?.name ?? session?.organization.name ?? "Organisation"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {organizationSummary?.code ?? session?.organization.code ?? "Aucun code"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={isSuperAdmin ? "success" : "muted"}>
                {isSuperAdmin ? "Super admin" : "Admin org"}
              </Badge>
              {organizationSummary ? (
                <Badge variant={organizationSummary.status === "active" ? "success" : "danger"}>
                  {organizationSummary.status}
                </Badge>
              ) : null}
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Les cookies admin dédiés et le header CSRF sont envoyés uniquement vers le namespace `/api/v1/admin/*`.
            </p>
          </div>
        </CardContent>
      </Card>

      {feedback ? <p className="text-sm text-muted-foreground">{feedback}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Création en lot</CardTitle>
              <CardDescription>
                Collez plusieurs adresses email. Les séparateurs `,`, `;` et les retours ligne sont acceptés. Chaque
                compte reçoit un mot de passe temporaire envoyé par email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bulk-user-emails">Emails</Label>
                <Textarea
                  id="bulk-user-emails"
                  onChange={(event) => setBulkEmailsInput(event.target.value)}
                  placeholder={"user1@example.com\nuser2@example.com"}
                  value={bulkEmailsInput}
                />
                <p className="text-xs text-muted-foreground">
                  {bulkEmails.length} adresse{bulkEmails.length > 1 ? "s" : ""} prête
                  {bulkEmails.length > 1 ? "s" : ""} à être créée{bulkEmails.length > 1 ? "s" : ""}.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Les doublons dans le champ sont ignorés avant l’envoi.
                </p>
                <Button
                  disabled={bulkCreateMutation.isPending || !organizationFilter || bulkEmails.length === 0}
                  onClick={() => {
                    setBulkFeedback(null)
                    setBulkResult(null)
                    void bulkCreateMutation.mutateAsync()
                  }}
                >
                  {bulkCreateMutation.isPending ? "Création..." : "Créer les comptes"}
                </Button>
              </div>
              {bulkFeedback ? <p className="text-sm text-muted-foreground">{bulkFeedback}</p> : null}
              {bulkResult ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="success">
                      {bulkResult.created.length} créé{bulkResult.created.length > 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="danger">
                      {bulkResult.failed.length} échec{bulkResult.failed.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  {bulkResult.created.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Comptes créés</p>
                      <ul className="space-y-2">
                        {bulkResult.created.map((item) => (
                          <li className="rounded-2xl border border-border/70 bg-muted/40 px-4 py-3 text-sm" key={item.id}>
                            <span className="font-medium">{item.email}</span>
                            <span className="ml-2 text-muted-foreground">({item.status})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {bulkResult.failed.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Échecs</p>
                      <ul className="space-y-2">
                        {bulkResult.failed.map((item) => (
                          <li
                            className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
                            key={`${item.email}-${item.error}`}
                          >
                            <span className="font-medium">{item.email}</span>
                            <span className="ml-2 text-muted-foreground">{item.error}</span>
                            {item.userId ? (
                              <span className="mt-1 block text-xs text-muted-foreground">Utilisateur: {item.userId}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <TableWrapper>
            <Table>
              <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Créé</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!organizationFilter ? (
                  <tr className="border-t border-border/70">
                    <td className="px-6 py-4 text-muted-foreground" colSpan={4}>
                      Sélectionnez une organisation pour gérer ses utilisateurs.
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr className="border-t border-border/70">
                    <td className="px-6 py-4 text-muted-foreground" colSpan={4}>
                      Aucun utilisateur trouvé pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const selected = selectedUser?.id === user.id
                    const isDeleteConfirmOpen = deleteConfirmUserId === user.id

                    return (
                      <tr className="border-t border-border/70" key={user.id}>
                        <td className="px-6 py-4">
                          <div className="font-medium">{user.email}</div>
                          <div className="text-xs text-muted-foreground">{user.id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={user.status === "active" ? "success" : "danger"}>{user.status}</Badge>
                        </td>
                        <td className="px-6 py-4">{formatDateTime(user.createdAt)}</td>
                        <td className="px-6 py-4">
                          {isDeleteConfirmOpen ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                disabled={deleteMutation.isPending}
                                onClick={() => setDeleteConfirmUserId(null)}
                                size="sm"
                                variant="secondary"
                              >
                                Annuler
                              </Button>
                              <Button
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                  setFeedback(null)
                                  void (async () => {
                                    try {
                                      await deleteMutation.mutateAsync(user)
                                    } catch (error) {
                                      setFeedback(
                                        error instanceof Error
                                          ? error.message
                                          : "Impossible de supprimer l’utilisateur.",
                                      )
                                    }
                                  })()
                                }}
                                size="sm"
                                variant="danger"
                              >
                                Confirmer la suppression
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                onClick={() => {
                                  setDeleteConfirmUserId(null)
                                  setUsersSearchParams({
                                    org: organizationFilter,
                                    q: searchFilter,
                                    user: user.id,
                                  })
                                }}
                                size="sm"
                                variant={selected ? "primary" : "secondary"}
                              >
                                {selected ? "Sélectionné" : "Gérer"}
                              </Button>
                              <Button
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                  setFeedback(null)
                                  setDeleteConfirmUserId(user.id)
                                }}
                                size="sm"
                                variant="danger"
                              >
                                Supprimer
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          </TableWrapper>
        </div>

        <div>
          {!selectedUser || !accessQuery.data || !rolesCatalogQuery.data || !permissionsCatalogQuery.data ? (
            <Card>
              <CardHeader>
                <CardTitle>Panneau d’accès</CardTitle>
                <CardDescription>
                  Sélectionnez un utilisateur pour modifier ses rôles, son rattachement ou ses overrides.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <UserDetailPanel
              access={accessQuery.data}
              deletePending={deleteMutation.isPending}
              entitlementsPending={entitlementsMutation.isPending}
              globalRolesPending={globalRolesMutation.isPending}
              isSuperAdmin={isSuperAdmin}
              key={userPanelKey}
              onDeleteUser={async () => {
                await deleteMutation.mutateAsync(selectedUser)
              }}
              onResetPassword={async (password) => {
                await passwordMutation.mutateAsync(password)
              }}
              onSaveGlobalRoles={async (codes) => {
                await globalRolesMutation.mutateAsync(codes)
              }}
              onSaveOrgRoles={async (codes) => {
                await orgRolesMutation.mutateAsync(codes)
              }}
              onSaveOverrides={async (overrides) => {
                await entitlementsMutation.mutateAsync(overrides)
              }}
              onSaveProfile={async (input) => {
                await profileMutation.mutateAsync(input)
              }}
              onSendResetEmail={async () => {
                await passwordResetEmailMutation.mutateAsync()
              }}
              orgRolesPending={orgRolesMutation.isPending}
              organizations={organizationOptions.map((organization) => ({
                id: organization.id,
                name: organization.name,
              }))}
              passwordEmailPending={passwordResetEmailMutation.isPending}
              passwordPending={passwordMutation.isPending}
              permissionsCatalog={permissionsCatalogQuery.data}
              profilePending={profileMutation.isPending}
              rolesCatalog={rolesCatalogQuery.data}
              user={selectedUser}
            />
          )}
        </div>
      </div>
    </div>
  )
}
