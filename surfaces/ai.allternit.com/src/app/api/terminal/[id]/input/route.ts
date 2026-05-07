import { NextRequest, NextResponse } from 'next/server';
import { terminalSessions } from '../../sessions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  const ptyProcess = terminalSessions.get(id);
  if (!ptyProcess) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  try {
    const body = await request.json() as { data?: unknown };
    const { data } = body;

    if (typeof data !== 'string') {
      return NextResponse.json({ error: 'Data must be a string' }, { status: 400 });
    }

    ptyProcess.write(data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[Terminal API] Error writing to session ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to write to terminal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
