// @ts-nocheck
import { describe, expect, test } from "bun:test"
import {
  ATTENTION_CLASSES,
  ATTENTION_HINTS,
  FAILURE_REASONS,
  annotateFailureReason,
  attentionHintFor,
  classifyFailure,
  classifyRetry,
  failureReasonOf,
  isAttentionReason,
  isAutoRetryable,
  type FailureReason,
} from "../../../src/runtime/bots/failure-reasons"

/**
 * Phase B4 — typed failure taxonomy (D4): faithful port of the platform test
 * cases (surfaces/ai.allternit.com/src/lib/bots/failure-reasons.test.ts) —
 * classifier ordering (auth outranks quota), retry classes, attention classes.
 */

class FakeProviderError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message)
    this.name = "ProviderApiError"
  }
}

describe("classifyFailure", () => {
  test("classifies a plain unknown error", () => {
    expect(classifyFailure(new Error("something odd happened"))).toBe("unknown")
    expect(classifyFailure(null)).toBe("unknown")
    expect(classifyFailure("")).toBe("unknown")
    expect(classifyFailure(undefined)).toBe("unknown")
  })

  test("maps statusCode 401/403 to provider_auth_or_access", () => {
    expect(classifyFailure(new FakeProviderError("HTTP 401", 401))).toBe("provider_auth_or_access")
    expect(classifyFailure(new FakeProviderError("forbidden", 403))).toBe("provider_auth_or_access")
  })

  test("auth outranks quota when both signals are present", () => {
    // Real provider 401 bodies mention funds; auth must still win the tie.
    expect(
      classifyFailure(new FakeProviderError("invalid api key: quota balance exceeded", 401)),
    ).toBe("provider_auth_or_access")
    expect(classifyFailure(new Error("401 unauthorized — insufficient funds"))).toBe(
      "provider_auth_or_access",
    )
  })

  test("maps 402 / out-of-funds bodies to provider_quota_limit", () => {
    expect(classifyFailure(new FakeProviderError("HTTP 402", 402))).toBe("provider_quota_limit")
    expect(classifyFailure(new Error("account is out of funds"))).toBe("provider_quota_limit")
    expect(classifyFailure(new Error("insufficient credits remaining"))).toBe("provider_quota_limit")
  })

  test("maps 429 / rate limit to provider_rate_limit", () => {
    expect(classifyFailure(new FakeProviderError("HTTP 429", 429))).toBe("provider_rate_limit")
    expect(classifyFailure(new Error("rate limit reached, slow down"))).toBe("provider_rate_limit")
  })

  test("maps 5xx / overloaded to provider_server_error", () => {
    expect(classifyFailure(new FakeProviderError("HTTP 503", 503))).toBe("provider_server_error")
    expect(classifyFailure(new Error("server error, try again"))).toBe("provider_server_error")
    expect(classifyFailure(new Error("provider is overloaded"))).toBe("provider_server_error")
  })

  test("maps context-length errors to context_overflow", () => {
    expect(classifyFailure(new Error("maximum context length exceeded"))).toBe("context_overflow")
    expect(classifyFailure(new Error("context_overflow"))).toBe("context_overflow")
  })

  test("maps missing provider/key configuration to missing_config", () => {
    expect(classifyFailure(new Error("no llm provider configured"))).toBe("missing_config")
    expect(
      classifyFailure(new Error("Grok is not configured. Add an xAI API key in Settings.")),
    ).toBe("missing_config")
  })

  test("maps unknown models to model_unavailable", () => {
    expect(classifyFailure(new Error("model gpt-99 does not exist"))).toBe("model_unavailable")
  })

  test("maps offline runtimes and network failures to runtime_offline", () => {
    expect(
      classifyFailure(new Error("Hermes is not available in this environment.")),
    ).toBe("runtime_offline")
    expect(classifyFailure(new Error("spawn hermes ENOENT"))).toBe("runtime_offline")
    expect(classifyFailure(new TypeError("Failed to fetch"))).toBe("runtime_offline")
    expect(classifyFailure(new Error("connect ECONNREFUSED 127.0.0.1:8013"))).toBe("runtime_offline")
  })

  test("maps timeouts to delivery_timeout", () => {
    expect(classifyFailure(new Error("ETIMEDOUT waiting for reply"))).toBe("delivery_timeout")
    expect(classifyFailure(new Error("The operation timed out"))).toBe("delivery_timeout")
  })

  test("maps busy targets to target_busy", () => {
    expect(classifyFailure(new Error("target busy with another turn"))).toBe("target_busy")
    expect(classifyFailure(new Error("bot is busy"))).toBe("target_busy")
  })

  test("maps queue expiry to queued_expired", () => {
    expect(classifyFailure(new Error("queue entry expired before delivery"))).toBe("queued_expired")
  })

  test("maps hard bans to agent_blocked", () => {
    expect(classifyFailure(new Error("Execution blocked by hard ban: no secrets"))).toBe(
      "agent_blocked",
    )
  })

  test("classifies objects with status/code fields without a message", () => {
    // A bare numeric status needs a status/http prefix to classify (same as
    // the platform original); string code/message fields classify directly.
    expect(classifyFailure({ status: "429 too many requests" })).toBe("provider_rate_limit")
    expect(classifyFailure({ statusCode: 429 })).toBe("unknown")
    expect(classifyFailure({ code: "ETIMEDOUT" })).toBe("delivery_timeout")
  })
})

