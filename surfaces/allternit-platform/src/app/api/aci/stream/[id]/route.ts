/**
 * GET /api/aci/stream/[id]
 *
 * SSE stream for an active ACI run session.
 * Emits: state | screenshot | trace | error | done events.
 *
 * Client usage:
 *   const es = new EventSource(`/api/aci/stream/${sessionId}`);
 *   es.onmessage = (e) => { const event = JSON.parse(e.data); ... }
 */

import { NextRequest } from 'next/server';
import { getSession, subscribe } from '@/lib/aci/session-store';
import type { SseEvent } from '@/lib/aci/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const session = getSession(sessionId);

  if (!session) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', data: { error: 'Session not found' }, ts: Date.now() })}\n\n`,
      {
        status: 404,
        headers: { 'Content-Type': 'text/event-stream' },
      },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send current state immediately so the client isn't blank on connect
      const initial: SseEvent = {
        type: 'state',
        data: { ...session.state },
        ts: Date.now(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initial)}\n\n`));

      // Subscribe to future events
      const unsub = subscribe(sessionId, (event: SseEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

          // Close stream when run ends
          if (
            event.type === 'state' &&
            typeof event.data === 'object' &&
            event.data !== null &&
            'status' in event.data &&
            (['Done', 'Error', 'Stopped'] as string[]).includes(
              (event.data as { status: string }).status,
            )
          ) {
            const done: SseEvent = { type: 'done', data: null, ts: Date.now() };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(done)}\n\n`));
            controller.close();
            unsub();
          }
        } catch {
          unsub();
        }
      });

      // Clean up if the client disconnects
      session.abortController.signal.addEventListener('abort', () => {
        unsub();
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
