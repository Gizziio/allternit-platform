/**
 * GET  /api/local-brain  — probe Ollama + check whether the Local Brain model is pulled
 * POST /api/local-brain  — stream an `ollama pull` as SSE progress events
 *
 * Local Brain model: llama3.2:3b (Q4_K_M via Ollama)
 * Ollama must be running on localhost:11434 — no key required.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = 'http://localhost:11434';
const LOCAL_BRAIN_MODEL = 'llama3.2:3b';

async function fetchWithTimeout(url: string, opts?: RequestInit, ms = 3000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── GET — status check ───────────────────────────────────────────────────────

export async function GET() {
  try {
    const res = await fetchWithTimeout(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return NextResponse.json({ ollamaRunning: false, modelReady: false });

    const json = await res.json() as { models?: Array<{ name: string; size: number }> };
    const models = json.models ?? [];
    const modelReady = models.some(
      (m) => m.name === LOCAL_BRAIN_MODEL || m.name === `${LOCAL_BRAIN_MODEL}:latest`
    );

    return NextResponse.json({
      ollamaRunning: true,
      modelReady,
      modelId: LOCAL_BRAIN_MODEL,
      pulledModels: models.map((m) => m.name),
    });
  } catch {
    return NextResponse.json({ ollamaRunning: false, modelReady: false });
  }
}

// ─── POST — stream pull progress as SSE ──────────────────────────────────────

export interface LocalBrainPullEvent {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
}

export async function POST() {
  // Verify Ollama is reachable before opening the stream
  try {
    const check = await fetchWithTimeout(`${OLLAMA_BASE}/api/tags`);
    if (!check.ok) throw new Error('not ok');
  } catch {
    return NextResponse.json(
      { error: 'Ollama is not running. Install it at ollama.com then try again.' },
      { status: 503 }
    );
  }

  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: LocalBrainPullEvent) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        const pullRes = await fetch(`${OLLAMA_BASE}/api/pull`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: LOCAL_BRAIN_MODEL, stream: true }),
        });

        if (!pullRes.ok || !pullRes.body) {
          send({ status: 'error', error: 'Pull request failed' });
          controller.close();
          return;
        }

        const reader = pullRes.body.getReader();
        const dec = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              send(JSON.parse(trimmed) as LocalBrainPullEvent);
            } catch {
              // skip malformed NDJSON lines
            }
          }
        }

        send({ status: 'success' });
      } catch (err) {
        send({ status: 'error', error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
