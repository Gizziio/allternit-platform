import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openCursorSse, type CursorSseEvent } from "./sse-cursor";

function sseStream(frames: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      for (const frame of frames) controller.enqueue(enc.encode(frame));
      controller.close();
    },
  });
}

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

function mockFetch(streams: ReadableStream<Uint8Array>[]) {
  const calls: FetchCall[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const stream = streams.shift();
    if (!stream) {
      // No scripted stream left: hang forever so retry scheduling is observable.
      return new Promise<Response>(() => {});
    }
    return new Response(stream, { status: 200 });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

describe("openCursorSse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Flush pending microtasks and 0ms timers without advancing the clock. */
  async function flush(times = 25) {
    for (let i = 0; i < times; i += 1) {
      await vi.advanceTimersByTimeAsync(0);
    }
  }

  it("parses SSE frames and reports id fields as cursors", async () => {
    const events: CursorSseEvent[] = [];
    const cursors: string[] = [];
    const { fetchImpl } = mockFetch([
      sseStream(['id: s1:3\nevent: patch\ndata: {"a":1}\ndata: {"b":2}\n\n']),
    ]);

    openCursorSse("https://relay.example/events", {
      onEvent: (e) => events.push(e),
      onCursor: (c) => cursors.push(c),
      fetchImpl,
    });

    await flush();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      event: "patch",
      data: '{"a":1}\n{"b":2}',
      id: "s1:3",
    });
    expect(cursors).toEqual(["s1:3"]);
  });

  it("reconnects after a dropped connection, sending Last-Event-ID", async () => {
    const events: CursorSseEvent[] = [];
    const { calls, fetchImpl } = mockFetch([
      sseStream(['id: s1:1\ndata: first\n\n']),
      sseStream(['id: s1:2\ndata: second\n\n']),
    ]);

    const handle = openCursorSse("https://relay.example/events", {
      onEvent: (e) => events.push(e),
      fetchImpl,
    });

    await flush();
    expect(events).toHaveLength(1);
    // First connection dropped (stream closed) → retry scheduled at 1s.
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(events).toHaveLength(2);

    expect(calls).toHaveLength(2);
    const firstHeaders = calls[0].init?.headers as Record<string, string>;
    const secondHeaders = calls[1].init?.headers as Record<string, string>;
    expect(firstHeaders["Accept"]).toBe("text/event-stream");
    expect(firstHeaders["Last-Event-ID"]).toBeUndefined();
    expect(secondHeaders["Last-Event-ID"]).toBe("s1:1");
    expect(events[1].id).toBe("s1:2");
    handle.close();
  });

  it("backs off exponentially (1s → 2s → 4s → 8s → 15s cap) across fetch rejections", async () => {
    // Rejections never receive a response, so the backoff is not reset —
    // this exercises the exponential ladder end to end.
    const calls: FetchCall[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      throw new Error("connection dropped");
    }) as unknown as typeof fetch;

    const handle = openCursorSse("https://relay.example/events", {
      onEvent: () => {},
      fetchImpl,
    });

    await flush();
    expect(calls).toHaveLength(1);
    for (const [advance, expected] of [
      [1000, 2],
      [2000, 3],
      [4000, 4],
      [8000, 5],
      [15_000, 6],
    ] as const) {
      await vi.advanceTimersByTimeAsync(advance);
      await flush();
      expect(calls).toHaveLength(expected);
    }

    handle.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(6);
  });

  it("never retries after an intentional abort", async () => {
    const { calls, fetchImpl } = mockFetch([sseStream(["data: only\n\n"])]);

    const controller = new AbortController();
    openCursorSse("https://relay.example/events", {
      onEvent: () => {},
      signal: controller.signal,
      fetchImpl,
    });

    await flush();
    expect(calls).toHaveLength(1);
    controller.abort();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(1);
  });

  it("never retries after close()", async () => {
    const { calls, fetchImpl } = mockFetch([sseStream(["data: only\n\n"])]);

    const handle = openCursorSse("https://relay.example/events", {
      onEvent: () => {},
      fetchImpl,
    });

    await flush();
    expect(calls).toHaveLength(1);
    handle.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(1);
  });
});
