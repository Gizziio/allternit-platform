import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MOCK_RESPONSE = `Allternit is a private AI platform that lets you run any AI model — Claude, GPT-4, Gemini, or local models — through a single unified interface.

Here's what makes it different:

**One Brain, Multiple Faces**
The core runtime handles all agent logic, tool execution, and model routing. The platform, desktop app, browser extension, and CLI are all just different "faces" connecting to the same brain.

**Key capabilities:**
- Multi-model support with unified API
- Real streaming with token-level visibility
- Agent creation wizard with full capability configuration
- MCP (Model Context Protocol) server integration
- Workspace for multi-agent collaboration

The streaming you're seeing right now is the SSE pipeline working end-to-end — each token arrives as a \`content_block_delta\` event and renders incrementally in the UI.`;

export async function POST(req: NextRequest) {
  if (process.env.ALLTERNIT_ENABLE_DEV_CHAT_TEST !== "1") {
    return NextResponse.json(
      { error: "chat-test route is disabled" },
      { status: 410 },
    );
  }

  const msgId = `msg-test-${Date.now()}`;
  const words = MOCK_RESPONSE.split(/(\s+)/);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      const send = (obj: unknown) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      // Anthropic-style message_start
      send({ type: "message_start", messageId: msgId });

      // Stream word by word as text events (normalised to content_block_delta by adapter)
      for (const word of words) {
        if (!word) continue;
        await new Promise(r => setTimeout(r, 25 + Math.random() * 35));
        send({ type: "text", text: word });
      }

      // finish event
      send({
        type: "finish",
        modelId: "claude/claude-sonnet-4-6",
        runtimeModelId: "claude-sonnet-4-6",
        finishedAt: Date.now(),
        durationMs: words.length * 30,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Agent-Backend": "dev-chat-test",
    },
  });
}
