import { describe, test, expect } from "bun:test"
import { ThinkingSpinner } from "../../src/cli/ui/ink-app/components/messages/ThinkingSpinner"

describe("ThinkingSpinner", () => {
  test("exports a component", () => {
    expect(typeof ThinkingSpinner).toBe("function")
  })
})
