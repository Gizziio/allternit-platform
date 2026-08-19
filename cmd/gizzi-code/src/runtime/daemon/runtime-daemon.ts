/**
 * RuntimeDaemon — exposes the local gizzi runtime over WebSocket and optionally Unix domain socket.
 *
 * This daemon is intended to run next to the code, on the user's machine or a
 * remote box. It discovers the agent CLIs installed on that host, registers
 * itself as a websocket/uds runtime in the local registry, and then accepts task
 * assignments from the Allternit platform API (or from a local gizzi process)
 * over a WebSocket or UDS connection.
 */

import { Hono } from "hono"
import { createBunWebSocket } from "hono/bun"
import { randomUUID } from "node:crypto"
import { RuntimeService } from "@/runtime/runtime-service"
import { discoverLocalRuntime } from "@/runtime/runtime-discovery"
import { LocalCliDriver } from "@/runtime/drivers/local-cli-driver"
import { Log } from "@/shared/util/log"
import type { AgentEvent, AgentTask, TaskHandle } from "@/runtime/runtime-driver"
import { createServer as createUdsServer, type Server as UdsServer, type Socket } from "node:net"
import { unlinkSync, existsSync } from "node:fs"

const log = Log.create({ service: "runtime-daemon" })

interface DaemonConfig {
  host?: string
  port?: number
  runtimeName?: string
  /** When provided, the daemon also listens on a Unix domain socket. */
  udsSocketPath?: string
}

interface DaemonState {
  runtimeId: string
  token: string
  url: string
  socketPath?: string
  drivers: Map<string, LocalCliDriver>
}

type ClientMessage =
  | { type: "assign"; reqId: string; cliName: string; task: AgentTask }
  | { type: "stream"; reqId: string; handle: TaskHandle }
  | { type: "abort"; reqId: string; handle: TaskHandle }
  | { type: "inspect"; reqId: string; handle: TaskHandle }
  | { type: "auth"; token: string }

type ServerMessage =
  | { type: "assigned"; reqId: string; handle: TaskHandle }
  | { type: "event"; reqId: string; event: AgentEvent }
  | { type: "stream-end"; reqId: string }
  | { type: "aborted"; reqId: string }
  | { type: "inspected"; reqId: string; log: any }
  | { type: "error"; reqId: string; error: string }

export namespace RuntimeDaemon {
  export async function start(config: DaemonConfig = {}): Promise<{
    runtimeId: string
    url: string
    token: string
    socketPath?: string
    stop: () => void
  }> {
    const hostname = config.host ?? "127.0.0.1"
    const token = randomUUID()

    const { upgradeWebSocket, websocket } = createBunWebSocket()

    const app = new Hono()

    app.get("/health", (c) => c.json({ ok: true }))

    app.get(
      "/ws",
      upgradeWebSocket((c) => {
        const reqToken = c.req.query("token")
        let authenticated = false

        return {
          onOpen(_event, ws) {
            if (reqToken !== token) {
              log.warn("websocket authentication failed")
              try {
                send(ws, { type: "error", reqId: "", error: "invalid token" })
              } catch {}
              ws.close()
              return
            }
            authenticated = true
            log.info("websocket client connected")
          },
          onMessage(event, ws) {
            if (!authenticated) {
              ws.close()
              return
            }
            handleClientMessage(state, (msg) => send(ws, msg), event.data as string).catch((err) => {
              log.error("unhandled websocket message error", { error: err })
            })
          },
          onClose() {
            log.info("websocket client disconnected")
          },
        }
      }),
    )

    const server = Bun.serve({
      hostname,
      port: config.port ?? 0,
      fetch: app.fetch,
      websocket,
    })

    const port = server.port
    const url = `ws://${hostname}:${port}/ws`

    const stateRef: { current: DaemonState | null } = { current: null }

    let udsServer: UdsServer | undefined
    let socketPath: string | undefined
    if (config.udsSocketPath) {
      socketPath = config.udsSocketPath
      udsServer = await startUdsServer(socketPath, token, stateRef)
    }

    const discovered = await discoverLocalRuntime()
    const runtime = await RuntimeService.upsertByHost(discovered, {
      name: config.runtimeName ?? `daemon-${discovered.host}`,
      metadata: {
        websocketUrl: url,
        udsSocket: socketPath,
        token,
      },
    })

    const state: DaemonState = {
      runtimeId: runtime.id,
      token,
      url,
      socketPath,
      drivers: new Map(),
    }
    stateRef.current = state

    log.info("runtime daemon listening", { url, socketPath, runtimeId: state.runtimeId })

    const heartbeatInterval = setInterval(() => {
      RuntimeService.heartbeat(state.runtimeId).catch((err) => {
        log.warn("runtime heartbeat failed", { error: err, runtimeId: state.runtimeId })
      })
    }, 30000)

    return {
      runtimeId: state.runtimeId,
      url,
      token,
      socketPath,
      stop: () => {
        log.info("stopping runtime daemon", { runtimeId: state.runtimeId })
        clearInterval(heartbeatInterval)
        server.stop(true)
        if (udsServer) {
          udsServer.close()
          if (socketPath && existsSync(socketPath)) {
            try {
              unlinkSync(socketPath)
            } catch {}
          }
        }
        RuntimeService.markOffline(state.runtimeId).catch(() => {})
      },
    }
  }
}

