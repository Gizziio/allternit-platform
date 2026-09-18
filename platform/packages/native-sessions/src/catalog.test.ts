import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, test } from "bun:test"
import { inspectOrigin, listHarnesses, listNativeSessions, showNativeSession, snapshotRef } from "./index.js"

function fixtureHome(): string {
  const root = join(tmpdir(), `native-sessions-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  const claude = join(root, ".claude", "projects", "-tmp-app")
  mkdirSync(claude, { recursive: true })
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  writeFileSync(
    join(claude, `${id}.jsonl`),
    [
      JSON.stringify({ type: "user", uuid: "u1", sessionId: id, message: { role: "user", content: "fix the login" } }),
      JSON.stringify({ type: "assistant", uuid: "a1", sessionId: id, message: { role: "assistant", content: "looking at auth.ts" } }),
    ].join("\n") + "\n",
  )
  return root
}

describe("native-sessions catalog", () => {
  test("registry covers production harnesses even when none are installed", () => {
    const listed = listHarnesses()
    expect(listed.length).toBeGreaterThanOrEqual(18)
    expect(listed.map((h) => h.id)).toContain("claude")
    expect(listed.map((h) => h.id)).toContain("devin")
    expect(listed.map((h) => h.id)).toContain("gizzi")
  })

  test("lists and projects a Claude jsonl, then reports native_ahead after mutation", () => {
    const home = fixtureHome()
    const sessions = listNativeSessions({ home, harnesses: ["claude"] })
    expect(sessions.length).toBe(1)
    expect(sessions[0]!.sessionId).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    const shown = showNativeSession("claude", sessions[0]!.sessionId, { home })
    expect(shown.events.some((e) => e.kind === "message" && e.role === "user")).toBe(true)
    const ref = snapshotRef("claude", sessions[0]!.sessionId, { home })
    expect(ref).toBeDefined()
    const clean = inspectOrigin(ref!, { home })
    expect(clean.divergence).toBe("clean")
    writeFileSync(sessions[0]!.path, readPlus(sessions[0]!.path))
    const ahead = inspectOrigin(ref!, { home })
    expect(ahead.divergence).toBe("native_ahead")
    expect(ahead.events.length).toBeGreaterThan(0)
  })

  test("lists Cline tasks and Amp threads from their documented store layouts", () => {
    const home = join(tmpdir(), `native-cline-amp-${Date.now()}`)
    const clineTask = join(home, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "tasks", "task-1234")
    mkdirSync(clineTask, { recursive: true })
    writeFileSync(
      join(clineTask, "api_conversation_history.json"),
      JSON.stringify([
        { role: "user", content: "refactor the parser" },
        { role: "assistant", content: "on it" },
      ]),
    )
    const ampThreads = join(home, ".local", "share", "amp", "threads")
    mkdirSync(ampThreads, { recursive: true })
    writeFileSync(
      join(ampThreads, "T-abc123.json"),
      JSON.stringify({ messages: [{ role: "user", content: [{ type: "text", text: "ship the feature" }] }] }),
    )

    const cline = listNativeSessions({ home, harnesses: ["cline"] })
    expect(cline.length).toBe(1)
    expect(cline[0]!.sessionId).toBe("task-1234")
    expect(cline[0]!.title).toContain("refactor the parser")
    expect(cline[0]!.projectable).toBe(true)

    const amp = listNativeSessions({ home, harnesses: ["amp"] })
    expect(amp.length).toBe(1)
    expect(amp[0]!.sessionId).toBe("T-abc123")
    expect(amp[0]!.title).toContain("ship the feature")
    expect(amp[0]!.projectable).toBe(true)
  })

  test("aider and kiro remain registry-only (no enumerable store reader)", () => {
    const listed = listHarnesses()
    expect(listed.map((h) => h.id)).toContain("aider")
    expect(listed.map((h) => h.id)).toContain("kiro")
    const sessions = listNativeSessions({ harnesses: ["aider", "kiro"] })
    expect(sessions.filter((s) => s.harness === "aider" || s.harness === "kiro").length).toBe(0)
  })
})

function readPlus(path: string): string {
  const { readFileSync } = require("node:fs") as typeof import("node:fs")
  return (
    readFileSync(path, "utf8") +
    JSON.stringify({ type: "user", uuid: "u2", sessionId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", message: { role: "user", content: "also add tests" } }) +
    "\n"
  )
}
