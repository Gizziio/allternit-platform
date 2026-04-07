// @ts-nocheck
import { describe, expect, test } from "bun:test"
import {
  classifyProviderErrorKind,
  describeProviderError,
  extractProviderErrorMessage,
  formatRetryStatus,
  isRetryLimitReached,
  normalizeProviderErrorCode,
  providerErrorLabel,
  providerErrorHint,
  retryLimitNote,
} from "../../src/util/provider-error"

describe("provider-error", () => {
  test("extracts nested message from embedded JSON", () => {
    const raw =
      'Too Many Requests: {"error":{"code":"1302","message":"Rate limit reached for requests"},"data":{"choices":[]}} (retry limit reached after 2 attempts)'
    expect(extractProviderErrorMessage(raw)).toBe("Rate limit reached for requests")
  })

  test("normalizes object payloads", () => {
    const raw = { error: { message: "Insufficient balance or no resource package. Please recharge." } }
    expect(extractProviderErrorMessage(raw)).toBe("Insufficient balance or no resource package. Please recharge.")
  })

  test("extracts detail fields from provider payloads", () => {
    const raw = 'Bad Request: {"detail":"model is not supported for this account"}'
    expect(extractProviderErrorMessage(raw)).toBe("model is not supported for this account")
  })

  test("extracts nested detail from wrapped api call error payloads", () => {
    const raw = JSON.stringify({
      error: {
        name: "AI_APICallError",
        responseBody:
          '{"detail":"The gpt-5.3-codex-spark model is not supported when using Codex with a ChatGPT account."}',
        requestBodyValues: {
          input: [
            {
              role: "developer",
              content: "very long prompt payload omitted",
            },
          ],
        },
      },
    })
    expect(extractProviderErrorMessage(raw)).toBe(
      "The gpt-5.3-codex-spark model is not supported when using Codex with a ChatGPT account.",
    )
  })

  test("classifies key provider error modes", () => {
    expect(classifyProviderErrorKind("rate limit reached")).toBe("rate_limit")
    expect(classifyProviderErrorKind("insufficient balance; please recharge")).toBe("insufficient_balance")
    expect(classifyProviderErrorKind("provider overloaded")).toBe("overloaded")
    expect(classifyProviderErrorKind("unauthorized request")).toBe("auth")
    expect(classifyProviderErrorKind("unexpected failure")).toBe("generic")
  })

  test("normalizes provider error codes", () => {
    expect(normalizeProviderErrorCode("1302", "Rate limit reached")).toBe("rate_limit")
    expect(normalizeProviderErrorCode("1113", "Insufficient balance")).toBe("insufficient_balance")
    expect(normalizeProviderErrorCode("model_not_supported", "unsupported model")).toBe("unsupported_model")
    expect(normalizeProviderErrorCode("context_length_exceeded", "context window")).toBe("context_overflow")
  })

  test("produces provider hints from code", () => {
    expect(providerErrorHint({ code: "unsupported_model", message: "x" })).toContain("supported")
    expect(providerErrorHint({ code: "rate_limit", message: "x" })).toContain("Wait")
  })

  test("produces codex spark-specific unsupported model hint", () => {
    expect(
      providerErrorHint({
        code: "unsupported_model",
        message: "The gpt-5.3-codex-spark model is not supported when using Codex with a ChatGPT account.",
      }),
    ).toContain("GPT-5.2 Codex")
  })

  test("describes provider error with title/code/hint", () => {
    const result = describeProviderError({
      raw: 'Bad Request: {"error":{"code":"model_not_supported"},"detail":"model not supported"}',
    })
    expect(result.code).toBe("unsupported_model")
    expect(result.title).toBe("Unsupported model")
    expect(result.hint).toBeDefined()
  })

  test("formats retry status with countdown", () => {
    const now = Date.now()
    const result = formatRetryStatus({
      message: "Too many requests",
      attempt: 2,
      next: now + 4200,
      now,
    })
    expect(result.label).toBe(providerErrorLabel("rate_limit"))
    expect(result.detail).toContain("retry in 5s")
    expect(result.detail).toContain("attempt 2")
  })

  test("detects retry limit suffix", () => {
    const suffix = `(${retryLimitNote(2)})`
    expect(isRetryLimitReached(`Rate limit reached ${suffix}`)).toBe(true)
    expect(isRetryLimitReached("Rate limit reached")).toBe(false)
  })
})
