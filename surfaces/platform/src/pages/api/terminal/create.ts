import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn } from 'node-pty';
import os from 'os';

// Store sessions in memory (use Redis in production)
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
    
    const shellName = os.platform() === 'win32' ? 'powershell.exe' : shell;
    const ptyProcess = spawn(shellName, [], {
      name: 'xterm-color',
      cols,
      rows,
      cwd: process.env.HOME || '/tmp',
      env: process.env,
    });

    terminalSessions.set(sessionId, ptyProcess);

    console.log(`[Terminal API] Created session: ${sessionId}`);

    // Handle process exit
    ptyProcess.onExit(() => {
      terminalSessions.delete(sessionId);
      console.log(`[Terminal API] Session exited: ${sessionId}`);
    });

    res.status(200).json({ sessionId });
  } catch (error) {
    console.error('[Terminal API] Error:', error);
    res.status(500).json({ error: 'Failed to create terminal session' });
  }
}
