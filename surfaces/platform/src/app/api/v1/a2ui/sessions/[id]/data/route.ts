// ============================================================================
// PATCH /api/v1/a2ui/sessions/[id]/data
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { sessionStore } from '../../route';

export async function PATCH(
  request: NextRequest,
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

    const { data_model } = await request.json() as { data_model: Record<string, unknown> };
    if (!data_model || typeof data_model !== 'object') {
      return NextResponse.json({ error: 'data_model is required' }, { status: 400 });
    }

    session.dataModel = { ...session.dataModel, ...data_model };
    session.updatedAt = new Date().toISOString();
    sessionStore.set(id, session);

    return NextResponse.json({
      id: session.id,
      chatId: session.chatId,
      payload: session.payload,
      dataModel: session.dataModel,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    });
  } catch (error) {
    console.error('[A2UI:sessions:PATCH:data]', error);
    return NextResponse.json({ error: 'Failed to update data model' }, { status: 500 });
  }
}
