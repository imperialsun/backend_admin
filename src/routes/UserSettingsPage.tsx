import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchUserAccess,
  fetchOrganizations,
  fetchUserSettings,
  resetUserSettings,
  updateUserSettings,
} from "@/lib/admin-client"
import { useAdminSession } from "@/lib/use-admin-session"

type SettingsDraft = Record<string, unknown>

const TEXT_FIELDS = [
  { key: "customModelId", label: "Model ID custom", placeholder: "ex: MonOrganisation/whisper-finetune" },
  { key: "cloudMistralApiUrl", label: "URL Mistral", placeholder: "https://api.mistral.ai" },
  { key: "cloudMistralModel", label: "Modèle Mistral", placeholder: "voxtral-mini-latest" },
  { key: "cloudDemeterModel", label: "Modèle Demeter", placeholder: "voxtral-mini-latest" },
  { key: "llmApiHfModelId", label: "Model ID Hugging Face", placeholder: "openai/gpt-oss-20b" },
  { key: "llmApiMistralModelId", label: "Model ID Mistral", placeholder: "mistral-medium-latest" },
  { key: "llmLocalModelId", label: "Model ID LLM local", placeholder: "onnx-community/Qwen3-1.7B-ONNX" },
] as const

const NUMBER_FIELDS = [
  { key: "chunkDurationSec", label: "Durée chunk (s)", min: 5, max: 120, step: 5 },
  { key: "overlapSec", label: "Overlap (s)", min: 0, max: 30, step: 1 },
  { key: "cloudMaxTokens", label: "Max tokens cloud", min: 128, max: 262144, step: 128 },
  { key: "cloudTemperature", label: "Température cloud", min: 0, max: 2, step: 0.1 },
  { key: "cloudTopP", label: "Top P cloud", min: 0, max: 1, step: 0.05 },
] as const

const SELECT_FIELDS = [
  {
    key: "activePreset",
    kind: "string",
    label: "Preset actif",
    fallback: "fast",
    options: [
      { value: "fast", label: "Rapide" },
      { value: "balanced", label: "Équilibre" },
      { value: "medium", label: "Intermédiaire" },
      { value: "quality", label: "Qualité" },
      { value: "mms", label: "Multilingue" },
      { value: "turbo", label: "Très haute qualité" },
      { value: "custom", label: "Personnalisé" },
    ],
  },
  {
    key: "backendPreference",
    kind: "string",
    label: "Backend local",
    fallback: "webgpu",
    options: [
      { value: "webgpu", label: "WebGPU" },
      { value: "wasm", label: "WASM" },
    ],
  },
  {
    key: "memoryMode",
    kind: "string",
    label: "Mode mémoire",
    fallback: "full",
    options: [
      { value: "full", label: "Complet" },
      { value: "progressive", label: "Progressif" },
    ],
  },
  {
    key: "chunkStrategy",
    kind: "string",
    label: "Stratégie de chunking",
    fallback: "overlap",
    options: [
      { value: "sequential", label: "Séquentiel" },
      { value: "overlap", label: "Overlap + dédoublonnage" },
      { value: "silence", label: "Détection de silences" },
    ],
  },
  {
    key: "segmentationMode",
    kind: "string",
    label: "Mode segmentation",
    fallback: "chunks",
    options: [
      { value: "chunks", label: "Chunks" },
      { value: "silence", label: "Silence" },
    ],
  },
  {
    key: "dedupeMode",
    kind: "string",
    label: "Mode dédoublonnage",
    fallback: "fuzzy",
    options: [
      { value: "normal", label: "Normal" },
      { value: "fuzzy", label: "Fuzzy" },
    ],
  },
  {
    key: "progressiveSegmentDurationSec",
    kind: "number",
    label: "Segment progressif",
    fallback: 600,
    options: [
      { value: "300", label: "5 minutes" },
      { value: "600", label: "10 minutes" },
      { value: "900", label: "15 minutes" },
      { value: "1200", label: "20 minutes" },
      { value: "1800", label: "30 minutes" },
    ],
  },
  {
    key: "preprocessingMode",
    kind: "string",
    label: "Prétraitement",
    fallback: "full",
    options: [
      { value: "quick", label: "Rapide" },
      { value: "full", label: "Complet" },
    ],
  },
  {
    key: "llmApiProvider",
    kind: "string",
    label: "Provider LLM cloud",
    fallback: "huggingface",
    options: [
      { value: "huggingface", label: "Hugging Face" },
      { value: "mistral", label: "Mistral" },
      { value: "demeter_sante", label: "Demeter Santé" },
    ],
  },
  {
    key: "llmLocalModelProfile",
    kind: "string",
    label: "Profil LLM local",
    fallback: "qwen_1_7b",
    options: [
      { value: "qwen_0_6b", label: "Qwen 3 0.6B" },
      { value: "qwen_1_7b", label: "Qwen 3 1.7B" },
      { value: "ministral_3_3b", label: "Ministral 3 3B" },
    ],
  },
  {
    key: "llmLocalBackendPreference",
    kind: "string",
    label: "Backend LLM local",
    fallback: "webgpu",
    options: [
      { value: "webgpu", label: "WebGPU" },
      { value: "wasm", label: "WASM" },
    ],
  },
] as const

