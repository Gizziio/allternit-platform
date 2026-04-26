import { NextRequest, NextResponse } from 'next/server';
import { getH5iContextTrace } from '@/lib/h5i/service';

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

    const result = getH5iContextTrace(workspacePath, sessionId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[h5i context trace API] Error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
