import { NextRequest, NextResponse } from 'next/server';
import { getH5iStatus } from '@/lib/h5i/service';

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

    const status = getH5iStatus(workspacePath);
    return NextResponse.json(status);
  } catch (error) {
    console.error('[h5i status API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
