/**
 * GET /v1/conversations/:id
 *
 * Retrieve a Conversation by ID.
 * Checks local DB first, then falls back to Gizzi session endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/server-auth";
import {
  resolveRuntimeBackendForAuthUserId,
  toGatewayAuthorizationHeader,
} from "@/lib/runtime-backend";
import { prisma } from "@/lib/db";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  // Check local DB first
  const dbConversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      _count: { select: { messages: true, branches: true } },
    },
  });

  if (dbConversation) {
    return NextResponse.json({
      id: dbConversation.id,
      object: "conversation",
      created_at: dbConversation.createdAt.toISOString(),
      updated_at: dbConversation.updatedAt.toISOString(),
      title: dbConversation.title,
      parent_conversation_id: dbConversation.parentConversationId,
      message_count: dbConversation._count.messages,
      branch_count: dbConversation._count.branches,
    });
  }

  try {
    const gizziAuth = getGizziAuthHeader();
    const headers: Record<string, string> = {};
    if (gizziAuth) headers["Authorization"] = gizziAuth;

    const authState = await getAuth();
    const resolvedRuntime =
      authState.userId
        ? await resolveRuntimeBackendForAuthUserId(authState.userId)
        : null;

    const baseUrl =
      resolvedRuntime?.mode === "byoc-vps"
        ? resolvedRuntime.gatewayUrl
        : TERMINAL_SERVER_URL;

    const gatewayToken =
      resolvedRuntime?.mode === "byoc-vps" ? resolvedRuntime.gatewayToken : null;
    if (gatewayToken) {
      const auth = toGatewayAuthorizationHeader(gatewayToken);
      if (auth) headers["Authorization"] = auth;
    }

    const res = await fetch(
      `${baseUrl}/v1/session/${encodeURIComponent(id)}`,
      { headers, signal: AbortSignal.timeout(5000) },
    ).catch(() => null);

    if (res?.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      return NextResponse.json({
        id,
        object: "conversation",
        created_at: (data.time as Record<string, unknown>)?.created ?? null,
        metadata: data,
      });
    }
  } catch {
    // fall through
  }

  return NextResponse.json(
    { error: "not_found", message: `Conversation '${id}' not found.` },
    { status: 404 },
  );
}
