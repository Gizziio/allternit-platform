import { NextRequest, NextResponse } from 'next/server';
import { installAgentHooks } from '@/lib/h5i/service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { workspacePath?: string; agents?: string[] };
    const { workspacePath, agents } = body;

    if (!workspacePath) {
      return NextResponse.json(
        { error: 'workspacePath is required' },
        { status: 400 }
      );
    }

    const result = installAgentHooks(workspacePath, agents ?? []);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[h5i agent-hooks API] Error:', error);
    return NextResponse.json(
      { success: false, errors: [error instanceof Error ? error.message : 'Unknown error'] },
      { status: 500 }
    );
  }
}