const BOOLEAN_FIELDS = [
  { key: "showSegments", label: "Afficher les segments" },
  { key: "showExportVtt", label: "Exporter VTT" },
  { key: "showExportSrt", label: "Exporter SRT" },
  { key: "showExportJson", label: "Exporter JSON" },
  { key: "showExportTelemetry", label: "Exporter telemetry" },
  { key: "cleanIntraChunk", label: "Nettoyage intra-chunk" },
  { key: "enableWordTimestamps", label: "Timestamps par mot" },
  { key: "showSegmentConfidence", label: "Afficher la confiance" },
  { key: "forceSingleThread", label: "Forcer single-thread" },
  { key: "cloudDoSample", label: "Cloud doSample" },
  { key: "cloudDemeterDiarizationEnabled", label: "Diarisation Demeter" },
] as const

const NUMBER_FIELD_DEFAULTS = {
  chunkDurationSec: 15,
  overlapSec: 1.5,
  cloudMaxTokens: 32768,
  cloudTemperature: 0,
  cloudTopP: 1,
} as const

type SelectFieldConfig = (typeof SELECT_FIELDS)[number]

function getStringValue(settings: SettingsDraft, key: string, fallback = "") {
  const value = settings[key]
  return typeof value === "string" ? value : fallback
}

function getSelectValue(settings: SettingsDraft, field: SelectFieldConfig) {
  const value = settings[field.key]
  if (field.kind === "number") {
    if (typeof value === "number" && field.options.some((option) => Number(option.value) === value)) {
      return String(value)
    }
    return String(field.fallback)
  }
  if (typeof value === "string" && field.options.some((option) => option.value === value)) {
    return value
  }
  return field.fallback
}

function getBooleanValue(settings: SettingsDraft, key: string, fallback = false) {
  const value = settings[key]
  return typeof value === "boolean" ? value : fallback
}

function getNumberValue(settings: SettingsDraft, key: string, fallback = 0) {
  const value = settings[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function formatJson(settings: SettingsDraft) {
  return JSON.stringify(settings, null, 2)
}

function normalizedSettingsPayload(payload: unknown): SettingsDraft {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {}
  }
  const next = { ...(payload as SettingsDraft) }

  for (const field of SELECT_FIELDS) {
    const value = next[field.key]
    if (field.kind === "number") {
      if (typeof value === "number" && field.options.some((option) => Number(option.value) === value)) {
        continue
      }
      if (field.key in next) {
        delete next[field.key]
      }
      continue
    }
    if (typeof value === "string" && field.options.some((option) => option.value === value)) {
      continue
    }
    if (field.key in next) {
      delete next[field.key]
    }
  }

  for (const field of NUMBER_FIELDS) {
    const value = next[field.key]
    if (typeof value === "number" && Number.isFinite(value)) {
      next[field.key] = clampNumber(value, field.min, field.max)
      continue
    }
    if (field.key in next) {
      delete next[field.key]
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    const value = next[field.key]
    if (typeof value === "boolean") {
      continue
    }
    if (field.key in next) {
      delete next[field.key]
    }
  }

  return next
}

function validateAdvancedJson(payload: SettingsDraft) {
  const issues: string[] = []

  for (const field of SELECT_FIELDS) {
    if (!(field.key in payload)) {
      continue
    }
    const value = payload[field.key]
    if (field.kind === "number") {
      if (typeof value !== "number" || !Number.isFinite(value) || !field.options.some((option) => Number(option.value) === value)) {
        issues.push(`${field.label} doit utiliser une valeur autorisée.`)
      }
      continue
    }
    if (typeof value !== "string" || !field.options.some((option) => option.value === value)) {
      issues.push(`${field.label} doit utiliser une valeur autorisée.`)
    }
  }

  for (const field of NUMBER_FIELDS) {
    if (!(field.key in payload)) {
      continue
    }
    const value = payload[field.key]
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push(`${field.label} doit être un nombre.`)
      continue
    }
    if (value < field.min || value > field.max) {
      issues.push(`${field.label} doit être comprise entre ${field.min} et ${field.max}.`)
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    if (!(field.key in payload)) {
      continue
    }
    if (typeof payload[field.key] !== "boolean") {
      issues.push(`${field.label} doit être un booléen.`)
    }
  }

  return issues
}

function updateObjectSetting(
  current: SettingsDraft,
  key: string,
  value: unknown,
): SettingsDraft {
  const next = { ...current }
  if (value === undefined || value === null) {
    delete next[key]
  } else {
    next[key] = value
  }
  return next
}

function SettingTextField(props: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const { id, label, value, onChange, placeholder } = props
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function SettingNumberField(props: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  const { id, label, value, onChange, min, max, step } = props
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const parsed = Number(event.target.value)
          if (!Number.isNaN(parsed)) {
            onChange(clampNumber(parsed, min ?? parsed, max ?? parsed))
          }
        }}
      />
    </div>
  )
}

