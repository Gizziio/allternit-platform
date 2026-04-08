/**
 * POST /v1/replies/:id/cancel
 *
 * Cancel an in-progress streaming reply.
 *
 * Sets a Redis cancellation flag that the streaming handler polls.
 * Returns 202 Accepted — cancellation is delivered on the next poll cycle
 * (typically within one streamed chunk).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestCancel } from '@/lib/reply-cancellation';

export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const wasActive = await requestCancel(id);

  return NextResponse.json(
    {
      reply_id: id,
      status: 'cancelling',
      message: wasActive
        ? 'Cancel signal delivered to streaming handler.'
        : 'Cancel signal accepted (reply may have already finished).',
    },
    { status: 202 },
  );
}
