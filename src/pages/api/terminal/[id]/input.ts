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
    const { data } = req.body;
    
    if (typeof data !== 'string') {
      return res.status(400).json({ error: 'Data must be a string' });
    }

    ptyProcess.write(data);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[Terminal API] Error writing to session ${sessionId}:`, error);
    res.status(500).json({ 
      error: 'Failed to write to terminal',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
