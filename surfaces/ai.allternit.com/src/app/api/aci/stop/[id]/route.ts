/**
 * POST /api/aci/stop/[id]
 *
 * Stop an active ACI run session and clean up.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, destroySession } from '@/lib/aci/session-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  destroySession(sessionId);

  return NextResponse.json({ ok: true, sessionId });
}
