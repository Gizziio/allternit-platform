/**
 * WebSocketDriver — executes agent tasks against a remote gizzi runtime daemon.
 *
 * Wire protocol (JSON over WebSocket):
 *   Client -> Server:
 *     { type: "assign", reqId, task: AgentTask }
 *     { type: "stream", reqId, handle: TaskHandle }
 *     { type: "abort", reqId, handle: TaskHandle }
 *     { type: "inspect", reqId, handle: TaskHandle }
 *   Server -> Client:
 *     { type: "assigned", reqId, handle: TaskHandle }
 *     { type: "event", reqId, event: AgentEvent }
 *     { type: "stream-end", reqId }
 *     { type: "aborted", reqId }
 *     { type: "inspected", reqId, log: ExecutionLog }
 *     { type: "error", reqId, error: string }
 */

import type {
  AgentEvent,
  AgentTask,
  ExecutionLog,
  RuntimeDriver,
  TaskHandle,
} from "@/runtime/runtime-driver"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "websocket-driver" })

type DriverMessage =
  | { type: "assign"; reqId: string; cliName: string; task: AgentTask }
  | { type: "stream"; reqId: string; handle: TaskHandle }
  | { type: "abort"; reqId: string; handle: TaskHandle }
  | { type: "inspect"; reqId: string; handle: TaskHandle }

type DaemonMessage =
  | { type: "assigned"; reqId: string; handle: TaskHandle }
  | { type: "event"; reqId: string; event: AgentEvent }
  | { type: "stream-end"; reqId: string }
  | { type: "aborted"; reqId: string }
  | { type: "inspected"; reqId: string; log: ExecutionLog }
  | { type: "error"; reqId: string; error: string }

export class WebSocketDriver implements RuntimeDriver {
  private readonly runtimeId: string
  private readonly cliName: string
  private readonly url: string
  private readonly token: string

  constructor(runtimeId: string, cliName: string, url: string, token: string) {
    this.runtimeId = runtimeId
    this.cliName = cliName
    this.url = url
    this.token = token
  }

  async assign(task: AgentTask): Promise<TaskHandle> {
    const reqId = generateReqId()
    const ws = await this.connect()
    try {
      this.send(ws, { type: "assign", reqId, cliName: this.cliName, task })
      const msg = await this.waitFor(ws, reqId, ["assigned", "error"])
      if (msg.type === "error") throw new Error(msg.error)
      return (msg as Extract<DaemonMessage, { type: "assigned" }>).handle
    } finally {
      ws.close()
    }
  }

  async *stream(handle: TaskHandle): AsyncIterable<AgentEvent> {
    const reqId = generateReqId()
    const ws = await this.connect()

    const buffer: AgentEvent[] = []
    let ended = false
    let error: Error | undefined
    let notify = () => {}

    const onMessage = (ev: MessageEvent) => {
      let msg: DaemonMessage
      try {
        msg = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (msg.reqId !== reqId) return

      if (msg.type === "event") {
        buffer.push(msg.event)
      } else if (msg.type === "stream-end") {
        ended = true
      } else if (msg.type === "error") {
        error = new Error(msg.error)
        ended = true
      }
      notify()
    }

    const onClose = () => {
      if (!ended) {
        ended = true
        error = error ?? new Error("websocket closed unexpectedly")
      }
      notify()
    }

    ws.addEventListener("message", onMessage)
    ws.addEventListener("close", onClose)
    ws.addEventListener("error", (ev: Event) => {
      error = new Error(`websocket error: ${(ev as ErrorEvent).message || "unknown"}`)
      notify()
    })

    this.send(ws, { type: "stream", reqId, handle })

    try {
      while (!ended || buffer.length > 0) {
        while (buffer.length > 0) {
          yield buffer.shift()!
        }
        if (!ended) {
          await new Promise<void>((r) => {
            notify = r
          })
        }
      }
      if (error) throw error
    } finally {
      ws.removeEventListener("message", onMessage)
      ws.removeEventListener("close", onClose)
      ws.close()
    }
  }

  async abort(handle: TaskHandle): Promise<void> {
    const reqId = generateReqId()
    const ws = await this.connect()
    try {
      this.send(ws, { type: "abort", reqId, handle })
      const msg = await this.waitFor(ws, reqId, ["aborted", "error"])
      if (msg.type === "error") throw new Error(msg.error)
    } finally {
      ws.close()
    }
  }

  async inspect(handle: TaskHandle): Promise<ExecutionLog> {
    const reqId = generateReqId()
    const ws = await this.connect()
    try {
      this.send(ws, { type: "inspect", reqId, handle })
      const msg = await this.waitFor(ws, reqId, ["inspected", "error"])
      if (msg.type === "error") throw new Error(msg.error)
      return (msg as Extract<DaemonMessage, { type: "inspected" }>).log
    } finally {
      ws.close()
    }
  }

  private connect(): Promise<WebSocket> {
    const url = new URL(this.url)
    if (this.token) {
      url.searchParams.set("token", this.token)
    }
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url.toString())
      const timeout = setTimeout(() => {
        ws.close()
        reject(new Error(`websocket connection timed out: ${this.url}`))
      }, 10000)

      ws.addEventListener(
        "open",
        () => {
          clearTimeout(timeout)
          resolve(ws)
        },
        { once: true },
      )

      ws.addEventListener(
        "error",
        (ev: Event) => {
          clearTimeout(timeout)
          reject(new Error(`websocket connection error: ${(ev as ErrorEvent).message || this.url}`))
        },
        { once: true },
      )

      ws.addEventListener(
        "close",
        () => {
          clearTimeout(timeout)
          reject(new Error(`websocket closed before open: ${this.url}`))
        },
        { once: true },
      )
    })
  }

  private send(ws: WebSocket, msg: DriverMessage) {
    ws.send(JSON.stringify(msg))
  }

  private waitFor(
    ws: WebSocket,
    reqId: string,
    types: DaemonMessage["type"][],
  ): Promise<DaemonMessage> {
    return new Promise<DaemonMessage>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error(`websocket request timed out: ${reqId}`))
      }, 120000)

      const onMessage = (ev: MessageEvent) => {
        let msg: DaemonMessage
        try {
          msg = JSON.parse(String(ev.data))
        } catch {
          return
        }
        if (msg.reqId !== reqId) return
        if (!types.includes(msg.type)) return

        cleanup()
        if (msg.type === "error") {
          reject(new Error(msg.error))
        } else {
          resolve(msg)
        }
      }

      const onClose = () => {
        cleanup()
        reject(new Error(`websocket closed while waiting for ${reqId}`))
      }

      const cleanup = () => {
        clearTimeout(timeout)
        ws.removeEventListener("message", onMessage)
        ws.removeEventListener("close", onClose)
      }

      ws.addEventListener("message", onMessage)
      ws.addEventListener("close", onClose)
    })
  }
}

function generateReqId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
