/**
 * /api/agent-chat — Agent chat proxy route
 *
 * Routes agent-mode chat requests from the web client to the correct backend:
 *   1. OpenClaw gateway (if gatewayUrl is present in the request)
 *   2. Allternit gateway at the configured GATEWAY_BASE_URL
 *   3. Gizzi terminal server (fallback, port 4096) — converts to gizzi session format
 *
 * The client (rust-stream-adapter) sends a relative URL so this Next.js route
 * must exist to proxy through to the actual running service.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import { prisma } from "@/lib/db";
import fs from "fs";
import path from "path";
import os from "os";

// Serverless Function timeout - max 300s for hobby plan
export const maxDuration = 300;
import {
  resolveRuntimeBackendForAuthUserId,
  toGatewayAuthorizationHeader,
} from "@/lib/runtime-backend";

const TERMINAL_SERVER_URL =
  process.env.TERMINAL_SERVER_URL ?? "http://127.0.0.1:4096";

// In-process warm cache: avoids a DB round-trip when the same session fires
// multiple messages in the same server lifetime.
const gizziSessionCache = new Map<string, string>();

async function getGizziSessionId(chatId: string): Promise<string | null> {
  const cached = gizziSessionCache.get(chatId);
  if (cached) return cached;
  try {
    const row = await prisma.conversation.findUnique({
      where: { id: chatId },
      select: { gizziSessionId: true },
    });
    if (row?.gizziSessionId) {
      gizziSessionCache.set(chatId, row.gizziSessionId);
      return row.gizziSessionId;
    }
  } catch { /* DB unavailable — fall through */ }
  return null;
}

async function saveGizziSessionId(chatId: string, gizziSessionId: string): Promise<void> {
  gizziSessionCache.set(chatId, gizziSessionId);
  try {
    await prisma.conversation.upsert({
      where: { id: chatId },
      update: { gizziSessionId },
      create: { id: chatId, gizziSessionId },
    });
  } catch { /* DB unavailable — mapping survives in warm cache only */ }
}

