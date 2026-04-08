/**
 * v1-replies-handler.ts
 *
 * Canonical handler shared by both:
 *   POST /api/agent-chat       (legacy surface, body uses camelCase)
 *   POST /v1/replies           (canonical surface, body uses snake_case)
 *
 * Normalises both body shapes into the same internal representation
 * and delegates to the same backend routing logic.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import {
  resolveRuntimeBackendForAuthUserId,
  toGatewayAuthorizationHeader,
} from "@/lib/runtime-backend";
import type { ReplyEvent } from '@/types/replies-contract';

export const runtime = "nodejs";
export const maxDuration = 800;

// ---------------------------------------------------------------------------
// Constants (duplicated from route.ts to keep this file self-contained)
// ---------------------------------------------------------------------------

const TERMINAL_SERVER_URL =
  process.env.TERMINAL_SERVER_URL ?? "http://127.0.0.1:4096";

const GATEWAY_BASE_URL =
  process.env.VITE_ALLTERNIT_GATEWAY_URL
    ? process.env.VITE_ALLTERNIT_GATEWAY_URL.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "")
    : null;

function getGizziAuthHeader(): string | undefined {
  const user =
    process.env.GIZZI_USERNAME ?? process.env.NEXT_PUBLIC_GIZZI_USERNAME ?? "gizzi";
  const pass =
    process.env.GIZZI_PASSWORD ?? process.env.NEXT_PUBLIC_GIZZI_PASSWORD;
  if (!pass) return undefined;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

const FULL_MODEL_MAP: Record<string, { providerID: string; modelID: string }> = {
  "kimi/kimi-for-coding": { providerID: "kimi-for-coding", modelID: "k2p5" },
  "kimi/kimi-k2.5": { providerID: "kimi-for-coding", modelID: "k2p5" },
  "kimi/kimi-k2-thinking": { providerID: "kimi-for-coding", modelID: "kimi-k2-thinking" },
};

function parseModelId(modelId: string | undefined): {
  providerID: string;
  modelID: string;
} {
  if (!modelId) return { providerID: "kimi-for-coding", modelID: "k2p5" };
  if (FULL_MODEL_MAP[modelId]) return FULL_MODEL_MAP[modelId];
  const slash = modelId.indexOf("/");
  if (slash > 0)
    return { providerID: modelId.slice(0, slash), modelID: modelId.slice(slash + 1) };
  const raw = modelId.toLowerCase();
  if (raw.startsWith("claude")) return { providerID: "claude-cli", modelID: modelId };
  if (raw.startsWith("gpt") || raw.startsWith("o1") || raw.startsWith("o3"))
    return { providerID: "openai", modelID: modelId };
  if (raw.startsWith("gemini")) return { providerID: "google", modelID: modelId };
  if (raw.startsWith("deepseek")) return { providerID: "deepseek", modelID: modelId };
  if (raw.startsWith("qwen")) return { providerID: "qwen-cli", modelID: modelId };
  return { providerID: "claude-cli", modelID: modelId };
}

// ---------------------------------------------------------------------------
// Body normalisation — accepts both snake_case (/v1/replies) and camelCase (/api/agent-chat)
// ---------------------------------------------------------------------------

interface NormalisedBody {
  chatId: string;
  message: string;
  modelId: string | undefined;
  runtimeModelId: string | undefined;
  gatewayUrl: string | null;
  gatewayToken: string | null;
  /** Original raw body for gateway proxying */
  raw: Record<string, unknown>;
}