function SettingSelectField(props: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
}) {
  const { id, label, value, onChange, options } = props
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus:border-primary"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function SettingCheckboxField(props: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}) {
  const { label, value, onChange } = props
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-4 py-3">
      <span className="text-sm font-medium">{label}</span>
      <input checked={value} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
    </label>
  )
}

export default function UserSettingsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id: userId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { session, isSuperAdmin, isOrgAdmin } = useAdminSession()
  const [draft, setDraft] = useState<SettingsDraft>({})
  const [jsonText, setJsonText] = useState("{}")
  const [jsonError, setJsonError] = useState<string | null>(null)
  const draftRef = useRef<SettingsDraft>({})

  const userAccessQuery = useQuery({
    queryKey: ["admin-user-access", userId],
    queryFn: () => fetchUserAccess(userId ?? ""),
    enabled: Boolean(userId),
  })

  const settingsQuery = useQuery({
    queryKey: ["admin-user-settings", userId],
    queryFn: () => fetchUserSettings(userId ?? ""),
    enabled: Boolean(userId),
  })

  const organizationsQuery = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: fetchOrganizations,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("Utilisateur introuvable.")
      }
      const envelope = settingsQuery.data
      return updateUserSettings(userId, {
        schemaVersion: envelope?.schemaVersion ?? 1,
        settings: normalizedSettingsPayload(draft),
      })
    },
    onSuccess: (envelope) => {
      const normalized = normalizedSettingsPayload(envelope.settings)
      draftRef.current = normalized
      queryClient.setQueryData(["admin-user-settings", userId], envelope)
      setDraft(normalized)
      setJsonText(formatJson(normalized))
      setJsonError(null)
    },
  })

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("Utilisateur introuvable.")
      }
      return resetUserSettings(userId)
    },
    onSuccess: (envelope) => {
      const normalized = normalizedSettingsPayload(envelope.settings)
      draftRef.current = normalized
      queryClient.setQueryData(["admin-user-settings", userId], envelope)
      setDraft(normalized)
      setJsonText(formatJson(normalized))
      setJsonError(null)
    },
  })

  const title = userAccessQuery.data?.user.email ?? userId ?? "Réglages utilisateur"
  const organizationName = useMemo(() => {
    const organizationId = userAccessQuery.data?.user.organizationId
    if (!organizationId) {
      return session?.organization?.name ?? ""
    }
    return organizationsQuery.data?.find((organization) => organization.id === organizationId)?.name ?? organizationId
  }, [organizationsQuery.data, session?.organization?.name, userAccessQuery.data?.user.organizationId])

  useEffect(() => {
    const envelope = settingsQuery.data
    if (!envelope) return
    const normalized = normalizedSettingsPayload(envelope.settings)
    draftRef.current = normalized
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the editor when backend data arrives
    setDraft(normalized)
    setJsonText(formatJson(normalized))
    setJsonError(null)
  }, [settingsQuery.data])

  const canEdit = isSuperAdmin || isOrgAdmin

  const updateDraft = (updater: (current: SettingsDraft) => SettingsDraft) => {
    const next = updater(draftRef.current)
    draftRef.current = next
    setDraft(next)
    setJsonText(formatJson(next))
    setJsonError(null)
  }

  const saveDisabled = Boolean(jsonError) || saveMutation.isPending || resetMutation.isPending || !canEdit
  const loading = userAccessQuery.isLoading || settingsQuery.isLoading || organizationsQuery.isLoading
  const error = userAccessQuery.error ?? settingsQuery.error ?? organizationsQuery.error
  const normalizedDraft = useMemo(() => normalizedSettingsPayload(draft), [draft])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Chargement des réglages</CardTitle>
          <CardDescription>Récupération du compte utilisateur et de ses réglages backend.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Impossible de charger les réglages</CardTitle>
          <CardDescription>{error instanceof Error ? error.message : "Réessayez dans quelques instants."}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Réglages utilisateur</p>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {organizationName ? `Organisation: ${organizationName}. ` : ""}
            Les réglages enregistrés ici sont ceux que le frontend recharge au démarrage.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => navigate(`/users${searchParams.toString() ? `?${searchParams.toString()}` : ""}`)}
            variant="secondary"
          >
            Retour à la liste
          </Button>
          <Button disabled={saveDisabled} onClick={() => void saveMutation.mutateAsync()}>
            {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
          <Button
            disabled={resetMutation.isPending || !canEdit}
            onClick={() => void resetMutation.mutateAsync()}
            variant="danger"
          >
            {resetMutation.isPending ? "Réinitialisation..." : "Réinitialiser"}
          </Button>
        </div>
      </div>

      {!canEdit ? (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle>Accès lecture seule</CardTitle>
            <CardDescription>
              Cette page est accessible en lecture seule pour votre profil administrateur actuel.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Réglages principaux</CardTitle>
          <CardDescription>Réglages les plus visibles dans la page frontend.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {SELECT_FIELDS.map((field) => (
            <SettingSelectField
              key={field.key}
              id={field.key}
              label={field.label}
              value={getSelectValue(normalizedDraft, field)}
              options={field.options}
              onChange={(value) =>
                updateDraft((current) =>
                  ({ ...current, [field.key]: field.kind === "number" ? Number(value) : value } as SettingsDraft)
                )
              }
            />
          ))}
          {TEXT_FIELDS.map((field) => (
            <SettingTextField
              key={field.key}
              id={field.key}
              label={field.label}
              value={getStringValue(normalizedDraft, field.key)}
              onChange={(value) => updateDraft((current) => updateObjectSetting(current, field.key, value))}
              placeholder={field.placeholder}
            />
          ))}
          {NUMBER_FIELDS.map((field) => (
            <SettingNumberField
              key={field.key}
              id={field.key}
              label={field.label}
              value={getNumberValue(normalizedDraft, field.key, NUMBER_FIELD_DEFAULTS[field.key])}
              onChange={(value) =>
                updateDraft((current) => updateObjectSetting(current, field.key, clampNumber(value, field.min, field.max)))
              }
              min={field.min}
              max={field.max}
              step={field.step}
            />
          ))}
          {BOOLEAN_FIELDS.map((field) => (
            <SettingCheckboxField
              key={field.key}
              label={field.label}
              value={getBooleanValue(normalizedDraft, field.key)}
              onChange={(value) => updateDraft((current) => updateObjectSetting(current, field.key, value))}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Éditeur avancé</CardTitle>
          <CardDescription>
            JSON complet des réglages. Toute valeur non exposée dans les sections ci-dessus peut être éditée ici.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label htmlFor="settings-json-editor">JSON complet</Label>
          <Textarea
            id="settings-json-editor"
            className="min-h-[28rem] font-mono text-xs"
            onChange={(event) => {
              const nextText = event.target.value
              setJsonText(nextText)
              try {
                const parsed = JSON.parse(nextText) as unknown
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                  setJsonError("Le JSON doit être un objet.")
                  return
                }
                const validationIssues = validateAdvancedJson(parsed as SettingsDraft)
                if (validationIssues.length > 0) {
                  setJsonError(`JSON invalide pour les réglages: ${validationIssues[0]}`)
                  return
                }
                const normalized = normalizedSettingsPayload(parsed)
                draftRef.current = normalized
                setDraft(normalized)
                setJsonError(null)
              } catch (parseError) {
                setJsonError(parseError instanceof Error ? parseError.message : "JSON invalide.")
              }
            }}
            value={jsonText}
          />
          {jsonError ? <p className="text-sm text-rose-600">{jsonError}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contrat backend</CardTitle>
          <CardDescription>
            Version API: {settingsQuery.data?.version ?? 1}. Schéma: {settingsQuery.data?.schemaVersion ?? 1}. Mis à jour le{" "}
            {settingsQuery.data?.updatedAt ?? "n/a"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Le frontend utilisateur recharge ces réglages au lancement via le backend, puis hydrate le store local
            avec la réponse reçue.
          </p>
          <p>
            Le bouton de reset remet le document à un objet vide, ce qui laisse le frontend retomber sur ses valeurs
            par défaut.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
