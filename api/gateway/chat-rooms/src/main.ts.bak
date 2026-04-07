/**
 * Chat Rooms Service Main Entry Point
 */

import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { createRoomStore } from './store/room-store.js';
import { createMessageStore } from './store/message-store.js';
import { registerRoutes } from './routes/index.js';
import { registerWebSocketHandler } from './websocket/index.js';

/**
 * Service configuration
 */
export interface ChatRoomsConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Create chat rooms service
 */
export function createChatRoomsService(config: Partial<ChatRoomsConfig> = {}) {
  const finalConfig: ChatRoomsConfig = {
    port: config.port || 8080,
    host: config.host || '0.0.0.0',
    corsOrigins: config.corsOrigins || ['*'],
    logLevel: config.logLevel || 'info',
  };

  const fastify = Fastify({
    logger: {
      level: finalConfig.logLevel,
    },
  });

  // Register plugins
  fastify.register(cors, {
    origin: finalConfig.corsOrigins,
  });

  fastify.register(websocket);

  // Create stores
  const roomStore = createRoomStore();
  const messageStore = createMessageStore();

  // Register routes
  registerRoutes(fastify, roomStore, messageStore);

  // Register WebSocket handler
  registerWebSocketHandler(fastify, roomStore, messageStore);

  // Start service
  const start = async () => {
    try {
      await fastify.listen({
        port: finalConfig.port,
        host: finalConfig.host,
      });
      console.log(`[ChatRooms] Service running on http://${finalConfig.host}:${finalConfig.port}`);
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  };

  // Stop service
  const stop = async () => {
    await fastify.close();
  };

  return {
    fastify,
    roomStore,
    messageStore,
    start,
    stop,
    config: finalConfig,
  };
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const service = createChatRoomsService();
  service.start();

  // Handle shutdown
  process.on('SIGINT', async () => {
    await service.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await service.stop();
    process.exit(0);
  });
}
