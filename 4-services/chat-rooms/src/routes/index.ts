/**
 * Chat Rooms Routes
 */

import type { FastifyInstance } from 'fastify';
import type { RoomStore } from '../store/room-store.js';
import type { MessageStore } from '../store/message-store.js';
import type { CreateRoomRequest, SendMessageRequest, ChatMessage } from '../types.js';
import { generateMessageId } from '../types.js';

/**
 * Register HTTP routes
 */
export function registerRoutes(
  fastify: FastifyInstance,
  roomStore: RoomStore,
  messageStore: MessageStore
): void {

  // Health check
  fastify.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }));

  // List rooms
  fastify.get('/api/v1/rooms', async (request, reply) => {
    const rooms = roomStore.getAll();
    return { rooms };
  });

  // Get room by ID
  fastify.get('/api/v1/rooms/:roomId', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const room = roomStore.get(roomId);
    
    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }
    
    return { room };
  });

  // Create room
  fastify.post('/api/v1/rooms', async (request, reply) => {
    const body = request.body as CreateRoomRequest;
    
    if (!body.name) {
      return reply.code(400).send({ error: 'Room name is required' });
    }
    
    const room = roomStore.create({
      name: body.name,
      description: body.description,
      type: body.type || 'public',
      memberIds: body.memberIds || [],
      maxMembers: body.maxMembers || 0,
    });
    
    return reply.code(201).send({ room });
  });

  // Get room messages
  fastify.get('/api/v1/rooms/:roomId/messages', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const { since, limit } = request.query as { since?: string; limit?: number };
    
    const room = roomStore.get(roomId);
    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }
    
    const messages = messageStore.get(roomId, { since, limit });
    return { messages };
  });

  // Send message
  fastify.post('/api/v1/rooms/:roomId/messages', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    const body = request.body as SendMessageRequest;
    
    const room = roomStore.get(roomId);
    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }
    
    if (!body.content) {
      return reply.code(400).send({ error: 'Message content is required' });
    }
    
    // Create message
    const message: ChatMessage = {
      id: generateMessageId(),
      roomId,
      senderId: 'user_current', // Would come from auth in production
      senderName: 'Current User',
      senderType: 'human',
      content: body.content,
      timestamp: new Date().toISOString(),
      mentions: body.mentions,
      inReplyTo: body.inReplyTo,
    };
    
    messageStore.add(roomId, message);
    
    // Broadcast to WebSocket clients (would be handled by WS handler)
    
    return reply.code(201).send({ message });
  });

  // Get room members
  fastify.get('/api/v1/rooms/:roomId/members', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    
    const room = roomStore.get(roomId);
    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }
    
    const members = roomStore.getMembers(roomId);
    return { members };
  });

  // Join room
  fastify.post('/api/v1/rooms/:roomId/join', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    
    const room = roomStore.get(roomId);
    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }
    
    const userId = 'user_current'; // Would come from auth
    
    roomStore.addMember(roomId, {
      id: userId,
      name: 'Current User',
      type: 'human',
      role: 'member',
      status: 'online',
    });
    
    return { success: true };
  });

  // Leave room
  fastify.post('/api/v1/rooms/:roomId/leave', async (request, reply) => {
    const { roomId } = request.params as { roomId: string };
    
    const room = roomStore.get(roomId);
    if (!room) {
      return reply.code(404).send({ error: 'Room not found' });
    }
    
    const userId = 'user_current';
    roomStore.removeMember(roomId, userId);
    
    return { success: true };
  });

  // Delete message
  fastify.delete('/api/v1/rooms/:roomId/messages/:messageId', async (request, reply) => {
    const { roomId, messageId } = request.params as { roomId: string; messageId: string };
    
    const message = messageStore.getById(messageId);
    if (!message || message.roomId !== roomId) {
      return reply.code(404).send({ error: 'Message not found' });
    }
    
    messageStore.delete(messageId);
    
    return { success: true };
  });
}
