import { getAdminCsrfToken } from "@/lib/admin-security"
import { getRuntimeConfig } from "@/lib/runtime-config"

export class AdminHttpError extends Error {
  readonly status: number
  readonly path: string
  readonly code: string

  constructor(params: { status: number; path: string; message: string; code: string }) {
    super(params.message)
    this.name = "AdminHttpError"
    this.status = params.status
    this.path = params.path
    this.code = params.code
  }
}

function toBackendUrl(path: string) {
  const base = getRuntimeConfig().backendBaseUrl
  const suffix = path.startsWith("/") ? path : `/${path}`
  return `${base}${suffix}`
}

function isMutating(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method)
}

export async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text) return {} as T
  return JSON.parse(text) as T
}

export async function toAdminHttpError(response: Response, path: string) {
  const text = await response.text()
  let message = `HTTP ${response.status}`
  let code = `http_${response.status}`

  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string }
      message = parsed.message?.trim() || parsed.error?.trim() || message
      code = parsed.error?.trim().toLowerCase().replace(/\s+/g, "_") || code
    } catch {
      message = text.trim()
    }
  }

  return new AdminHttpError({
    status: response.status,
    path,
    message,
    code,
  })
}

function toAdminNetworkError(path: string, cause: unknown) {
  const browserMessage = cause instanceof Error ? cause.message.trim() : ""
  const detail = browserMessage ? ` (${browserMessage})` : ""

  return new AdminHttpError({
    status: 0,
    path,
    code: "network_error",
    message: `Impossible de joindre le backend admin. Verifiez l URL backend, le protocole HTTP/HTTPS et CORS${detail}.`,
  })
}

export async function adminFetch(path: string, init?: RequestInit) {
  const method = (init?.method ?? "GET").toUpperCase()
  const headers = new Headers(init?.headers ?? {})
  headers.set("Accept", "application/json")
  if (isMutating(method) && !headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json")
  }
  if (isMutating(method) && !headers.has("X-Admin-CSRF")) {
    const csrfToken = getAdminCsrfToken()
    if (csrfToken) {
      headers.set("X-Admin-CSRF", csrfToken)
    }
  }

  let response: Response
  try {
    response = await fetch(toBackendUrl(path), {
      credentials: "include",
      ...init,
      method,
      headers,
    })
  } catch (error) {
    throw toAdminNetworkError(path, error)
  }

  if (!response.ok) {
    throw await toAdminHttpError(response, path)
  }
  return response
}

export async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await adminFetch(path, init)
  return parseJson<T>(response)
}

export async function requestNoContent(path: string, init?: RequestInit) {
  await adminFetch(path, init)
}
