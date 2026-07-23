import { describe, test, expect } from "bun:test"
import { ToolUseCard } from "../../src/cli/ui/ink-app/components/messages/ToolUseCard"

describe("ToolUseCard", () => {
  test("exports a component", () => {
    expect(typeof ToolUseCard).toBe("function")
  })
})
