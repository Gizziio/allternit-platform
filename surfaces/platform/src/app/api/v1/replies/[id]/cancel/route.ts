/**
 * POST /v1/replies/:id/cancel
 *
 * Cancel an in-progress reply.
 * Delegates to the native-agent store abort signal — the store holds a
 * per-session AbortController that is signalled here.
 *
 * NOTE: Cross-process cancellation (Phase 8) is not yet implemented.
 * Returns 202 Accepted — the cancel signal is best-effort.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  // TODO (Phase 8): look up the active run by replyId and signal its AbortController.
  return NextResponse.json(
    { reply_id: id, status: "cancelling", message: "Cancel signal accepted (best-effort)." },
    { status: 202 },
  );
}
