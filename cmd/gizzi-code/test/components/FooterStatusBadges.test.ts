import { describe, test, expect } from "bun:test"
import { FooterStatusBadges } from "../../src/cli/ui/ink-app/components/PromptInput/FooterStatusBadges"

describe("FooterStatusBadges", () => {
  test("exports a component", () => {
    expect(typeof FooterStatusBadges).toBe("function")
  })
})
