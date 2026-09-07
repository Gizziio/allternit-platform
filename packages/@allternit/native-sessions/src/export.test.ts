import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, test } from "bun:test"
import { exportPortableSession } from "./export.js"
import { listNativeSessions, showNativeSession } from "./index.js"
import type { PortableEvent } from "./types.js"

const events: PortableEvent[] = [
  { kind: "message", role: "user", text: "continue the login fix", recordIndex: 0, inert: true },
  { kind: "message", role: "assistant", text: "patching auth.ts", recordIndex: 1, inert: true },
]

describe("native export", () => {
  test("writes a new Claude session and never touches the origin file", () => {
    const home = join(tmpdir(), `export-${Date.now()}`)
    const originDir = join(home, ".claude", "projects", "-tmp-app")
    mkdirSync(originDir, { recursive: true })
    const originId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    const originPath = join(originDir, `${originId}.jsonl`)
    writeFileSync(originPath, JSON.stringify({ type: "user", uuid: "u1", sessionId: originId, message: { content: "origin" } }) + "\n")
    const originBefore = readFileSync(originPath, "utf8")

    const exported = exportPortableSession({
      harness: "claude",
      events,
      cwd: "/tmp/app",
      title: "allternit continuation",
      home,
      forbidPath: originPath,
    })

    expect(exported.sessionId).not.toBe(originId)
    expect(exported.path).not.toBe(originPath)
    expect(readFileSync(originPath, "utf8")).toBe(originBefore)
    const listed = listNativeSessions({ home, harnesses: ["claude"] })
    expect(listed.some((s) => s.sessionId === exported.sessionId)).toBe(true)
    const shown = showNativeSession("claude", exported.sessionId, { home })
    expect(shown.events.some((e) => e.text?.includes("login"))).toBe(true)
  })

  test("a second export allocates another id and leaves the first file intact", () => {
    const home = join(tmpdir(), `export-clobber-${Date.now()}`)
    const first = exportPortableSession({ harness: "claude", events, cwd: "/tmp/same", home })
    const before = readFileSync(first.path, "utf8")
    const second = exportPortableSession({ harness: "claude", events, cwd: "/tmp/same", home, forbidPath: first.path })
    expect(second.sessionId).not.toBe(first.sessionId)
    expect(second.path).not.toBe(first.path)
    expect(readFileSync(first.path, "utf8")).toBe(before)
  })
})
