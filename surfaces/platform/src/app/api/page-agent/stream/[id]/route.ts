/**
 * GET /api/page-agent/stream/[id]
 *
 * SSE stream for the live Electron browser bridge.
 * Emits raw RemoteMessage events from the extension-compatible runtime:
 *   { id, type: 'status'|'activity'|'history'|'done'|'error', payload, timestamp }
 *
 * Client usage:
 *   const es = new EventSource(`/api/page-agent/stream/${sessionId}`);
 *   es.onmessage = (e) => { const msg = JSON.parse(e.data); ... }
 */

import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const THIN_CLIENT_BASE = process.env.A2R_THIN_CLIENT_URL ?? 'http://127.0.0.1:3014';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params;

  let upstream: Response;
  try {
    upstream = await fetch(`${THIN_CLIENT_BASE}/v1/page-agent/stream`, {
      headers: { Accept: 'text/event-stream' },
      signal: req.signal,
      cache: 'no-store',
    });
  } catch (error) {
    return new Response(
      `data: ${JSON.stringify({
        id: '',
        type: 'error',
        payload: {
          message: error instanceof Error ? error.message : 'Failed to connect to the page-agent stream',
        },
        timestamp: Date.now(),
      })}\n\n`,
      {
        status: 502,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      },
    );
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(
      `data: ${JSON.stringify({
        id: '',
        type: 'error',
        payload: { message: `Failed to connect to page-agent stream: ${upstream.status}` },
        timestamp: Date.now(),
      })}\n\n`,
      {
        status: upstream.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      },
    );
  }

  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      const abort = () => {
        try {
          reader.cancel();
        } catch {}
      };

      req.signal.addEventListener('abort', abort, { once: true });

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            controller.enqueue(value);
          }
        }
      } catch (error) {
        if (!req.signal.aborted) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            id: '',
            type: 'error',
            payload: {
              message: error instanceof Error ? error.message : 'The page-agent stream was interrupted',
            },
            timestamp: Date.now(),
          })}\n\n`));
        }
      } finally {
        req.signal.removeEventListener('abort', abort);
        try { controller.close(); } catch {}
        reader.releaseLock();
      }
    },
    cancel() {
      try {
        reader.cancel();
      } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
