/**
 * Cowork Session SSE Stream
 * 
 * Server-Sent Events for real-time cowork collaboration
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth-sqlite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_GATEWAY_URL = process.env.A2R_GATEWAY_URL || 'http://127.0.0.1:3210';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { sessionId } = params;
    
    // Create SSE stream
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial connection event
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ sessionId, timestamp: Date.now() })}\n\n`)
        );
        
        // Connect to Gateway WebSocket for this session
        const wsUrl = `${DEFAULT_GATEWAY_URL.replace('http', 'ws')}/ws/cowork/${sessionId}`;
        
        try {
          const ws = new WebSocket(wsUrl);
          
          ws.onopen = () => {
            console.log(`[Cowork SSE] Connected to Gateway for session: ${sessionId}`);
          };
          
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              // Forward Gateway events as SSE
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
              );
            } catch (e) {
              console.error('[Cowork SSE] Failed to parse WebSocket message:', e);
            }
          };
          
          ws.onerror = (error) => {
            console.error('[Cowork SSE] WebSocket error:', error);
            controller.enqueue(
              encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Connection failed' })}\n\n`)
            );
          };
          
          ws.onclose = () => {
            console.log(`[Cowork SSE] Gateway connection closed for session: ${sessionId}`);
            controller.close();
          };
          
          // Handle client disconnect
          req.signal.addEventListener('abort', () => {
            console.log(`[Cowork SSE] Client disconnected from session: ${sessionId}`);
            ws.close();
            controller.close();
          });
          
        } catch (error) {
          console.error('[Cowork SSE] Failed to connect to Gateway:', error);
          // Send mock events for development
          const mockEvents = [
            { type: 'cowork.session.start', sessionId, timestamp: Date.now() },
            { type: 'cowork.observation', content: 'Connected to cowork session (mock mode)' },
          ];
          
          for (const event of mockEvents) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
          
          // Keep connection alive with heartbeat
          const heartbeat = setInterval(() => {
            controller.enqueue(encoder.encode(`:heartbeat\n\n`));
          }, 30000);
          
          req.signal.addEventListener('abort', () => {
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
  } catch (error) {
    console.error('[Cowork SSE] Error:', error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
