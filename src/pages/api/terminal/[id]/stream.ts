import type { NextApiRequest, NextApiResponse } from 'next';
import { terminalSessions } from '../create';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // Handle data from PTY
  const dataHandler = (data: string) => {
    try {
      // Escape special characters for SSE
      const escaped = JSON.stringify({ type: 'data', data });
      res.write(`data: ${escaped}\n\n`);
    } catch (err) {
      console.error('[Terminal SSE] Error sending data:', err);
    }
  };

  ptyProcess.onData(dataHandler);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[Terminal SSE] Client disconnected from session ${sessionId}`);
    ptyProcess.offData(dataHandler);
    // Note: We don't close the PTY here - the session persists for reconnection
  });

  req.on('error', (err) => {
    console.error(`[Terminal SSE] Request error for session ${sessionId}:`, err);
    ptyProcess.offData(dataHandler);
  });

  // Keep connection alive with periodic comments
  const keepAlive = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 30000);

  // Clean up on close
  req.on('close', () => {
    clearInterval(keepAlive);
  });
}