describe("retry policy", () => {
  test("auto-retries only transient classes, once", () => {
    const retryable: FailureReason[] = [
      "runtime_offline",
      "delivery_timeout",
      "provider_rate_limit",
      "provider_server_error",
    ]
    for (const reason of retryable) {
      expect(isAutoRetryable(reason)).toBe(true)
      expect(classifyRetry(reason)).toEqual({ reason, retry: "once" })
    }
  })

  test("context_overflow retries only after compaction", () => {
    expect(isAutoRetryable("context_overflow")).toBe(false)
    expect(classifyRetry("context_overflow")).toEqual({
      reason: "context_overflow",
      retry: "after_compact",
    })
  })

  test("never retries auth/quota/config/model/blocked/unknown", () => {
    const neverRetry: FailureReason[] = [
      "provider_auth_or_access",
      "provider_quota_limit",
      "missing_config",
      "model_unavailable",
      "agent_blocked",
      "target_busy",
      "queued_expired",
      "unknown",
    ]
    for (const reason of neverRetry) {
      expect(isAutoRetryable(reason)).toBe(false)
      expect(classifyRetry(reason)).toEqual({ reason, retry: "never" })
    }
  })
})

describe("attention classes", () => {
  test("badges only persistent classes", () => {
    expect([...ATTENTION_CLASSES].sort()).toEqual(
      ["agent_blocked", "missing_config", "provider_auth_or_access", "provider_quota_limit"].sort(),
    )
    for (const reason of FAILURE_REASONS) {
      expect(isAttentionReason(reason)).toBe(ATTENTION_CLASSES.has(reason))
    }
  })

  test("provides a hint for every attention class", () => {
    for (const reason of ATTENTION_CLASSES) {
      expect(attentionHintFor(reason).length).toBeGreaterThan(10)
    }
    for (const reason of FAILURE_REASONS) {
      expect(typeof ATTENTION_HINTS[reason]).toBe("string")
    }
  })
})

describe("annotateFailureReason / failureReasonOf", () => {
  test("attaches and reads back a typed reason without losing the error", () => {
    const err = new Error("HTTP 429 too many requests")
    annotateFailureReason(err, "provider_rate_limit")
    expect(failureReasonOf(err)).toBe("provider_rate_limit")
    expect(err.message).toBe("HTTP 429 too many requests")
  })

  test("wraps non-object errors defensively", () => {
    const wrapped = annotateFailureReason("some string failure", "missing_config")
    expect(failureReasonOf(wrapped)).toBe("missing_config")
  })

  test("returns undefined for errors without a typed reason", () => {
    expect(failureReasonOf(new Error("plain"))).toBeUndefined()
    expect(failureReasonOf({ reason: "not_a_code" })).toBeUndefined()
    expect(failureReasonOf(null)).toBeUndefined()
  })
})
