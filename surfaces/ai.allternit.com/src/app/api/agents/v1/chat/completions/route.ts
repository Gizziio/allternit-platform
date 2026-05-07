import { NextRequest, NextResponse } from "next/server";
import {
  extractArtifactsFromAgentOutput,
  getOwnedRemoteAgentModel,
  invokeAgentTextCompletion,
  requirePlatformUserId,
  streamAgentTextCompletion,
} from "../../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatCompletionRequest = {
  model?: string;
  messages?: Array<{
    role?: string;
    content?: string | Array<{
      type?: string;
      text?: string;
      image_url?: {
        url?: string;
      };
    }> | null;
  }>;
  stream?: boolean;
  session_id?: string;
  conversation_id?: string;
  parent_message_id?: string;
};

function extractPrompt(messages: ChatCompletionRequest["messages"]): string {
  if (!Array.isArray(messages)) {
    return "";
  }

  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return "";
  }

  if (typeof lastUserMessage.content === "string") {
    return lastUserMessage.content.trim();
  }

  if (!Array.isArray(lastUserMessage.content)) {
    return "";
  }

  return lastUserMessage.content
    .map((part) => {
      if (part.type === "text") {
        return part.text ?? "";
      }
      if (part.type === "image_url") {
        return part.image_url?.url ? `[image] ${part.image_url.url}` : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const platformUserId = await requirePlatformUserId();
    const body = (await request.json().catch(() => ({}))) as ChatCompletionRequest;

    if (!body.model) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }

    const prompt = extractPrompt(body.messages);
    if (!prompt) {
      return NextResponse.json(
        { error: "At least one user message with content is required" },
        { status: 400 },
      );
    }

    const model = await getOwnedRemoteAgentModel(body.model, platformUserId);
    if (!model) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (body.stream) {
      const streamed = await streamAgentTextCompletion(
        body.model,
        prompt,
        platformUserId,
        {
          sessionId: body.session_id,
          conversationId: body.conversation_id,
          parentMessageId: body.parent_message_id,
        },
      );
      if (!streamed) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }

      const encoder = new TextEncoder();
      const sse = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = streamed.stream.getReader();
          let index = 0;
          let fullText = "";

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                id: `chatcmpl_${streamed.sessionId}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: body.model,
                choices: [
                  {
                    index,
                    delta: { role: "assistant", content: "" },
                    finish_reason: null,
                  },
                ],
              })}\n\n`,
            ),
          );

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const content = new TextDecoder().decode(value);
            fullText += content;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: `chatcmpl_${streamed.sessionId}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: body.model,
                  choices: [
                    {
                      index,
                      delta: { content },
                      finish_reason: null,
                    },
                  ],
                })}\n\n`,
              ),
            );
            index += 1;
          }

          const trailingArtifacts = extractArtifactsFromAgentOutput(fullText);
          if (trailingArtifacts.artifacts.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  object: "allternit.artifacts",
                  artifacts: trailingArtifacts.artifacts,
                })}\n\n`,
              ),
            );
          }

          // Expose HITL metadata so the UI can detect permission/question events
          // even when consuming the stream. Standard clients will ignore this event.
          const { result: hitlResult } = streamed;
          const { hitlEvents, toolCalls, pendingHitl } = await hitlResult;
          if (hitlEvents.length > 0 || toolCalls.length > 0 || pendingHitl) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  object: "allternit.metadata",
                  hitl_events: hitlEvents,
                  tool_calls: toolCalls,
                  pending_hitl: pendingHitl,
                })}
\n\n`,
              ),
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                id: `chatcmpl_${streamed.sessionId}`,
                object: "chat.completion.chunk",
                created: Math.floor(Date.now() / 1000),
                model: body.model,
                choices: [{ index, delta: {}, finish_reason: "stop" }],
              })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(sse, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const resolved = await invokeAgentTextCompletion(
        body.model,
        prompt,
        platformUserId,
        {
          sessionId: body.session_id,
          conversationId: body.conversation_id,
          parentMessageId: body.parent_message_id,
        },
      );
    if (!resolved) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const parsed = extractArtifactsFromAgentOutput(resolved.content);

    return NextResponse.json({
      id: `chatcmpl_${resolved.sessionId}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: body.model,
      choices: [
        {
          index: 0,
          finish_reason: "stop",
          message: {
            role: "assistant",
            content: parsed.text || resolved.content,
          },
        },
      ],
      allternit: {
        session_id: resolved.sessionId,
        conversation_id: resolved.conversationId,
        parent_message_id: resolved.parentMessageId,
        agent_profile: model.profile,
        artifacts: parsed.artifacts,
        hitl_events: resolved.hitlEvents ?? [],
        tool_calls: resolved.toolCalls ?? [],
        pending_hitl: resolved.pendingHitl,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[agents/v1/chat/completions] Failed to execute agent", error);
    return NextResponse.json(
      { error: "Failed to execute agent chat completion" },
      { status: 500 },
    );
  }
}
