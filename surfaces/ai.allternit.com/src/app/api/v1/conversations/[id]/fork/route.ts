/**
 * POST /v1/conversations/:id/fork
 *
 * Create a new Conversation branch from an existing one.
 * Body: { fromMessageId?: string, title?: string }
 *
 * Creates a new Conversation with parentConversationId set to the source
 * conversation's id, copying all messages up to and including fromMessageId
 * (or all messages if fromMessageId is omitted).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface ForkBody {
  fromMessageId?: string;
  title?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  let body: ForkBody = {};
  try {
    body = (await req.json()) as ForkBody;
  } catch {
    // empty body is fine — fork all messages
  }

  const { fromMessageId, title } = body;

  // Validate source conversation exists
  const sourceConversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!sourceConversation) {
    return NextResponse.json(
      { error: "not_found", message: `Conversation '${id}' not found.` },
      { status: 404 },
    );
  }

  // Determine which messages to copy
  let messagesToCopy = sourceConversation.messages;

  if (fromMessageId) {
    const cutoffIndex = messagesToCopy.findIndex((m) => m.id === fromMessageId);
    if (cutoffIndex === -1) {
      return NextResponse.json(
        {
          error: "invalid_message",
          message: `Message '${fromMessageId}' not found in conversation '${id}'.`,
        },
        { status: 422 },
      );
    }
    // Include all messages up to and including the cutoff
    messagesToCopy = messagesToCopy.slice(0, cutoffIndex + 1);
  }

  // Create the new branched conversation with its messages in a transaction
  const newConversation = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        title: title ?? sourceConversation.title ?? null,
        userId: sourceConversation.userId,
        parentConversationId: id,
      },
    });

    if (messagesToCopy.length > 0) {
      await tx.conversationMessage.createMany({
        data: messagesToCopy.map((m) => ({
          conversationId: conversation.id,
          role: m.role,
          content: m.content,
          parentMessageId: m.parentMessageId,
          metadata: m.metadata,
        })),
      });
    }

    return conversation;
  });

  return NextResponse.json(
    {
      id: newConversation.id,
      object: "conversation",
      created_at: newConversation.createdAt.toISOString(),
      updated_at: newConversation.updatedAt.toISOString(),
      title: newConversation.title,
      parent_conversation_id: newConversation.parentConversationId,
      forked_from_message_id: fromMessageId ?? null,
      message_count: messagesToCopy.length,
    },
    { status: 201 },
  );
}