async function startUdsServer(
  socketPath: string,
  token: string,
  stateRef: { current: DaemonState | null },
): Promise<UdsServer> {
  if (existsSync(socketPath)) {
    try {
      unlinkSync(socketPath)
    } catch {}
  }

  return new Promise((resolve, reject) => {
    const server = createUdsServer((socket) => {
      let authenticated = false
      const sendToSocket = (msg: ServerMessage) => sendSocket(socket, msg)
      const reader = readSocketLines(socket, (line) => {
        if (!authenticated) {
          let msg: ClientMessage
          try {
            msg = JSON.parse(line)
          } catch {
            sendToSocket({ type: "error", reqId: "", error: "invalid JSON" })
            socket.destroy()
            return
          }
          if (msg.type !== "auth" || msg.token !== token) {
            sendToSocket({ type: "error", reqId: "", error: "invalid token" })
            socket.destroy()
            return
          }
          authenticated = true
          log.info("uds client connected", { socketPath })
          return
        }

        const state = stateRef.current
        if (!state) {
          sendToSocket({ type: "error", reqId: "", error: "daemon not ready" })
          socket.destroy()
          return
        }

        handleClientMessage(state, sendToSocket, line).catch((err) => {
          log.error("unhandled uds message error", { error: err })
        })
      })

      socket.on("end", () => {
        reader.destroy()
      })
      socket.on("error", (err) => {
        log.warn("uds socket error", { error: err, socketPath })
        reader.destroy()
      })
    })

    server.listen(socketPath, () => {
      resolve(server)
    })

    server.on("error", (err) => {
      reject(err)
    })
  })
}

async function handleClientMessage(
  state: DaemonState,
  send: (msg: ServerMessage) => void,
  raw: string,
): Promise<void> {
  let msg: ClientMessage
  try {
    msg = JSON.parse(raw)
  } catch {
    send({ type: "error", reqId: "", error: "invalid JSON" })
    return
  }

  const reqId = "reqId" in msg ? msg.reqId : ""

  try {
    switch (msg.type) {
      case "assign": {
        const driver = getDriver(state, msg.cliName)
        const handle = await driver.assign(msg.task)
        send({ type: "assigned", reqId, handle })
        break
      }

      case "stream": {
        const driver = getDriver(state, msg.handle.cliName)
        // Run the stream in the background so the message loop stays free.
        ;(async () => {
          try {
            for await (const event of driver.stream(msg.handle)) {
              send({ type: "event", reqId, event })
            }
            send({ type: "stream-end", reqId })
          } catch (err) {
            log.error("stream error", { error: err, taskId: msg.handle.taskId })
            send({ type: "error", reqId, error: errorMessage(err) })
            send({ type: "stream-end", reqId })
          }
        })()
        break
      }

      case "abort": {
        const driver = getDriver(state, msg.handle.cliName)
        await driver.abort(msg.handle)
        send({ type: "aborted", reqId })
        break
      }

      case "inspect": {
        const driver = getDriver(state, msg.handle.cliName)
        const logEntry = await driver.inspect(msg.handle)
        send({ type: "inspected", reqId, log: logEntry })
        break
      }

      default:
        send({ type: "error", reqId, error: "unknown message type" })
    }
  } catch (err) {
    log.error("websocket request failed", { type: msg.type, reqId, error: err })
    send({ type: "error", reqId, error: errorMessage(err) })
  }
}

function getDriver(state: DaemonState, cliName: string): LocalCliDriver {
  let driver = state.drivers.get(cliName)
  if (!driver) {
    driver = new LocalCliDriver(state.runtimeId, cliName)
    state.drivers.set(cliName, driver)
  }
  return driver
}

function send(ws: any, msg: ServerMessage) {
  try {
    ws.send(JSON.stringify(msg))
  } catch (err) {
    log.warn("failed to send websocket message", { error: err })
  }
}

function sendSocket(socket: Socket, msg: ServerMessage) {
  try {
    socket.write(JSON.stringify(msg) + "\n")
  } catch (err) {
    log.warn("failed to send uds message", { error: err })
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

interface LineReader {
  destroy(): void
}

function readSocketLines(socket: Socket, onLine: (line: string) => void): LineReader {
  let buffer = ""
  const onData = (chunk: Buffer) => {
    buffer += chunk.toString("utf-8")
    let idx: number
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      if (line.length > 0) {
        onLine(line)
      }
    }
  }
  socket.on("data", onData)
  return {
    destroy() {
      socket.off("data", onData)
    },
  }
}
