import { describe, test, expect } from "bun:test"
import { buildSessionStatus } from "../../src/cli/ui/ink-app/utils/statusModel"

describe("/status --json slash command", () => {
  test("buildSessionStatus returns valid JSON structure", async () => {
    const status = await buildSessionStatus({
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

    expect(status.schemaVersion).toBe(1)
    expect(typeof status.model).toBe("string")
    expect(typeof status.version).toBe("string")
    expect(typeof status.directory).toBe("string")
    expect(typeof status.sessionId).toBe("string")
    expect(status.context).toHaveProperty("total")
    expect(status.context).toHaveProperty("used")
    expect(status.context).toHaveProperty("percent")
    expect(status.costUSD).toBeGreaterThanOrEqual(0)
    expect(status.durationMs).toBeGreaterThanOrEqual(0)
    expect(status.requests).toBeGreaterThanOrEqual(0)
    expect(status.tokens).toHaveProperty("input")
    expect(status.tokens).toHaveProperty("output")
    expect(status.mcp.connected).toBe(2)
    expect(status.mcp.servers).toContain("filesystem")
    expect(status.mcp.servers).toContain("git")
    expect(status.harness).toHaveProperty("enabled")
    expect(status.harness).toHaveProperty("mode")
    expect(status.workspace).toHaveProperty("present")
    expect(Array.isArray(status.errors)).toBe(true)
  })

  test("JSON serialization round-trips", async () => {
    const status = await buildSessionStatus({
      getAppState: () => ({
        messages: [],
        toolPermissionContext: { mode: "ask" },
      }),
      options: {
        mainLoopModel: "claude-sonnet-4-6-20251001",
        mcpClients: [],
      },
    } as any)

    const json = JSON.stringify(status)
    const parsed = JSON.parse(json)
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.mcp.connected).toBe(0)
    expect(parsed.mcp.servers).toEqual([])
  })
})
