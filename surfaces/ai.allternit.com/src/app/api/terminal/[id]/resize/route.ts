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
    const body = await request.json() as { cols?: unknown; rows?: unknown };
    const { cols, rows } = body;

    if (typeof cols !== 'number' || typeof rows !== 'number') {
      return NextResponse.json({ error: 'cols and rows must be numbers' }, { status: 400 });
    }

    const validCols = Math.max(20, Math.min(200, cols));
    const validRows = Math.max(5, Math.min(100, rows));

    ptyProcess.resize(validCols, validRows);
    return NextResponse.json({ success: true, cols: validCols, rows: validRows });
  } catch (error) {
    console.error(`[Terminal API] Error resizing session ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to resize terminal', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