function normaliseBody(body: Record<string, unknown>): NormalisedBody | null {
  // Resolve id — snake_case first, camelCase fallback
  const chatId =
    (typeof body.conversation_id === "string" ? body.conversation_id : null) ??
    (typeof body.chatId === "string" ? body.chatId : null);
  if (!chatId) return null;

  // Resolve message — v1 supports a string or the last user entry in a messages array
  let message: string | null =
    typeof body.message === "string" ? body.message : null;
  if (!message && Array.isArray(body.messages)) {
    const last = body.messages.at(-1);
    if (last && typeof (last as Record<string, unknown>).content === "string") {
      message = (last as Record<string, unknown>).content as string;
    }
  }
  if (!message) return null;

  const modelId =
    (typeof body.model === "string" ? body.model : undefined) ??
    (typeof body.modelId === "string" ? body.modelId : undefined);

  const runtimeModelId =
    (typeof body.runtime_model === "string" ? body.runtime_model : undefined) ??
    (typeof body.runtimeModelId === "string" ? body.runtimeModelId : undefined);

  const gatewayUrl =
    (typeof body.gateway_url === "string" ? body.gateway_url.replace(/\/+$/, "") : null) ??
    (typeof body.gatewayUrl === "string" ? body.gatewayUrl.replace(/\/+$/, "") : null);

  const gatewayToken =
    (typeof body.gateway_token === "string" ? body.gateway_token : null) ??
    (typeof body.gatewayToken === "string" ? body.gatewayToken : null);

  return { chatId, message, modelId, runtimeModelId, gatewayUrl, gatewayToken, raw: body };
}

// ---------------------------------------------------------------------------
// Gateway proxy
// ---------------------------------------------------------------------------

async function proxyToGateway(
  targetUrl: string,
  body: unknown,
  token?: string | null,
): Promise<Response | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
    };
    const authorization = toGatewayAuthorizationHeader(token);
    if (authorization) headers["Authorization"] = authorization;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) return res;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gizzi terminal server path (streaming)
// ---------------------------------------------------------------------------

