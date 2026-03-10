import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { db } from "@/lib/db/client-sqlite";
import { chat, message, part, kernelSession } from "@/lib/db/schema-sqlite";
import { eq, and } from "drizzle-orm";

const KERNEL_URL = process.env.NEXT_PUBLIC_KERNEL_URL || "http://127.0.0.1:3004";

const MODEL_ID_ALIASES: Record<string, string> = {
  "gemini-1-5-pro": "gemini-1.5-pro",
  "gemini-1-5-flash": "gemini-1.5-flash",
};

const API_MODEL_TARGETS: Record<string, string> = {
  "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku": "claude-3-5-haiku-20241022",
  "claude-3-opus": "claude-3-opus-20240229",
  "deepseek-r1": "deepseek-reasoner",
};

const API_PROVIDER_ENV: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  mistral: "MISTRAL_API_KEY",
  moonshot: "MOONSHOT_API_KEY",
};

function normalizeModelId(rawModelId: string): string {
  const trimmed = rawModelId.trim();
  return MODEL_ID_ALIASES[trimmed] || trimmed;
}

function inferProvider(modelId: string): string {
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1")) return "openai";
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gemini-")) return "google";
  if (modelId.startsWith("deepseek-")) return "deepseek";
  if (modelId.startsWith("ollama-")) return "ollama";
  return "openai";
}

// Kernel configuration builder
function buildKernelConfig(modelId: string) {
  if (modelId === "claude-code") {
    return {
      id: "claude-code",
      name: "Claude Code CLI",
      brain_type: "cli",
      model: "claude-3-5-sonnet",
      api_key_env: null,
      command: "claude",
      args: ["--output-format", "stream-json"],
      requirements: [{ kind: "binary", name: "claude" }],
    };
  }

  if (modelId === "gemini-cli") {
    return {
      id: "gemini-cli",
      name: "Gemini CLI",
      brain_type: "cli",
      model: "gemini-2.0-flash",
      api_key_env: null,
      command: "gemini",
      args: ["--output-format", "stream-json", "--yolo"],
      requirements: [{ kind: "binary", name: "gemini" }],
    };
  }

  if (modelId === "kimi-cli") {
    return {
      id: "kimi-cli",
      name: "Kimi CLI",
      brain_type: "cli",
      model: "kimi-k2",
      api_key_env: null,
      command: "kimi",
      args: ["--yolo"],
      requirements: [{ kind: "binary", name: "kimi" }],
    };
  }

  if (modelId === "codex") {
    return {
      id: "codex",
      name: "Codex CLI",
      brain_type: "cli",
      model: "codex",
      api_key_env: null,
      command: "codex",
      args: ["exec", "--yolo", "-"],
      requirements: [{ kind: "binary", name: "codex" }],
    };
  }

  if (modelId.startsWith("ollama-")) {
    const localModel = modelId.replace(/^ollama-/, "");
    return {
      id: modelId,
      name: `Ollama ${localModel}`,
      brain_type: "local",
      model: localModel,
      endpoint: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
      requirements: [{ kind: "dependency", name: "ollama", package_manager: "brew" }],
    };
  }

  const provider = inferProvider(modelId);
  const resolvedModel = API_MODEL_TARGETS[modelId] || modelId;
  const apiKeyEnv = API_PROVIDER_ENV[provider];

  return {
    id: modelId,
    name: `${provider} ${resolvedModel}`,
    brain_type: "api",
    model: resolvedModel,
    api_key_env: apiKeyEnv || null,
    requirements: apiKeyEnv
      ? [{ kind: "env_var", name: apiKeyEnv }]
      : [],
  };
}

type PlanStepStatus = "pending" | "in-progress" | "complete" | "error";

type StreamPlanStep = {
  id: string;
  description: string;
  status: PlanStepStatus;
};

type SearchSourceCandidate = {
  title: string;
  url: string;
  text: string;
};

function emitSse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  payload: Record<string, unknown>
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
}

function parseStructuredValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;

  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      console.error("[Chat] Failed to parse structured value:", error, "Value:", trimmed);
      return value;
    }
  }

  return value;
}

function humanizeToolLabel(toolId: string): string {
  return toolId
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeToolInput(input: unknown): string | undefined {
  const parsed = parseStructuredValue(input);

  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    return trimmed ? trimmed.slice(0, 120) : undefined;
  }

  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  for (const key of ["query", "url", "path", "goal", "task", "prompt", "question"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().slice(0, 120);
    }
  }

  return undefined;
}

function inferSourceTitle(url: string, fallback?: string): string {
  if (fallback && fallback.trim()) return fallback.trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (error) {
    console.error("[Chat] Failed to infer source title from URL:", error, "URL:", url);
    return url;
  }
}

