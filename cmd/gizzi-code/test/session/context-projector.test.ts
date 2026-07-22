import { describe, expect, test } from "bun:test"
import type { ModelMessage } from "ai"
import { ContextProjector } from "../../src/runtime/session/context-projector"

const user = { role: "user", content: [{ type: "text", text: "go" }] } as ModelMessage
const call = { type: "tool-call", toolCallId: "call-1", toolName: "read", input: {} }
const result = { type: "tool-result", toolCallId: "call-1", toolName: "read", output: { type: "text", value: "ok" } }

describe("wire-valid context projection", () => {
  test("moves tool results directly behind their call", () => {
    const projected = ContextProjector.project([
      user,
      { role: "assistant", content: [call] } as ModelMessage,
      { role: "user", content: [{ type: "text", text: "intervening" }] } as ModelMessage,
      { role: "tool", content: [result] } as ModelMessage,
    ])
    expect(projected.messages[2]?.role).toBe("tool")
    expect(projected.anomalies.map((item) => item.kind)).toContain("tool_result_reordered")
  })

  test("synthesizes interrupted results and drops orphan results", () => {
    const projected = ContextProjector.project([
      user,
      { role: "assistant", content: [call] } as ModelMessage,
      { role: "tool", content: [{ ...result, toolCallId: "orphan" }] } as ModelMessage,
    ])
    expect(projected.anomalies.map((item) => item.kind)).toEqual([
      "tool_result_synthesized",
      "orphan_tool_result_dropped",
    ])
  })

  test("degrades only older media and can strip the captured request projection", () => {
    const media = (id: string) => ({
      role: "user",
      content: [{ type: "file", data: id, mediaType: "image/png" }],
    }) as ModelMessage
    const degraded = ContextProjector.degradeOlderMedia([media("one"), media("two"), media("three")], 2)
    expect((degraded[0]!.content as any[])[0].type).toBe("text")
    expect((degraded[1]!.content as any[])[0].type).toBe("file")
    const stripped = ContextProjector.stripMedia(degraded)
    expect(stripped.flatMap((message) => message.content as any[]).every((part) => part.type !== "file")).toBe(true)
  })
})
