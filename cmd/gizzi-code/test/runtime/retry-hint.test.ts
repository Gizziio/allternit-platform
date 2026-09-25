import { describe, expect, test } from "bun:test"
import {
  clearRetryHints,
  consumeRetryHint,
  createRetryHintStream,
  parseRetryHint,
  recordRetryHint,
  tapRetryHint,
} from "@/runtime/providers/retry-hint"

const RETRYABLE_FRAME =
  'event: allternit.retry_hint\ndata: {"retryable":true,"reason":"rate_limit_error","next_fallback":{"provider_id":"mock-b","model_id":"model-b"}}\n\n'
const TERMINAL_FRAME =
  'event: allternit.retry_hint\ndata: {"retryable":false,"reason":"invalid_request_error","next_fallback":null}\n\n'

function streamResponse(body: string, contentType = "text/event-stream"): Response {
  return new Response(new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(body))
      c.close()
    },
  }), { status: 200, headers: { "content-type": contentType } })
}

async function readAll(res: Response): Promise<string> {
  return new Response(res.body).text()
}

describe("parseRetryHint", () => {
  test("parses the retryable wire shape", () => {
    const hint = parseRetryHint(
      '{"retryable":true,"reason":"rate_limit_error","next_fallback":{"provider_id":"mock-b","model_id":"model-b"}}',
    )
    expect(hint).toEqual({
      retryable: true,
      reason: "rate_limit_error",
      next_fallback: { provider_id: "mock-b", model_id: "model-b" },
    })
  })

  test("parses the terminal wire shape", () => {
    const hint = parseRetryHint('{"retryable":false,"reason":"upstream_error","next_fallback":null}')
    expect(hint).toEqual({ retryable: false, reason: "upstream_error", next_fallback: null })
  })

  test("rejects malformed payloads", () => {
    expect(parseRetryHint("not json")).toBeNull()
    expect(parseRetryHint('{"reason":"x"}')).toBeNull()
    expect(parseRetryHint('{"retryable":true,"next_fallback":{"provider_id":1}}')).toEqual({
      retryable: true,
      reason: "unknown",
      next_fallback: null,
    })
  })
})

describe("createRetryHintStream", () => {
  async function run(chunks: string[]): Promise<{ out: string; hints: unknown[] }> {
    const hints: unknown[] = []
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk))
        c.close()
      },
    })
    const out = await new Response(source.pipeThrough(createRetryHintStream((h) => hints.push(h)))).text()
    return { out, hints }
  }

  test("strips a retry_hint frame and reports it, passing other frames through byte-identical", async () => {
    const chunk = 'data: {"id":"x","choices":[]}\n\n'
    const { out, hints } = await run([chunk + RETRYABLE_FRAME + 'data: {"error":{}}\n\ndata: [DONE]\n\n'])
    expect(out).toBe(chunk + 'data: {"error":{}}\n\ndata: [DONE]\n\n')
    expect(hints).toEqual([
      { retryable: true, reason: "rate_limit_error", next_fallback: { provider_id: "mock-b", model_id: "model-b" } },
    ])
  })

  test("handles frames split across byte chunks", async () => {
    const wire = 'data: {"a":1}\n\n' + RETRYABLE_FRAME + "data: [DONE]\n\n"
    const mid = Math.floor(wire.length / 2)
    const { out, hints } = await run([wire.slice(0, mid), wire.slice(mid)])
    expect(out).toBe('data: {"a":1}\n\ndata: [DONE]\n\n')
    expect(hints).toHaveLength(1)
  })

  test("preserves CRLF framing and multi-line data", async () => {
    const frame = "event: allternit.retry_hint\r\ndata: {\"retryable\":false,\"reason\":\"x\",\r\ndata: \"next_fallback\":null}\r\n\r\n"
    const kept = "data: [DONE]\r\n\r\n"
    const { out, hints } = await run([frame + kept])
    expect(out).toBe(kept)
    expect(hints).toEqual([{ retryable: false, reason: "x", next_fallback: null }])
  })

  test("ignores frames that merely mention the event name in data", async () => {
    const frame = 'data: {"note":"event: allternit.retry_hint"}\n\n'
    const real = 'data: {"x":1}\n\n'
    const { out, hints } = await run([real + frame])
    expect(out).toBe(real + frame)
    expect(hints).toHaveLength(0)
  })
})

describe("retry hint store", () => {
  test("consume returns the hint exactly once", () => {
    clearRetryHints()
    recordRetryHint("s1", { retryable: true, reason: "r", next_fallback: null })
    expect(consumeRetryHint("s1")?.retryable).toBe(true)
    expect(consumeRetryHint("s1")).toBeUndefined()
  })

  test("hints are scoped per session", () => {
    clearRetryHints()
    recordRetryHint("s1", { retryable: true, reason: "r", next_fallback: null })
    expect(consumeRetryHint("s2")).toBeUndefined()
    expect(consumeRetryHint("s1")).toBeDefined()
  })
})

describe("tapRetryHint", () => {
  const base = {
    method: "POST",
    url: "https://api.allternit.com/v1/chat/completions",
    sessionID: "ses_1",
    npm: "@ai-sdk/openai-compatible",
  }

  test("taps gateway chat-completions SSE responses", async () => {
    clearRetryHints()
    const res = tapRetryHint({
      ...base,
      response: streamResponse('data: {"a":1}\n\n' + RETRYABLE_FRAME + "data: [DONE]\n\n"),
    })
    const out = await readAll(res)
    expect(out).toBe('data: {"a":1}\n\ndata: [DONE]\n\n')
    expect(consumeRetryHint("ses_1")).toEqual({
      retryable: true,
      reason: "rate_limit_error",
      next_fallback: { provider_id: "mock-b", model_id: "model-b" },
    })
  })

  test("passes through non-SSE, non-POST, and non-openai-compatible responses untouched", async () => {
    clearRetryHints()
    const json = tapRetryHint({ ...base, response: streamResponse("{}", "application/json") })
    expect(await readAll(json)).toBe("{}")
    const get = tapRetryHint({ ...base, method: "GET", response: streamResponse(RETRYABLE_FRAME) })
    expect(await readAll(get)).toBe(RETRYABLE_FRAME)
    const anthropic = tapRetryHint({
      ...base,
      npm: "@ai-sdk/anthropic",
      response: streamResponse(RETRYABLE_FRAME),
    })
    expect(await readAll(anthropic)).toBe(RETRYABLE_FRAME)
    expect(consumeRetryHint("ses_1")).toBeUndefined()
  })

  test("requires a session header and is disabled via GIZZI_DISABLE_RETRY_HINT", async () => {
    clearRetryHints()
    const noSession = tapRetryHint({ ...base, sessionID: null, response: streamResponse(RETRYABLE_FRAME) })
    expect(await readAll(noSession)).toBe(RETRYABLE_FRAME)

    process.env.GIZZI_DISABLE_RETRY_HINT = "1"
    try {
      const disabled = tapRetryHint({ ...base, response: streamResponse(RETRYABLE_FRAME) })
      expect(await readAll(disabled)).toBe(RETRYABLE_FRAME)
    } finally {
      delete process.env.GIZZI_DISABLE_RETRY_HINT
    }
  })

  test("terminal hints are recorded too (the processor surfaces them as today)", async () => {
    clearRetryHints()
    const res = tapRetryHint({ ...base, response: streamResponse(TERMINAL_FRAME + "data: [DONE]\n\n") })
    await readAll(res)
    expect(consumeRetryHint("ses_1")?.retryable).toBe(false)
  })
})
