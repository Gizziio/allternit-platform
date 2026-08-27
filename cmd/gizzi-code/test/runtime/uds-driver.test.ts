import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { createServer, type Server, type Socket } from "node:net"
import { unlinkSync, existsSync } from "node:fs"
import { UdsDriver } from "@/runtime/drivers/uds-driver"
import type { AgentEvent, AgentTask } from "@/runtime/runtime-driver"

const SOCKET_PATH = "/tmp/gizzi-uds-driver-test.sock"

function writeJson(socket: Socket, msg: unknown) {
  socket.write(JSON.stringify(msg) + "\n")
}

describe("UdsDriver", () => {
  let server: Server | undefined

  afterEach(() => {
    if (server) {
      server.close()
      server = undefined
    }
    if (existsSync(SOCKET_PATH)) {
      try {
        unlinkSync(SOCKET_PATH)
      } catch {}
    }
  })

  test("assign receives handle from server", async () => {
    server = createServer((socket) => {
      let authenticated = false
      let buffer = ""
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf-8")
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line) continue
          const msg = JSON.parse(line)
          if (!authenticated) {
            if (msg.type === "auth" && msg.token === "secret") {
              authenticated = true
            }
            continue
          }
          if (msg.type === "assign") {
            writeJson(socket, {
              type: "assigned",
              reqId: msg.reqId,
              handle: { taskId: msg.task.taskId, runtimeId: "rt-1", cliName: "cursor-agent" },
            })
          }
        }
      })
    })

    await new Promise<void>((resolve) => server!.listen(SOCKET_PATH, resolve))

    const driver = new UdsDriver("rt-1", "cursor-agent", SOCKET_PATH, "secret")
    const handle = await driver.assign({ taskId: "task-1", prompt: "hi" })
    expect(handle).toEqual({ taskId: "task-1", runtimeId: "rt-1", cliName: "cursor-agent" })
  })

  test("stream yields events and ends", async () => {
    server = createServer((socket) => {
      let authenticated = false
      let buffer = ""
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf-8")
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line) continue
          const msg = JSON.parse(line)
          if (!authenticated) {
            if (msg.type === "auth" && msg.token === "secret") authenticated = true
            continue
          }
          if (msg.type === "stream") {
            writeJson(socket, { type: "event", reqId: msg.reqId, event: { type: "text_delta", delta: "hello" } })
            writeJson(socket, { type: "stream-end", reqId: msg.reqId })
          }
        }
      })
    })

    await new Promise<void>((resolve) => server!.listen(SOCKET_PATH, resolve))

    const driver = new UdsDriver("rt-1", "cursor-agent", SOCKET_PATH, "secret")
    const events: AgentEvent[] = []
    for await (const ev of driver.stream({ taskId: "task-1", runtimeId: "rt-1", cliName: "cursor-agent" })) {
      events.push(ev)
    }
    expect(events).toEqual([{ type: "text_delta", delta: "hello" }])
  })

  test("rejects on authentication failure / connection error", async () => {
    server = createServer((socket) => {
      socket.destroy()
    })
    await new Promise<void>((resolve) => server!.listen(SOCKET_PATH, resolve))

    const driver = new UdsDriver("rt-1", "cursor-agent", SOCKET_PATH, "secret")
    await expect(driver.assign({ taskId: "task-1", prompt: "hi" })).rejects.toThrow()
  })
})
