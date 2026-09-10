import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const envMocks = vi.hoisted(() => ({
  isAgentSessionsApiEnabled: vi.fn(() => true),
  isDesktopOperatorShell: vi.fn(() => false),
  getCloudApiBaseUrl: vi.fn(() => "https://api.example.test"),
}));

vi.mock("@/lib/agents/api-config", () => ({
  buildAuthHeaders: async () => ({ Authorization: "Bearer test" }),
}));
vi.mock("@/lib/runtime-target", () => ({
  getActiveRuntimeId: () => undefined,
  getRuntimeExecutionTarget: () => "local",
}));
vi.mock("@/lib/env", () => ({
  isAgentSessionsApiEnabled: () => envMocks.isAgentSessionsApiEnabled(),
  isDesktopOperatorShell: () => envMocks.isDesktopOperatorShell(),
  getCloudApiBaseUrl: () => envMocks.getCloudApiBaseUrl(),
}));

import { nativeSessionsApi } from "./native-sessions-api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("nativeSessionsApi control-plane routing", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    envMocks.isAgentSessionsApiEnabled.mockReturnValue(true);
    envMocks.isDesktopOperatorShell.mockReturnValue(false);
    envMocks.getCloudApiBaseUrl.mockReturnValue("https://api.example.test");
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

  it("lists against cloud-api when the agent-sessions flag is on", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ sessions: [] }));
    await nativeSessionsApi.list({ harness: "kimi" });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "https://api.example.test/api/v1/native-sessions?harness=kimi",
    );
  });

  it("fails closed on web when the agent-sessions flag is off", async () => {
    envMocks.isAgentSessionsApiEnabled.mockReturnValue(false);
    await expect(nativeSessionsApi.list()).rejects.toThrow(/disabled in this deployment/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps pickup surface bot to chat before hitting the node", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ session: { id: "ses_1" }, source: { harness: "kimi", sessionId: "abc" }, warnings: [], eventCount: 0 }),
    );
    await nativeSessionsApi.pickup({ harness: "kimi", sessionId: "abc", surface: "bot" });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://api.example.test/api/v1/native-sessions/pickup");
    expect(JSON.parse(String(init.body))).toMatchObject({
      harness: "kimi",
      sessionId: "abc",
      surface: "chat",
    });
  });

  it("routes export-native through the agent-sessions control-plane base", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ harness: "kimi", sessionId: "n1", path: "/tmp", resumeHint: "kimi", at: 1 }),
    );
    await nativeSessionsApi.exportNative("ses_1", "kimi");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "https://api.example.test/api/v1/agent-sessions/ses_1/export-native",
    );
  });
});
