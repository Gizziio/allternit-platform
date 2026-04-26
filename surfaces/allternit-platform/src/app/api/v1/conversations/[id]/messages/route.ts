/**
 * GET  /v1/conversations/:id/messages  — list messages for a conversation
 * POST /v1/conversations/:id/messages  — add a message to a conversation
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface AddMessageBody {
  role: string;
  content: string;
  parentMessageId?: string;
  metadata?: Record<string, unknown>;
}

// GET /v1/conversations/:id/messages
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "not_found", message: `Conversation '${id}' not found.` },
      { status: 404 },
    );
  }

  const messages = await prisma.conversationMessage.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    object: "list",
    conversation_id: id,
    data: messages.map((m) => ({
      id: m.id,
      object: "conversation.message",
      created_at: m.createdAt.toISOString(),
      conversation_id: m.conversationId,
      role: m.role,
      content: m.content,
      parent_message_id: m.parentMessageId,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
    })),
    has_more: false,
  });
}

// POST /v1/conversations/:id/messages
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  let body: AddMessageBody;
  try {
    body = (await req.json()) as AddMessageBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_body", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body.role || !body.content) {
    return NextResponse.json(
      { error: "missing_fields", message: "Fields 'role' and 'content' are required." },
      { status: 422 },
    );
  }

  const validRoles = ["user", "assistant", "system"];
  if (!validRoles.includes(body.role)) {
    return NextResponse.json(
      { error: "invalid_role", message: `Role must be one of: ${validRoles.join(", ")}.` },
      { status: 422 },
    );
  }

  // Ensure conversation exists — auto-create if it doesn't (idempotent)
  await prisma.conversation.upsert({
    where: { id },
    create: { id },
    update: {},
  });

  const message = await prisma.conversationMessage.create({
    data: {
      conversationId: id,
      role: body.role,
      content: body.content,
      parentMessageId: body.parentMessageId ?? null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  });

  return NextResponse.json(
    {
      id: message.id,
      object: "conversation.message",
      created_at: message.createdAt.toISOString(),
      conversation_id: message.conversationId,
      role: message.role,
      content: message.content,
      parent_message_id: message.parentMessageId,
      metadata: message.metadata ? JSON.parse(message.metadata) : null,
    },
    { status: 201 },
  );
}
