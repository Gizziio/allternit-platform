import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  getCloudApiBaseUrl: () => "https://api.example.test",
}));
vi.mock("@/lib/agents/api-config", () => ({
  buildAuthHeaders: async () => ({ Authorization: "Bearer test-token" }),
}));
vi.mock("@/lib/fabric-session-pwa", () => ({
  isFabricSessionPwaHost: () => false,
}));

import { CloudApiEventSource } from "./cloud-api";

function sseResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("CloudApiEventSource Last-Event-ID", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Last-Event-ID on connect and records id: from the stream", async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse('id: 42\ndata: {"type":"created","id":"ses_1"}\n\n'),
    );

    const source = new CloudApiEventSource("/api/v1/agent-sessions/sync", {
      lastEventId: "17",
    });
    const message = await new Promise<MessageEvent>((resolve, reject) => {
      source.onmessage = (event) => resolve(event);
      source.onerror = () => reject(new Error("stream error"));
    });
    source.close();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get("Last-Event-ID")).toBe("17");
    expect(headers.get("Authorization")).toBe("Bearer test-token");
    expect(message.lastEventId).toBe("42");
    expect(source.lastEventId).toBe("42");
    expect(JSON.parse(message.data as string)).toMatchObject({ type: "created", id: "ses_1" });
  });

  it("omits Last-Event-ID when no cursor is known", async () => {
    vi.mocked(fetch).mockResolvedValue(sseResponse("data: {\"type\":\"created\"}\n\n"));
    const source = new CloudApiEventSource("/api/v1/agent-sessions/sync");
    await new Promise<MessageEvent>((resolve) => {
      source.onmessage = (event) => resolve(event);
    });
    source.close();
    const headers = new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers);
    expect(headers.get("Last-Event-ID")).toBeNull();
  });
});
