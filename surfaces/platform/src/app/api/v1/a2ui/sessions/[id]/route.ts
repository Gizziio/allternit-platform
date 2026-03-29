// ============================================================================
// GET|DELETE /api/v1/a2ui/sessions/[id]
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { sessionStore } from '../route';

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
    const session = sessionStore.get(id);

    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      chatId: session.chatId,
      messageId: session.messageId,
      agentId: session.agentId,
      payload: session.payload,
      dataModel: session.dataModel,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
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
    const session = sessionStore.get(id);

    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    sessionStore.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[A2UI:sessions:DELETE:id]', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
