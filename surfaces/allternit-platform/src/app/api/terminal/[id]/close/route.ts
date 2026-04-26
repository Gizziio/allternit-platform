import { NextRequest, NextResponse } from 'next/server';
import { terminalSessions } from '../../sessions';

export async function POST(
  _request: NextRequest,
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
    ptyProcess.kill();
    terminalSessions.delete(id);
    console.log(`[Terminal API] Closed session ${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[Terminal API] Error closing session ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to close terminal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
