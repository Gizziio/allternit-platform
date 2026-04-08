/**
 * GET /v1/conversations/:id/replies
 *
 * List replies for a conversation.
 * NOTE: Full persistence (Phase 8) not yet implemented — returns empty list.
 * Replies are currently held in client ConversationReplyState only.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return NextResponse.json({
    object: "list",
    conversation_id: id,
    data: [],
    has_more: false,
  });
}
