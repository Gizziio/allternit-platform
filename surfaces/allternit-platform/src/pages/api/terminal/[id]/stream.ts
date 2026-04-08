import type { NextApiRequest, NextApiResponse } from 'next';
import { terminalSessions } from '../create';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

  // Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Forward PTY output to SSE
  const onData = (data: string) => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'data', data })}\n\n`);
    } catch (e) {
      // Client disconnected
    }
  };

  ptyProcess.onData(onData);

  // Handle client disconnect
  req.on('close', () => {
    ptyProcess.removeListener('data', onData);
  });

  // Handle PTY exit
  ptyProcess.onExit(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'exit' })}\n\n`);
      res.end();
    } catch (e) {
      // Already closed
    }
  });
}
