import { describe, test, expect } from "bun:test"
import { call } from "../../src/cli/ui/ink-app/commands/status/status"

describe("/status slash command", () => {
  test("--inline returns status as a system text message", async () => {
    let doneText: string | undefined
    let doneOptions: any

    const result = await call(
      (text, options) => {
        doneText = text
        doneOptions = options
      },
      {
        getAppState: () => ({
          messages: [],
          toolPermissionContext: { mode: "ask" },
        }),
        options: {
          mainLoopModel: "claude-sonnet-4-6-20251001",
          mcpClients: [],
        },
      } as any,
      "--inline",
    )

    expect(result).toBeNull()
    expect(doneText).toBeDefined()
    expect(doneOptions?.display).toBe("system")
    expect(doneText).toContain("Status")
    expect(doneText).toContain("Model:")
    expect(doneText).toContain("Context window")
  })
})
