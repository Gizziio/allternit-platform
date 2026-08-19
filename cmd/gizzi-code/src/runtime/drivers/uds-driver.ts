/**
 * UdsDriver — executes agent tasks against a remote gizzi runtime daemon over a Unix domain socket.
 *
 * Wire protocol (NDJSON over node:net UNIX socket):
 *   Client -> Server:
 *     { type: "assign", reqId, cliName, task: AgentTask }
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
import { createConnection, type Socket } from "node:net"

const log = Log.create({ service: "uds-driver" })

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

export class UdsDriver implements RuntimeDriver {
  private readonly runtimeId: string
  private readonly cliName: string
  private readonly socketPath: string
  private readonly token: string

  constructor(runtimeId: string, cliName: string, socketPath: string, token: string) {
    this.runtimeId = runtimeId
    this.cliName = cliName
    this.socketPath = socketPath
    this.token = token
  }

  async assign(task: AgentTask): Promise<TaskHandle> {
    const reqId = generateReqId()
    const socket = await this.connect()
    try {
      this.send(socket, { type: "assign", reqId, cliName: this.cliName, task })
      const msg = await waitFor(socket, reqId, ["assigned", "error"])
      if (msg.type === "error") throw new Error(msg.error)
      return (msg as Extract<DaemonMessage, { type: "assigned" }>).handle
    } finally {
      socket.destroy()
    }
  }

  async *stream(handle: TaskHandle): AsyncIterable<AgentEvent> {
    const reqId = generateReqId()
    const socket = await this.connect()

    const buffer: AgentEvent[] = []
    let ended = false
    let error: Error | undefined
    let notify = () => {}

    const reader = readLines(socket, (line) => {
      let msg: DaemonMessage
      try {
        msg = JSON.parse(line)
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
    })

    socket.on("end", () => {
      if (!ended) {
        ended = true
        error = error ?? new Error("uds socket closed unexpectedly")
      }
      notify()
    })

    socket.on("error", (err: Error) => {
      error = err
      ended = true
      notify()
    })

    this.send(socket, { type: "stream", reqId, handle })

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
      reader.destroy()
      socket.destroy()
    }
  }

  async abort(handle: TaskHandle): Promise<void> {
    const reqId = generateReqId()
    const socket = await this.connect()
    try {
      this.send(socket, { type: "abort", reqId, handle })
      const msg = await waitFor(socket, reqId, ["aborted", "error"])
      if (msg.type === "error") throw new Error(msg.error)
    } finally {
      socket.destroy()
    }
  }

  async inspect(handle: TaskHandle): Promise<ExecutionLog> {
    const reqId = generateReqId()
    const socket = await this.connect()
    try {
      this.send(socket, { type: "inspect", reqId, handle })
      const msg = await waitFor(socket, reqId, ["inspected", "error"])
      if (msg.type === "error") throw new Error(msg.error)
      return (msg as Extract<DaemonMessage, { type: "inspected" }>).log
    } finally {
      socket.destroy()
    }
  }

  private connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ path: this.socketPath })
      const timeout = setTimeout(() => {
        socket.destroy()
        reject(new Error(`uds connection timed out: ${this.socketPath}`))
      }, 10000)

      socket.once("connect", () => {
        clearTimeout(timeout)
        if (this.token) {
          socket.write(JSON.stringify({ type: "auth", token: this.token }) + "\n")
        }
        resolve(socket)
      })

      socket.once("error", (err: Error) => {
        clearTimeout(timeout)
        reject(new Error(`uds connection error: ${err.message}`))
      })
    })
  }

  private send(socket: Socket, msg: DriverMessage) {
    socket.write(JSON.stringify(msg) + "\n")
  }
}

function generateReqId(): string {
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function waitFor(
  socket: Socket,
  reqId: string,
  types: DaemonMessage["type"][],
): Promise<DaemonMessage> {
  return new Promise<DaemonMessage>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`uds request timed out: ${reqId}`))
    }, 120000)

    const reader = readLines(socket, (line) => {
      let msg: DaemonMessage
      try {
        msg = JSON.parse(line)
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
    })

    const onClose = () => {
      cleanup()
      reject(new Error(`uds socket closed while waiting for ${reqId}`))
    }

    const onError = (err: Error) => {
      cleanup()
      reject(err)
    }

    const cleanup = () => {
      clearTimeout(timeout)
      reader.destroy()
      socket.off("end", onClose)
      socket.off("error", onError)
    }

    socket.on("end", onClose)
    socket.on("error", onError)
  })
}

interface LineReader {
  destroy(): void
}

function readLines(socket: Socket, onLine: (line: string) => void): LineReader {
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