function extractSearchSources(result: unknown): SearchSourceCandidate[] {
  const seen = new Set<string>();
  const sources: SearchSourceCandidate[] = [];

  const visit = (value: unknown) => {
    const parsed = parseStructuredValue(value);

    if (Array.isArray(parsed)) {
      parsed.forEach(visit);
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      return;
    }

    const record = parsed as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const textCandidate = [
      record.content,
      record.snippet,
      record.extracted_content,
      record.description,
      record.text,
    ].find((candidate) => typeof candidate === "string" && candidate.trim()) as string | undefined;

    if (url && !seen.has(url) && (title || textCandidate)) {
      seen.add(url);
      sources.push({
        title: inferSourceTitle(url, title),
        url,
        text: (textCandidate ?? title).trim().slice(0, 220),
      });
    }

    for (const nestedKey of ["results", "items", "sources", "documents", "citations"]) {
      if (Array.isArray(record[nestedKey])) {
        visit(record[nestedKey]);
      }
    }
  };

  visit(result);
  return sources;
}

function extractToolSources(input: unknown, result: unknown): SearchSourceCandidate[] {
  const extracted = extractSearchSources(result);
  if (extracted.length > 0) return extracted;

  const parsedInput = parseStructuredValue(input);
  if (!parsedInput || typeof parsedInput !== "object") {
    return extracted;
  }

  const inputRecord = parsedInput as Record<string, unknown>;
  const url = typeof inputRecord.url === "string" ? inputRecord.url.trim() : "";
  if (!url) {
    return extracted;
  }

  const parsedResult = parseStructuredValue(result);
  const resultRecord =
    parsedResult && typeof parsedResult === "object" && !Array.isArray(parsedResult)
      ? parsedResult as Record<string, unknown>
      : null;

  const textResult = typeof parsedResult === "string" ? parsedResult.trim() : "";
  const headingTitle = textResult.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const recordTitle = resultRecord && typeof resultRecord.title === "string" ? resultRecord.title.trim() : "";
  const inputTitle = typeof inputRecord.title === "string" ? inputRecord.title.trim() : "";
  const textCandidate = textResult || ([
    resultRecord?.content,
    resultRecord?.text,
    resultRecord?.snippet,
    resultRecord?.summary,
    resultRecord?.description,
    resultRecord?.output,
  ].find((candidate) => typeof candidate === "string" && candidate.trim()) as string | undefined)?.trim();

  return [{
    title: inferSourceTitle(url, recordTitle || headingTitle || inputTitle),
    url,
    text: (textCandidate ?? recordTitle ?? headingTitle ?? inputTitle ?? url).trim().slice(0, 220),
  }];
}

function resultHasError(result: unknown): boolean {
  const parsed = parseStructuredValue(result);
  if (!parsed || typeof parsed !== "object") return false;

  const record = parsed as Record<string, unknown>;
  if (record.success === false) return true;
  return typeof record.error === "string" && record.error.trim().length > 0;
}

function isCliKernelModel(modelId: string): boolean {
  return modelId === "codex" || modelId === "gemini-cli" || modelId === "kimi-cli" || modelId === "claude-code";
}

