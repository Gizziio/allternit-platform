/**
 * GET /v1/replies/:id
 *
 * Retrieve a Reply by ID.
 * Replies are persisted when their stream completes via the reply-store.
 * Streaming replies will not be available here until completion.
 */

import { NextRequest, NextResponse } from "next/server";
import { getReply } from "@/lib/reply-store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const reply = await getReply(id);
  if (!reply) {
    return NextResponse.json(
      { error: "not_found", message: `Reply '${id}' not found.` },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: reply.id,
    conversation_id: reply.conversationId,
    status: reply.status,
    items: reply.items,
    created_at: reply.createdAt.toISOString(),
    updated_at: reply.updatedAt.toISOString(),
  });
}
