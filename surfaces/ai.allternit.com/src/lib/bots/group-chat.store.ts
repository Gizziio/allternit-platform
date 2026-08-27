/**
 * Group Chat Store
 *
 * Persists bot group chats and tracks the active room. Each group has a unique
 * id derived from its name, 2-6 members, and a chronological message log.
 *
 * @module group-chat.store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import type { GroupChat, GroupChatMember, GroupChatMessage, GroupChatMetadata } from './group-chat.types';

export interface GroupChatState {
  groups: Record<string, GroupChat>;
  activeGroupId: string | null;
  /** Per-group ISO timestamp of the last time the user read the channel. */
  lastReadAt: Record<string, string>;

  createGroup: (name: string, members: GroupChatMember[], metadata?: GroupChatMetadata) => string;
  deleteGroup: (groupId: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  updateGroup: (groupId: string, updates: Partial<Pick<GroupChat, 'name' | 'members' | 'image'>> & { metadata?: GroupChatMetadata }) => void;
  setActiveGroup: (groupId: string | null) => void;
  addMessage: (groupId: string, message: Omit<GroupChat['log'][number], 'id' | 'timestamp'>) => void;
  appendLog: (groupId: string, messages: GroupChat['log']) => void;
  getGroup: (groupId: string) => GroupChat | undefined;
  markGroupRead: (groupId: string) => void;
  getUnreadCount: (groupId: string) => number;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function uniqueGroupId(name: string, existing: Record<string, GroupChat>): string {
  const base = slugify(name) || 'group';
  if (!existing[base]) return base;

  let suffix = 2;
  while (existing[`${base}-${suffix}`]) {
    suffix++;
  }
  return `${base}-${suffix}`;
}

export const useGroupChatStore = create<GroupChatState>()(
  persist(
    (set, get) => ({
      groups: {},
      activeGroupId: null,
      lastReadAt: {},

      createGroup: (name, members, metadata) => {
        const id = uniqueGroupId(name, get().groups);
        const now = new Date().toISOString();
        const group: GroupChat = {
          id,
          name,
          members,
          log: [],
          metadata,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          groups: { ...state.groups, [id]: group },
          activeGroupId: id,
          lastReadAt: { ...state.lastReadAt, [id]: now },
        }));
        return id;
      },

      deleteGroup: (groupId) => {
        set((state) => {
          const nextGroups = { ...state.groups };
          delete nextGroups[groupId];
          const nextLastRead = { ...state.lastReadAt };
          delete nextLastRead[groupId];
          return {
            groups: nextGroups,
            activeGroupId: state.activeGroupId === groupId ? null : state.activeGroupId,
            lastReadAt: nextLastRead,
          };
        });
      },

      renameGroup: (groupId, name) => {
        set((state) => {
          const group = state.groups[groupId];
          if (!group) return state;
          return {
            groups: {
              ...state.groups,
              [groupId]: { ...group, name, updatedAt: new Date().toISOString() },
            },
          };
        });
      },

      updateGroup: (groupId, updates) => {
        const now = new Date().toISOString();
        set((state) => {
          const group = state.groups[groupId];
          if (!group) return state;
          return {
            groups: {
              ...state.groups,
              [groupId]: {
                ...group,
                ...(updates.name !== undefined && { name: updates.name }),
                ...(updates.members !== undefined && { members: updates.members }),
                ...(updates.image !== undefined && { image: updates.image }),
                ...(updates.metadata !== undefined && { metadata: { ...group.metadata, ...updates.metadata } }),
                updatedAt: now,
              },
            },
          };
        });
      },

      setActiveGroup: (groupId) => set({ activeGroupId: groupId }),

      addMessage: (groupId, message) => {
        const now = new Date().toISOString();
        const entry: GroupChatMessage = {
          ...message,
          id: `gcm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: now,
        };
        set((state) => {
          const group = state.groups[groupId];
          if (!group) return state;
          return {
            groups: {
              ...state.groups,
              [groupId]: {
                ...group,
                log: [...group.log, entry],
                updatedAt: now,
              },
            },
          };
        });
      },

      appendLog: (groupId, messages) => {
        const now = new Date().toISOString();
        set((state) => {
          const group = state.groups[groupId];
          if (!group) return state;
          return {
            groups: {
              ...state.groups,
              [groupId]: {
                ...group,
                log: [...group.log, ...messages],
                updatedAt: now,
              },
            },
          };
        });
      },

      getGroup: (groupId) => get().groups[groupId],

      markGroupRead: (groupId) => {
        const now = new Date().toISOString();
        set((state) => ({
          lastReadAt: { ...state.lastReadAt, [groupId]: now },
        }));
      },

      getUnreadCount: (groupId) => {
        const group = get().groups[groupId];
        if (!group) return 0;
        const lastRead = get().lastReadAt[groupId];
        if (!lastRead) return group.log.length;
        const lastReadTime = new Date(lastRead).getTime();
        return group.log.filter((m) => new Date(m.timestamp).getTime() > lastReadTime).length;
      },
    }),
    {
      name: 'allternit-group-chats',
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({ groups: state.groups, lastReadAt: state.lastReadAt }),
    },
  ),
);
