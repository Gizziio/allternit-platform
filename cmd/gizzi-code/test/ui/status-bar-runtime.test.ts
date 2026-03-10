import { describe, expect, test } from "bun:test"
import type { Part, SessionStatus } from "@a2r/sdk/v2"
import { resolveFixtureState, resolveRuntimeState } from "../../src/ui/a2r/status-runtime"

function status(type: SessionStatus["type"]): SessionStatus {
  return { type } as SessionStatus
}

function part(value: Partial<Part> & { type: Part["type"] }): Part {
  return value as Part
}

describe("A2R status runtime resolver", () => {
  test("keeps queued idle as connecting", () => {
    expect(resolveRuntimeState(status("idle"), [], true)).toBe("connecting")
  })

  test("maps retry to connecting", () => {
    expect(resolveRuntimeState(status("retry"), [], false)).toBe("connecting")
  })

  test("maps busy without parts to connecting", () => {
    expect(resolveRuntimeState(status("busy"), [], false)).toBe("connecting")
  })

  test("prioritizes compacting over tools/reasoning", () => {
    const parts = [
      part({
        type: "tool",
        state: { status: "running", input: {}, time: { start: 1_000 } },
        tool: "websearch",
      }),
      part({ type: "reasoning", text: "plan" }),
      part({ type: "compaction" }),
    ]
    expect(resolveRuntimeState(status("busy"), parts, false)).toBe("compacting")
  })

  test("prioritizes executing over planning when both exist", () => {
    const parts = [
      part({ type: "reasoning", text: "plan" }),
      part({ type: "tool", state: { status: "pending", input: {}, raw: "" }, tool: "grep" }),
    ]
    expect(resolveRuntimeState(status("busy"), parts, false)).toBe("executing")
  })

  test("maps namespaced web tools to web", () => {
    const parts = [
      part({
        type: "tool",
        state: { status: "running", input: {}, time: { start: 1_000 } },
        tool: "websearch_web_search_exa",
      }),
    ]
    expect(resolveRuntimeState(status("busy"), parts, false)).toBe("web")
  })

  test("maps reasoning-only parts to planning", () => {
    const parts = [part({ type: "reasoning", text: "thinking" })]
    expect(resolveRuntimeState(status("busy"), parts, false)).toBe("planning")
  })

  test("falls back to responding after non-tool/non-reasoning parts", () => {
    const parts = [part({ type: "text", text: "hello" })]
    expect(resolveRuntimeState(status("busy"), parts, false)).toBe("responding")
  })
})

describe("A2R status fixture resolver", () => {
  test("returns undefined for off/empty fixture mode", () => {
    expect(resolveFixtureState("", Date.now(), Date.now())).toBeUndefined()
    expect(resolveFixtureState("off", Date.now(), Date.now())).toBeUndefined()
  })

  test("returns undefined when turn has no start timestamp", () => {
    expect(resolveFixtureState("slow_tools", undefined, Date.now())).toBeUndefined()
  })

  test("silent mode stays connecting until delay threshold", () => {
    const start = 1_000
    expect(resolveFixtureState("silent", start, start + 5_000, 22_000)?.state).toBe("connecting")
    expect(resolveFixtureState("silent", start, start + 22_500, 22_000)?.state).toBe("responding")
  })

  test("slow_tools mode emits web window with tool badges", () => {
    const start = 1_000
    const value = resolveFixtureState("slow_tools", start, start + 10_000, 22_000)
    expect(value?.state).toBe("web")
    expect(value?.tools).toEqual(["websearch", "context7", "grep_app"])
  })

  test("slow_response mode transitions to responding before delay end", () => {
    const start = 1_000
    expect(resolveFixtureState("slow_response", start, start + 9_000, 22_000)?.state).toBe("responding")
  })
})
