/**
 * Terminal Session API
 * 
 * Creates a local PTY terminal session using node-pty
 */

import { NextRequest, NextResponse } from 'next/server';
import os from 'os';

// Dynamically import node-pty to handle missing native module
let spawn: typeof import('node-pty').spawn | undefined;
try {
  const nodePty = require('node-pty');
  spawn = nodePty.spawn;
} catch {
  // node-pty not available (e.g., in Vercel build environment)
  spawn = undefined;
}

// Store active sessions (in production, use Redis or database)
const sessions = new Map<string, any>();

function generateSessionId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Check if node-pty is available
  if (!spawn) {
    return NextResponse.json(
      { error: 'Terminal sessions are not available in this environment' },
      { status: 503 }
    );
  }

  try {
    const nodeId = params.id;
    const body = await request.json();
    const { 
      shell = '/bin/bash', 
      cols = 80, 
      rows = 24,
      env = {}
    } = body;

    const sessionId = generateSessionId();
    
    // Create PTY process
    const shellName = os.platform() === 'win32' ? 'powershell.exe' : shell;
    const ptyProcess = spawn(shellName, [], {
      name: 'xterm-color',
      cols,
      rows,
      cwd: process.env.HOME || '/tmp',
      env: { ...process.env, ...env },
    });

    // Store session
    sessions.set(sessionId, ptyProcess);

    console.log(`[Terminal API] Created session ${sessionId} for node ${nodeId}`);

    // Handle process exit
    ptyProcess.onExit(() => {
      sessions.delete(sessionId);
      console.log(`[Terminal API] Session ${sessionId} exited`);
    });

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error('[Terminal API] Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create terminal session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const sessionId = pathParts[pathParts.length - 1];

    const ptyProcess = sessions.get(sessionId);
    if (ptyProcess) {
      ptyProcess.kill();
      sessions.delete(sessionId);
      console.log(`[Terminal API] Closed session ${sessionId}`);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  } catch (error) {
    console.error('[Terminal API] Error closing session:', error);
    return NextResponse.json(
      { error: 'Failed to close terminal session' },
      { status: 500 }
    );
  }
}
