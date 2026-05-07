/**
 * Standalone tldraw multiplayer sync server.
 *
 * Uses @tldraw/sync-core's TLSocketRoom to manage per-room CRDT state.
 * Rooms are identified by the `roomId` query param on the WebSocket URL.
 *
 * Run:  node scripts/tldraw-sync-server.mjs
 * Env:  TLDRAW_SYNC_PORT   (default: 5858)
 *
 * Rooms are kept in memory; they are created on first connection and garbage-
 * collected 60 seconds after the last session leaves.
 */

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { TLSocketRoom } from '@tldraw/sync-core';

const PORT = Number(process.env.TLDRAW_SYNC_PORT ?? 5858);

// roomId → { room: TLSocketRoom, gcTimer: NodeJS.Timeout | null }
const rooms = new Map();

function getRoom(roomId) {
  let entry = rooms.get(roomId);
  if (!entry) {
    const room = new TLSocketRoom({
      onDataChange() {
        // persist to DB here if desired
      },
      onSessionRemoved(_room, { sessionId }) {
        console.log(`[sync] session left  room=${roomId} session=${sessionId} remaining=${room.getNumSessions()}`);
        scheduleGC(roomId);
      },
    });
    entry = { room, gcTimer: null };
    rooms.set(roomId, entry);
    console.log(`[sync] room created  room=${roomId}`);
  }
  // Cancel any pending GC — someone is active
  if (entry.gcTimer) {
    clearTimeout(entry.gcTimer);
    entry.gcTimer = null;
  }
  return entry.room;
}

function scheduleGC(roomId) {
  const entry = rooms.get(roomId);
  if (!entry || entry.room.getNumSessions() > 0) return;
  entry.gcTimer = setTimeout(() => {
    rooms.delete(roomId);
    console.log(`[sync] room disposed  room=${roomId}`);
  }, 60_000);
}

// ─── HTTP + WebSocket server ──────────────────────────────────────────────────

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('tldraw sync server OK\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', `http://localhost`);
  const roomId = url.searchParams.get('roomId') ?? url.pathname.split('/').pop() ?? 'default';
  const sessionId = url.searchParams.get('sessionId') ?? crypto.randomUUID();

  const room = getRoom(roomId);
  console.log(`[sync] session joined room=${roomId} session=${sessionId}`);

  const session = room.handleNewSession({
    sessionId,
    socket: {
      sendMessage(msg) {
        if (ws.readyState === ws.OPEN) {
          ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
        }
      },
      close() {
        ws.close();
      },
    },
    isReadonly: false,
    onClose() {
      // handled by ws 'close' event below
    },
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      session.receive(msg);
    } catch {
      // ignore malformed messages
    }
  });

  ws.on('close', () => {
    try { session.close(); } catch { /* already closed */ }
  });

  ws.on('error', (err) => {
    console.error(`[sync] ws error room=${roomId} session=${sessionId}`, err.message);
    try { session.close(); } catch { /* ignore */ }
  });
});

server.listen(PORT, () => {
  console.log(`[sync] tldraw sync server listening on ws://localhost:${PORT}`);
  console.log(`[sync] connect via: ws://localhost:${PORT}/connect?roomId=<id>`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => { server.close(); process.exit(0); });
