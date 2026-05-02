import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, FileSliders, WandSparkles } from "lucide-react"

import {
  createOrganizationReportTemplate,
  createReportTemplateDraftOperation,
  fetchOrganizationReportTemplates,
  fetchOrganizations,
  fetchReportTemplateDraftOperation,
  updateOrganizationReportTemplate,
  type ReportTemplateDraftOperationInput,
  type ReportTemplateInput,
} from "@/lib/admin-client"
import type { OrganizationReportTemplate, ReportTemplateBaseFormat } from "@/lib/types"
import { useAdminSession } from "@/lib/use-admin-session"
import { formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const BASE_FORMATS: ReportTemplateBaseFormat[] = ["CRI", "CRO", "CRS", "CRN"]

const emptyDraft: ReportTemplateInput = {
  name: "",
  description: "",
  baseFormat: "CRI",
  instructions: "",
  exampleOutline: "",
  orgEnabled: true,
}

const emptyAiDraft: ReportTemplateDraftOperationInput = {
  draftBrief: "",
  baseFormatHint: "",
  tone: "",
  requiredSections: [],
}

function buildPromptPreview(draft: ReportTemplateInput) {
  return [
    `Format de base: ${draft.baseFormat}`,
    `Nom du modèle: ${draft.name || "Nouveau modèle"}`,
    "",
    "Consignes spécifiques:",
    draft.instructions || "Décrivez l'objectif, les rubriques attendues, le style et les contraintes.",
    draft.exampleOutline ? `\nStructure attendue:\n${draft.exampleOutline}` : "",
  ].join("\n")
}

export default function ReportTemplatesPage() {
  const { isSuperAdmin, session } = useAdminSession()
  const queryClient = useQueryClient()
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(session?.organization.id ?? "")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReportTemplateInput>(emptyDraft)
  const [aiDraft, setAiDraft] = useState<ReportTemplateDraftOperationInput>(emptyAiDraft)
  const [aiSectionsText, setAiSectionsText] = useState("")
  const [aiOperationId, setAiOperationId] = useState("")
  const [aiAssistantOpen, setAiAssistantOpen] = useState(true)

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: fetchOrganizations,
    enabled: isSuperAdmin,
  })
  const organizationId = isSuperAdmin ? selectedOrganizationId : session?.organization.id ?? ""
  const templatesQuery = useQuery({
    queryKey: ["organization-report-templates", organizationId],
    queryFn: () => fetchOrganizationReportTemplates(organizationId),
    enabled: Boolean(organizationId),
  })
  const aiOperationQuery = useQuery({
    queryKey: ["report-template-draft-operation", aiOperationId],
    queryFn: () => fetchReportTemplateDraftOperation(aiOperationId),
    enabled: Boolean(aiOperationId),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === "completed" || status === "failed" || status === "cancelled" ? false : 1200
    },
  })

  const selectedOrganization = useMemo(
    () => (organizationsQuery.data ?? []).find((organization) => organization.id === organizationId) ?? session?.organization,
    [organizationId, organizationsQuery.data, session?.organization],
  )

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("Sélectionnez une organisation.")
      return editingId
        ? updateOrganizationReportTemplate(organizationId, editingId, draft)
        : createOrganizationReportTemplate(organizationId, draft)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["organization-report-templates", organizationId] })
      setEditingId(null)
      setDraft(emptyDraft)
    },
  })

  const aiMutation = useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("Sélectionnez une organisation.")
      const requiredSections = aiSectionsText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
      return createReportTemplateDraftOperation(organizationId, { ...aiDraft, requiredSections })
    },
    onSuccess: (operation) => {
      setAiOperationId(operation.operationId)
    },
  })

  useEffect(() => {
    const response = aiOperationQuery.data?.response
    if (aiOperationQuery.data?.status !== "completed" || response?.kind !== "report_template_draft") {
      return
    }
    setEditingId(null)
    setDraft({
      name: response.draft.name,
      description: response.draft.description,
      baseFormat: response.draft.baseFormat,
      instructions: response.draft.instructions,
      exampleOutline: response.draft.exampleOutline,
      orgEnabled: true,
    })
  }, [aiOperationQuery.data])

  const startEdit = (template: OrganizationReportTemplate) => {
    setEditingId(template.id)
    setDraft({
      name: template.name,
      description: template.description,
      baseFormat: template.baseFormat,
      instructions: template.instructions,
      exampleOutline: template.exampleOutline,
      orgEnabled: template.orgEnabled,
    })
  }

  const toggleOrgEnabled = (template: OrganizationReportTemplate, orgEnabled: boolean) => {
    updateOrganizationReportTemplate(template.organizationId, template.id, {
      name: template.name,
      description: template.description,
      baseFormat: template.baseFormat,
      instructions: template.instructions,
      exampleOutline: template.exampleOutline,
      orgEnabled,
    })
      .then(() => queryClient.invalidateQueries({ queryKey: ["organization-report-templates", template.organizationId] }))
      .catch(() => undefined)
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Rédaction</p>
          <h1 className="mt-2 text-3xl font-semibold">Modèles CR</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Créez des modèles de compte rendu propres à une organisation. Les utilisateurs les activeront ensuite dans Front User.
          </p>
        </div>
        {isSuperAdmin ? (
          <div className="w-full max-w-sm space-y-2">
            <Label htmlFor="report-template-organization">Organisation</Label>
            <select
              id="report-template-organization"
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={organizationId}
              onChange={(event) => {
                setSelectedOrganizationId(event.target.value)
                setEditingId(null)
                setDraft(emptyDraft)
              }}
            >
              <option value="">Choisir une organisation</option>
              {(organizationsQuery.data ?? []).map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <WandSparkles className="h-5 w-5" />
                    Assistant IA
                  </CardTitle>
                  <CardDescription>Générez un brouillon via la queue rapport Demeter Santé.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {aiOperationQuery.data ? (
                    <Badge variant={aiOperationQuery.data.status === "completed" ? "success" : aiOperationQuery.data.status === "failed" ? "danger" : "default"}>
                      {aiOperationQuery.data.status === "pending"
                        ? "En file"
                        : aiOperationQuery.data.status === "running"
                          ? "Génération"
                          : aiOperationQuery.data.status === "completed"
                            ? "Terminé"
                            : "Erreur"}
                    </Badge>
                  ) : null}
                  <Button size="sm" variant="secondary" onClick={() => setAiAssistantOpen((open) => !open)}>
                    {aiAssistantOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                    {aiAssistantOpen ? "Replier" : "Déplier"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {aiAssistantOpen ? (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="report-template-ai-brief">Brief métier</Label>
                  <Textarea
                    id="report-template-ai-brief"
                    rows={4}
                    value={aiDraft.draftBrief}
                    onChange={(event) => setAiDraft({ ...aiDraft, draftBrief: event.target.value })}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="report-template-ai-format">Format de base optionnel</Label>
                    <select
                      id="report-template-ai-format"
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={aiDraft.baseFormatHint}
                      onChange={(event) => setAiDraft({ ...aiDraft, baseFormatHint: event.target.value as ReportTemplateBaseFormat | "" })}
                    >
                      <option value="">IA choisit</option>
                      {BASE_FORMATS.map((format) => (
                        <option key={format} value={format}>
                          {format}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report-template-ai-tone">Ton / style optionnel</Label>
                    <Input
                      id="report-template-ai-tone"
                      value={aiDraft.tone}
                      onChange={(event) => setAiDraft({ ...aiDraft, tone: event.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="report-template-ai-sections">Sections souhaitées optionnelles</Label>
                  <Textarea
                    id="report-template-ai-sections"
                    rows={3}
                    value={aiSectionsText}
                    onChange={(event) => setAiSectionsText(event.target.value)}
                  />
                </div>
                {aiMutation.error ? <p className="text-sm text-destructive">{String(aiMutation.error)}</p> : null}
                {aiOperationQuery.data?.lastError ? <p className="text-sm text-destructive">{aiOperationQuery.data.lastError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => aiMutation.mutate()}
                    disabled={aiMutation.isPending || !organizationId || !aiDraft.draftBrief.trim()}
                  >
                    {aiMutation.isPending ? "Mise en file..." : "Générer un brouillon"}
                  </Button>
                </div>
              </CardContent>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSliders className="h-5 w-5" />
                Saisie du modèle
              </CardTitle>
              <CardDescription>Renseignez les champs, vérifiez l’aperçu, puis publiez le modèle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="report-template-name">Nom</Label>
                <Input id="report-template-name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-template-format">Format de base</Label>
                <select
                  id="report-template-format"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={draft.baseFormat}
                  onChange={(event) => setDraft({ ...draft, baseFormat: event.target.value as ReportTemplateBaseFormat })}
                >
                  {BASE_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-template-description">Description courte</Label>
              <Input id="report-template-description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-template-instructions">Objectif, sections, style et contraintes</Label>
              <Textarea
                id="report-template-instructions"
                rows={8}
                value={draft.instructions}
                onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-template-outline">Structure ou exemple attendu</Label>
              <Textarea
                id="report-template-outline"
                rows={5}
                value={draft.exampleOutline}
                onChange={(event) => setDraft({ ...draft, exampleOutline: event.target.value })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-2xl border bg-background/70 p-4">
              <Label htmlFor="report-template-enabled">Disponible pour l’organisation</Label>
              <input
                id="report-template-enabled"
                type="checkbox"
                checked={draft.orgEnabled}
                onChange={(event) => setDraft({ ...draft, orgEnabled: event.target.checked })}
              />
            </div>
            <pre className="max-h-64 overflow-auto rounded-2xl border bg-muted/40 p-4 text-xs whitespace-pre-wrap">{buildPromptPreview(draft)}</pre>
            {saveMutation.error ? <p className="text-sm text-destructive">{String(saveMutation.error)}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !organizationId}>
                {saveMutation.isPending ? "Enregistrement..." : editingId ? "Enregistrer" : "Créer le modèle"}
              </Button>
              {editingId ? (
                <Button variant="secondary" onClick={() => { setEditingId(null); setDraft(emptyDraft) }}>
                  Annuler
                </Button>
              ) : null}
            </div>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4">
          <div className="rounded-3xl border bg-card p-4">
            <p className="text-sm font-medium">{selectedOrganization?.name ?? "Organisation"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{templatesQuery.data?.length ?? 0} modèle(s)</p>
          </div>
          {(templatesQuery.data ?? []).map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileSliders className="h-4 w-4" />
                      {template.name}
                    </CardTitle>
                    <CardDescription>{template.description || "Sans description"}</CardDescription>
                  </div>
                  <Badge variant={template.orgEnabled ? "success" : "muted"}>{template.orgEnabled ? "On" : "Off"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">{template.baseFormat}</Badge>
                  <Badge variant="muted">Maj {formatDateTime(template.updatedAt)}</Badge>
                </div>
                <p className="line-clamp-3 text-muted-foreground">{template.instructions}</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => startEdit(template)}>
                    Éditer
                  </Button>
                  <Button size="sm" variant={template.orgEnabled ? "danger" : "primary"} onClick={() => toggleOrgEnabled(template, !template.orgEnabled)}>
                    {template.orgEnabled ? "Désactiver" : "Activer"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!templatesQuery.isLoading && !(templatesQuery.data ?? []).length ? (
            <div className="rounded-3xl border border-dashed bg-muted/20 p-8 text-sm text-muted-foreground">
              Aucun modèle pour cette organisation.
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
