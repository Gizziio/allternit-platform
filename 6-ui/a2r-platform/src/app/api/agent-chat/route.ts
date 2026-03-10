import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { db } from "@/lib/db/client-sqlite";
import { chat, message, part } from "@/lib/db/schema-sqlite";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const DEFAULT_GATEWAY_PORT = Number(
  process.env.A2R_OPENCLAW_HOST_PORT
    || process.env.A2R_PORT
    || process.env.OPENCLAW_PORT
    || 18789,
);

const DEFAULT_GATEWAY_WS_URL = (
  process.env.A2R_OPENCLAW_GATEWAY_WS_URL
  || process.env.OPENCLAW_GATEWAY_WS_URL
  || process.env.A2R_OPENCLAW_HOST_URL
  || process.env.OPENCLAW_HOST_URL
  || `ws://127.0.0.1:${DEFAULT_GATEWAY_PORT}`
).trim();

const DEFAULT_GATEWAY_TOKEN = (
  process.env.A2R_GATEWAY_TOKEN
  || process.env.OPENCLAW_GATEWAY_TOKEN
  || process.env.A2R_OPENCLAW_GATEWAY_TOKEN
  || null
);

const DEFAULT_GATEWAY_PASSWORD = (
  process.env.A2R_GATEWAY_PASSWORD
  || process.env.OPENCLAW_GATEWAY_PASSWORD
  || null
);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeWsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/^http:\/\//i, "ws://")
    .replace(/^https:\/\//i, "wss://")
    .replace(/\/+$/, "");
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractMessageText(messagePayload: unknown): string {
  if (messagePayload == null) return "";
  if (typeof messagePayload === "string") return messagePayload;
  if (typeof messagePayload === "number" || typeof messagePayload === "boolean") {
    return String(messagePayload);
  }

  if (isRecord(messagePayload)) {
    if (typeof messagePayload.text === "string") {
      return messagePayload.text;
    }

    if (Array.isArray(messagePayload.content)) {
      const parts: string[] = [];
      for (const item of messagePayload.content) {
        if (!isRecord(item)) continue;
        if (typeof item.text === "string") {
          parts.push(item.text);
        }
      }
      if (parts.length > 0) {
        return parts.join("\n");
      }
    }

    try {
      return JSON.stringify(messagePayload);
    } catch (error) {
      console.error("[Agent Chat] Failed to stringify message payload:", error);
      return String(messagePayload);
    }
  }

  return String(messagePayload);
}

function resolveSessionKey(chatId: string, agentId: string | null, requested: string | null): string {
  if (requested) return requested;
  if (agentId) return `agent:${agentId}:${chatId}`;
  return `agent:main:${chatId}`;
}

function commonPrefixLength(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  let idx = 0;
  while (idx < limit && a[idx] === b[idx]) idx += 1;
  return idx;
}

function encodeSse(encoder: TextEncoder, payload: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

interface GatewayResFrame {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { message?: string };
}

interface GatewayEventFrame {
  type: "event";
  event: string;
  payload?: unknown;
}

function asResFrame(frame: unknown): GatewayResFrame | null {
  if (!isRecord(frame)) return null;
  if (frame.type !== "res") return null;
  if (typeof frame.id !== "string") return null;
  if (typeof frame.ok !== "boolean") return null;
  return frame as unknown as GatewayResFrame;
}

function asEventFrame(frame: unknown): GatewayEventFrame | null {
  if (!isRecord(frame)) return null;
  if (frame.type !== "event") return null;
  if (typeof frame.event !== "string") return null;
  return frame as unknown as GatewayEventFrame;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "00000000-0000-0000-0000-000000000000";

    const body = await req.json() as JsonRecord;
    const chatId = getString(body.chatId);
    const userMessage = getString(body.message);
    const modelId = getString(body.modelId) || "agent";

    if (!chatId || !userMessage) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const requestedMode = body.conversationMode === "agent" ? "agent" : "llm";
    const agentId = getString(body.agentId);
    const agentName = getString(body.agentName);
    const agentProvider = getString(body.agentProvider);
    const agentModel = getString(body.agentModel);
    const agentFallbackModels = Array.isArray(body.agentFallbackModels)
      ? body.agentFallbackModels.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const requestedSessionKey = getString(body.agentSessionKey);
    const sessionKey = resolveSessionKey(chatId, agentId, requestedSessionKey);

    const gatewayWsUrl = normalizeWsUrl(
      getString(body.gatewayWsUrl)
      || getString(body.gatewayUrl)
      || DEFAULT_GATEWAY_WS_URL,
    );
    const gatewayToken = getString(body.gatewayToken) || DEFAULT_GATEWAY_TOKEN;
    const gatewayPassword = getString(body.gatewayPassword) || DEFAULT_GATEWAY_PASSWORD;

    if (!gatewayWsUrl) {
      return NextResponse.json(
        { error: "Missing gateway WebSocket URL" },
        { status: 400 },
      );
    }

    const messageAnnotations = JSON.stringify({
      conversationMode: requestedMode,
      transport: "openclaw-gateway",
      sessionKey,
      agent: requestedMode === "agent"
        ? {
            id: agentId,
            name: agentName,
            provider: agentProvider,
            model: agentModel,
            fallbackModels: agentFallbackModels,
          }
        : undefined,
    });

    const chatRecord = await db.query.chat.findFirst({
      where: eq(chat.id, chatId),
    });

    if (!chatRecord) {
      await db.insert(chat).values({
        id: chatId,
        title: userMessage.slice(0, 50) + (userMessage.length > 50 ? "..." : ""),
        userId,
      }).returning();
    }

    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
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

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        let streamClosed = false;
        let finalized = false;
        let socket: WebSocket | null = null;
        let queue = Promise.resolve();
        let activeRunId: string | null = null;
        let assistantMessageId: string | null = null;
        let assistantBuffer = "";
        let partOrder = 0;
        let connectReqId = "";
        let chatReqId = "";
        let connectSent = false;
        let chatSent = false;
        const idempotencyKey = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;

        const closeStream = () => {
          if (streamClosed) return;
          streamClosed = true;
          try {
            controller.close();
          } catch (error) {
            console.error("[Agent Chat] Failed to close stream controller:", error);
          }
        };

        const cleanupSocket = () => {
          if (!socket) return;
          try {
            socket.close(1000, "done");
          } catch (error) {
            console.error("[Agent Chat] Failed to close WebSocket:", error);
          }
          socket = null;
        };

        const sendSse = (payload: unknown) => {
          if (streamClosed) return;
          controller.enqueue(encodeSse(encoder, payload));
        };

        const ensureAssistantMessage = async (runId: string | null) => {
          if (assistantMessageId) return assistantMessageId;

          const [assistantMsg] = await db
            .insert(message)
            .values({
              chatId,
              role: "assistant",
              content: "",
              parentMessageId: userMsgRecord.id,
              annotations: messageAnnotations,
              selectedModel: modelId,
              kernelRunId: runId || undefined,
            })
            .returning();

          assistantMessageId = assistantMsg.id;
          sendSse({
            type: "message_start",
            messageId: assistantMessageId,
          });
          return assistantMessageId;
        };

        const appendAssistantFromFullText = async (fullText: string) => {
          if (!fullText) return;
          if (fullText.length < assistantBuffer.length) return;

          const prefixLen = commonPrefixLength(assistantBuffer, fullText);
          const deltaText = fullText.slice(prefixLen);
          assistantBuffer = fullText;

          if (!deltaText) return;
          sendSse({
            type: "content_block_delta",
            delta: {
              type: "text_delta",
              text: deltaText,
            },
          });
        };

        const persistAssistant = async () => {
          if (!assistantMessageId && !assistantBuffer) return;

          if (!assistantMessageId) {
            await ensureAssistantMessage(activeRunId);
          }

          if (!assistantMessageId) return;

          await db
            .update(message)
            .set({ content: assistantBuffer })
            .where(eq(message.id, assistantMessageId));

          if (assistantBuffer) {
            await db.insert(part).values({
              messageId: assistantMessageId,
              type: "text",
              text_text: assistantBuffer,
              order: partOrder++,
            });
          }
        };

        const timeoutHandle = setTimeout(() => {
          void fail(new Error("Gateway chat timed out"));
        }, 120_000);

        const abortHandler = () => {
          finalizeCleanup();
          cleanupSocket();
          closeStream();
        };

        const finalizeCleanup = () => {
          clearTimeout(timeoutHandle);
          req.signal.removeEventListener("abort", abortHandler);
        };

        req.signal.addEventListener("abort", abortHandler, { once: true });

        const finish = async () => {
          if (finalized) return;
          finalized = true;
          finalizeCleanup();
          await persistAssistant();
          sendSse({ type: "finish" });
          cleanupSocket();
          closeStream();
        };

        const fail = async (error: unknown) => {
          const errorText = error instanceof Error ? error.message : String(error);
          if (!assistantMessageId) {
            await ensureAssistantMessage(activeRunId);
          }
          if (errorText) {
            const nextText = assistantBuffer
              ? `${assistantBuffer}\n\nError: ${errorText}`
              : `Error: ${errorText}`;
            await appendAssistantFromFullText(nextText);
          }
          await finish();
        };

        const sendReq = (id: string, method: string, params: unknown) => {
          if (!socket || socket.readyState !== WebSocket.OPEN) {
            throw new Error("gateway socket is not open");
          }
          socket.send(JSON.stringify({
            type: "req",
            id,
            method,
            params,
          }));
        };

        const sendConnect = () => {
          if (!socket || socket.readyState !== WebSocket.OPEN) return;
          connectReqId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `connect-${Date.now()}-${Math.random()}`;
          connectSent = true;
          sendReq(connectReqId, "connect", {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: "openclaw-control-ui",
              version: "a2r-agent-chat-1",
              platform: "node",
              mode: "webchat",
              instanceId: `a2r-agent-chat-${chatId}`,
            },
            role: "operator",
            scopes: ["operator.read", "operator.write"],
            caps: [],
            auth: (gatewayToken || gatewayPassword)
              ? {
                  token: gatewayToken || undefined,
                  password: gatewayPassword || undefined,
                }
              : undefined,
            userAgent: "a2r-agent-chat/1",
            locale: "en-US",
          });
        };

        const sendChat = () => {
          if (!socket || socket.readyState !== WebSocket.OPEN) return;
          chatReqId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `chat-${Date.now()}-${Math.random()}`;
          chatSent = true;
          sendReq(chatReqId, "chat.send", {
            sessionKey,
            message: userMessage,
            deliver: false,
            idempotencyKey,
          });
        };

        const handleFrame = async (rawText: string) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(rawText);
          } catch (error) {
            console.error("[Agent Chat] Failed to parse frame JSON:", error, "Raw text:", rawText);
            return;
          }

          const eventFrame = asEventFrame(parsed);
          if (eventFrame) {
            if (eventFrame.event === "connect.challenge") {
              sendConnect();
              return;
            }

            if (eventFrame.event === "chat") {
              const payload = isRecord(eventFrame.payload) ? eventFrame.payload : null;
              if (!payload) return;

              const payloadSessionKey = getString(payload.sessionKey);
              if (payloadSessionKey && payloadSessionKey !== sessionKey) {
                return;
              }

              const payloadRunId = getString(payload.runId);
              const state = getString(payload.state);
              if (payloadRunId) {
                if (!activeRunId) {
                  activeRunId = payloadRunId;
                } else if (payloadRunId !== activeRunId && state !== "final") {
                  return;
                }
              }

              if (state === "delta") {
                await ensureAssistantMessage(activeRunId);
                const deltaText = extractMessageText(payload.message);
                await appendAssistantFromFullText(deltaText);
                return;
              }

              if (state === "error") {
                const errorMessage = getString(payload.errorMessage) || "chat error";
                await fail(new Error(errorMessage));
                return;
              }

              if (state === "final" || state === "aborted") {
                await ensureAssistantMessage(activeRunId);
                const finalText = extractMessageText(payload.message);
                if (finalText) {
                  await appendAssistantFromFullText(finalText);
                }
                if (state === "aborted" && !assistantBuffer) {
                  await appendAssistantFromFullText("[run aborted]");
                }
                await finish();
                return;
              }
            }
            return;
          }

          const resFrame = asResFrame(parsed);
          if (!resFrame) return;

          if (resFrame.id === connectReqId) {
            if (!resFrame.ok) {
              throw new Error(resFrame.error?.message || "connect failed");
            }
            if (!chatSent) {
              sendChat();
            }
            return;
          }

          if (resFrame.id === chatReqId) {
            if (!resFrame.ok) {
              throw new Error(resFrame.error?.message || "chat.send failed");
            }

            const payload = isRecord(resFrame.payload) ? resFrame.payload : {};
            const ackRunId = getString(payload.runId);
            if (ackRunId) activeRunId = ackRunId;

            const status = getString(payload.status);
            if (status === "ok") {
              await finish();
            }
          }
        };

        try {
          socket = new WebSocket(gatewayWsUrl);
        } catch (error) {
          finalizeCleanup();
          void fail(error);
          return;
        }

        socket.onopen = () => {
          try {
            if (!connectSent) sendConnect();
          } catch (error) {
            void fail(error);
          }
        };

        socket.onmessage = (event) => {
          const rawText = String(event.data ?? "");
          queue = queue
            .then(async () => {
              await handleFrame(rawText);
            })
            .catch(async (error) => {
              await fail(error);
            });
        };

        socket.onerror = () => {
          void fail(new Error("gateway websocket error"));
        };

        socket.onclose = (event) => {
          if (finalized) return;
          const reason = event.reason ? `: ${event.reason}` : "";
          void fail(new Error(`Gateway closed (${event.code})${reason}`));
        };
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
    console.error("Agent Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
