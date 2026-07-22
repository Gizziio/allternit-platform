import { describe, test, expect } from "bun:test"
import { call } from "../../src/cli/ui/ink-app/commands/usage/usage"

describe("/usage slash command", () => {
  test("call returns an inline usage dashboard", async () => {
    const result = await call("", {
      getAppState: () => ({
        messages: [],
        toolPermissionContext: { mode: "ask" },
      }),
      options: {
        mainLoopModel: "claude-sonnet-4-6-20251001",
        mcpClients: [],
      },
    } as any)

    expect(result.type).toBe("text")
    const value = (result as any).value as string
    expect(value).toContain("Usage")
    expect(value).toContain("Model:")
    expect(value).toContain("Directory:")
    expect(value).toContain("Session:")
    expect(value).toContain("Context window")
    expect(value).toContain("Session totals")
    expect(value).toContain("Tokens:")
  })
})
