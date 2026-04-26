import { NextRequest } from 'next/server';
import { terminalSessions } from '../../sessions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Session ID required' }), { status: 400 });
  }

  const ptyProcess = terminalSessions.get(id);
  if (!ptyProcess) {
    return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'connected', sessionId: id })}\n\n`)
      );

      const dataDisposable = ptyProcess.onData((data: string) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'data', data })}\n\n`)
          );
        } catch {
          // Client disconnected
        }
      });

      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':keepalive\n\n'));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 30000);

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        clearInterval(keepAliveInterval);
        dataDisposable.dispose();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