async function routeViaGizzi(
  chatId: string,
  message: string,
  modelId: string | undefined,
  runtimeModelId: string | undefined,
  replyId: string,
  clientSignal?: AbortSignal,
): Promise<Response> {
  const { providerID, modelID } = parseModelId(runtimeModelId ?? modelId);
  const gizziAuth = getGizziAuthHeader();
  const gizziSessionId = chatId;
  const messageUrl = `${TERMINAL_SERVER_URL}/v1/session/${encodeURIComponent(gizziSessionId)}/message`;
  const eventUrl = `${TERMINAL_SERVER_URL}/v1/event`;

  const msgHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (gizziAuth) msgHeaders["Authorization"] = gizziAuth;

  const eventHeaders: Record<string, string> = {
    Accept: "text/event-stream",
    "Cache-Control": "no-cache",
  };
  if (gizziAuth) eventHeaders["Authorization"] = gizziAuth;

  const eventRes = await fetch(eventUrl, {
    method: "GET",
    headers: eventHeaders,
  }).catch(() => null);

  const postSignal = clientSignal
    ? AbortSignal.any([clientSignal, AbortSignal.timeout(120_000)])
    : AbortSignal.timeout(120_000);

  const postPromise = fetch(messageUrl, {
    method: "POST",
    headers: msgHeaders,
    body: JSON.stringify({
      sessionID: gizziSessionId,
      parts: [{ type: "text", text: message }],
      model: { providerID, modelID },
    }),
    signal: postSignal,
  });

  if (!eventRes?.ok || !eventRes.body) {
    const res = await postPromise;
    if (!res.ok) {
      return NextResponse.json(
        { error: `Gizzi session error: ${res.status} ${res.statusText}` },
        { status: res.status },
      );
    }
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Agent-Backend": "gizzi-fallback",
      },
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const eventsReader = eventRes.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      let evtBuffer = "";
      let closed = false;
      let stepTokens: Record<string, unknown> | null = null;
      let stepCost: number | null = null;
      const reasoningPartIds = new Set<string>();
      const openedTextPartIds = new Set<string>();
      const emittedToolCallIds = new Set<string>();
      let currentMessageId: string = replyId;

      const enqueue = (data: object) => {
        if (!closed)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Emit reply.started once with our pre-generated replyId so the client
      // has a stable cancellation handle before the first Gizzi event arrives.
      let replyStarted = false;
      function ensureMessageStart(_msgId?: string): void {
        if (!replyStarted) {
          replyStarted = true;
          enqueue({
            type: "reply.started",
            replyId: currentMessageId,
            runId: `run_${currentMessageId}`,
            conversationId: gizziSessionId,
            ts: Date.now(),
          } satisfies ReplyEvent);
        }
      }

      try {
        while (!closed) {
          const { value, done } = await eventsReader.read();
          if (done) break;
          evtBuffer += decoder.decode(value, { stream: true });

          let nl: number;
          while ((nl = evtBuffer.indexOf("\n")) !== -1) {
            const line = evtBuffer.slice(0, nl).trim();
            evtBuffer = evtBuffer.slice(nl + 1);
            if (!line.startsWith("data:")) continue;

            let evt: Record<string, unknown>;
            try {
              evt = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
            } catch {
              continue;
            }

            const evtType = evt.type as string;

            if (evtType === "message.updated") {
              const msg = evt.message as Record<string, unknown> | undefined;
              const msgId = (msg?.id ?? evt.messageID) as string | undefined;
              if (msgId) ensureMessageStart(msgId);

              const usage = (msg?.usage ?? evt.usage) as Record<string, unknown> | undefined;
              if (usage) {
                stepTokens = {
                  input_tokens: usage.inputTokens ?? usage.input_tokens ?? 0,
                  output_tokens: usage.outputTokens ?? usage.output_tokens ?? 0,
                };
              }
              const cost = (msg?.cost ?? evt.cost) as number | undefined;
              if (typeof cost === "number") stepCost = cost;
            }

            if (evtType === "message.part.updated") {
              const part = evt.part as Record<string, unknown> | undefined;
              const partId = (part?.id ?? evt.partID) as string | undefined;
              const partType = (part?.type ?? evt.partType) as string | undefined;
              const partState = (part?.state ?? evt.state) as
                | Record<string, unknown>
                | undefined;
              const msgId = (evt.messageID ?? evt.sessionID) as string | undefined;

              if (msgId) ensureMessageStart(msgId);

              if (partType === "reasoning" && partId) {
                if (!reasoningPartIds.has(partId)) {
                  reasoningPartIds.add(partId);
                  enqueue({
                    type: "reply.item.added",
                    replyId: currentMessageId,
                    runId: `run_${currentMessageId}`,
                    itemId: partId,
                    kind: "reasoning",
                    ts: Date.now(),
                  } satisfies ReplyEvent);
                }
              }

              if (partType === "tool" && partId) {
                const toolName =
                  (part?.tool as string) ??
                  (partState?.tool as string) ??
                  "tool";
                const toolStatus =
                  (partState?.status as string) ?? "running";
                const toolOutput = partState?.output;

                if (!emittedToolCallIds.has(partId)) {
                  emittedToolCallIds.add(partId);
                  enqueue({
                    type: "reply.item.added",
                    replyId: currentMessageId,
                    runId: `run_${currentMessageId}`,
                    itemId: partId,
                    kind: "tool_call",
                    ts: Date.now(),
                  } satisfies ReplyEvent);
                  enqueue({
                    type: "tool_call.started",
                    replyId: currentMessageId,
                    runId: `run_${currentMessageId}`,
                    itemId: partId,
                    toolCallId: partId,
                    toolName,
                    input: partState?.input ?? {},
                    ts: Date.now(),
                  } satisfies ReplyEvent);
                }

                if (toolStatus === "completed" && toolOutput !== undefined) {
                  enqueue({
                    type: "tool_call.completed",
                    replyId: currentMessageId,
                    runId: `run_${currentMessageId}`,
                    itemId: partId,
                    toolCallId: partId,
                    output: toolOutput,
                    ts: Date.now(),
                  } satisfies ReplyEvent);
                } else if (toolStatus === "error") {
                  enqueue({
                    type: "tool_call.failed",
                    replyId: currentMessageId,
                    runId: `run_${currentMessageId}`,
                    itemId: partId,
                    toolCallId: partId,
                    error: String(partState?.error ?? "Tool failed"),
                    ts: Date.now(),
                  } satisfies ReplyEvent);
                }
              }
            }

            if (evtType === "message.part.delta") {
              const partId = (evt.partID ?? evt.partId) as string | undefined;
              const delta = (evt.delta as Record<string, unknown> | undefined);
              const text = delta?.text as string | undefined;
              if (!partId || !text) continue;

              const msgId = (evt.messageID ?? evt.sessionID) as string | undefined;
              if (msgId) ensureMessageStart(msgId);

              if (reasoningPartIds.has(partId)) {
                enqueue({
                  type: "reply.reasoning.delta",
                  replyId: currentMessageId,
                  runId: `run_${currentMessageId}`,
                  itemId: partId,
                  delta: text,
                  ts: Date.now(),
                } satisfies ReplyEvent);
              } else {
                if (!openedTextPartIds.has(partId)) {
                  openedTextPartIds.add(partId);
                  enqueue({
                    type: "reply.item.added",
                    replyId: currentMessageId,
                    runId: `run_${currentMessageId}`,
                    itemId: partId,
                    kind: "text",
                    ts: Date.now(),
                  } satisfies ReplyEvent);
                }
                enqueue({
                  type: "reply.text.delta",
                  replyId: currentMessageId,
                  runId: `run_${currentMessageId}`,
                  itemId: partId,
                  delta: text,
                  ts: Date.now(),
                } satisfies ReplyEvent);
              }
            }

            if (evtType === "message.completed" || evtType === "step-finish") {
              const msgId = (evt.messageID ?? evt.sessionID) as string | undefined;
              if (msgId) ensureMessageStart(msgId);
              enqueue({
                type: "reply.completed",
                replyId: currentMessageId,
                runId: `run_${currentMessageId}`,
                ts: Date.now(),
                ...(stepTokens ? { usage: stepTokens } : {}),
                ...(typeof stepCost === "number" ? { cost: stepCost } : {}),
              } as ReplyEvent & Record<string, unknown>);
              closed = true;
              break;
            }

            if (evtType === "message.failed" || evtType === "error") {
              const msgId = (evt.messageID ?? evt.sessionID) as string | undefined;
              if (msgId) ensureMessageStart(msgId);
              enqueue({
                type: "reply.failed",
                replyId: currentMessageId,
                runId: `run_${currentMessageId}`,
                error: String(evt.error ?? evt.message ?? "Unknown error"),
                ts: Date.now(),
              } satisfies ReplyEvent);
              closed = true;
              break;
            }
          }
        }
      } catch (err) {
        if (!closed) {
          enqueue({
            type: "reply.failed",
            replyId: currentMessageId,
            runId: `run_${currentMessageId}`,
            error: err instanceof Error ? err.message : "Stream error",
            ts: Date.now(),
          } satisfies ReplyEvent);
        }
      } finally {
        try { eventsReader.cancel(); } catch {}
        closed = true;
        try { controller.close(); } catch {}
      }

      // Ensure postPromise doesn't hang
      postPromise.catch(() => {});
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Agent-Backend": "gizzi-streaming",
    },
  });
}

