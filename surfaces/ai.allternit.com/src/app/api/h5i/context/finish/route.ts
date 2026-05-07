import { NextRequest, NextResponse } from 'next/server';
import { finishH5iContext } from '@/lib/h5i/service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { workspacePath?: string; sessionId?: string };
    const { workspacePath, sessionId } = body;

    if (!workspacePath || !sessionId) {
      return NextResponse.json(
        { error: 'workspacePath and sessionId are required' },
        { status: 400 }
      );
    }

    const result = finishH5iContext(workspacePath, sessionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[h5i context finish API] Error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
