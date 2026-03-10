/**
 * A2UI Session Events API Route
 * 
 * Server-sent events for real-time A2UI updates.
 * Connects to Kernel event stream (port 3004).
 * 
 * Usage: /api/v1/a2ui/events?session_id=xxx
 */

import { NextRequest } from 'next/server';

const KERNEL_URL = process.env.NEXT_PUBLIC_KERNEL_URL || 'http://127.0.0.1:3004';

// GET /api/v1/a2ui/events?session_id=xxx - Event stream
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return new Response('session_id is required', { status: 400 });
  }

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Connect to kernel event stream
        const response = await fetch(
          `${KERNEL_URL}/v1/a2ui/sessions/${sessionId}/events`,
          {
            headers: {
              'Accept': 'text/event-stream',
              'X-User-ID': 'anonymous',
            },
          }
        );

        if (!response.ok) {
          // Fallback: Send initial event and keep connection alive
          controller.enqueue(
            encoder.encode(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`)
          );
          
          // Send periodic heartbeat
          const heartbeat = setInterval(() => {
            controller.enqueue(
              encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`)
            );
          }, 30000);
          
          // Close on abort
          request.signal.addEventListener('abort', () => {
            clearInterval(heartbeat);
            controller.close();
          });
          
          return;
        }

        // Pipe kernel events to client
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        // Forward data from kernel to client
        const pump = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch (err) {
            console.error('[A2UI Events] Pump error:', err);
          } finally {
            controller.close();
          }
        };

        pump();

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          reader.cancel().catch((error) => {
            console.error('[A2UI Events] Failed to cancel reader:', error);
          });
        });
      } catch (error) {
        console.error('[A2UI Events] Error:', error);
        
        // Fallback: Simple heartbeat stream
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ sessionId, fallback: true })}\n\n`)
        );
        
        const heartbeat = setInterval(() => {
          controller.enqueue(
            encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`)
          );
        }, 30000);
        
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat);
          controller.close();
        });
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
