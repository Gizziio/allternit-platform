// @ts-nocheck
import { describe, expect, test } from "bun:test"
import { existsSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { Instance } from "../../src/runtime/context/project/instance"
import { Pty } from "../../src/runtime/integrations/pty"
import { tmpdir } from "../fixture/fixture"

const MUX_SOCK = join(homedir(), ".allternit", "mux", "mux.sock")
async function isMuxAvailable(): Promise<boolean> {
  if (!existsSync(MUX_SOCK)) return false
  try {
    const { connect } = await import("net")
    const sock = connect(MUX_SOCK)
    await new Promise((resolve, reject) => {
      sock.once("connect", resolve)
      sock.once("error", reject)
      setTimeout(() => reject(new Error("timeout")), 1000)
    })
    sock.end()
    return true
  } catch {
    return false
  }
}
const muxAvailable = await isMuxAvailable()

if (muxAvailable) {
describe("pty", () => {
  test("does not leak output when websocket objects are reused", async () => {
    await using dir = await tmpdir({ git: true })

    await Instance.provide({
      directory: dir.path,
      fn: async () => {
        const a = await Pty.create({ command: "cat", title: "a" })
        const b = await Pty.create({ command: "cat", title: "b" })
        try {
          const outA: string[] = []
          const outB: string[] = []

          const ws = {
            readyState: 1,
            data: { events: { connection: "a" } },
            send: (data: unknown) => {
              outA.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
            },
            close: () => {
              // no-op (simulate abrupt drop)
            },
          }

          // Connect "a" first with ws.
          Pty.connect(a.id, ws as any)

          // Now "reuse" the same ws object for another connection.
          ws.data = { events: { connection: "b" } }
          ws.send = (data: unknown) => {
            outB.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
          }
          Pty.connect(b.id, ws as any)

          // Clear connect metadata writes.
          outA.length = 0
          outB.length = 0

          // Output from a must never show up in b.
          Pty.write(a.id, "AAA\n")
          await Bun.sleep(100)

          expect(outB.join("")).not.toContain("AAA")
        } finally {
          await Pty.remove(a.id)
          await Pty.remove(b.id)
        }
      },
    })
  })

  test("does not leak output when Bun recycles websocket objects before re-connect", async () => {
    await using dir = await tmpdir({ git: true })

    await Instance.provide({
      directory: dir.path,
      fn: async () => {
        const a = await Pty.create({ command: "cat", title: "a" })
        try {
          const outA: string[] = []
          const outB: string[] = []

          const ws = {
            readyState: 1,
            data: { events: { connection: "a" } },
            send: (data: unknown) => {
              outA.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
            },
            close: () => {
              // no-op (simulate abrupt drop)
            },
          }

          // Connect "a" first.
          Pty.connect(a.id, ws as any)
          outA.length = 0

          // Simulate Bun reusing the same websocket object for another
          // connection before the next onOpen calls Pty.connect.
          ws.data = { events: { connection: "b" } }
          ws.send = (data: unknown) => {
            outB.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
          }

          Pty.write(a.id, "AAA\n")
          await Bun.sleep(100)

          expect(outB.join("")).not.toContain("AAA")
        } finally {
          await Pty.remove(a.id)
        }
      },
    })
  })

  test("does not leak output when socket data mutates in-place", async () => {
    await using dir = await tmpdir({ git: true })

    await Instance.provide({
      directory: dir.path,
      fn: async () => {
        const a = await Pty.create({ command: "cat", title: "a" })
        try {
          const outA: string[] = []
          const outB: string[] = []

          const ctx = { connId: 1 }
          const ws = {
            readyState: 1,
            data: ctx,
            send: (data: unknown) => {
              outA.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
            },
            close: () => {
              // no-op
            },
          }

          Pty.connect(a.id, ws as any)
          outA.length = 0

          // Simulate the runtime mutating per-connection data without
          // swapping the reference (ws.data stays the same object).
          ctx.connId = 2
          ws.send = (data: unknown) => {
            outB.push(typeof data === "string" ? data : Buffer.from(data as Uint8Array).toString("utf8"))
          }

          Pty.write(a.id, "AAA\n")
          await Bun.sleep(100)

          expect(outB.join("")).not.toContain("AAA")
        } finally {
          await Pty.remove(a.id)
        }
      },
    })
  })
})
}
