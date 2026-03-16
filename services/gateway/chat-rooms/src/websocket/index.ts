/**
 * WebSocket Handler
 */

import type { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';
import type { RoomStore } from '../store/room-store.js';
import type { MessageStore } from '../store/message-store.js';
import type { WSMessage } from '../types.js';

/**
 * WebSocket client connection
 */
interface WSClient {
  conn: SocketStream;
  roomId: string | null;
  userId: string;
}

/**
 * Register WebSocket handler
 */
export function registerWebSocketHandler(
  fastify: FastifyInstance,
  roomStore: RoomStore,
  messageStore: MessageStore
): void {

  const clients: Map<string, WSClient[]> = new Map(); // roomId -> clients

  fastify.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, async (connection, req) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const wsClient: WSClient = {
        conn: connection,
        roomId: null,
        userId: clientId,
      };

      console.log(`[WS] Client connected: ${clientId}`);

      // Handle incoming messages
      connection.socket.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString()) as WSMessage;
          await handleWSMessage(message, wsClient, clients, roomStore, messageStore, connection);
        } catch (error) {
          console.error('[WS] Error parsing message:', error);
        }
      });

      // Handle disconnect
      connection.socket.on('close', () => {
        console.log(`[WS] Client disconnected: ${clientId}`);
        
        // Remove from all rooms
        for (const [roomId, roomClients] of clients.entries()) {
          const index = roomClients.findIndex(c => c.userId === clientId);
          if (index !== -1) {
            roomClients.splice(index, 1);
          }
        }
      });
    });
  });
}

/**
 * Handle WebSocket message
 */
async function handleWSMessage(
  message: WSMessage,
  client: WSClient,
  clients: Map<string, WSClient[]>,
  roomStore: RoomStore,
  messageStore: MessageStore,
  connection: SocketStream
): Promise<void> {
  switch (message.type) {
    case 'room:join': {
      const payload = message.payload as { roomId: string };
      client.roomId = payload.roomId;
      
      // Add to room clients
      let roomClients = clients.get(payload.roomId);
      if (!roomClients) {
        roomClients = [];
        clients.set(payload.roomId, roomClients);
      }
      roomClients.push(client);
      
      // Broadcast join
      broadcastToRoom(payload.roomId, {
        type: 'room:join',
        payload: { userId: client.userId },
        timestamp: new Date().toISOString(),
      }, clients, connection);
      
      break;
    }
    
    case 'room:leave': {
      if (client.roomId) {
        const roomId = client.roomId;
        const roomClients = clients.get(roomId);
        
        if (roomClients) {
          const index = roomClients.findIndex(c => c.userId === client.userId);
          if (index !== -1) {
            roomClients.splice(index, 1);
          }
        }
        
        client.roomId = null;
        
        broadcastToRoom(roomId, {
          type: 'room:leave',
          payload: { userId: client.userId },
          timestamp: new Date().toISOString(),
        }, clients, connection);
      }
      
      break;
    }
    
    case 'message:new': {
      if (!client.roomId) {
        sendError(connection, 'Not in a room');
        return;
      }
      
      const payload = message.payload as { content: string; mentions?: string[] };
      
      // Message would be saved and broadcast in production
      console.log(`[WS] New message in ${client.roomId}: ${payload.content}`);
      
      break;
    }
  }
}

/**
 * Broadcast message to room
 */
function broadcastToRoom(
  roomId: string,
  message: WSMessage,
  clients: Map<string, WSClient[]>,
  excludeConnection?: SocketStream
): void {
  const roomClients = clients.get(roomId);
  
  if (!roomClients) {
    return;
  }
  
  const data = JSON.stringify(message);
  
  for (const client of roomClients) {
    if (client.conn !== excludeConnection) {
      client.conn.socket.send(data);
    }
  }
}

/**
 * Send error message
 */
function sendError(connection: SocketStream, error: string): void {
  connection.socket.send(JSON.stringify({
    type: 'error',
    payload: { error },
    timestamp: new Date().toISOString(),
  }));
}
