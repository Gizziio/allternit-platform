// @ts-nocheck
import { afterEach, describe, expect, test } from "bun:test"
import {
  apiFetch,
  API_FETCH_DEFAULT_TIMEOUT_MS,
} from "../src/runtime/services/api/allternitApi"

const config = {
  baseUrl: "http://127.0.0.1:9",
  token: "test-token",
  userId: "test-user",
  userEmail: undefined,
  userName: undefined,
}

describe("apiFetch default timeout", () => {
  const realFetch = globalThis.fetch
  let seenInit: RequestInit | undefined

  afterEach(() => {
    globalThis.fetch = realFetch
    seenInit = undefined
  })

  function stubFetch() {
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      seenInit = init
      return new Response("{}", { status: 200 })
    }) as typeof fetch
  }

  test("attaches an AbortSignal deadline when the caller passes none", async () => {
    stubFetch()
    await apiFetch(config, "/x")
    expect(seenInit?.signal).toBeInstanceOf(AbortSignal)
    expect((seenInit?.signal as AbortSignal).aborted).toBe(false)
  })

  test("caller-provided signal wins over the default", async () => {
    stubFetch()
    const controller = new AbortController()
    await apiFetch(config, "/x", { signal: controller.signal })
    expect(seenInit?.signal).toBe(controller.signal)
  })

  test("default timeout constant is exported and sane", () => {
    expect(API_FETCH_DEFAULT_TIMEOUT_MS).toBeGreaterThan(0)
    expect(API_FETCH_DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(60_000)
  })
})
