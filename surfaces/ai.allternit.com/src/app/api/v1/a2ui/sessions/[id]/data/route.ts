// ============================================================================
// PATCH /api/v1/a2ui/sessions/[id]/data
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { getSession, saveSession } from '@/lib/a2ui-sessions';

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
    const session = await getSession(id);

    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data_model } = await request.json() as { data_model: Record<string, unknown> };
    if (!data_model || typeof data_model !== 'object') {
      return NextResponse.json({ error: 'data_model is required' }, { status: 400 });
    }

    const updated = {
      ...session,
      dataModel: { ...session.dataModel, ...data_model },
      updatedAt: new Date().toISOString(),
    };

    await saveSession(updated);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[A2UI:sessions:PATCH:data]', error);
    return NextResponse.json({ error: 'Failed to update data model' }, { status: 500 });
  }
}
