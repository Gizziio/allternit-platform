/**
 * POST /v1/conversations
 *
 * Create a new Conversation (Gizzi session).
 * Returns a conversation_id that callers pass to POST /v1/replies.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import {
  resolveRuntimeBackendForAuthUserId,
  toGatewayAuthorizationHeader,
} from "@/lib/runtime-backend";

export const runtime = "nodejs";

const TERMINAL_SERVER_URL =
  process.env.TERMINAL_SERVER_URL ?? "http://127.0.0.1:4096";

function getGizziAuthHeader(): string | undefined {
  const user =
    process.env.GIZZI_USERNAME ?? process.env.NEXT_PUBLIC_GIZZI_USERNAME ?? "gizzi";
  const pass =
    process.env.GIZZI_PASSWORD ?? process.env.NEXT_PUBLIC_GIZZI_PASSWORD;
  if (!pass) return undefined;
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // empty body is fine
  }

  // Allow caller to supply a stable conversation_id (idempotent creation).
  const requestedId =
    typeof body.conversation_id === "string" ? body.conversation_id : undefined;
  const metadata =
    body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  // Generate a new ID if none provided — matches Gizzi session ID format.
  const conversationId = requestedId ?? `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Create the Gizzi session.
  try {
    const gizziAuth = getGizziAuthHeader();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (gizziAuth) headers["Authorization"] = gizziAuth;

    const authState = await getAuth();
    const resolvedRuntime =
      authState.userId
        ? await resolveRuntimeBackendForAuthUserId(authState.userId)
        : null;
    const gatewayUrl =
      resolvedRuntime?.mode === "byoc-vps" ? resolvedRuntime.gatewayUrl : null;
    const gatewayToken =
      resolvedRuntime?.mode === "byoc-vps" ? resolvedRuntime.gatewayToken : null;

    const sessionUrl = gatewayUrl
      ? `${gatewayUrl}/v1/sessions`
      : `${TERMINAL_SERVER_URL}/v1/sessions`;

    if (gatewayToken) {
      const authorization = toGatewayAuthorizationHeader(gatewayToken);
      if (authorization) headers["Authorization"] = authorization;
    }

    const res = await fetch(sessionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: conversationId, metadata }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);

    if (res?.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      return NextResponse.json({
        id: (data.id ?? conversationId) as string,
        object: "conversation",
        created_at: Math.floor(Date.now() / 1000),
        metadata,
      });
    }
  } catch {
    // Fall through to synthetic response
  }

  // Synthetic response — session will be created lazily on first message.
  return NextResponse.json({
    id: conversationId,
    object: "conversation",
    created_at: Math.floor(Date.now() / 1000),
    metadata,
  });
}
