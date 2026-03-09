import { spawn } from "node:child_process"
import type { ChildProcessWithoutNullStreams } from "node:child_process"
import fs from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"

import { resetRuntimeConfigForTests } from "@/lib/runtime-config"
import type { AdminSessionPayload, Organization, User } from "@/lib/types"

type StoredCookie = {
  name: string
  value: string
  path: string
  expiresAt?: number
}

type GlobalFetch = typeof fetch

export type RealBackendHandle = {
  apiBaseUrl: string
  credentials: {
    email: string
    password: string
  }
  createTransport: () => CookieJarTransport
  configureRuntime: () => void
  logs: () => string
  stop: () => Promise<void>
}

type LoginCredentials = {
  email: string
  password: string
}

type CreateOrganizationInput = {
  name: string
  code: string
  status: string
}

type CreateUserInput = {
  email: string
  password: string
  status: string
}

type ActivityEventInput = {
  eventId: string
  eventKind: "transcription" | "report"
  sourceMode: "local" | "cloud_direct" | "cloud_backend"
  provider: string
  status: "success" | "error"
  occurredAt?: string
}

type ActivityEventsResponse = {
  accepted: number
  duplicates: number
  rejected: Array<{
    eventId: string
    reason: string
  }>
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function resolveFreePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("[integration] failed to resolve a free port")))
        return
      }
      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

async function assertBackendPrerequisites(backendDir: string) {
  const serverEntrypoint = path.join(backendDir, "cmd", "server", "main.go")
  try {
    await fs.access(serverEntrypoint)
  } catch {
    throw new Error(`[integration] backend entrypoint not found at ${serverEntrypoint}`)
  }

  await new Promise<void>((resolve, reject) => {
    const probe = spawn("go", ["version"], {
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stderr = ""
    probe.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    probe.once("error", () => {
      reject(new Error("[integration] `go` is required to run the real backend integration tests"))
    })

    probe.once("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`[integration] \`go version\` failed${stderr ? `: ${stderr.trim()}` : ""}`))
    })
  })
}

function parseSetCookie(raw: string): StoredCookie | null {
  const parts = raw.split(";")
  const nameValue = parts.shift()?.trim() ?? ""
  const separatorIndex = nameValue.indexOf("=")
  if (separatorIndex <= 0) {
    return null
  }

  const name = nameValue.slice(0, separatorIndex).trim()
  const value = nameValue.slice(separatorIndex + 1)
  let cookiePath = "/"
  let expiresAt: number | undefined

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    const attributeSeparator = trimmed.indexOf("=")
    const key = (attributeSeparator === -1 ? trimmed : trimmed.slice(0, attributeSeparator)).trim().toLowerCase()
    const attributeValue = attributeSeparator === -1 ? "" : trimmed.slice(attributeSeparator + 1).trim()

    if (key === "path" && attributeValue) {
      cookiePath = attributeValue
      continue
    }

    if (key === "max-age") {
      const ttlSeconds = Number(attributeValue)
      if (Number.isFinite(ttlSeconds)) {
        expiresAt = Date.now() + ttlSeconds * 1_000
      }
      continue
    }

    if (key === "expires") {
      const nextExpires = Date.parse(attributeValue)
      if (!Number.isNaN(nextExpires)) {
        expiresAt = nextExpires
      }
    }
  }

  return {
    name,
    value,
    path: cookiePath,
    expiresAt,
  }
}

function isExpired(cookie: StoredCookie) {
  return typeof cookie.expiresAt === "number" && cookie.expiresAt <= Date.now()
}

export class CookieJarTransport {
  private readonly baseFetch: GlobalFetch
  private readonly cookies = new Map<string, StoredCookie>()

  constructor(private readonly origin: string, baseFetch: GlobalFetch = globalThis.fetch.bind(globalThis)) {
    if (typeof baseFetch !== "function") {
      throw new Error("[integration] global fetch is unavailable in this runtime")
    }
    this.baseFetch = baseFetch
  }

  private cookieKey(cookie: Pick<StoredCookie, "name" | "path">) {
    return `${cookie.name}@@${cookie.path}`
  }

