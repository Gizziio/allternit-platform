import { describe, test, expect } from "bun:test"
import { call } from "../../src/cli/ui/ink-app/commands/dash/dash"

describe("/dash slash command", () => {
  test("call returns a text dashboard", async () => {
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
    expect(value).toContain("Welcome to Gizzi Code")
    expect(value).toContain("Model:")
    expect(value).toContain("Directory:")
    expect(value).toContain("Session:")
    expect(value).toContain("Version:")
    expect(value).toContain("Context window")
    expect(value).toContain("Session usage")
    expect(value).toContain("Requests:")
    expect(value).toContain("Tokens:")
    expect(value).toContain("Run /dash again to refresh.")
  })

  test("call includes MCP server summary when clients are present", async () => {
    const result = await call("", {
      getAppState: () => ({
        messages: [],
        toolPermissionContext: { mode: "ask" },
      }),
      options: {
        mainLoopModel: "claude-sonnet-4-6-20251001",
        mcpClients: [
          { name: "filesystem", status: "connected" },
          { name: "git", status: "connected" },
        ],
      },
    } as any)

    expect(result.type).toBe("text")
    const value = (result as any).value as string
    expect(value).toContain("MCP servers: 2 connected")
    expect(value).toContain("filesystem")
    expect(value).toContain("git")
  })
})
