/**
 * POST /api/aci/approve/[id]
 * POST /api/aci/approve/[id]?deny=true
 *
 * Approve or deny a T3/T4 action that is paused WaitingApproval.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/aci/session-store';
import { approveAction, denyAction } from '@/lib/aci/runner';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  if (session.state.status !== 'WaitingApproval') {
    return NextResponse.json(
      { error: `Session is not waiting for approval (status: ${session.state.status})` },
      { status: 409 },
    );
  }

  const deny = req.nextUrl.searchParams.get('deny') === 'true';
  const ok = deny ? denyAction(session) : approveAction(session);

  if (!ok) {
    return NextResponse.json({ error: 'No pending action to resolve' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, action: deny ? 'denied' : 'approved' });
}
