import { NextRequest, NextResponse } from "next/server";
import {
  extractArtifactsFromAgentOutput,
  getOwnedRemoteAgentModel,
  invokeAgentTextCompletion,
  requirePlatformUserId,
  streamAgentTextCompletion,
} from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResponsesRequest = {
  model?: string;
  input?: string | Array<
    | {
        type?: "message";
        role?: string;
        content?: string | Array<{
          type?: string;
          text?: string;
          image_url?: string;
          file_id?: string;
          filename?: string;
          output?: string;
        }>;
      }
    | {
        type?: "function_call_output" | "function_call" | "item_reference" | "reasoning";
        call_id?: string;
        name?: string;
        arguments?: string;
        output?: string;
        id?: string;
      }
  >;
  stream?: boolean;
  session_id?: string;
  previous_response_id?: string;
  instructions?: string;
  store?: boolean;
};

function normalizeInput(input: ResponsesRequest["input"]): string {
  if (typeof input === "string") {
    return input.trim();
  }

  if (!Array.isArray(input)) {
    return "";
  }

  return input
    .map((item) => {
      if (item.type === "function_call_output") {
        return item.output ?? "";
      }
      if (item.type === "function_call") {
        return [item.name, item.arguments].filter(Boolean).join("\n");
      }
      if (item.type === "item_reference") {
        return item.id ?? "";
      }
      if ("content" in item && typeof item.content === "string") {
        return item.content;
      }
      if ("content" in item && Array.isArray(item.content)) {
        return item.content
          .map((part: { type?: string; text?: string; image_url?: string; filename?: string; file_id?: string }) => {
            if (part.type === "input_text") {
              return part.text ?? "";
            }
            if (part.type === "input_image") {
              return part.image_url ? `[image] ${part.image_url}` : "";
            }
            if (part.type === "input_file") {
              return [part.filename, part.file_id].filter(Boolean).join(" ");
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
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
    const body = (await request.json().catch(() => ({}))) as ResponsesRequest;

    if (!body.model) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }

    const prompt = normalizeInput(body.input);
    if (!prompt) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const model = await getOwnedRemoteAgentModel(body.model, platformUserId);
    if (!model) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    if (body.stream) {
      const responseId = `resp_${crypto.randomUUID().replace(/-/g, "")}`;
      const streamed = await streamAgentTextCompletion(
        body.model,
        [body.instructions, prompt].filter(Boolean).join("\n\n"),
        platformUserId,
        {
          sessionId: body.session_id,
          conversationId: body.previous_response_id,
          responseId,
        },
      );
      if (!streamed) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }

      const encoder = new TextEncoder();
      const sse = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = streamed.stream.getReader();
          let fullText = "";
          const outputItemId = `msg_${streamed.sessionId}`;

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "response.created",
                response: {
                  id: responseId,
                  object: "response",
                  created_at: Math.floor(Date.now() / 1000),
                  status: "in_progress",
                  model: body.model,
                },
              })}\n\n`,
            ),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "response.in_progress",
                response: {
                  id: responseId,
                  object: "response",
                  created_at: Math.floor(Date.now() / 1000),
                  status: "in_progress",
                  model: body.model,
                },
              })}\n\n`,
            ),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "response.output_item.added",
                output_index: 0,
                item: {
                  id: outputItemId,
                  type: "message",
                  role: "assistant",
                  status: "in_progress",
                  content: [],
                },
              })}\n\n`,
            ),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "response.content_part.added",
                item_id: outputItemId,
                output_index: 0,
                content_index: 0,
                part: {
                  type: "output_text",
                  text: "",
                  annotations: [],
                  logprobs: [],
                },
              })}\n\n`,
            ),
          );

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = new TextDecoder().decode(value);
            fullText += text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "response.output_text.delta",
                  delta: text,
                })}\n\n`,
              ),
            );
          }

          const parsed = extractArtifactsFromAgentOutput(fullText);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "response.output_text.done",
                text: parsed.text || fullText,
              })}\n\n`,
            ),
          );
          if (parsed.artifacts.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "response.output_artifact.added",
                  artifacts: parsed.artifacts,
                })}\n\n`,
              ),
            );
          }

          // Expose HITL metadata so the UI can detect permission/question events
          // even when consuming the stream. Standard clients will ignore this event.
          const { result: hitlResult } = streamed;
          const { hitlEvents, toolCalls } = await hitlResult;
          if (hitlEvents.length > 0 || toolCalls.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "allternit.metadata",
                  hitl_events: hitlEvents,
                  tool_calls: toolCalls,
                })}
\n\n`,
              ),
            );
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "response.output_item.done",
                output_index: 0,
                item: {
                  id: outputItemId,
                  type: "message",
                  role: "assistant",
                  status: "completed",
                  content: [
                    {
                      type: "output_text",
                      text: parsed.text || fullText,
                      annotations: [],
                      logprobs: [],
                    },
                  ],
                },
              })}\n\n`,
            ),
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "response.completed",
                response: {
                  id: responseId,
                  object: "response",
                  created_at: Math.floor(Date.now() / 1000),
                  status: "completed",
                  model: body.model,
                  output: [
                    {
                      id: outputItemId,
                      type: "message",
                      role: "assistant",
                      status: "completed",
                      content: [
                        {
                          type: "output_text",
                          text: parsed.text || fullText,
                          annotations: [],
                          logprobs: [],
                        },
                      ],
                    },
                  ],
                },
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

    const responseId = `resp_${crypto.randomUUID().replace(/-/g, "")}`;
    const result = await invokeAgentTextCompletion(
      body.model,
      [body.instructions, prompt].filter(Boolean).join("\n\n"),
      platformUserId,
      {
        sessionId: body.session_id,
        conversationId: body.previous_response_id,
        responseId,
      },
    );
    if (!result) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const parsed = extractArtifactsFromAgentOutput(result.content);

    return NextResponse.json({
      id: responseId,
      object: "response",
      created_at: Math.floor(Date.now() / 1000),
      status: "completed",
      model: body.model,
      output_text: parsed.text || result.content,
      output: [
        {
          id: result.parentMessageId ?? `msg_${result.sessionId}`,
          type: "message",
          role: "assistant",
          status: "completed",
          content: [
            {
              type: "output_text",
              text: parsed.text || result.content,
              annotations: [],
              logprobs: [],
            },
          ],
        },
      ],
      artifacts: parsed.artifacts,
      allternit: {
        session_id: result.sessionId,
        conversation_id: result.conversationId,
        parent_message_id: result.parentMessageId,
        agent_profile: model.profile,
        artifacts: parsed.artifacts,
        hitl_events: result.hitlEvents ?? [],
        tool_calls: result.toolCalls ?? [],
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error("[agents/v1/responses] Failed to execute agent", error);
    return NextResponse.json(
      { error: "Failed to execute agent response" },
      { status: 500 },
    );
  }
}
