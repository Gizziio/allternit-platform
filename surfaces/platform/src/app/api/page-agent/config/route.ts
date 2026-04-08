import { NextRequest, NextResponse } from 'next/server';
import { hasPageAgentBridgeConfig, type PageAgentBridgeConfig } from '@/lib/page-agent/config';

const THIN_CLIENT_BASE = process.env.ALLTERNIT_THIN_CLIENT_URL ?? 'http://127.0.0.1:3014';

export async function POST(req: NextRequest) {
  let body: { config?: PageAgentBridgeConfig };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!hasPageAgentBridgeConfig(body.config)) {
    return NextResponse.json({ error: '`config` is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${THIN_CLIENT_BASE}/v1/page-agent/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: body.config }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      if (err.error === 'page_agent_not_connected') {
        return NextResponse.json(
          { error: 'Browser extension not connected. Open the Allternit extension in Chrome.' },
          { status: 503 },
        );
      }

      return NextResponse.json(
        { error: err.error ?? 'Failed to configure page-agent task runtime.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: 'Thin-client not reachable. Start the Allternit desktop app.' },
      { status: 503 },
    );
  }
}
