import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'node-pty';
import os from 'os';
import fs from 'fs';
import { terminalSessions } from '../sessions';

function generateSessionId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { shell?: string; cols?: number; rows?: number };
    const { shell = '/bin/zsh', cols = 80, rows = 24 } = body;
    const sessionId = generateSessionId();

    const shellName = os.platform() === 'win32' ? 'powershell.exe' : shell;
    const actualShell = fs.existsSync(shellName) ? shellName : '/bin/bash';

    const ptyProcess = spawn(actualShell, [], {
      name: 'xterm-color',
      cols: Math.max(20, Math.min(200, cols)),
      rows: Math.max(5, Math.min(100, rows)),
      cwd: process.env.HOME || process.cwd() || '/tmp',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      },
    });

    terminalSessions.set(sessionId, ptyProcess);

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`[Terminal API] Session ${sessionId} exited with code ${exitCode}`);
      terminalSessions.delete(sessionId);
    });

    console.log(`[Terminal API] Created session ${sessionId}`);
    return NextResponse.json({ sessionId, shell: actualShell });
  } catch (error) {
    console.error('[Terminal API] Error creating terminal:', error);
    return NextResponse.json(
      { error: 'Failed to create terminal session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
