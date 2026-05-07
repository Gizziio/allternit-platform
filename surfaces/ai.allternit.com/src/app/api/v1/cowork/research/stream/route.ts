import { NextResponse } from 'next/server';

const RESEARCH_BASE = process.env.COWORK_RESEARCH_URL ?? 'http://localhost:8764';

export async function POST(req: Request) {
  const body = await req.json() as { threadId?: string; message?: string; modelName?: string; thinkingEnabled?: boolean };
  const { threadId, message, modelName, thinkingEnabled } = body;

  if (!threadId || !message) {
    return NextResponse.json({ error: 'threadId and message required' }, { status: 400 });
  }

  const upstream = await fetch(`${RESEARCH_BASE}/api/threads/${threadId}/runs/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { messages: [{ role: 'user', content: message }] },
      config: {
        configurable: {
          ...(modelName ? { model_name: modelName } : {}),
          ...(thinkingEnabled !== undefined ? { thinking_enabled: thinkingEnabled } : {}),
        },
      },
      stream_mode: ['messages', 'values', 'custom'],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `Research gateway error (${upstream.status})` }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
