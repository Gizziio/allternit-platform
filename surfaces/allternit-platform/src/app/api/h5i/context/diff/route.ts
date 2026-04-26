import { NextRequest, NextResponse } from 'next/server';
import { diffH5iContext } from '@/lib/h5i/service';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { workspacePath?: string; sessionA?: string; sessionB?: string };
    const { workspacePath, sessionA, sessionB } = body;

    if (!workspacePath || !sessionA || !sessionB) {
      return NextResponse.json(
        { error: 'workspacePath, sessionA, and sessionB are required' },
        { status: 400 }
      );
    }

    const result = diffH5iContext(workspacePath, sessionA, sessionB);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[h5i context diff API] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
