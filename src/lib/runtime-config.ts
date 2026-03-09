export interface RuntimeConfig {
  backendBaseUrl: string
}

declare global {
  interface Window {
    __APP_RUNTIME_CONFIG__?: {
      backendBaseUrl?: string
    }
  }
}

const LOCAL_DEV_BACKEND_BASE_URL = "http://localhost:8080/api/v1"
const DEFAULT_BACKEND_BASE_PATH = "/api/v1"
const LOCALHOST_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"])

let cachedConfig: RuntimeConfig | null = null

export function normalizeBackendBaseUrl(backendBaseUrl: string) {
  const normalized = backendBaseUrl.trim().replace(/\/+$/, "")
  if (!normalized) {
    return DEFAULT_BACKEND_BASE_PATH
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) || normalized.startsWith("/")) {
    return normalized
  }
  return `/${normalized.replace(/^\/+/, "")}`
}

export function resolveDefaultBackendBaseUrl(
  currentLocation?: Pick<Location, "hostname" | "protocol">,
) {
  if (currentLocation && currentLocation.protocol === "http:" && LOCALHOST_HOSTNAMES.has(currentLocation.hostname)) {
    return LOCAL_DEV_BACKEND_BASE_URL
  }
  return DEFAULT_BACKEND_BASE_PATH
}

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) return cachedConfig
  if (typeof window === "undefined") {
    cachedConfig = {
      backendBaseUrl: LOCAL_DEV_BACKEND_BASE_URL,
    }
    return cachedConfig
  }

  const backendBaseUrl =
    window.__APP_RUNTIME_CONFIG__?.backendBaseUrl?.trim() || resolveDefaultBackendBaseUrl(window.location)
  cachedConfig = {
    backendBaseUrl: normalizeBackendBaseUrl(backendBaseUrl),
  }
  return cachedConfig
}

export function resetRuntimeConfigForTests() {
  cachedConfig = null
}
