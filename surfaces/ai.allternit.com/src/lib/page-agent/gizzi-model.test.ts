import { afterEach, describe, expect, it, vi } from "vitest";
import { runPageAgentTask } from "../../../../../services/page-agent/src/client";

const mockFetch = vi.fn();

describe("page-agent gizzi model binding", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it("sends the Gizzi picker model on session create and message, never an API key", async () => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "sess-1" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({ start() {} }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parts: [{ type: "text", text: "done" }] }),
      });

    await runPageAgentTask({
      goal: "Open settings",
      config: {
        model: "claude-cli/claude-sonnet-4-6",
        apiKey: "sk-should-not-be-sent",
        baseURL: "https://evil.example",
        systemInstruction: "Stay on the tab.",
      },
      callbacks: {},
    });

    const sessionBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sessionBody.defaultModel).toEqual({
      providerID: "claude-cli",
      modelID: "claude-sonnet-4-6",
    });
    expect(sessionBody).not.toHaveProperty("apiKey");

    const messageCall = mockFetch.mock.calls.find(
      ([url]) => String(url).endsWith("/v1/session/sess-1/message"),
    );
    expect(messageCall).toBeDefined();
    const messageBody = JSON.parse((messageCall?.[1] as RequestInit).body as string);
    expect(messageBody.model).toEqual({
      providerID: "claude-cli",
      modelID: "claude-sonnet-4-6",
    });
    expect(messageBody).not.toHaveProperty("apiKey");
  });
});
