import { useCallback, useEffect, useRef, useState } from "react"

import { getAdminCsrfToken } from "@/lib/admin-security"
import { getRuntimeConfig } from "@/lib/runtime-config"
import type { AdminSessionPayload, DemeterQueueSnapshot } from "@/lib/types"

export type DemeterQueueWebSocketMode = "polling" | "websocket_auth" | "websocket"

type DemeterQueueWebSocketMessage =
  | { type: "auth_ok" }
  | { type: "auth_error"; code?: string; message?: string }
  | { type: "snapshot"; snapshot?: DemeterQueueSnapshot }
  | { type: "command_ok"; commandId?: string; snapshot?: DemeterQueueSnapshot }
  | { type: "command_error"; commandId?: string; code?: string; message?: string }

type PendingCommand = {
  resolve: (snapshot: DemeterQueueSnapshot) => void
  reject: (error: Error) => void
}

type UseDemeterQueueWebSocketInput = {
  limit: number
  onSnapshot: (snapshot: DemeterQueueSnapshot) => void
  refreshSession: () => Promise<AdminSessionPayload | null>
}

function toDemeterQueueWebSocketUrl(limit: number) {
  const base = getRuntimeConfig().backendBaseUrl
  const suffix = `/admin/providers/demeter-sante/queue/ws?limit=${encodeURIComponent(String(limit))}`

  if (base.startsWith("http://") || base.startsWith("https://")) {
    const url = new URL(`${base}${suffix}`)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    return url.toString()
  }

  if (typeof window === "undefined") {
    return `ws://localhost:8080/api/v1${suffix}`
  }

  const origin = new URL(window.location.href)
  origin.protocol = origin.protocol === "https:" ? "wss:" : "ws:"
  origin.pathname = `${base.replace(/\/+$/, "")}${suffix}`
  origin.search = ""
  origin.hash = ""
  return origin.toString()
}

function createCommandId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function rejectPendingCommands(pending: Map<string, PendingCommand>, error: Error) {
  for (const command of pending.values()) {
    command.reject(error)
  }
  pending.clear()
}

export function useDemeterQueueWebSocket({ limit, onSnapshot, refreshSession }: UseDemeterQueueWebSocketInput) {
  const [mode, setMode] = useState<DemeterQueueWebSocketMode>("polling")
  const socketRef = useRef<WebSocket | null>(null)
  const authenticatedRef = useRef(false)
  const pendingRef = useRef(new Map<string, PendingCommand>())
  const onSnapshotRef = useRef(onSnapshot)
  const refreshSessionRef = useRef(refreshSession)

  useEffect(() => {
    onSnapshotRef.current = onSnapshot
  }, [onSnapshot])

  useEffect(() => {
    refreshSessionRef.current = refreshSession
  }, [refreshSession])

  useEffect(() => {
    if (typeof WebSocket === "undefined") {
      return
    }

    const pendingCommands = pendingRef.current
    let disposed = false
    let reconnectTimer: ReturnType<typeof globalThis.setTimeout> | undefined
    let reconnectAttempt = 0
    let shouldReconnect = true

    const clearReconnectTimer = () => {
      if (reconnectTimer !== undefined) {
        globalThis.clearTimeout(reconnectTimer)
        reconnectTimer = undefined
      }
    }

    const scheduleReconnect = (delayMs?: number) => {
      if (disposed) return
      clearReconnectTimer()
      const delay = delayMs ?? Math.min(8_000, 500 * 2 ** reconnectAttempt)
      reconnectAttempt += 1
      reconnectTimer = globalThis.setTimeout(openSocket, delay)
    }

    const handleAuthError = async (socket: WebSocket, code?: string) => {
      shouldReconnect = false
      authenticatedRef.current = false
      setMode("polling")
      rejectPendingCommands(pendingCommands, new Error(code || "websocket auth failed"))
      socket.close()

      if (code === "invalid_csrf" || code === "access_token_expired") {
        try {
          const refreshed = await refreshSessionRef.current()
          if (refreshed && !disposed) {
            shouldReconnect = true
            scheduleReconnect(0)
          }
        } catch {
          // Session state is normalized by the admin refresh bridge.
        }
      }
    }

    const handleMessage = (socket: WebSocket, raw: MessageEvent) => {
      let message: DemeterQueueWebSocketMessage
      try {
        message = JSON.parse(String(raw.data)) as DemeterQueueWebSocketMessage
      } catch {
        return
      }

      if (message.type === "auth_ok") {
        authenticatedRef.current = true
        reconnectAttempt = 0
        setMode("websocket")
        return
      }

      if (message.type === "auth_error") {
        void handleAuthError(socket, message.code)
        return
      }

      if (message.type === "snapshot" && message.snapshot) {
        onSnapshotRef.current(message.snapshot)
        return
      }

      if (message.type === "command_ok" && message.commandId) {
        const pending = pendingCommands.get(message.commandId)
        if (!pending || !message.snapshot) return
        pendingCommands.delete(message.commandId)
        onSnapshotRef.current(message.snapshot)
        pending.resolve(message.snapshot)
        return
      }

      if (message.type === "command_error" && message.commandId) {
        const pending = pendingCommands.get(message.commandId)
        if (!pending) return
        pendingCommands.delete(message.commandId)
        pending.reject(new Error(message.message || message.code || "websocket command failed"))
      }
    }

    function openSocket() {
      if (disposed) return
      shouldReconnect = true
      authenticatedRef.current = false
      setMode("websocket_auth")

      const socket = new WebSocket(toDemeterQueueWebSocketUrl(limit))
      socketRef.current = socket

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "auth", csrfToken: getAdminCsrfToken() }))
      }
      socket.onmessage = (event) => handleMessage(socket, event)
      socket.onerror = () => {
        authenticatedRef.current = false
        setMode("polling")
      }
      socket.onclose = () => {
        if (socketRef.current === socket) {
          socketRef.current = null
        }
        authenticatedRef.current = false
        setMode("polling")
        rejectPendingCommands(pendingCommands, new Error("websocket closed"))
        if (!disposed && shouldReconnect) {
          scheduleReconnect()
        }
      }
    }

    openSocket()

    return () => {
      disposed = true
      shouldReconnect = false
      clearReconnectTimer()
      authenticatedRef.current = false
      rejectPendingCommands(pendingCommands, new Error("websocket disposed"))
      socketRef.current?.close()
      socketRef.current = null
    }
  }, [limit])

  const updateSettings = useCallback((input: { parallelism: number }) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN || !authenticatedRef.current) {
      return Promise.reject(new Error("websocket unavailable"))
    }

    const commandId = createCommandId()
    return new Promise<DemeterQueueSnapshot>((resolve, reject) => {
      pendingRef.current.set(commandId, { resolve, reject })
      try {
        socket.send(JSON.stringify({ type: "update_settings", commandId, settings: input }))
      } catch (error) {
        pendingRef.current.delete(commandId)
        reject(error instanceof Error ? error : new Error("websocket command failed"))
      }
    })
  }, [])

  return {
    mode,
    isAuthenticated: mode === "websocket",
    updateSettings,
  }
}
