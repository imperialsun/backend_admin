import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableWrapper } from "@/components/ui/table"
import { createOrganization, fetchOrganizations, updateOrganization } from "@/lib/admin-client"
import { formatDateTime } from "@/lib/utils"

type OrganizationForm = {
  name: string
  code: string
  status: string
}

export default function OrganizationsPage() {
  const queryClient = useQueryClient()
  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
  })
  const [createForm, setCreateForm] = useState<OrganizationForm>({ name: "", code: "", status: "active" })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingForm, setEditingForm] = useState<OrganizationForm>({ name: "", code: "", status: "active" })
  const [feedback, setFeedback] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: async () => {
      setFeedback("Organisation créée.")
      setCreateForm({ name: "", code: "", status: "active" })
      await queryClient.invalidateQueries({ queryKey: ["organizations"] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: OrganizationForm }) => updateOrganization(id, payload),
    onSuccess: async () => {
      setFeedback("Organisation mise à jour.")
      setEditingId(null)
      await queryClient.invalidateQueries({ queryKey: ["organizations"] })
    },
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Créer une organisation</CardTitle>
          <CardDescription>Chaque organisation reste isolée côté backend par `organization_id`.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="organization-name">Nom</Label>
            <Input
              id="organization-name"
              onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
              value={createForm.name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization-code">Code</Label>
            <Input
              id="organization-code"
              onChange={(event) => setCreateForm((current) => ({ ...current, code: event.target.value }))}
              value={createForm.code}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="organization-status">Statut</Label>
            <select
              className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm"
              id="organization-status"
              onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value }))}
              value={createForm.status}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              className="w-full"
              disabled={createMutation.isPending || !createForm.name.trim()}
              onClick={() => createMutation.mutate(createForm)}
            >
              {createMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </div>
          {feedback ? <p className="md:col-span-4 text-sm text-muted-foreground">{feedback}</p> : null}
        </CardContent>
      </Card>

      <TableWrapper>
        <Table>
          <thead className="bg-background/80 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="px-6 py-4">Nom</th>
              <th className="px-6 py-4">Code</th>
              <th className="px-6 py-4">Statut</th>
              <th className="px-6 py-4">Mis à jour</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(organizationsQuery.data ?? []).map((organization) => {
              const editing = editingId === organization.id

              return (
                <tr className="border-t border-border/70" key={organization.id}>
                  <td className="px-6 py-4">
                    {editing ? (
                      <Input
                        onChange={(event) => setEditingForm((current) => ({ ...current, name: event.target.value }))}
                        value={editingForm.name}
                      />
                    ) : (
                      organization.name
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editing ? (
                      <Input
                        onChange={(event) => setEditingForm((current) => ({ ...current, code: event.target.value }))}
                        value={editingForm.code}
                      />
                    ) : (
                      organization.code
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editing ? (
                      <select
                        className="h-10 rounded-2xl border border-border bg-background px-4 text-sm"
                        onChange={(event) => setEditingForm((current) => ({ ...current, status: event.target.value }))}
                        value={editingForm.status}
                      >
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    ) : (
                      organization.status
                    )}
                  </td>
                  <td className="px-6 py-4">{formatDateTime(organization.updatedAt)}</td>
                  <td className="px-6 py-4 text-right">
                    {editing ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingId(null)
                          }}
                        >
                          Annuler
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateMutation.mutate({ id: organization.id, payload: editingForm })}
                        >
                          Enregistrer
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingId(organization.id)
                          setEditingForm({
                            name: organization.name,
                            code: organization.code,
                            status: organization.status,
                          })
                        }}
                      >
                        Éditer
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      </TableWrapper>
    </div>
  )
}
