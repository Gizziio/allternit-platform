import { describe, expect, test } from "bun:test"
import { ContextAccounting } from "@/runtime/session/context-accounting"

describe("context accounting contract", () => {
  test("counts prompts, messages, schemas, and reserved output without exceeding the window", () => {
    const result = ContextAccounting.measure({
      system: ["system"],
      messages: [{ role: "user", content: "hello" }],
      tools: { read: { description: "read a file" } },
      contextWindow: 1_000,
      reservedOutputTokens: 100,
    })
    expect(result.basis).toBe("estimated")
    expect(result.inputTokens).toBeGreaterThan(0)
    expect(result.remainingTokens).toBe(1_000 - result.inputTokens - 100)
  })

  test("never understates a larger local projection when provider usage is stale", () => {
    const result = ContextAccounting.measure({
      system: ["x".repeat(400)],
      messages: [],
      tools: {},
      contextWindow: 1_000,
      reservedOutputTokens: 100,
      providerUsage: { inputTokens: 1, cachedTokens: 20 },
    })
    expect(result.inputTokens).toBeGreaterThan(1)
    expect(result.cachedTokens).toBe(20)
  })
})