  private matchingCookieHeader(url: URL) {
    const validCookies = [...this.cookies.values()]
      .filter((cookie) => !isExpired(cookie))
      .filter((cookie) => url.pathname.startsWith(cookie.path))
      .sort((left, right) => right.path.length - left.path.length)

    if (validCookies.length === 0) {
      return ""
    }

    return validCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
  }

  private persistCookies(response: Response) {
    const headerBag = response.headers as Headers & { getSetCookie?: () => string[] }
    const rawCookies = headerBag.getSetCookie?.() ?? []
    for (const rawCookie of rawCookies) {
      const parsed = parseSetCookie(rawCookie)
      if (!parsed) continue

      const key = this.cookieKey(parsed)
      if (!parsed.value || isExpired(parsed)) {
        this.cookies.delete(key)
        continue
      }

      this.cookies.set(key, parsed)
    }
  }

  async fetch(input: RequestInfo | URL, init?: RequestInit) {
    const request = new Request(input, init)
    const requestUrl = new URL(request.url, this.origin)
    const headers = new Headers(request.headers)
    const cookieHeader = this.matchingCookieHeader(requestUrl)
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader)
    }

    const response = await this.baseFetch(new Request(request, { headers }))
    if (requestUrl.origin === this.origin) {
      this.persistCookies(response)
    }
    return response
  }

  async fetchPath(pathname: string, init?: RequestInit) {
    return this.fetch(new URL(pathname, this.origin), init)
  }

  async requestJson<T>(pathname: string, init?: RequestInit) {
    const response = await this.fetchPath(pathname, init)
    const rawBody = await response.text()
    const data = rawBody ? (JSON.parse(rawBody) as T) : ({} as T)
    if (!response.ok) {
      throw new Error(
        `[integration] ${init?.method ?? "GET"} ${pathname} failed with ${response.status}: ${rawBody || "<empty>"}`,
      )
    }
    return data
  }

  async requestNoContent(pathname: string, init?: RequestInit) {
    const response = await this.fetchPath(pathname, init)
    const rawBody = await response.text()
    if (!response.ok) {
      throw new Error(
        `[integration] ${init?.method ?? "GET"} ${pathname} failed with ${response.status}: ${rawBody || "<empty>"}`,
      )
    }
  }

  installAsGlobalFetch() {
    const previousGlobalFetch = globalThis.fetch
    const previousWindowFetch = typeof window !== "undefined" ? window.fetch : undefined
    const nextFetch = this.fetch.bind(this) as typeof fetch

    globalThis.fetch = nextFetch
    if (typeof window !== "undefined") {
      window.fetch = nextFetch
    }

    return () => {
      globalThis.fetch = previousGlobalFetch
      if (typeof window !== "undefined" && previousWindowFetch) {
        window.fetch = previousWindowFetch
      }
    }
  }

  deleteCookieByExactPath(pathname: string) {
    for (const cookie of [...this.cookies.values()]) {
      if (cookie.path === pathname) {
        this.cookies.delete(this.cookieKey(cookie))
      }
    }
  }

  deleteCookieByName(name: string) {
    for (const cookie of [...this.cookies.values()]) {
      if (cookie.name === name) {
        this.cookies.delete(this.cookieKey(cookie))
      }
    }
  }

  clearCookies() {
    this.cookies.clear()
  }
}

