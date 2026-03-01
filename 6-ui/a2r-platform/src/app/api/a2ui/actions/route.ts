/**
 * A2UI Actions API Route
 * 
 * This route forwards action execution to the Kernel (port 3004).
 * Handles action processing and data model updates.
 */

import { NextRequest, NextResponse } from 'next/server';

const KERNEL_URL = process.env.NEXT_PUBLIC_KERNEL_URL || 'http://127.0.0.1:3004';

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

// POST /api/v1/a2ui/actions - Execute action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, action_id, payload, data_model } = body;

    if (!session_id || !action_id) {
      return NextResponse.json(
        { error: 'session_id and action_id are required' },
        { status: 400 }
      );
    }

    // Forward to kernel
    const response = await forwardToKernel('/action', 'POST', {
      session_id,
      action_id,
      payload,
      data_model,
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

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[A2UI Actions] POST error:', error);
    
    // Fallback to local processing
    try {
      const { db } = await import('../../../../lib/db/client-sqlite');
      const { a2uiSession } = await import('../../../../lib/db/schema-sqlite');
      const { eq, and } = await import('drizzle-orm');
      
      const body = await request.json();
      const { session_id, action_id, payload, data_model } = body;

      // Get session from DB
      const [session] = await db
        .select()
        .from(a2uiSession)
        .where(and(eq(a2uiSession.id, session_id), eq(a2uiSession.userId, 'anonymous')))
        .limit(1);

      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }

      // Parse current state
      const currentPayload = JSON.parse(session.payload);
      const currentDataModel = data_model || JSON.parse(session.dataModel);

      // Process action (simple implementation)
      let newPayload = { ...currentPayload };
      let newDataModel = { ...currentDataModel };
      let actionResult: any = { success: true };

      // Handle common actions
      switch (action_id) {
        case 'submit':
        case 'click':
          // Update data model with payload
          if (payload) {
            Object.assign(newDataModel, payload);
          }
          break;
        case 'update':
          if (payload?.field && payload?.value !== undefined) {
            newDataModel[payload.field] = payload.value;
          }
          break;
        default:
          // Custom action handling
          actionResult = {
            success: true,
            action: action_id,
            timestamp: new Date().toISOString(),
          };
      }

      // Update session in DB
      await db
        .update(a2uiSession)
        .set({
          payload: JSON.stringify(newPayload),
          dataModel: JSON.stringify(newDataModel),
          updatedAt: new Date(),
        })
        .where(eq(a2uiSession.id, session_id));

      return NextResponse.json({
        success: true,
        payload: newPayload,
        dataModel: newDataModel,
        result: actionResult,
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { error: 'Failed to execute action', details: String(fallbackError) },
        { status: 500 }
      );
    }
  }
}
