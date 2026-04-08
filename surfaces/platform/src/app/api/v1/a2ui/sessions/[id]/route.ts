// ============================================================================
// GET|DELETE /api/v1/a2ui/sessions/[id]
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { getSession, deleteSession } from '@/lib/a2ui-sessions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const session = await getSession(id);

    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('[A2UI:sessions:GET:id]', error);
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const session = await getSession(id);

    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    await deleteSession(id, userId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[A2UI:sessions:DELETE:id]', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
