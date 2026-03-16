/**
 * Message Store
 * 
 * In-memory store for chat messages.
 */

import type { ChatMessage } from './types.js';

/**
 * Message store
 */
export class MessageStore {
  private messages: Map<string, ChatMessage[]>; // roomId -> messages
  private messageIndex: Map<string, ChatMessage>; // messageId -> message

  constructor() {
    this.messages = new Map();
    this.messageIndex = new Map();
  }

  /**
   * Add message to room
   */
  add(roomId: string, message: ChatMessage): void {
    let roomMessages = this.messages.get(roomId);
    
    if (!roomMessages) {
      roomMessages = [];
      this.messages.set(roomId, roomMessages);
    }
    
    roomMessages.push(message);
    this.messageIndex.set(message.id, message);
    
    // Keep only last 1000 messages per room
    if (roomMessages.length > 1000) {
      const removed = roomMessages.shift();
      if (removed) {
        this.messageIndex.delete(removed.id);
      }
    }
  }

  /**
   * Get messages from room
   */
  get(roomId: string, options?: { since?: string; limit?: number }): ChatMessage[] {
    const roomMessages = this.messages.get(roomId) || [];
    
    let result = [...roomMessages];
    
    // Filter by since
    if (options?.since) {
      const sinceTime = new Date(options.since).getTime();
      result = result.filter(m => new Date(m.timestamp).getTime() > sinceTime);
    }
    
    // Apply limit
    if (options?.limit) {
      result = result.slice(-options.limit);
    }
    
    return result;
  }

  /**
   * Get message by ID
   */
  getById(messageId: string): ChatMessage | null {
    return this.messageIndex.get(messageId) || null;
  }

  /**
   * Update message
   */
  update(messageId: string, updates: Partial<ChatMessage>): boolean {
    const message = this.messageIndex.get(messageId);
    
    if (!message) {
      return false;
    }
    
    Object.assign(message, updates);
    message.editedAt = new Date().toISOString();
    
    return true;
  }

  /**
   * Delete message
   */
  delete(messageId: string): boolean {
    const message = this.messageIndex.get(messageId);
    
    if (!message) {
      return false;
    }
    
    const roomMessages = this.messages.get(message.roomId);
    
    if (roomMessages) {
      const index = roomMessages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        roomMessages.splice(index, 1);
      }
    }
    
    this.messageIndex.delete(messageId);
    
    return true;
  }

  /**
   * Get message count for room
   */
  getCount(roomId: string): number {
    return this.messages.get(roomId)?.length || 0;
  }

  /**
   * Clear all messages (for testing)
   */
  clear(): void {
    this.messages.clear();
    this.messageIndex.clear();
  }

  /**
   * Get recent messages across all rooms
   */
  getRecent(limit: number = 50): ChatMessage[] {
    const allMessages: ChatMessage[] = [];
    
    for (const messages of this.messages.values()) {
      allMessages.push(...messages);
    }
    
    // Sort by timestamp descending
    allMessages.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return allMessages.slice(0, limit);
  }
}

/**
 * Create message store
 */
export function createMessageStore(): MessageStore {
  return new MessageStore();
}
