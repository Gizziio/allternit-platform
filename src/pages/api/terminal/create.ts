import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'node-pty';
import os from 'os';

// Store active terminal sessions
export const terminalSessions = new Map<string, ReturnType<typeof spawn>>();

function generateSessionId(): string {
  return `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { shell = '/bin/zsh', cols = 80, rows = 24 } = req.body;
    const sessionId = generateSessionId();

    // Determine shell based on platform
    const shellName = os.platform() === 'win32' ? 'powershell.exe' : shell;
    
    // Check if shell exists, fallback to /bin/bash
    const fs = require('fs');
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

    // Handle process exit
    ptyProcess.onExit(({ exitCode }) => {
      console.log(`[Terminal API] Session ${sessionId} exited with code ${exitCode}`);
      terminalSessions.delete(sessionId);
    });

    console.log(`[Terminal API] Created session ${sessionId}`);
    
    res.status(200).json({ sessionId, shell: actualShell });
  } catch (error) {
    console.error('[Terminal API] Error creating terminal:', error);
    res.status(500).json({ 
      error: 'Failed to create terminal session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
