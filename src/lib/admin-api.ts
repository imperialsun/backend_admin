import { getAdminCsrfToken } from "@/lib/admin-security"
import { getRuntimeConfig } from "@/lib/runtime-config"

const DEFAULT_SAFE_TIMEOUT_MS = 15_000
const DEFAULT_MUTATING_TIMEOUT_MS = 30_000
const DEFAULT_RETRY_ATTEMPTS = 2
const DEFAULT_RETRY_INITIAL_BACKOFF_MS = 300
const DEFAULT_RETRY_MAX_BACKOFF_MS = 2_000
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])
const RETRYABLE_HTTP_STATUSES = new Set([404, 408, 502, 503, 504])

export type AdminFetchOptions = RequestInit & {
  timeoutMs?: number
  retryAttempts?: number
  retryInitialBackoffMs?: number
  retryMaxBackoffMs?: number
}

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

class AdminTimeoutError extends Error {
  readonly path: string
  readonly method: string
  readonly url: string
  readonly timeoutMs: number

  constructor(params: { path: string; method: string; url: string; timeoutMs: number }) {
    super(`Le backend admin ne répond pas dans le délai imparti. (${params.method} ${params.path} -> ${params.url}, ${params.timeoutMs} ms)`)
    this.name = "AdminTimeoutError"
    this.path = params.path
    this.method = params.method
    this.url = params.url
    this.timeoutMs = params.timeoutMs
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

function isRetryableMethod(method: string) {
  return RETRYABLE_METHODS.has(method)
}

function isRetryableHttpStatus(status: number) {
  return RETRYABLE_HTTP_STATUSES.has(status)
}

function isRetryableTransportError(error: unknown) {
  if (error instanceof AdminTimeoutError) {
    return true
  }
  if (error instanceof TypeError) {
    return true
  }
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch|networkerror|load failed/i.test(message)
}

function getDefaultTimeoutMs(method: string) {
  return isRetryableMethod(method) ? DEFAULT_SAFE_TIMEOUT_MS : DEFAULT_MUTATING_TIMEOUT_MS
}

function calculateRetryDelayMs(attempt: number, initialBackoffMs: number, maxBackoffMs: number) {
  return Math.min(initialBackoffMs * 2 ** attempt, maxBackoffMs)
}

async function performFetchWithTimeout(
  url: string,
  init: RequestInit,
  path: string,
  method: string,
  timeoutMs: number
): Promise<Response> {
  const externalSignal = init.signal
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
  let timedOut = false

  const onExternalAbort = () => {
    controller.abort()
  }

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true })
    }
  }

  if (timeoutMs > 0) {
    timeoutId = globalThis.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)
  }

  try {
    return await fetch(url, {
      ...init,
      credentials: "include",
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut && error instanceof Error && error.name === "AbortError") {
      throw new AdminTimeoutError({
        path,
        method,
        url,
        timeoutMs,
      })
    }
    throw error
  } finally {
    if (timeoutId !== undefined) {
      globalThis.clearTimeout(timeoutId)
    }
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort)
    }
  }
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

function toAdminTransportError(path: string, error: unknown) {
  if (error instanceof AdminTimeoutError) {
    return new AdminHttpError({
      status: 0,
      path,
      code: "timeout",
      message: `Le backend admin ne répond pas dans le délai imparti. Réessayez dans quelques instants. (${error.method} ${error.path} -> ${error.url}, ${error.timeoutMs} ms)`,
    })
  }

  const browserMessage = error instanceof Error ? error.message.trim() : ""
  const detail = browserMessage ? ` (${browserMessage})` : ""

  return new AdminHttpError({
    status: 0,
    path,
    code: "network_error",
    message: `Impossible de joindre le backend admin. Vérifiez l'URL backend, le protocole HTTP/HTTPS et CORS${detail}.`,
  })
}

export async function adminFetch(path: string, init?: AdminFetchOptions) {
  const method = (init?.method ?? "GET").toUpperCase()
  const retryAttempts = init?.retryAttempts ?? (isRetryableMethod(method) ? DEFAULT_RETRY_ATTEMPTS : 0)
  const retryInitialBackoffMs = init?.retryInitialBackoffMs ?? DEFAULT_RETRY_INITIAL_BACKOFF_MS
  const retryMaxBackoffMs = init?.retryMaxBackoffMs ?? DEFAULT_RETRY_MAX_BACKOFF_MS
  const timeoutMs = init?.timeoutMs ?? getDefaultTimeoutMs(method)
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

  let attempt = 0
  while (true) {
    let response: Response
    try {
      response = await performFetchWithTimeout(
        toBackendUrl(path),
        {
          ...(init ?? {}),
          method,
          headers,
        },
        path,
        method,
        timeoutMs
      )
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error
      }
      if (attempt < retryAttempts && isRetryableTransportError(error)) {
        const delayMs = calculateRetryDelayMs(attempt, retryInitialBackoffMs, retryMaxBackoffMs)
        attempt += 1
        await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs))
        continue
      }

      throw toAdminTransportError(path, error)
    }

    if (!response.ok && attempt < retryAttempts && isRetryableHttpStatus(response.status)) {
      const delayMs = calculateRetryDelayMs(attempt, retryInitialBackoffMs, retryMaxBackoffMs)
      attempt += 1
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs))
      continue
    }

    if (!response.ok) {
      throw await toAdminHttpError(response, path)
    }

    return response
  }
}

export async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await adminFetch(path, init)
  return parseJson<T>(response)
}

export async function requestNoContent(path: string, init?: RequestInit) {
  await adminFetch(path, init)
}
