import { NextRequest, NextResponse } from 'next/server';
import { listH5iSummaries } from '@/lib/h5i/service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { workspacePath?: string };
    const { workspacePath } = body;

    if (!workspacePath) {
      return NextResponse.json(
        { error: 'workspacePath is required' },
        { status: 400 }
      );
    }

    const result = listH5iSummaries(workspacePath);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[h5i summary list API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
