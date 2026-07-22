import { beforeEach, describe, expect, test } from "bun:test"
import { ToolDedupe } from "@/runtime/tools/dedupe"
import { ToolSelection } from "@/runtime/tools/selection"

describe("tool execution safeguards", () => {
  beforeEach(() => {
    ToolDedupe.reset()
    ToolSelection.reset()
  })

  test("coalesces semantically identical calls in one step", async () => {
    let calls = 0
    const execute = () =>
      ToolDedupe.execute({
        sessionID: "session-1",
        messageID: "message-1",
        tool: "write",
        args: { b: 2, a: 1 },
        run: async () => ({ output: String(++calls) }),
      })
    const reordered = () =>
      ToolDedupe.execute({
        sessionID: "session-1",
        messageID: "message-1",
        tool: "write",
        args: { a: 1, b: 2 },
        run: async () => ({ output: String(++calls) }),
      })

    const [first, second] = await Promise.all([execute(), reordered()])
    expect(calls).toBe(1)
    expect(second).toEqual(first)
  })

  test("preserves selected MCP tools and rejects unknown names", () => {
    expect(ToolSelection.load("session-1", ["github:issue", "missing"], ["github:issue"])).toEqual({
      loaded: ["github:issue"],
      alreadyAvailable: [],
      unknown: ["missing"],
    })
    expect(ToolSelection.loaded("session-1", [])).toEqual(new Set(["github:issue"]))
  })
})
