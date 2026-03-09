import { describe, expect, it } from "vitest"

import {
  getRuntimeConfig,
  normalizeBackendBaseUrl,
  resetRuntimeConfigForTests,
  resolveDefaultBackendBaseUrl,
} from "@/lib/runtime-config"

describe("runtime-config", () => {
  it("uses the local backend fallback on localhost over http", () => {
    expect(resolveDefaultBackendBaseUrl({ hostname: "localhost", protocol: "http:" })).toBe(
      "http://localhost:8080/api/v1",
    )
  })

  it("uses the same-origin api path fallback outside local http development", () => {
    expect(resolveDefaultBackendBaseUrl({ hostname: "admin.example.test", protocol: "https:" })).toBe("/api/v1")
  })

  it("normalizes configured relative backend paths", () => {
    expect(normalizeBackendBaseUrl("api/v1/")).toBe("/api/v1")
  })

  it("normalizes the runtime config once before caching it", () => {
    resetRuntimeConfigForTests()
    window.__APP_RUNTIME_CONFIG__ = {
      backendBaseUrl: "https://admin-api.example.test/api/v1/",
    }

    expect(getRuntimeConfig()).toEqual({
      backendBaseUrl: "https://admin-api.example.test/api/v1",
    })
  })
})
