/**
 * Bot Group Store
 *
 * Zustand store for managing bot group chats. Groups map to
 * AgentSwarm configurations, allowing multiple bots to collaborate
 * with configurable coordination strategies and consensus thresholds.
 *
 * @module bot-group-store
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import { createModuleLogger } from '@/lib/logger';
import type { SwarmRole, SwarmStrategy } from '@/lib/agents/agent-advanced.types';

const logger = createModuleLogger('BotGroup');

// ============================================================================
// Types
// ============================================================================

export interface BotGroup {
  id: string;
  name: string;
  members: BotGroupMember[];
  strategy: SwarmStrategy;
  consensusThreshold: number;
  createdAt: string;
  status: 'active' | 'paused' | 'completed';
}

export interface BotGroupMember {
  botId: string;
  botName: string;
  role: SwarmRole;
  weight: number;
  status: 'idle' | 'working' | 'responding' | 'error';
}

// ============================================================================
// State Interface
// ============================================================================

export interface BotGroupStoreState {
  groups: BotGroup[];
  activeGroupId: string | null;

  createGroup: (name: string, members: BotGroupMember[], strategy?: SwarmStrategy) => BotGroup;
  addMemberToGroup: (groupId: string, member: BotGroupMember) => void;
  removeMemberFromGroup: (groupId: string, botId: string) => void;
  setActiveGroup: (groupId: string | null) => void;
  deleteGroup: (groupId: string) => void;
  updateMemberStatus: (groupId: string, botId: string, status: BotGroupMember['status']) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function generateGroupId(): string {
  return `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Store
// ============================================================================

export const useBotGroupStore = create<BotGroupStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        groups: [],
        activeGroupId: null,

        createGroup: (
          name: string,
          members: BotGroupMember[],
          strategy: SwarmStrategy = 'collaborative',
        ): BotGroup => {
          const group: BotGroup = {
            id: generateGroupId(),
            name,
            members,
            strategy,
            consensusThreshold: 0.6,
            createdAt: new Date().toISOString(),
            status: 'active',
          };

          set(
            (state) => ({
              groups: [...state.groups, group],
            }),
            false,
            'createGroup',
          );
          logger.info(`Group created: ${name} (${members.length} members, strategy: ${strategy})`);
          return group;
        },

        addMemberToGroup: (groupId: string, member: BotGroupMember) => {
          set(
            (state) => ({
              groups: state.groups.map((g) =>
                g.id === groupId
                  ? { ...g, members: [...g.members, member] }
                  : g,
              ),
            }),
            false,
            'addMemberToGroup',
          );
          logger.info(`Member ${member.botName} added to group ${groupId}`);
        },

        removeMemberFromGroup: (groupId: string, botId: string) => {
          set(
            (state) => ({
              groups: state.groups.map((g) =>
                g.id === groupId
                  ? { ...g, members: g.members.filter((m) => m.botId !== botId) }
                  : g,
              ),
            }),
            false,
            'removeMemberFromGroup',
          );
          logger.info(`Member ${botId} removed from group ${groupId}`);
        },

        setActiveGroup: (groupId: string | null) => {
          set({ activeGroupId: groupId }, false, 'setActiveGroup');
          logger.debug(`Active group set to: ${groupId ?? 'none'}`);
        },

        deleteGroup: (groupId: string) => {
          const group = get().groups.find((g) => g.id === groupId);
          set(
            (state) => ({
              groups: state.groups.filter((g) => g.id !== groupId),
              activeGroupId:
                state.activeGroupId === groupId ? null : state.activeGroupId,
            }),
            false,
            'deleteGroup',
          );
          logger.info(`Group deleted: ${group?.name ?? groupId}`);
        },

        updateMemberStatus: (
          groupId: string,
          botId: string,
          status: BotGroupMember['status'],
        ) => {
          set(
            (state) => ({
              groups: state.groups.map((g) =>
                g.id === groupId
                  ? {
                      ...g,
                      members: g.members.map((m) =>
                        m.botId === botId ? { ...m, status } : m,
                      ),
                    }
                  : g,
              ),
            }),
            false,
            'updateMemberStatus',
          );
          logger.debug(`Member ${botId} in group ${groupId} status → ${status}`);
        },
      }),
      {
        name: 'allternit-bot-groups',
        storage: createBrowserJSONStorage(),
      },
    ),
  ),
);
