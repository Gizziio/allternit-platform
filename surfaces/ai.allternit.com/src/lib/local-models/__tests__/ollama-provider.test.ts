import { describe, expect, it } from "vitest";
import { OllamaLocalProvider } from "../providers/ollama";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("OllamaLocalProvider", () => {
  it("discovers models and verifies capabilities through /api/show", async () => {
    const calls: string[] = [];
    const provider = new OllamaLocalProvider({
      fetch: async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/api/tags")) {
          return response({ models: [{ name: "gemma:local", size: 42, digest: "sha256:test" }] });
        }
        if (url.endsWith("/api/show")) {
          return response({ capabilities: ["completion", "tools", "vision"] });
        }
        throw new Error(`unexpected request: ${url}`);
      },
    });

    const [model] = await provider.listModels();
    expect(calls).toHaveLength(2);
    expect(model.sizeBytes).toBe(42);
    expect(model.capabilities.verified).toBe(true);
    expect(model.capabilities.tasks).toEqual(expect.arrayContaining(["chat", "tools", "vision"]));
  });

  it("normalizes streamed text, tools, usage, and completion", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":{"content":"hello"}}\n'));
        controller.enqueue(encoder.encode('{"message":{"tool_calls":[{"function":{"name":"lookup","arguments":{"id":7}}}]}}\n'));
        controller.enqueue(encoder.encode('{"done":true,"done_reason":"stop","prompt_eval_count":3,"eval_count":2}\n'));
        controller.close();
      },
    });
    const provider = new OllamaLocalProvider({ fetch: async () => new Response(body) });
    const events = [];
    for await (const event of provider.generate({
      requestId: "request-1",
      model: "gemma:local",
      prompt: "hello",
    })) events.push(event);

    expect(events).toContainEqual({ type: "text-delta", text: "hello" });
    expect(events).toContainEqual({ type: "tool-call", id: "request-1:0", name: "lookup", arguments: { id: 7 } });
    expect(events).toContainEqual({ type: "usage", promptTokens: 3, completionTokens: 2 });
    expect(events).toContainEqual({ type: "done", finishReason: "stop" });
  });
});
