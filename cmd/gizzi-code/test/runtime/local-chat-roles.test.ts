// @ts-nocheck
import { describe, expect, test } from "bun:test"
import { normalizeRoleAlternation } from "../../src/cli/ui/ink-app/utils/localChatRoles"

describe("normalizeRoleAlternation", () => {
  test("folds system into the first user message", () => {
    const out = normalizeRoleAlternation([
      { role: "system", content: "You are an agent." },
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ])
    expect(out.map((m) => m.role)).toEqual(["user", "assistant"])
    expect(out[0].content).toBe("You are an agent.\n\nhi")
  })

  test("converts tool results to user messages with prefix", () => {
    const out = normalizeRoleAlternation([
      { role: "user", content: "run ls" },
      { role: "assistant", content: "", tool_calls: [{ id: "call_1" }] },
      { role: "tool", content: "file.txt", tool_call_id: "call_1" },
      { role: "assistant", content: "done" },
    ])
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"])
    expect(out[2].content).toContain("[tool result call_1]")
    expect(out[2].content).toContain("file.txt")
    expect(out[1].tool_calls).toEqual([{ id: "call_1" }])
  })

  test("merges consecutive user messages (folded non-conversational entries)", () => {
    const out = normalizeRoleAlternation([
      { role: "user", content: "first" },
      { role: "user", content: "second" },
      { role: "assistant", content: "ok" },
    ])
    expect(out.map((m) => m.role)).toEqual(["user", "assistant"])
    expect(out[0].content).toBe("first\n\nsecond")
  })

  test("full agent transcript alternates strictly", () => {
    const out = normalizeRoleAlternation([
      { role: "system", content: "sys" },
      { role: "user", content: "do a thing" },
      { role: "assistant", content: "", tool_calls: [{ id: "c1" }] },
      { role: "tool", content: "r1", tool_call_id: "c1" },
      { role: "assistant", content: "", tool_calls: [{ id: "c2" }] },
      { role: "tool", content: "r2", tool_call_id: "c2" },
      { role: "assistant", content: "finished" },
      { role: "user", content: "thanks" },
      { role: "assistant", content: "yw" },
    ])
    const roles = out.map((m) => m.role)
    expect(roles).toEqual(["user", "assistant", "user", "assistant", "user", "assistant", "user", "assistant"])
    for (let i = 1; i < roles.length; i++) {
      expect(roles[i]).not.toBe(roles[i - 1])
    }
  })

  test("system becomes a user message when transcript starts with assistant", () => {
    const out = normalizeRoleAlternation([
      { role: "system", content: "sys" },
      { role: "assistant", content: "hi" },
    ])
    expect(out.map((m) => m.role)).toEqual(["user", "assistant"])
    expect(out[0].content).toBe("sys")
  })

  test("tool result after assistant text merges into one user turn", () => {
    const out = normalizeRoleAlternation([
      { role: "user", content: "q" },
      { role: "assistant", content: "thinking", tool_calls: [{ id: "c1" }] },
      { role: "tool", content: "r1", tool_call_id: "c1" },
      { role: "tool", content: "r2", tool_call_id: "c2" },
    ])
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "user"])
    expect(out[2].content).toContain("r1")
    expect(out[2].content).toContain("r2")
  })
})
