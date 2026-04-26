import { NextRequest, NextResponse } from 'next/server';
import { initH5i } from '@/lib/h5i/service';

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

    const result = initH5i(workspacePath);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[h5i init API] Error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