function toConversationAnnotations(body: Record<string, unknown>): string {
  const conversationMode = body.conversationMode === "agent" ? "agent" : "llm";
  const agentId = typeof body.agentId === "string" ? body.agentId : null;
  const agentName = typeof body.agentName === "string" ? body.agentName : null;
  const agentProvider = typeof body.agentProvider === "string" ? body.agentProvider : null;
  const agentModel = typeof body.agentModel === "string" ? body.agentModel : null;
  const agentFallbackModels = Array.isArray(body.agentFallbackModels)
    ? body.agentFallbackModels.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return JSON.stringify({
    conversationMode,
    agent: conversationMode === "agent"
      ? {
          id: agentId,
          name: agentName,
          provider: agentProvider,
          model: agentModel,
          fallbackModels: agentFallbackModels,
        }
      : undefined,
  });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    // Allow anonymous sessions in dev - use a system anonymous user ID
    const userId = session?.user?.id || "00000000-0000-0000-0000-000000000000";

    const body = await req.json() as Record<string, unknown>;
    const requestedModelId = typeof body.modelId === "string" ? body.modelId : "codex";
    const modelId = normalizeModelId(requestedModelId);
    const chatId = typeof body.chatId === "string" ? body.chatId : "";
    const userMessage = typeof body.message === "string" ? body.message : "";
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const messageAnnotations = toConversationAnnotations(body);

    if (!chatId || !userMessage) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get or create chat
    let chatRecord = await db.query.chat.findFirst({
      where: eq(chat.id, chatId),
    });

    if (!chatRecord) {
      // Create new chat
      const [newChat] = await db.insert(chat).values({
        id: chatId,
        title: userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : ""),
        userId,
      }).returning();
      chatRecord = newChat;
    }

    // Get or create kernel session
    const isCliModel = isCliKernelModel(modelId);
    let kernelSessionId = isCliModel ? null : chatRecord.kernelSessionId;
    if (!kernelSessionId) {
      const config = buildKernelConfig(modelId);
      const sessionRes = await fetch(`${KERNEL_URL}/v1/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, profile_id: modelId }),
      });

      if (!sessionRes.ok) {
        const errorText = await sessionRes.text();
        return NextResponse.json(
          { error: `Failed to create kernel session: ${errorText}` },
          { status: 500 }
        );
      }

      const sessionData = await sessionRes.json() as { id: string };
      kernelSessionId = sessionData.id;

      if (!kernelSessionId) {
        return NextResponse.json(
          { error: "Failed to create kernel session: no session ID returned" },
          { status: 500 }
        );
      }

      // Save reusable sessions only for non-CLI models.
      if (!isCliModel) {
        await db.insert(kernelSession).values({
          id: kernelSessionId,
          userId,
          chatId: chatId,
          config: JSON.stringify(config),
          status: "active",
        });

        // Update chat with session ID
        await db.update(chat).set({ kernelSessionId }).where(eq(chat.id, chatId));
      }
    }

    // Create user message in DB
    const [userMsgRecord] = await db
      .insert(message)
      .values({
        chatId,
        role: "user",
        content: userMessage,
        attachments: JSON.stringify(attachments),
        annotations: messageAnnotations,
        selectedModel: modelId,
      })
      .returning();

    // Start streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (!isCliModel) {
            await fetch(`${KERNEL_URL}/v1/sessions/${kernelSessionId}/input`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(userMessage + "\n"),
            });
          }

          // Connect to kernel event stream
          const eventSource = new EventSource(
            `${KERNEL_URL}/v1/sessions/${kernelSessionId}/events`
          );

          let assistantMessageId: string | null = null;
          let messageBuffer = "";
          let partOrder = 0;
          const streamStartedAt = Date.now();
          const planId = `plan-${chatId}`;
          const planSteps: StreamPlanStep[] = [];
          const toolInputsByCallId = new Map<string, unknown>();
          const toolLabelsByCallId = new Map<string, string>();
          const toolDescriptionsByCallId = new Map<string, string>();
          const sourceIdsByUrl = new Map<string, string>();
          let planStarted = false;
          let checkpointCount = 0;

          const emitPlan = (eventType: "plan" | "plan_update") => {
            emitSse(controller, encoder, {
              type: eventType,
              planId,
              title: "Live execution plan",
              steps: planSteps.map((step) => ({ ...step })),
            });
          };

          const upsertPlanStep = (id: string, description: string, status: PlanStepStatus) => {
            const existingIndex = planSteps.findIndex((step) => step.id === id);
            const nextStep = { id, description, status };

            if (existingIndex >= 0) {
              planSteps[existingIndex] = nextStep;
            } else {
              planSteps.push(nextStep);
            }
          };

          eventSource.onmessage = async (event) => {
            try {
              const data = JSON.parse(event.data);

              switch (data.type) {
                case "chat.delta":
                  if (!assistantMessageId) {
                    const [assistantMsg] = await db
                      .insert(message)
                      .values({
                        chatId,
                        role: "assistant",
                        content: "",
                        parentMessageId: userMsgRecord.id,
                        annotations: messageAnnotations,
                        selectedModel: modelId,
                        kernelRunId: kernelSessionId,
                      })
                      .returning();
                    assistantMessageId = assistantMsg.id;

                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: "message_start",
                          messageId: assistantMessageId,
                        })}\n\n`
                      )
                    );
                  }

                  const deltaText = data.text || '';
                  messageBuffer += deltaText;

                  emitSse(controller, encoder, {
                    type: "content_block_delta",
                    delta: {
                      type: "text_delta",
                      text: deltaText,
                    },
                  });
                  break;

                case "tool.call":
                  {
                    const toolArgs = parseStructuredValue(data.args);
                    const toolLabel = humanizeToolLabel(data.tool_id);
                    const toolDescription = summarizeToolInput(toolArgs);
                    const stepDescription = toolDescription ? `${toolLabel}: ${toolDescription}` : toolLabel;

                    toolLabelsByCallId.set(data.call_id, toolLabel);
                    toolInputsByCallId.set(data.call_id, toolArgs);
                    if (toolDescription) {
                      toolDescriptionsByCallId.set(data.call_id, toolDescription);
                    }

                    upsertPlanStep(data.call_id, stepDescription, "in-progress");
                    emitPlan(planStarted ? "plan_update" : "plan");
                    planStarted = true;

                    emitSse(controller, encoder, {
                      type: "task",
                      taskId: data.call_id,
                      title: toolLabel,
                      description: toolDescription,
                      status: "running",
                      progress: 35,
                    });

                    emitSse(controller, encoder, {
                      type: "content_block_start",
                      content_block: {
                        type: "tool_use",
                        id: data.call_id,
                        name: data.tool_id,
                        input: toolArgs,
                      },
                    });
                  }
                  break;

                case "tool.result":
                  {
                    const parsedResult = parseStructuredValue(data.result);
                    const toolLabel = toolLabelsByCallId.get(data.call_id) ?? humanizeToolLabel(data.tool_id || "tool");
                    const toolDescription = toolDescriptionsByCallId.get(data.call_id);
                    const stepDescription = toolDescription ? `${toolLabel}: ${toolDescription}` : toolLabel;
                    const failed = resultHasError(parsedResult);
                    const sources = extractToolSources(toolInputsByCallId.get(data.call_id), parsedResult);

                    emitSse(controller, encoder, {
                      type: "tool_result",
                      toolCallId: data.call_id,
                      result: parsedResult,
                    });

                    upsertPlanStep(data.call_id, stepDescription, failed ? "error" : "complete");
                    emitPlan("plan_update");

                    emitSse(controller, encoder, {
                      type: "task",
                      taskId: data.call_id,
                      title: toolLabel,
                      description: toolDescription,
                      status: failed ? "error" : "complete",
                      progress: 100,
                    });

                    for (const [index, source] of sources.entries()) {
                      let sourceId = sourceIdsByUrl.get(source.url);
                      if (!sourceId) {
                        sourceId = `src-${data.call_id}-${index + 1}`;
                        sourceIdsByUrl.set(source.url, sourceId);
                        emitSse(controller, encoder, {
                          type: "source",
                          sourceId,
                          title: source.title,
                          url: source.url,
                        });
                      }

                      emitSse(controller, encoder, {
                        type: "citation",
                        citationId: `citation-${data.call_id}-${index + 1}`,
                        sourceId,
                        text: source.text,
                        startIndex: 0,
                        endIndex: source.text.length,
                      });
                    }

                    checkpointCount += 1;
                    emitSse(controller, encoder, {
                      type: "checkpoint",
                      checkpointId: `checkpoint-${checkpointCount}`,
                      description: failed
                        ? `${toolLabel} reported an error`
                        : sources.length > 0
                          ? `${toolLabel} returned ${sources.length} source${sources.length === 1 ? "" : "s"}`
                          : `${toolLabel} completed`,
                    });
                  }
                  break;

                case "artifact.created":
                  emitSse(controller, encoder, {
                    type: "artifact",
                    artifactId: data.id,
                    kind: data.kind,
                    content: data.content,
                  });
                  break;

                case "chat.message.completed":
                case "session.status":
                  if (data.status === "exited" || data.status === "terminated" || data.type === "chat.message.completed") {
                    if (assistantMessageId && messageBuffer) {
                      await db
                        .update(message)
                        .set({ content: messageBuffer })
                        .where(eq(message.id, assistantMessageId));

                      await db.insert(part).values({
                        messageId: assistantMessageId,
                        type: "text",
                        text_text: messageBuffer,
                        order: partOrder++,
                      });
                    }

                    emitSse(controller, encoder, {
                      type: "finish",
                      messageId: assistantMessageId,
                      modelId,
                      durationMs: Date.now() - streamStartedAt,
                      finishedAt: Date.now(),
                    });
                    controller.close();
                    eventSource.close();
                  }
                  break;

                case "error":
                  emitSse(controller, encoder, {
                    type: "error",
                    error: data.message,
                  });
                  controller.close();
                  eventSource.close();
                  break;
              }
            } catch (err) {
              console.error("Error processing kernel event:", err);
            }
          };

          eventSource.onerror = () => {
            emitSse(controller, encoder, { type: "error", error: "Stream error" });
            controller.close();
            eventSource.close();
          };
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Get chat messages
export async function GET(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";

    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json(
        { error: "Missing chatId parameter" },
        { status: 400 }
      );
    }

    // Get messages
    const messages = await db.query.message.findMany({
      where: eq(message.chatId, chatId),
      orderBy: (message, { asc }) => [asc(message.createdAt)],
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Get chat messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
