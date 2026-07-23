import { describe, test, expect } from "bun:test"
import { RotatingTip } from "../../src/cli/ui/ink-app/components/PromptInput/RotatingTip"

describe("RotatingTip", () => {
  test("exports a component", () => {
    expect(typeof RotatingTip).toBe("function")
  })
})
