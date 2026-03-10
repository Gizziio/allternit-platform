/**
 * A2UI Sessions API Route
 * 
 * This route forwards to the Kernel (port 3004) for real processing.
 * Previously mocked, now integrated with actual backend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';

const KERNEL_URL = process.env.NEXT_PUBLIC_KERNEL_URL || 'http://127.0.0.1:3004';

/**
 * Safely parse JSON with error handling
 * Returns null if parsing fails, logs error for debugging
 */
function safeJSONParse<T>(json: string | null, fieldName: string, sessionId?: string): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error(`[A2UI Session] Failed to parse ${fieldName}${sessionId ? ` for session ${sessionId}` : ''}:`, error);
    console.error(`[A2UI Session] Invalid JSON content:`, json.substring(0, 200));
    return null;
  }
}

// Helper to forward to kernel
async function forwardToKernel(
  path: string,
  method: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<Response> {
  const url = `${KERNEL_URL}/v1/a2ui${path}`;
  
  return fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// GET /api/v1/a2ui/sessions - List sessions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chat_id');

    // Forward to kernel
    const query = chatId ? `?chat_id=${encodeURIComponent(chatId)}` : '';
    const response = await forwardToKernel(`/sessions${query}`, 'GET', undefined, {
      'X-User-ID': 'anonymous', // TODO: Get from auth
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Kernel error: ${error}` },
        { status: response.status }
      );
    }

    const sessions = await response.json();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('[A2UI Sessions] GET error:', error);
    
    // Fallback to local DB if kernel unavailable
    try {
      const { db } = await import('../../../../lib/db/client-sqlite');
      const { a2uiSession } = await import('../../../../lib/db/schema-sqlite');
      const { eq } = await import('drizzle-orm');
      
      const { searchParams } = new URL(request.url);
      const chatId = searchParams.get('chat_id');
      
      const sessions = await db
        .select()
        .from(a2uiSession)
        .where(chatId ? eq(a2uiSession.chatId, chatId) : undefined);
      
      // Parse stored JSON with error handling
      const parsed = sessions.map((s: { id: string; payload: string; dataModel: string; [key: string]: unknown }) => {
        const payload = safeJSONParse<Record<string, unknown>>(s.payload, 'payload', s.id);
        const dataModel = safeJSONParse<Record<string, unknown>>(s.dataModel, 'dataModel', s.id);
        
        return {
          ...s,
          payload: payload ?? {}, // Fallback to empty object
          dataModel: dataModel ?? {}, // Fallback to empty object
        };
      });
      
      return NextResponse.json({ sessions: parsed });
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to fetch sessions', details: String(fallbackError) },
        { status: 500 }
      );
    }
  }
}

// POST /api/v1/a2ui/sessions - Create session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chat_id, payload, message_id, agent_id } = body;

    // Forward to kernel
    const response = await forwardToKernel('/sessions', 'POST', {
      chat_id,
      payload,
      message_id,
      agent_id,
    }, {
      'X-User-ID': 'anonymous',
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Kernel error: ${error}` },
        { status: response.status }
      );
    }

    const session = await response.json();
    return NextResponse.json(session);
  } catch (error) {
    console.error('[A2UI Sessions] POST error:', error);
    
    // Fallback to local DB
    try {
      const { db } = await import('../../../../lib/db/client-sqlite');
      const { a2uiSession } = await import('../../../../lib/db/schema-sqlite');
      
      const body = await request.json();
      const { chat_id, payload, message_id, agent_id } = body;

      const sessionId = nanoid();
      
      const [newSession] = await db
        .insert(a2uiSession)
        .values({
          id: sessionId,
          chatId: chat_id,
          userId: 'anonymous',
          payload: JSON.stringify(payload),
          dataModel: JSON.stringify(payload.dataModel || {}),
          messageId: message_id,
          agentId: agent_id,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      const parsedPayload = safeJSONParse<Record<string, unknown>>(newSession.payload, 'payload', newSession.id);
      const parsedDataModel = safeJSONParse<Record<string, unknown>>(newSession.dataModel, 'dataModel', newSession.id);

      if (parsedPayload === null || parsedDataModel === null) {
        return NextResponse.json(
          { error: "Created session data is corrupted", sessionId: newSession.id },
          { status: 500 }
        );
      }

      return NextResponse.json({
        id: newSession.id,
        chat_id: newSession.chatId,
        payload: parsedPayload,
        dataModel: parsedDataModel,
        status: newSession.status,
        created_at: newSession.createdAt,
        updated_at: newSession.updatedAt,
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to create session', details: String(fallbackError) },
        { status: 500 }
      );
    }
  }
}
