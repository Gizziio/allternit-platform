/**
 * /api/playground — AI Playground streaming route
 *
 * Accepts a structured prompt (system + messages array) from PlaygroundView,
 * collapses it into a single formatted message, and streams the response.
 *
 * Routing priority:
 *   1. Gizzi (primary inference engine, port 4096) — always tried first
 *   2. A2R gateway (port 8013) — fallback if gizzi is unreachable
 *
 * OpenClaw is NOT in this chain — it's agent infrastructure, not LLM inference.
 */

import { NextRequest, NextResponse } from "next/server";

const TERMINAL_SERVER_URL =
  process.env.TERMINAL_SERVER_URL ?? "http://127.0.0.1:4096";

const GATEWAY_BASE_URL =
  process.env.VITE_A2R_GATEWAY_URL?.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "") ??
  "http://127.0.0.1:8013";

interface PlaygroundMessage {
  role: "user" | "assistant";
  content: string;
}

interface PlaygroundRequest {
  systemPrompt?: string;
  messages: PlaygroundMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

function getGizziAuthHeader(): string | undefined {
  const user = process.env.GIZZI_USERNAME ?? process.env.NEXT_PUBLIC_GIZZI_USERNAME ?? "gizzi";
  const pass = process.env.GIZZI_PASSWORD ?? process.env.NEXT_PUBLIC_GIZZI_PASSWORD;
  if (!pass) return undefined;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

function parseModelId(model: string | undefined): { providerID: string; modelID: string } {
  if (!model) return { providerID: "claude-cli", modelID: "claude-sonnet-4-6" };
  const slash = model.indexOf("/");
  if (slash > 0) return { providerID: model.slice(0, slash), modelID: model.slice(slash + 1) };
  const raw = model.toLowerCase();
  if (raw.startsWith("claude")) return { providerID: "claude-cli", modelID: model };
  if (raw.startsWith("gpt") || raw.startsWith("o1") || raw.startsWith("o3")) return { providerID: "openai", modelID: model };
  if (raw.startsWith("gemini")) return { providerID: "google", modelID: model };
  return { providerID: "claude-cli", modelID: model };
}

/**
 * Collapse system prompt + multi-turn messages into a single prompt string.
 * Gizzi's session API takes one message at a time; for the playground we
 * flatten the whole conversation into one well-structured message so the model
 * receives all context in a single call.
 */
function buildPrompt(systemPrompt: string | undefined, messages: PlaygroundMessage[]): string {
  const parts: string[] = [];

  if (systemPrompt?.trim()) {
    parts.push(`<system>\n${systemPrompt.trim()}\n</system>`);
  }

  for (const msg of messages) {
    if (!msg.content.trim()) continue;
    if (msg.role === "user") {
      parts.push(`<user>\n${msg.content.trim()}\n</user>`);
    } else {
      parts.push(`<assistant>\n${msg.content.trim()}\n</assistant>`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Try to run the playground request via gizzi (primary inference engine).
 * Returns the streaming Response on success, null if gizzi is unreachable.
 */
async function routeViaGizzi(
  prompt: string,
  providerID: string,
  modelID: string,
  temperature: number | undefined,
  maxTokens: number | undefined,
): Promise<Response | null> {
  const gizziAuth = getGizziAuthHeader();
  const sessionHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (gizziAuth) sessionHeaders["Authorization"] = gizziAuth;

  // Create a session — gizzi assigns the ses_* ID
  let sessionId: string | null = null;
  try {
    const sessionRes = await fetch(`${TERMINAL_SERVER_URL}/session`, {
      method: "POST",
      headers: sessionHeaders,
      body: JSON.stringify({ title: "Playground" }),
      signal: AbortSignal.timeout(5000),
    });
    if (sessionRes.ok) {
      const data = (await sessionRes.json()) as { id?: string };
      if (typeof data.id === "string") sessionId = data.id;
    }
  } catch {
    return null;
  }

  if (!sessionId) return null;

  const msgHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (gizziAuth) msgHeaders["Authorization"] = gizziAuth;

  try {
    const msgRes = await fetch(
      `${TERMINAL_SERVER_URL}/session/${encodeURIComponent(sessionId)}/message`,
      {
        method: "POST",
        headers: msgHeaders,
        body: JSON.stringify({
          sessionID: sessionId,
          parts: [{ type: "text", text: prompt }],
          model: { providerID, modelID },
          ...(temperature !== undefined && { temperature }),
          ...(maxTokens !== undefined && { max_tokens: maxTokens }),
        }),
        signal: AbortSignal.timeout(120_000),
      },
    );

    if (!msgRes.ok) return null;

    return new Response(msgRes.body, {
      status: 200,
      headers: {
        "Content-Type": msgRes.headers.get("Content-Type") ?? "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Playground-Backend": "gizzi",
      },
    });
  } catch {
    return null;
  }
}

/**
 * Fallback: forward to the A2R gateway, which internally routes to gizzi.
 * Used when gizzi is not directly reachable (e.g. remote deploy).
 */
async function routeViaGateway(body: PlaygroundRequest): Promise<Response | null> {
  try {
    const res = await fetch(`${GATEWAY_BASE_URL}/api/playground`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Playground-Backend": "a2r-gateway",
      },
    });
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: PlaygroundRequest;
  try {
    body = (await req.json()) as PlaygroundRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { systemPrompt, messages = [], model, temperature, maxTokens } = body;

  if (!messages.length) {
    return NextResponse.json({ error: "messages array is required" }, { status: 400 });
  }

  const prompt = buildPrompt(systemPrompt, messages);
  const { providerID, modelID } = parseModelId(model);

  // 1. Try gizzi directly — it's the primary inference engine
  const gizziRes = await routeViaGizzi(prompt, providerID, modelID, temperature, maxTokens);
  if (gizziRes) return gizziRes;

  // 2. Fall back to the A2R gateway if gizzi is unreachable
  const gatewayRes = await routeViaGateway(body);
  if (gatewayRes) return gatewayRes;

  return NextResponse.json({ error: "AI backend unavailable" }, { status: 503 });
}