// ---------------------------------------------------------------------------
// POST handler (exported — used by both /api/agent-chat and /v1/replies)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const norm = normaliseBody(body);
  if (!norm) {
    return NextResponse.json(
      { error: "conversation_id (or chatId) and message are required" },
      { status: 400 },
    );
  }

  const { chatId, message, modelId, runtimeModelId, gatewayUrl, gatewayToken, raw } = norm;

  const authState = await getAuth();
  const resolvedRuntime =
    authState.userId
      ? await resolveRuntimeBackendForAuthUserId(authState.userId)
      : null;

  const resolvedGatewayUrl =
    gatewayUrl ??
    (resolvedRuntime?.mode === "byoc-vps" ? resolvedRuntime.gatewayUrl : null);
  const resolvedGatewayToken =
    gatewayToken ??
    (resolvedRuntime?.mode === "byoc-vps" ? resolvedRuntime.gatewayToken : null);

  // 1. Caller-provided gateway
  if (resolvedGatewayUrl) {
    const res = await proxyToGateway(
      `${resolvedGatewayUrl}/api/agent-chat`,
      raw,
      resolvedGatewayToken,
    );
    if (res) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Agent-Backend": "openclaw-gateway",
        },
      });
    }
  }

  // 2. Environment-configured Allternit gateway
  if (GATEWAY_BASE_URL && GATEWAY_BASE_URL !== resolvedGatewayUrl) {
    const res = await proxyToGateway(
      `${GATEWAY_BASE_URL}/api/agent-chat`,
      raw,
      resolvedGatewayToken,
    );
    if (res) {
      return new Response(res.body, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Agent-Backend": "allternit-gateway",
        },
      });
    }
  }

  // 3. Gizzi terminal server
  const replyId = `reply_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return routeViaGizzi(chatId, message, modelId, runtimeModelId, replyId, req.signal);
}
