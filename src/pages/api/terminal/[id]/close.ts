import type { NextApiRequest, NextApiResponse } from 'next';
import { terminalSessions } from '../create';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const sessionId = Array.isArray(id) ? id[0] : id;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID required' });
  }

  const ptyProcess = terminalSessions.get(sessionId);
  if (!ptyProcess) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    ptyProcess.kill();
    terminalSessions.delete(sessionId);
    console.log(`[Terminal API] Closed session ${sessionId}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[Terminal API] Error closing session ${sessionId}:`, error);
    res.status(500).json({ 
      error: 'Failed to close terminal',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
