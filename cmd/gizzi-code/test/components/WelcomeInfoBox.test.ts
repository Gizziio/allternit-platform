import { describe, test, expect } from "bun:test"
import { WelcomeInfoBox } from "../../src/cli/ui/ink-app/components/LogoV2/WelcomeInfoBox"

describe("WelcomeInfoBox", () => {
  test("exports a component", () => {
    expect(typeof WelcomeInfoBox).toBe("function")
  })
})
