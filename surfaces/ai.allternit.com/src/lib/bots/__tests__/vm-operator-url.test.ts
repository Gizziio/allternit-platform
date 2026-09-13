import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBotDesktopStatus,
  handBackBotDesktop,
  observeBotDesktop,
  startBotDesktop,
  stopBotDesktop,
  takeOverBotDesktop,
} from "../vm-operator";

const BOT = "bot-1";
const SANDBOX = "sandbox-9";

function mockFetchOnce() {
  const calls: Array<{ url: string; method: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? "GET",
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }));
  return calls;
}

describe("bot desktop action URLs", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["observe", observeBotDesktop, "observe"],
    ["take over", takeOverBotDesktop, "take-over"],
    ["hand back", handBackBotDesktop, "hand-back"],
    ["start", startBotDesktop, "start"],
    ["stop", stopBotDesktop, "stop"],
  ] as const)("%s posts to the action path, not after the query string", async (_label, fn, action) => {
    const calls = mockFetchOnce();
    await fn(BOT, SANDBOX);
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe(`/api/v1/bots/${BOT}/desktop/${action}`);
    expect(url.searchParams.get("sandbox_id")).toBe(SANDBOX);
    expect(calls[0].method).toBe("POST");
  });

  it("status GET keeps the bare desktop path with the sandbox query", async () => {
    const calls = mockFetchOnce();
    await getBotDesktopStatus(BOT, SANDBOX);
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe(`/api/v1/bots/${BOT}/desktop`);
    expect(url.searchParams.get("sandbox_id")).toBe(SANDBOX);
    expect(calls[0].method).toBe("GET");
  });
});
