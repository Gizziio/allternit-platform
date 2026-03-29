// ============================================================================
// GET|POST /api/v1/a2ui/sessions
// ============================================================================
// Session store is module-level (per-process).
// TODO: Replace with Prisma persistence once schema migration is run.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import type { A2UIPayload } from '@/capsules/a2ui/a2ui.types';

// ============================================================================
// In-process store (shared across this module's exports)
// ============================================================================

interface StoredSession {
  id: string;
  chatId: string;
  userId: string;
  messageId?: string;
  agentId?: string;
  payload: A2UIPayload;
  dataModel: Record<string, unknown>;
  status: 'active' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
}

// Exported so [id] routes can access the same Map instance
export const sessionStore = new Map<string, StoredSession>();

function toResponse(s: StoredSession) {
  return {
    id: s.id,
    chatId: s.chatId,
    messageId: s.messageId,
    agentId: s.agentId,
    payload: s.payload,
    dataModel: s.dataModel,
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

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

    const session: StoredSession = {
      id,
      chatId: chat_id,
      userId,
      messageId: message_id,
      agentId: agent_id,
      payload,
      dataModel: payload.dataModel ?? {},
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    sessionStore.set(id, session);
    return NextResponse.json(toResponse(session), { status: 201 });
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

    const chatId = request.nextUrl.searchParams.get('chat_id');

    const results = [...sessionStore.values()].filter(
      (s) => s.userId === userId && (!chatId || s.chatId === chatId)
    );

    return NextResponse.json({ sessions: results.map(toResponse) });
  } catch (error) {
    console.error('[A2UI:sessions:GET]', error);
    return NextResponse.json({ error: 'Failed to list sessions' }, { status: 500 });
  }
}
