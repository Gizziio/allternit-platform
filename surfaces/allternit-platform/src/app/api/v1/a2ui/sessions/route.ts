// ============================================================================
// GET|POST /api/v1/a2ui/sessions
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { saveSession, listSessions } from '@/lib/a2ui-sessions';
import type { A2UIPayload } from '@/capsules/a2ui/a2ui.types';

// ============================================================================
// POST /api/v1/a2ui/sessions
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chat_id, payload, message_id, agent_id } = body as {
      chat_id: string;
      payload: A2UIPayload;
      message_id?: string;
      agent_id?: string;
    };

    if (!chat_id || !payload) {
      return NextResponse.json(
        { error: 'chat_id and payload are required' },
        { status: 400 }
      );
    }

    const id = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    const session = {
      id,
      chatId: chat_id,
      userId,
      messageId: message_id,
      agentId: agent_id,
      payload,
      dataModel: payload.dataModel ?? {},
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    };

    await saveSession(session);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('[A2UI:sessions:POST]', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

// ============================================================================
// GET /api/v1/a2ui/sessions?chat_id=...
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const chatId = request.nextUrl.searchParams.get('chat_id') ?? undefined;
    const sessions = await listSessions(userId, chatId);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[A2UI:sessions:GET]', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}
