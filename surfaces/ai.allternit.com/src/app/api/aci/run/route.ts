/**
 * POST /api/aci/run
 *
 * Start a new ACI agent run using the model-agnostic generic adapter.
 * Any vision-capable model accessible via AI SDK can be used.
 *
 * Body: { goal: string, model?: string }
 *   model — AI SDK model string, e.g. 'anthropic/claude-sonnet-4.6'
 *           Defaults to ACI_DEFAULT_MODEL env var or 'anthropic/claude-sonnet-4.6'
 *
 * Response: { sessionId: string, adapterId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createSession } from '@/lib/aci/session-store';
import { startRun } from '@/lib/aci/runner';
import { createGenericAdapter } from '@/lib/aci/adapters/generic';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_MODEL =
  process.env.ACI_DEFAULT_MODEL ?? 'anthropic/claude-sonnet-4.6';

export async function POST(req: NextRequest) {
  let body: { goal?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { goal, model = DEFAULT_MODEL } = body;

  if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
    return NextResponse.json({ error: '`goal` is required' }, { status: 400 });
  }

  const adapter = createGenericAdapter({ modelId: model });
  const sessionId = randomUUID();
  const session = createSession(sessionId, goal.trim(), adapter);

  // Run loop is fire-and-forget — client subscribes via SSE
  startRun(session).catch((err) => {
    console.error(`[aci/run] session ${sessionId} crashed:`, err);
  });

  return NextResponse.json({ sessionId, adapterId: adapter.adapterId });
}
