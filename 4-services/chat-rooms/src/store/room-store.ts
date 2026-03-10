/**
 * Room Store
 * 
 * In-memory store for chat rooms.
 */

import type { ChatRoom, RoomMember } from './types.js';
import { generateRoomId } from './types.js';

/**
 * Room store
 */
export class RoomStore {
  private rooms: Map<string, ChatRoom>;
  private members: Map<string, Map<string, RoomMember>>; // roomId -> memberId -> member

  constructor() {
    this.rooms = new Map();
    this.members = new Map();
  }

  /**
   * Create room
   */
  create(room: Omit<ChatRoom, 'id' | 'createdAt'>): ChatRoom {
    const newRoom: ChatRoom = {
      ...room,
      id: generateRoomId(),
      createdAt: new Date().toISOString(),
    };
    
    this.rooms.set(newRoom.id, newRoom);
    this.members.set(newRoom.id, new Map());
    
    return newRoom;
  }

  /**
   * Get room by ID
   */
  get(roomId: string): ChatRoom | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get all rooms
   */
  getAll(): ChatRoom[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get public rooms
   */
  getPublic(): ChatRoom[] {
    return Array.from(this.rooms.values()).filter(r => r.type === 'public');
  }

  /**
   * Update room
   */
  update(roomId: string, updates: Partial<ChatRoom>): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return false;
    }
    
    Object.assign(room, updates);
    
    return true;
  }

  /**
   * Delete room
   */
  delete(roomId: string): boolean {
    const deleted = this.rooms.delete(roomId);
    this.members.delete(roomId);
    return deleted;
  }

  /**
   * Add member to room
   */
  addMember(roomId: string, member: Omit<RoomMember, 'joinedAt'>): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return false;
    }
    
    let roomMembers = this.members.get(roomId);
    
    if (!roomMembers) {
      roomMembers = new Map();
      this.members.set(roomId, roomMembers);
    }
    
    roomMembers.set(member.id, {
      ...member,
      joinedAt: new Date().toISOString(),
    });
    
    // Update room member IDs
    if (!room.memberIds.includes(member.id)) {
      room.memberIds.push(member.id);
    }
    
    return true;
  }

  /**
   * Remove member from room
   */
  removeMember(roomId: string, memberId: string): boolean {
    const roomMembers = this.members.get(roomId);
    
    if (!roomMembers) {
      return false;
    }
    
    const removed = roomMembers.delete(memberId);
    
    if (removed) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.memberIds = room.memberIds.filter(id => id !== memberId);
      }
    }
    
    return removed;
  }

  /**
   * Get room members
   */
  getMembers(roomId: string): RoomMember[] {
    const roomMembers = this.members.get(roomId);
    
    if (!roomMembers) {
      return [];
    }
    
    return Array.from(roomMembers.values());
  }

  /**
   * Get member by ID
   */
  getMember(roomId: string, memberId: string): RoomMember | null {
    const roomMembers = this.members.get(roomId);
    
    if (!roomMembers) {
      return null;
    }
    
    return roomMembers.get(memberId) || null;
  }

  /**
   * Update member status
   */
  updateMemberStatus(roomId: string, memberId: string, status: RoomMember['status']): boolean {
    const member = this.getMember(roomId, memberId);
    
    if (!member) {
      return false;
    }
    
    member.status = status;
    member.lastSeen = new Date().toISOString();
    
    return true;
  }

  /**
   * Check if user is member of room
   */
  isMember(roomId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      return false;
    }
    
    return room.memberIds.includes(userId);
  }

  /**
   * Get rooms for user
   */
  getRoomsForUser(userId: string): ChatRoom[] {
    return Array.from(this.rooms.values()).filter(
      room => room.memberIds.includes(userId) || room.type === 'public'
    );
  }

  /**
   * Clear all rooms (for testing)
   */
  clear(): void {
    this.rooms.clear();
    this.members.clear();
  }
}

/**
 * Create room store
 */
export function createRoomStore(): RoomStore {
  return new RoomStore();
}
