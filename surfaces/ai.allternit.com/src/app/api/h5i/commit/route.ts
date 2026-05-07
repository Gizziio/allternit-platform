import { NextRequest, NextResponse } from 'next/server';
import { commitWithH5i } from '@/lib/h5i/service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as {
      workspacePath?: string;
      message?: string;
      model?: string;
      agent?: string;
      prompt?: string;
      files?: string[];
    };
    const { workspacePath, message, model, agent, prompt, files } = body;

    if (!workspacePath || !message) {
      return NextResponse.json(
        { error: 'workspacePath and message are required' },
        { status: 400 }
      );
    }

    const result = commitWithH5i(workspacePath, message, { model, agent, prompt, files });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[h5i commit API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
