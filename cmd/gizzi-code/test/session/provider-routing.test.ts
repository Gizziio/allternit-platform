// @ts-nocheck
import { describe, expect, test } from "bun:test"
import { SessionPrompt } from "../../src/session/prompt"

describe("session.prompt provider routing", () => {
  test("accepts a provider routing object on the prompt input", () => {
    const parsed = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_test",
      provider: { sort: "price", only: ["anthropic"] },
      parts: [{ type: "text", text: "hello" }],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.provider).toEqual({ sort: "price", only: ["anthropic"] })
    }
  })

  test("provider routing is optional", () => {
    const parsed = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_test",
      parts: [{ type: "text", text: "hello" }],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.provider).toBeUndefined()
    }
  })

  test("rejects non-object provider routing", () => {
    const parsed = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_test",
      provider: "price",
      parts: [{ type: "text", text: "hello" }],
    })
    expect(parsed.success).toBe(false)
  })
})
