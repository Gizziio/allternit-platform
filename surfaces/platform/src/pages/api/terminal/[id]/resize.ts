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
    const { cols, rows } = req.body;
    
    if (typeof cols !== 'number' || typeof rows !== 'number') {
      return res.status(400).json({ error: 'cols and rows must be numbers' });
    }

    // Validate bounds
    const validCols = Math.max(20, Math.min(200, cols));
    const validRows = Math.max(5, Math.min(100, rows));

    ptyProcess.resize(validCols, validRows);
    res.status(200).json({ success: true, cols: validCols, rows: validRows });
  } catch (error) {
    console.error(`[Terminal API] Error resizing session ${sessionId}:`, error);
    res.status(500).json({ 
      error: 'Failed to resize terminal',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