function readDevSessionPassword(): string | undefined {
  try {
    const raw = fs.readFileSync(
      path.join(os.homedir(), ".allternit", "gizzi-dev-session.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as { gizziPassword?: string; writtenAt?: number };
    if (parsed.writtenAt && Date.now() - parsed.writtenAt > 86_400_000) return undefined;
    return parsed.gizziPassword || undefined;
  } catch {
    return undefined;
  }
}

function getGizziAuthHeader(): string | undefined {
  const user = process.env.GIZZI_USERNAME ?? process.env.NEXT_PUBLIC_GIZZI_USERNAME ?? "gizzi";
  const pass =
    process.env.GIZZI_PASSWORD ??
    process.env.NEXT_PUBLIC_GIZZI_PASSWORD ??
    readDevSessionPassword();
  if (!pass) return undefined;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

// Only use the Allternit gateway when explicitly configured via env var.
// Defaulting to a local port caused silent message swallowing when anything
// else (e.g., a stale dev process) was listening there.
const GATEWAY_BASE_URL =
  process.env.VITE_ALLTERNIT_GATEWAY_URL
    ? process.env.VITE_ALLTERNIT_GATEWAY_URL.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "")
    : null;

function shouldPreferLocalDesktopRuntime(): boolean {
  return (
    process.env.ALLTERNIT_DESKTOP_AUTH_ENABLED === "1" ||
    process.env.NEXT_PUBLIC_ALLTERNIT_DESKTOP_AUTH === "1"
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Maps frontend model slugs to gizzi internal { providerID, modelID }
const FULL_MODEL_MAP: Record<string, { providerID: string; modelID: string }> = {
  "kimi/kimi-for-coding":   { providerID: "kimi-for-coding", modelID: "kimi-k2" },
  "kimi/kimi-k2":           { providerID: "kimi-for-coding", modelID: "kimi-k2" },
  "kimi/kimi-k2.5":         { providerID: "kimi-for-coding", modelID: "kimi-k2" },
  "kimi/kimi-k2-thinking":  { providerID: "kimi-for-coding", modelID: "kimi-k2-thinking" },
};

function parseModelId(modelId: string | undefined): {
  providerID: string;
  modelID: string;
} {
  // Default: use claude-cli (local Claude Code CLI — no API key needed)
  if (!modelId) return { providerID: "claude-cli", modelID: "claude-sonnet-4-6" };

  // Exact match in known map
  if (FULL_MODEL_MAP[modelId]) return FULL_MODEL_MAP[modelId];

  // Onboarding format: "providerID::modelID"
  const colons = modelId.indexOf("::");
  if (colons > 0) {
    const providerID = modelId.slice(0, colons);
    const rawModel = modelId.slice(colons + 2);
    // claude-cli only has claude-sonnet-4-6
    const modelID = providerID === "claude-cli" ? "claude-sonnet-4-6" : rawModel;
    return { providerID, modelID };
  }

  // Standard format: "providerID/modelID"
  const slash = modelId.indexOf("/");
  if (slash > 0) {
    const rawProvider = modelId.slice(0, slash).toLowerCase();
    const modelPart = modelId.slice(slash + 1);
    // Normalize provider aliases to gizzi internal IDs
    // claude-cli only has claude-sonnet-4-6; always normalize to that model
    const providerID =
      rawProvider === "claude" || rawProvider === "anthropic" ? "claude-cli" :
      rawProvider === "openai" || rawProvider === "gpt" ? "openai" :
      rawProvider === "google" || rawProvider === "gemini" ? "google" :
      rawProvider === "kimi" || rawProvider === "moonshot" ? "kimi-for-coding" :
      rawProvider === "qwen" ? "qwen-cli" :
      modelId.slice(0, slash);
    const modelID = providerID === "claude-cli" ? "claude-sonnet-4-6" : modelPart;
    return { providerID, modelID };
  }

  // Heuristic provider detection
  const raw = modelId.toLowerCase();
  // claude-cli only has claude-sonnet-4-6
  if (raw.startsWith("claude")) return { providerID: "claude-cli", modelID: "claude-sonnet-4-6" };
  if (raw.startsWith("gpt") || raw.startsWith("o1") || raw.startsWith("o3"))
    return { providerID: "openai", modelID: modelId };
  if (raw.startsWith("gemini")) return { providerID: "google", modelID: modelId };
  if (raw.startsWith("deepseek")) return { providerID: "deepseek", modelID: modelId };
  if (raw.startsWith("qwen")) return { providerID: "qwen-cli", modelID: modelId };
  if (raw.startsWith("kimi") || raw.startsWith("moonshot")) return { providerID: "kimi-for-coding", modelID: modelId };

  return { providerID: "claude-cli", modelID: modelId };
}

// ---------------------------------------------------------------------------
// Try forwarding to a remote gateway endpoint
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
// Fall back to gizzi terminal server
// ---------------------------------------------------------------------------

async function routeViaGizzi(
  chatId: string,
  message: string,
  modelId: string | undefined,
  runtimeModelId: string | undefined,
  clientSignal?: AbortSignal,
): Promise<Response> {
  const { providerID, modelID } = parseModelId(runtimeModelId ?? modelId);

  const gizziAuth = getGizziAuthHeader();

  // Resolve gizzi session ID:
  // - Real gizzi session IDs start with 'ses_' — use directly.
  // - Any other ID → look up persisted mapping, or create a new gizzi session and persist it.
  let gizziSessionId = chatId;
  if (!chatId.startsWith('ses_')) {
    const persisted = await getGizziSessionId(chatId);
    if (persisted) {
      gizziSessionId = persisted;
    } else {
      const createRes = await fetch(`${TERMINAL_SERVER_URL}/v1/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(gizziAuth ? { Authorization: gizziAuth } : {}) },
        body: JSON.stringify({ name: 'Platform Chat' }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => null);
      if (createRes?.ok) {
        const created = await createRes.json().catch(() => null);
        if (created?.id) {
          gizziSessionId = created.id;
          await saveGizziSessionId(chatId, created.id);
        }
      }
    }
  }
  const messageUrl = `${TERMINAL_SERVER_URL}/v1/session/${encodeURIComponent(gizziSessionId)}/message`;
  const eventUrl = `${TERMINAL_SERVER_URL}/v1/event`;

  const msgHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (gizziAuth) msgHeaders["Authorization"] = gizziAuth;

  // Open the gizzi bus event stream BEFORE posting so we don't miss early part_delta events.
  const eventHeaders: Record<string, string> = { Accept: "text/event-stream", "Cache-Control": "no-cache" };
  if (gizziAuth) eventHeaders["Authorization"] = gizziAuth;
  // No timeout on the event stream — body reading is cancelled by eventsReader.cancel()
  // when the POST completes. Using AbortSignal.timeout here would abort body reading
  // for long model responses.
  const eventRes = await fetch(eventUrl, {
    method: "GET",
    headers: eventHeaders,
  }).catch(() => null);

  // Combine client disconnect signal with hard timeout.
  // If the client closes the tab, clientSignal fires and we cancel gizzi immediately.
  const postSignal = clientSignal
    ? AbortSignal.any([clientSignal, AbortSignal.timeout(120_000)])
    : AbortSignal.timeout(120_000);

  // Fire the POST (don't await here; stream while it runs)
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

  // If the event stream is unavailable, fall back to the original blocking POST approach.
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

  // Stream gizzi bus events as SSE to the client.
  //
  // Gizzi part types → rust-stream-adapter event mapping:
  //   message.part.updated (tool, running)    → content_block_start (tool_use) with full input
  //   message.part.updated (tool, completed)  → tool_result
  //   message.part.updated (tool, error)      → tool_error
  //   message.part.updated (reasoning, empty) → content_block_start (thinking)
  //   message.part.updated (step-finish)      → captured for finish event token usage
  //   message.part.delta (reasoning partID)   → content_block_delta (thinking_delta)
  //   message.part.delta (text partID)        → content_block_delta (text_delta)
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const eventsReader = eventRes.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      let evtBuffer = "";
      let messageId: string | null = null;
      let closed = false;
      // Part IDs whose deltas should be forwarded as thinking_delta (not text_delta).
      // message.part.updated with type="reasoning" and empty text arrives BEFORE
      // the part's deltas, so we can classify them before any delta arrives.
      const reasoningPartIds = new Set<string>();
      // Tool callIDs already emitted as content_block_start (avoid double-emit).
      const emittedToolCallIds = new Set<string>();
      // Token usage from step-finish, sent in the terminal finish event.
      let stepTokens: Record<string, unknown> | null = null;
      let stepCost: number | null = null;

      const enqueue = (data: object) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Emit message_start exactly once on first encounter of the message ID.
      const ensureMessageStart = (msgId: string) => {
        if (!messageId && msgId) {
          messageId = msgId;
          enqueue({ type: "message_start", messageId });
        }
      };

      // Cancel the event stream reader if the client disconnects mid-stream.
      clientSignal?.addEventListener("abort", () => {
        closed = true;
        eventsReader.cancel().catch(() => {});
        try { controller.close(); } catch {}
      });

      let postResponse: Response | null = null;
      let postErr: string | null = null;
      const postDonePromise = postPromise
        .then((r) => { postResponse = r; })
        .catch((e: unknown) => { postErr = e instanceof Error ? e.message : String(e); })
        .finally(() => { eventsReader.cancel().catch(() => {}); });

      try {
        while (true) {
          const { done, value } = await eventsReader.read();
          if (done) break;

          evtBuffer += decoder.decode(value, { stream: true });
          const blocks = evtBuffer.split(/\r?\n\r?\n/);
          evtBuffer = blocks.pop() ?? "";

          for (const block of blocks) {
            if (!block.trim()) continue;

            const data = block
              .split(/\r?\n/)
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).trimStart())
              .join("\n");
            if (!data) continue;

            try {
              const event = JSON.parse(data) as {
                type?: string;
                properties?: Record<string, unknown>;
              };

              // ── message.part.updated ──────────────────────────────────────
              if (event.type === "message.part.updated") {
                // The part object itself carries sessionID and messageID (from PartBase).
                const part = event.properties?.part as Record<string, unknown> | undefined;
                if (!part || part.sessionID !== gizziSessionId) continue;

                const partId = part.id as string | undefined;
                const msgId = part.messageID as string | undefined;
                if (!partId || !msgId) continue;

                ensureMessageStart(msgId);

                switch (part.type) {
                  case "reasoning": {
                    // Initial empty part arrives BEFORE its deltas — open a thinking block.
                    if (typeof part.text === "string" && part.text === "") {
                      reasoningPartIds.add(partId);
                      enqueue({
                        type: "content_block_start",
                        messageId,
                        content_block: { type: "thinking", id: partId, thinking: "" },
                      });
                    }
                    // The final part.updated (full text) arrives after all deltas — skip,
                    // the client already has the streamed text.
                    break;
                  }

                  case "tool": {
                    const state = part.state as Record<string, unknown> | undefined;
                    if (!state) break;
                    const callID = part.callID as string | undefined;
                    const toolName = (part.tool as string | undefined) ?? "tool";
                    if (!callID) break;

                    if (state.status === "running" && !emittedToolCallIds.has(callID)) {
                      // Emit content_block_start once when the tool has its full input.
                      emittedToolCallIds.add(callID);
                      enqueue({
                        type: "content_block_start",
                        messageId,
                        content_block: {
                          type: "tool_use",
                          id: callID,
                          name: toolName,
                          input: (state.input as Record<string, unknown>) ?? {},
                        },
                      });
                    } else if (state.status === "completed") {
                      enqueue({
                        type: "tool_result",
                        messageId,
                        toolCallId: callID,
                        toolName,
                        result: state.output,
                      });
                    } else if (state.status === "error") {
                      enqueue({
                        type: "tool_error",
                        messageId,
                        toolCallId: callID,
                        error: state.error ?? "Tool execution failed",
                      });
                    }
                    break;
                  }

                  case "step-finish": {
                    // step-finish is NOT emitted as a bus event — this case is
                    // unreachable in practice. Tokens come from message.updated instead.
                    break;
                  }

                  default:
                    break;
                }
                continue;
              }

              // ── message.part.delta ───────────────────────────────────────
              if (event.type === "message.part.delta") {
                const props = event.properties as {
                  sessionID?: string;
                  messageID?: string;
                  partID?: string;
                  field?: string;
                  delta?: string;
                } | undefined;
                if (!props?.sessionID || props.sessionID !== gizziSessionId) continue;
                if (props.field !== "text" && props.field !== "content") continue;
                if (!props.delta) continue;

                ensureMessageStart(props.messageID ?? "");

                if (props.partID && reasoningPartIds.has(props.partID)) {
                  // Thinking delta — route to the open thinking block.
                  enqueue({
                    type: "content_block_delta",
                    messageId,
                    partId: props.partID,
                    delta: { type: "thinking_delta", thinking: props.delta },
                  });
                } else {
                  // Text delta.
                  enqueue({
                    type: "content_block_delta",
                    messageId,
                    partId: props.partID,
                    delta: { type: "text_delta", text: props.delta },
                  });
                }
                continue;
              }

              // ── message.updated — capture final token counts ──────────────
              if (event.type === "message.updated") {
                const info = event.properties?.info as Record<string, unknown> | undefined;
                if (info?.sessionID === gizziSessionId && info?.role === "assistant") {
                  const tokens = info.tokens as Record<string, unknown> | undefined;
                  if (tokens && typeof tokens.total === "number" && tokens.total > 0) {
                    stepTokens = tokens;
                    stepCost = typeof info.cost === "number" ? info.cost : null;
                  }
                }
                continue;
              }

            } catch {
              // Malformed SSE event — skip.
            }
          }
        }
      } catch {
        // eventsReader.cancel() throws an AbortError when POST finishes — expected.
      } finally {
        try { eventsReader.releaseLock(); } catch {}
      }

      await postDonePromise;
      const resolvedResponse = postResponse as Response | null;

      if (postErr) {
        enqueue({ type: "error", error: postErr });
      } else if (resolvedResponse) {
        if (!resolvedResponse.ok) {
          enqueue({ type: "error", error: `Gizzi session error: ${resolvedResponse.status} ${resolvedResponse.statusText}` });
        } else if (resolvedResponse.body) {
          // Read the full JSON body from gizzi and forward as the final sync object.
          const bodyReader = resolvedResponse.body.getReader();
          const bodyDecoder = new TextDecoder();
          let bodyBuf = "";
          try {
            while (true) {
              const { done, value } = await bodyReader.read();
              if (done) break;
              bodyBuf += bodyDecoder.decode(value, { stream: true });
            }
          } finally {
            bodyReader.releaseLock();
          }
          const trimmed = bodyBuf.trim();
          if (trimmed) {
            try {
              enqueue(JSON.parse(trimmed));
            } catch {
              // Not JSON — skip.
            }
          }
        }
      }

      // Terminal finish event — include token usage if captured from step-finish.
      enqueue({
        type: "finish",
        ...(stepTokens ? { tokens: stepTokens } : {}),
        ...(stepCost !== null ? { cost: stepCost } : {}),
      });
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      closed = true;
      try { controller.close(); } catch {}
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
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const chatId = typeof body.chatId === "string" ? body.chatId : "";
  const message = typeof body.message === "string" ? body.message : "";
  const modelId = typeof body.modelId === "string" ? body.modelId : undefined;
  const runtimeModelId =
    typeof body.runtimeModelId === "string" ? body.runtimeModelId : undefined;
  const preferLocalDesktopRuntime = shouldPreferLocalDesktopRuntime();
  const gatewayUrl =
    !preferLocalDesktopRuntime && typeof body.gatewayUrl === "string"
      ? body.gatewayUrl.replace(/\/+$/, "")
      : null;
  const gatewayToken =
    !preferLocalDesktopRuntime && typeof body.gatewayToken === "string"
      ? body.gatewayToken
      : null;
  const authState = preferLocalDesktopRuntime ? { userId: null } : await getAuth();
  const resolvedRuntime =
    !preferLocalDesktopRuntime && authState.userId
      ? await resolveRuntimeBackendForAuthUserId(authState.userId)
      : null;
  const resolvedGatewayUrl = preferLocalDesktopRuntime
    ? null
    : gatewayUrl ??
      (resolvedRuntime?.mode === "byoc-vps" ? resolvedRuntime.gatewayUrl : null);
  const resolvedGatewayToken = preferLocalDesktopRuntime
    ? null
    : gatewayToken ??
      (resolvedRuntime?.mode === "byoc-vps" ? resolvedRuntime.gatewayToken : null);

  if (!chatId || !message) {
    return NextResponse.json(
      { error: "chatId and message are required" },
      { status: 400 },
    );
  }

  // 1. Try the caller-provided gateway URL
  if (resolvedGatewayUrl) {
    const res = await proxyToGateway(
      `${resolvedGatewayUrl}/api/agent-chat`,
      body,
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

  // 2. Try the environment-configured Allternit gateway (only when explicitly set)
  if (GATEWAY_BASE_URL && GATEWAY_BASE_URL !== resolvedGatewayUrl) {
    const res = await proxyToGateway(
      `${GATEWAY_BASE_URL}/api/agent-chat`,
      body,
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

  // 3. Try gizzi terminal server first.
  const gizziHealth = await fetch(`${TERMINAL_SERVER_URL}/v1/global/health`, {
    method: 'GET',
    headers: getGizziAuthHeader() ? { Authorization: getGizziAuthHeader()! } : {},
    signal: AbortSignal.timeout(1500),
  }).catch(() => null);

  if (gizziHealth?.ok) {
    return routeViaGizzi(chatId, message, modelId, runtimeModelId, req.signal);
  }

  // 4. No backend available
  return NextResponse.json({ error: 'No backend available' }, { status: 503 });
}
