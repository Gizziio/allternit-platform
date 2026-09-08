import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the auth/runtime modules authFetch depends on so no network or
// window state is needed.
vi.mock("@/lib/agents/api-config", () => ({
  buildAuthHeaders: async () => ({}),
}));
vi.mock("@/lib/runtime-target", () => ({
  getActiveRuntimeId: () => undefined,
  getRuntimeExecutionTarget: () => "local",
}));

import { nativeSessionsApi } from "./native-sessions-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("nativeSessionsApi stale-backend guard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws an actionable error when the backend serves the SPA HTML fallback", async () => {
    vi.mocked(fetch).mockImplementation(
      async () =>
        new Response("<!doctype html><html><head><title>Allternit Platform</title></head></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    );
    await expect(nativeSessionsApi.list()).rejects.toThrow(/update allternit desktop/i);
    await expect(nativeSessionsApi.listHarnesses()).rejects.toThrow(/native sessions aren't supported by this backend/i);
  });

  it("throws an actionable error on truncated/invalid JSON bodies", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('{"sessions": [', { status: 200, headers: { "content-type": "application/json" } }),
    );
    await expect(nativeSessionsApi.list()).rejects.toThrow(/expected json/i);
  });

  it("parses a healthy catalog response", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ sessions: [{ harness: "claude", sessionId: "abc" }] }));
    const sessions = await nativeSessionsApi.list();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].harness).toBe("claude");
  });

  it("passes through HTTP error statuses unchanged", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("boom", { status: 502 }));
    await expect(nativeSessionsApi.list()).rejects.toThrow(/native catalog failed: 502/);
  });
});
