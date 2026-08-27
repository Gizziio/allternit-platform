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
import type { GroupChat, GroupChatMember, GroupChatMessage } from './group-chat.types';

export interface GroupChatState {
  groups: Record<string, GroupChat>;
  activeGroupId: string | null;

  createGroup: (name: string, members: GroupChatMember[]) => string;
  deleteGroup: (groupId: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  setActiveGroup: (groupId: string | null) => void;
  addMessage: (groupId: string, message: Omit<GroupChat['log'][number], 'id' | 'timestamp'>) => void;
  appendLog: (groupId: string, messages: GroupChat['log']) => void;
  getGroup: (groupId: string) => GroupChat | undefined;
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

      createGroup: (name, members) => {
        const id = uniqueGroupId(name, get().groups);
        const now = new Date().toISOString();
        const group: GroupChat = {
          id,
          name,
          members,
          log: [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          groups: { ...state.groups, [id]: group },
          activeGroupId: id,
        }));
        return id;
      },

      deleteGroup: (groupId) => {
        set((state) => {
          const next = { ...state.groups };
          delete next[groupId];
          return {
            groups: next,
            activeGroupId: state.activeGroupId === groupId ? null : state.activeGroupId,
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
    }),
    {
      name: 'allternit-group-chats',
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({ groups: state.groups }),
    },
  ),
);
