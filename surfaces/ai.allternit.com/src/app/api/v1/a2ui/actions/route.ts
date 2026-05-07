// ============================================================================
// POST /api/v1/a2ui/actions
// ============================================================================
// Executes an A2UI action. Uses the LLM to determine what dataModel
// updates the action should produce and what message to return.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';
import { getAuth } from '@/lib/server-auth';
import { getSession, saveSession } from '@/lib/a2ui-sessions';

const ActionResultSchema = z.object({
  dataModelUpdates: z.record(z.unknown()).optional().describe(
    'Partial data model updates to merge into the current state'
  ),
  message: z.string().optional().describe(
    'A short confirmation or feedback message to display to the user'
  ),
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      session_id: string;
      action_id: string;
      payload?: Record<string, unknown>;
      data_model?: Record<string, unknown>;
      context?: { chatId?: string; messageId?: string; userId?: string };
    };

    const { session_id, action_id, payload: actionPayload, data_model, context } = body;

    if (!session_id || !action_id) {
      return NextResponse.json(
        { error: 'session_id and action_id are required' },
        { status: 400 }
      );
    }

    // Fetch session payload for context if available
    const session = await getSession(session_id);
    const currentPayload = session?.payload ?? null;

    const result = await generateText({
      model: gateway('anthropic/claude-sonnet-4.6'),
      output: Output.object({ schema: ActionResultSchema }),
      system: `You are an A2UI action handler. An action was triggered in an interactive UI. \
Determine what data model updates to apply and what confirmation message to show. \
Return only the partial updates (not the full model) — they will be merged with the current state. \
Be conservative: only update what the action logically changes.`,
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            actionId: action_id,
            actionPayload: actionPayload ?? {},
            currentDataModel: data_model ?? session?.dataModel ?? {},
            uiPayload: currentPayload ?? null,
            context: context ?? {},
          }),
        },
      ],
    });

    // Persist dataModel updates back to session store
    if (session && result.output?.dataModelUpdates) {
      session.dataModel = { ...session.dataModel, ...result.output.dataModelUpdates };
      session.updatedAt = new Date().toISOString();
      await saveSession(session);
    }

    return NextResponse.json({
      success: true,
      sessionId: session_id,
      dataModelUpdates: result.output?.dataModelUpdates,
      message: result.output?.message,
    });
  } catch (error) {
    console.error('[A2UI:actions]', error);
    return NextResponse.json(
      {
        success: false,
        sessionId: '',
        error: { code: 'ACTION_FAILED', message: 'Failed to execute action' },
      },
      { status: 500 }
    );
  }
}
