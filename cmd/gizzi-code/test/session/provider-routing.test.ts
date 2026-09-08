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

  test("accepts BYO provider credentials on the prompt input", () => {
    const parsed = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_test",
      provider_credentials: { apiKey: "sk-byo-1234", baseURL: "https://api.anthropic.com" },
      parts: [{ type: "text", text: "hello" }],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.provider_credentials).toEqual({
        apiKey: "sk-byo-1234",
        baseURL: "https://api.anthropic.com",
      })
    }
  })

  test("provider credentials are optional and must be an object", () => {
    const empty = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_test",
      parts: [{ type: "text", text: "hello" }],
    })
    expect(empty.success).toBe(true)
    if (empty.success) {
      expect(empty.data.provider_credentials).toBeUndefined()
    }
    const bad = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_test",
      provider_credentials: "sk-byo-1234",
      parts: [{ type: "text", text: "hello" }],
    })
    expect(bad.success).toBe(false)
  })

  test("provider routing and credentials compose on one input", () => {
    const parsed = SessionPrompt.PromptInput.safeParse({
      sessionID: "ses_test",
      provider: { only: ["anthropic"] },
      provider_credentials: { apiKey: "sk-byo-1234" },
      parts: [{ type: "text", text: "hello" }],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) {
      expect(parsed.data.provider).toEqual({ only: ["anthropic"] })
      expect(parsed.data.provider_credentials).toEqual({ apiKey: "sk-byo-1234" })
    }
  })
})
