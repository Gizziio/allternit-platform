/**
 * Stream context (AsyncLocalStorage) — carries the sessionID from llm.ts
 * through the streamText pipeline into the subprocess driver, where ACP
 * permission requests gate through the session's PermissionNext policy.
 */
import { describe, expect, test } from "bun:test"
import { getStreamContext, runWithStreamContext } from "@/runtime/session/stream-context"

describe("stream-context", () => {
  test("context is visible inside the marked scope", () => {
    runWithStreamContext({ sessionID: "ses_test" }, () => {
      expect(getStreamContext()?.sessionID).toBe("ses_test")
    })
  })

  test("context propagates through awaited async chains", async () => {
    await runWithStreamContext({ sessionID: "ses_async" }, async () => {
      await new Promise((r) => setTimeout(r, 1))
      expect(getStreamContext()?.sessionID).toBe("ses_async")
    })
  })

  test("context is undefined outside the marked scope", () => {
    runWithStreamContext({ sessionID: "ses_inner" }, () => {})
    expect(getStreamContext()).toBeUndefined()
  })

  test("nested scopes shadow correctly", () => {
    runWithStreamContext({ sessionID: "outer" }, () => {
      runWithStreamContext({ sessionID: "inner" }, () => {
        expect(getStreamContext()?.sessionID).toBe("inner")
      })
      expect(getStreamContext()?.sessionID).toBe("outer")
    })
  })
})
