/**
 * CommRails Store
 *
 * Zustand store aggregating bot sessions, group chats, and automation
 * state for the CommRails left-rail surface. Persists to localStorage
 * so the rail restores across page reloads.
 *
 * @module commrails-store
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import { createModuleLogger } from '@/lib/logger';
import type {
  CommRailSection,
  BotRailItem,
  GroupRailItem,
  WIHSummary,
} from './commrails-types';
import { isSeedBotSession } from './commrails-visibility';

const logger = createModuleLogger('CommRails');

// ============================================================================
// State Interface
// ============================================================================

export interface CommRailsState {
  // Bot sessions
  activeBotSessions: BotRailItem[];

  // Group chats
  activeGroups: GroupRailItem[];

  // WIH summaries keyed by botId
  wihSummaries: Record<string, WIHSummary>;

  // Actions
  addBotSession: (item: BotRailItem) => void;
  removeBotSession: (botId: string) => void;
  updateBotSessionStatus: (botId: string, status: BotRailItem['status']) => void;
  addGroup: (item: GroupRailItem) => void;
  removeGroup: (groupId: string) => void;
  updateWIHSummary: (botId: string, summary: WIHSummary) => void;
  getSections: () => CommRailSection[];
}

export function dropSeedBotSessions(items: BotRailItem[]): BotRailItem[] {
  return items.filter((item) => !isSeedBotSession(item.id, item.botId));
}

// ============================================================================
// Store
// ============================================================================

export const useCommRailsStore = create<CommRailsState>()(
  devtools(
    persist(
      (set, get) => ({
        activeBotSessions: [],
        activeGroups: [],
        wihSummaries: {},

        // ------ Bot Sessions ------

        addBotSession: (item: BotRailItem) => {
          set(
            (state) => ({
              activeBotSessions: [...state.activeBotSessions, item],
            }),
            false,
            'addBotSession',
          );
          logger.info(`Bot session added: ${item.label}`);
        },

        removeBotSession: (botId: string) => {
          set(
            (state) => ({
              activeBotSessions: state.activeBotSessions.filter(
                (s) => s.botId !== botId,
              ),
            }),
            false,
            'removeBotSession',
          );
          logger.info(`Bot session removed: ${botId}`);
        },

        updateBotSessionStatus: (botId: string, status: BotRailItem['status']) => {
          set(
            (state) => ({
              activeBotSessions: state.activeBotSessions.map((s) =>
                s.botId === botId ? { ...s, status } : s,
              ),
            }),
            false,
            'updateBotSessionStatus',
          );
          logger.debug(`Bot ${botId} status → ${status}`);
        },

        // ------ Groups ------

        addGroup: (item: GroupRailItem) => {
          set(
            (state) => ({
              activeGroups: [...state.activeGroups, item],
            }),
            false,
            'addGroup',
          );
          logger.info(`Group added: ${item.label}`);
        },

        removeGroup: (groupId: string) => {
          set(
            (state) => ({
              activeGroups: state.activeGroups.filter(
                (g) => g.groupId !== groupId,
              ),
            }),
            false,
            'removeGroup',
          );
          logger.info(`Group removed: ${groupId}`);
        },

        // ------ WIH Summaries ------

        updateWIHSummary: (botId: string, summary: WIHSummary) => {
          set(
            (state) => ({
              wihSummaries: { ...state.wihSummaries, [botId]: summary },
            }),
            false,
            'updateWIHSummary',
          );
          logger.debug(`WIH summary updated for bot: ${botId}`);
        },

        // ------ Section Builder ------

        getSections: (): CommRailSection[] => {
          const { activeBotSessions, activeGroups } = get();

          const botsSection: CommRailSection = {
            id: 'comrails-bots',
            title: 'Bots',
            type: 'bots',
            items: activeBotSessions,
            isDynamic: true,
            defaultExpanded: true,
            collapsible: true,
          };

          const groupsSection: CommRailSection = {
            id: 'comrails-groups',
            title: 'Groups',
            type: 'groups',
            items: activeGroups,
            isDynamic: true,
            defaultExpanded: false,
            collapsible: true,
          };

          return [botsSection, groupsSection];
        },
      }),
      {
        name: 'allternit-comrails',
        storage: createBrowserJSONStorage(),
        merge: (persisted, current) => {
          const incoming = (persisted ?? {}) as Partial<CommRailsState>;
          const sessions = dropSeedBotSessions(incoming.activeBotSessions ?? []);
          return {
            ...current,
            ...incoming,
            activeBotSessions: sessions,
          };
        },
      },
    ),
  ),
);
