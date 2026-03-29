// ============================================================================
// POST /api/v1/a2ui/generate
// ============================================================================
// Generates a real A2UIPayload using an LLM. No mock fallbacks.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { generateA2UIPayload } from '@/lib/ai/a2ui-generator';
import type { A2UIPayload } from '@/capsules/a2ui/a2ui.types';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await getAuth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, context } = body as {
      chat_id?: string;
      prompt: string;
      context?: {
        currentPayload?: A2UIPayload;
        dataModel?: Record<string, unknown>;
      };
    };

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const result = await generateA2UIPayload({
      prompt,
      currentPayload: context?.currentPayload,
    });

    return NextResponse.json({
      payload: result.payload,
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error('[A2UI:generate]', error);
    return NextResponse.json({ error: 'Failed to generate UI' }, { status: 500 });
  }
}
