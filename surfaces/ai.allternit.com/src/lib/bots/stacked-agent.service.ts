/**
 * Stacked Agent Service
 *
 * Polls registered AgentStackProviders and exposes their external agents as
 * synthetic Allternit `Agent` records. These agents are kept separate from the
 * persisted agent API and merged into the UI at the roster/composer layer.
 *
 * @module stacked-agent.service
 */

import type { Agent, BotProfile } from '@/lib/agents/agent.types';
import type { ExternalAgentReference, AgentStackProvider } from './stack-providers/types';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('StackedAgentService');

export const STACKED_AGENT_POLL_INTERVAL_MS = 30_000;

export interface StackedAgent {
  agent: Agent;
  provider: AgentStackProvider;
  external: ExternalAgentReference;
}

export interface StackedAgentSyncState {
  agents: StackedAgent[];
  isLoading: boolean;
  error: string | null;
  lastSyncedAt: string | null;
}

export type StackedAgentListener = (state: StackedAgentSyncState) => void;

class StackedAgentService {
  private providers: AgentStackProvider[] = [];
  private state: StackedAgentSyncState = {
    agents: [],
    isLoading: false,
    error: null,
    lastSyncedAt: null,
  };
  private listeners = new Set<StackedAgentListener>();
  private timer: ReturnType<typeof setInterval> | null = null;

  registerProviders(providers: AgentStackProvider[]): void {
    this.providers = providers;
    logger.info(`Registered ${providers.length} stack providers`);
  }

  getState(): StackedAgentSyncState {
    return { ...this.state };
  }

  subscribe(listener: StackedAgentListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        logger.error({ err }, 'StackedAgent listener failed');
      }
    }
  }

  async sync(): Promise<void> {
    this.state = { ...this.state, isLoading: true, error: null };
    this.emit();

    try {
      const stacked: StackedAgent[] = [];

      for (const provider of this.providers) {
        try {
          const installed = await provider.isInstalled();
          if (!installed) continue;

          const externalAgents = await provider.listAgents();
          for (const external of externalAgents) {
            stacked.push({
              agent: externalToAgent(external),
              provider,
              external,
            });
          }
        } catch (err) {
          logger.warn({ err }, `Failed to sync provider '${provider.id}'`);
        }
      }

      this.state = {
        agents: stacked,
        isLoading: false,
        error: null,
        lastSyncedAt: new Date().toISOString(),
      };
    } catch (err) {
      this.state = {
        ...this.state,
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    this.emit();
  }

  startPolling(intervalMs = STACKED_AGENT_POLL_INTERVAL_MS): void {
    this.stopPolling();
    void this.sync();
    this.timer = setInterval(() => {
      void this.sync();
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const stackedAgentService = new StackedAgentService();

export function externalToAgent(external: ExternalAgentReference): Agent {
  const now = new Date().toISOString();
  const botProfile: BotProfile = {
    displayName: external.displayName,
    tagline: external.tagline,
    accentColor: providerColor(external.providerId),
    botCategory: 'custom',
    lifecycle: 'active',
    providerId: external.providerId,
    externalId: external.externalId,
  };

  return {
    id: `${external.providerId}:${external.externalId}`,
    name: external.externalId,
    description: external.tagline ?? `${external.providerId} agent`,
    type: 'specialist',
    model: 'external',
    provider: 'custom',
    capabilities: external.capabilities,
    tools: [],
    maxIterations: 50,
    temperature: 0.7,
    config: {
      providerId: external.providerId,
      externalId: external.externalId,
      ...(external.metadata ?? {}),
    },
    status: 'idle',
    createdAt: now,
    updatedAt: now,
    source: 'vendor',
    isBot: true,
    botProfile,
    allowedSurfaces: ['chat', 'cowork'],
    agentCard: {
      tagline: external.tagline,
      capabilityDescription: `${external.providerId} agent: ${external.capabilities.join(', ')}`,
      trustTier: 'medium',
      canDelegate: true,
      a2aVersion: '1.0',
    },
  };
}

function providerColor(providerId: string): string {
  switch (providerId) {
    case 'hermes':
      return '#3b82f6'; // blue
    case 'openclaw':
      return '#f97316'; // orange
    case 'grok':
      return '#ec4899'; // pink
    default:
      return '#6b7280'; // gray
  }
}
