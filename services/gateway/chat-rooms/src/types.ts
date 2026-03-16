/**
 * Chat Rooms Types
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Chat room
 */
export interface ChatRoom {
  /** Room ID */
  id: string;
  /** Room name */
  name: string;
  /** Room description */
  description?: string;
  /** Room type */
  type: 'public' | 'private' | 'direct';
  /** Created at */
  createdAt: string;
  /** Created by */
  createdBy: string;
  /** Member IDs */
  memberIds: string[];
  /** Max members (0 = unlimited) */
  maxMembers: number;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Chat message
 */
export interface ChatMessage {
  /** Message ID */
  id: string;
  /** Room ID */
  roomId: string;
  /** Sender ID */
  senderId: string;
  /** Sender name */
  senderName: string;
  /** Sender type */
  senderType: 'human' | 'agent' | 'system';
  /** Content */
  content: string;
  /** Timestamp */
  timestamp: string;
  /** Mentions */
  mentions?: string[];
  /** Attachments */
  attachments?: Attachment[];
  /** In reply to message ID */
  inReplyTo?: string;
  /** Edited at */
  editedAt?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Attachment
 */
export interface Attachment {
  /** Attachment ID */
  id: string;
  /** Filename */
  filename: string;
  /** URL */
  url: string;
  /** Content type */
  contentType: string;
  /** Size in bytes */
  size?: number;
}

/**
 * Room member
 */
export interface RoomMember {
  /** User/agent ID */
  id: string;
  /** Display name */
  name: string;
  /** Type */
  type: 'human' | 'agent';
  /** Role in room */
  role: 'admin' | 'member' | 'observer';
  /** Joined at */
  joinedAt: string;
  /** Last seen */
  lastSeen?: string;
  /** Status */
  status: 'online' | 'offline' | 'away' | 'busy';
}

/**
 * WebSocket message types
 */
export type WSMessageType = 
  | 'message:new'
  | 'message:edit'
  | 'message:delete'
  | 'room:join'
  | 'room:leave'
  | 'member:status'
  | 'typing:start'
  | 'typing:stop';

/**
 * WebSocket message
 */
export interface WSMessage {
  /** Message type */
  type: WSMessageType;
  /** Payload */
  payload: unknown;
  /** Timestamp */
  timestamp: string;
}

/**
 * Create room request
 */
export interface CreateRoomRequest {
  /** Room name */
  name: string;
  /** Room description */
  description?: string;
  /** Room type */
  type?: 'public' | 'private';
  /** Initial member IDs */
  memberIds?: string[];
  /** Max members */
  maxMembers?: number;
}

/**
 * Send message request
 */
export interface SendMessageRequest {
  /** Message content */
  content: string;
  /** Mentions */
  mentions?: string[];
  /** In reply to */
  inReplyTo?: string;
}

/**
 * Generate room ID
 */
export function generateRoomId(): string {
  return `room_${uuidv4()}`;
}

/**
 * Generate message ID
 */
export function generateMessageId(): string {
  return `msg_${uuidv4()}`;
}
