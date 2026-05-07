/**
 * GET /v1/conversations/:id/replies
 *
 * List child conversations (branches) that were forked from this conversation.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const branches = await prisma.conversation.findMany({
    where: { parentConversationId: id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    object: "list",
    conversation_id: id,
    data: branches.map((b) => ({
      id: b.id,
      object: "conversation",
      created_at: b.createdAt.toISOString(),
      updated_at: b.updatedAt.toISOString(),
      title: b.title,
      parent_conversation_id: b.parentConversationId,
      message_count: b._count.messages,
    })),
    has_more: false,
  });
}
