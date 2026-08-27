/**
 * Bot AllternitBus Manager
 *
 * Manages an AllternitBus messaging client per bot. When a bot has
 * `messagingConfig.photonEnabled === true`, this manager creates a client
 * using the bot's id as its identity, connects to the configured bus gateway,
 * and exposes send/subscribe helpers for cross-surface session handoff,
 * bot-to-bot direct messages, and cloud runtime events.
 *
 * @module bot-allternit-bus
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import { createAllternitBusClient } from '@/lib/messaging/allternit-bus.service';

enableMapSet();
import type { AllternitBusClient, AllternitBusEnvelope } from '@/lib/messaging/allternit-bus.types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BotAllternitBus');

export interface BotAllternitBusState {
  clients: Map<string, AllternitBusClient>;
  statuses: Map<string, 'connecting' | 'connected' | 'disconnected' | 'error'>;
  lastEnvelope: Map<string, AllternitBusEnvelope>;

  ensureClient: (botId: string, baseUrl?: string, token?: string) => AllternitBusClient;
  connect: (botId: string) => void;
  disconnect: (botId: string) => void;
  send: (
    botId: string,
    to: string,
    topic: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  subscribe: (
    botId: string,
    topic: string,
    handler: (envelope: AllternitBusEnvelope) => void,
  ) => () => void;
  getStatus: (botId: string) => 'connecting' | 'connected' | 'disconnected' | 'error';
}

function getDefaultBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return (
    (window as any).ALLTERNIT_PHOTON_URL ||
    process.env.NEXT_PUBLIC_PHOTON_URL ||
    window.location.origin
  );
}

export const useBotAllternitBusStore = create<BotAllternitBusState>()(
  immer((set, get) => ({
  clients: new Map(),
  statuses: new Map(),
  lastEnvelope: new Map(),

  ensureClient: (botId: string, baseUrl?: string, token?: string) => {
    const existing = get().clients.get(botId);
    if (existing) return existing;

    const url = baseUrl || getDefaultBaseUrl();
    const client = createAllternitBusClient({
      baseUrl: url,
      identity: botId,
      token,
      defaultTopic: `bot:${botId}`,
    });

    set((state) => {
      state.clients.set(botId, client);
      state.statuses.set(botId, 'disconnected');
    });

    return client;
  },

  connect: (botId: string) => {
    const client = get().ensureClient(botId);
    set((state) => {
      state.statuses.set(botId, 'connecting');
    });

    try {
      client.connect();
      // EventSource connected state is async; we poll briefly for status
      const check = setInterval(() => {
        if (client.connected) {
          set((state) => {
            state.statuses.set(botId, 'connected');
          });
          clearInterval(check);
        }
      }, 250);

      // Timeout the connection attempt after 5s
      setTimeout(() => {
        clearInterval(check);
        if (!client.connected) {
          set((state) => {
            state.statuses.set(botId, 'error');
          });
        }
      }, 5000);
    } catch (err) {
      logger.error({ err, botId }, 'Failed to connect AllternitBus client');
      set((state) => {
        state.statuses.set(botId, 'error');
      });
    }
  },

  disconnect: (botId: string) => {
    const client = get().clients.get(botId);
    if (!client) return;

    client.disconnect();
    set((state) => {
      state.statuses.set(botId, 'disconnected');
      state.clients.delete(botId);
      state.lastEnvelope.delete(botId);
    });
  },

  send: async (botId: string, to: string, topic: string, payload: Record<string, unknown>) => {
    const client = get().ensureClient(botId);
    await client.send(to, topic, payload);
    logger.debug({ botId, to, topic }, 'AllternitBus message sent');
  },

  subscribe: (botId: string, topic: string, handler: (envelope: AllternitBusEnvelope) => void) => {
    const client = get().ensureClient(botId);
    const unsubscribe = client.subscribe(topic, (envelope) => {
      set((state) => {
        state.lastEnvelope.set(botId, envelope);
      });
      handler(envelope);
    });
    return unsubscribe;
  },

  getStatus: (botId: string) => {
    return get().statuses.get(botId) || 'disconnected';
  },
})),
);

/**
 * React hook for a single bot's AllternitBus status.
 */
export function useBotAllternitBusStatus(botId: string | undefined): BotAllternitBusState['statuses'] extends Map<string, infer V> ? V : never {
  return useBotAllternitBusStore((state) => (botId ? state.statuses.get(botId) : 'disconnected')) as any;
}
