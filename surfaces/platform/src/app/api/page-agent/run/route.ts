/**
 * POST /api/page-agent/run
 *
 * Start a new page-agent task through the live Electron browser bridge.
 *
 * Body: { task: string, config?: PageAgentBridgeConfig }
 * Response: { sessionId: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasPageAgentBridgeConfig, type PageAgentBridgeConfig } from '@/lib/page-agent/config';

const THIN_CLIENT_BASE = process.env.ALLTERNIT_THIN_CLIENT_URL ?? 'http://127.0.0.1:3014';

export async function POST(req: NextRequest) {
  let body: { task?: string; config?: PageAgentBridgeConfig };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { task, config } = body;
  if (!task || typeof task !== 'string' || task.trim().length === 0) {
    return NextResponse.json({ error: '`task` is required' }, { status: 400 });
  }

  // Tell the thin-client to start the task (which relays to the extension)
  try {
    const res = await fetch(`${THIN_CLIENT_BASE}/v1/page-agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: task.trim(),
        ...(hasPageAgentBridgeConfig(config) ? { config } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      if (err.error === 'page_agent_not_connected') {
        return NextResponse.json(
          { error: 'Browser extension not connected. Open the A2R extension in Chrome.' },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: 'Failed to start page-agent task' }, { status: 502 });
    }
    const data = await res.json() as { sessionId?: string };
    if (!data.sessionId) {
      return NextResponse.json({ error: 'Page-agent bridge did not return a session id' }, { status: 502 });
    }

    return NextResponse.json({ sessionId: data.sessionId });
  } catch {
    return NextResponse.json(
      { error: 'Thin-client not reachable. Start the A2R desktop app.' },
      { status: 503 },
    );
  }
}
