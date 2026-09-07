import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, test } from "bun:test"
import { eventsAfter, showNativeSession } from "./project.js"
import { listNativeSessions, snapshotRef, inspectOrigin } from "./index.js"

describe("native-sessions projectors", () => {
  test("projects Codex rollout response_item messages", () => {
    const home = join(tmpdir(), `codex-proj-${Date.now()}`)
    const dir = join(home, ".codex", "sessions", "2026", "09", "06")
    mkdirSync(dir, { recursive: true })
    const id = "019e0283-5626-7071-bfec-9de27bc1e686"
    const file = join(dir, `rollout-2026-09-06T12-00-00-${id}.jsonl`)
    writeFileSync(
      file,
      [
        JSON.stringify({ type: "session_meta", payload: { id, cwd: "/tmp/app" } }),
        JSON.stringify({ type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "ship the catalog" }] } }),
        JSON.stringify({ type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "working on it" }] } }),
      ].join("\n") + "\n",
    )
    const listed = listNativeSessions({ home, harnesses: ["codex"] })
    expect(listed.some((s) => s.sessionId === id)).toBe(true)
    const shown = showNativeSession("codex", id, { home })
    expect(shown.events.some((e) => e.role === "user" && e.text?.includes("catalog"))).toBe(true)
    expect(shown.events.some((e) => e.role === "assistant")).toBe(true)
  })

  test("eventsAfter returns only native turns past the snapshot leaf", () => {
    const home = join(tmpdir(), `after-${Date.now()}`)
    const dir = join(home, ".claude", "projects", "-tmp")
    mkdirSync(dir, { recursive: true })
    const id = "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee"
    const file = join(dir, `${id}.jsonl`)
    writeFileSync(
      file,
      [
        JSON.stringify({ type: "user", uuid: "u1", sessionId: id, message: { role: "user", content: "one" } }),
        JSON.stringify({ type: "assistant", uuid: "a1", sessionId: id, message: { role: "assistant", content: "ok" } }),
      ].join("\n") + "\n",
    )
    const ref = snapshotRef("claude", id, { home })
    expect(ref?.eventId).toBe("a1")
    writeFileSync(
      file,
      [
        JSON.stringify({ type: "user", uuid: "u1", sessionId: id, message: { role: "user", content: "one" } }),
        JSON.stringify({ type: "assistant", uuid: "a1", sessionId: id, message: { role: "assistant", content: "ok" } }),
        JSON.stringify({ type: "user", uuid: "u2", sessionId: id, message: { role: "user", content: "two" } }),
      ].join("\n") + "\n",
    )
    const delta = inspectOrigin(ref!, { home })
    expect(delta.divergence).toBe("native_ahead")
    expect(delta.events.some((e) => e.sourceId === "u2")).toBe(true)
    expect(eventsAfter(showNativeSession("claude", id, { home }), "a1").some((e) => e.sourceId === "u2")).toBe(true)
  })
})