export async function startRealBackend(): Promise<RealBackendHandle> {
  const backendDir = path.resolve(process.cwd(), "../Backend")
  await assertBackendPrerequisites(backendDir)

  const port = await resolveFreePort()
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "demeter-admin-integration-"))
  const sqlitePath = path.join(tempDir, "backend.sqlite")
  const logs: string[] = []
  let startError: Error | null = null
  let stopped = false

  const child = spawn("go", ["run", "./cmd/server"], {
    cwd: backendDir,
    env: {
      ...process.env,
      APP_ENV: "test",
      PORT: String(port),
      SQLITE_PATH: sqlitePath,
      JWT_SECRET: "integration-jwt-secret",
      COOKIE_SECURE: "false",
      ADMIN_CORS_ORIGINS: "http://localhost:4173",
      BOOTSTRAP_ADMIN_EMAIL: "admin@demeter.local",
      BOOTSTRAP_ADMIN_PASSWORD: "ChangeMe123!",
      BOOTSTRAP_ORG_NAME: "Demeter Integration",
    },
    stdio: ["ignore", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams

  const appendLog = (value: string) => {
    logs.push(value)
    if (logs.length > 200) {
      logs.splice(0, logs.length - 200)
    }
  }

  child.stdout.on("data", (chunk) => appendLog(chunk.toString()))
  child.stderr.on("data", (chunk) => appendLog(chunk.toString()))
  child.once("error", (error) => {
    startError = error instanceof Error ? error : new Error(String(error))
  })

  const origin = `http://127.0.0.1:${port}`
  const apiBaseUrl = `${origin}/api/v1`

  const readyAt = Date.now() + 45_000
  while (Date.now() < readyAt) {
    if (startError) {
      break
    }
    if (child.exitCode !== null) {
      break
    }

    try {
      const response = await fetch(`${origin}/healthz`)
      if (response.ok) {
        return {
          apiBaseUrl,
          credentials: {
            email: "admin@demeter.local",
            password: "ChangeMe123!",
          },
          createTransport: () => new CookieJarTransport(origin),
          configureRuntime: () => {
            resetRuntimeConfigForTests()
            window.__APP_RUNTIME_CONFIG__ = {
              backendBaseUrl: apiBaseUrl,
            }
          },
          logs: () => logs.join(""),
          stop: async () => {
            if (stopped) {
              return
            }
            stopped = true

            if (child.exitCode === null) {
              child.kill("SIGINT")
              const exited = await new Promise<boolean>((resolve) => {
                const timer = setTimeout(() => resolve(false), 5_000)
                child.once("exit", () => {
                  clearTimeout(timer)
                  resolve(true)
                })
              })

              if (!exited && child.exitCode === null) {
                child.kill("SIGKILL")
                await new Promise<void>((resolve) => {
                  child.once("exit", () => resolve())
                })
              }
            }

            await fs.rm(tempDir, { force: true, recursive: true })
          },
        }
      }
    } catch {
      // Startup polling intentionally ignores transient connection failures.
    }

    await sleep(250)
  }

  if (child.exitCode === null) {
    child.kill("SIGKILL")
  }
  await fs.rm(tempDir, { force: true, recursive: true })

  const logOutput = logs.join("").trim()
  const reason = startError?.message ?? `backend did not become healthy on ${origin} within 45s`
  throw new Error(`${reason}${logOutput ? `\n\nBackend logs:\n${logOutput}` : ""}`)
}

export async function loginAdminDirect(
  transport: CookieJarTransport,
  credentials: LoginCredentials,
) {
  return transport.requestJson<AdminSessionPayload>("/api/v1/admin/auth/login", {
    body: JSON.stringify(credentials),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  })
}

export async function loginAppDirect(
  transport: CookieJarTransport,
  credentials: LoginCredentials,
) {
  return transport.requestJson<AdminSessionPayload>("/api/v1/auth/login", {
    body: JSON.stringify(credentials),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  })
}

export async function createOrganizationDirect(
  transport: CookieJarTransport,
  csrfToken: string,
  input: CreateOrganizationInput,
) {
  return transport.requestJson<Organization>("/api/v1/admin/organizations", {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
      "X-Admin-CSRF": csrfToken,
    },
    method: "POST",
  })
}

export async function createUserDirect(
  transport: CookieJarTransport,
  csrfToken: string,
  organizationId: string,
  input: CreateUserInput,
) {
  return transport.requestJson<User>(`/api/v1/admin/organizations/${organizationId}/users`, {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json",
      "X-Admin-CSRF": csrfToken,
    },
    method: "POST",
  })
}

export async function postActivityEventsDirect(
  transport: CookieJarTransport,
  events: ActivityEventInput[],
) {
  return transport.requestJson<ActivityEventsResponse>("/api/v1/activity/events", {
    body: JSON.stringify({ events }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  })
}

export function uniqueSuffix(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
