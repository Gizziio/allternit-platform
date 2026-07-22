import { describe, expect, test } from "bun:test"
import { MCP } from "../../src/runtime/tools/mcp"

describe("MCP qualified tool names", () => {
  test("keeps server provenance and avoids builtin names", () => {
    expect(MCP.qualifiedToolName("github", "read_issue")).toBe("mcp__github__read_issue")
    expect(MCP.qualifiedToolName("filesystem", "read")).not.toBe("read")
  })

  test("bounds long provider tool names with a stable hash", () => {
    const first = MCP.qualifiedToolName("a very long server name repeated many times", "a very long tool name repeated many times")
    const second = MCP.qualifiedToolName("a very long server name repeated many times", "a very long tool name repeated many times")
    expect(first.length).toBeLessThanOrEqual(64)
    expect(first).toBe(second)
  })
})
