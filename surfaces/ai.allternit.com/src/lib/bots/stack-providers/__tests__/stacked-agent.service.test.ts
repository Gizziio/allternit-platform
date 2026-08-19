/**
 * Tests for the stacked-agent sync service.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stackedAgentService, externalToAgent } from '../../stacked-agent.service';
import type { AgentStackProvider, ExternalAgentReference } from '../types';

function fakeProvider(
  id: string,
  installed: boolean,
  agents: ExternalAgentReference[],
): AgentStackProvider {
  return {
    id,
    name: id,
    isInstalled: async () => installed,
    listAgents: async () => agents,
    sendMessage: async function* () {},
    getStatus: async () => 'idle',
  };
}

beforeEach(() => {
  stackedAgentService.stopPolling();
  stackedAgentService.registerProviders([]);
});

describe('stacked-agent service', () => {
  it('syncs installed providers into stacked agents', async () => {
    stackedAgentService.registerProviders([
      fakeProvider('hermes', true, [
        {
          providerId: 'hermes',
          externalId: 'researcher',
          displayName: 'Researcher',
          capabilities: ['chat'],
        },
      ]),
      fakeProvider('openclaw', false, []),
    ]);

    await stackedAgentService.sync();
    const state = stackedAgentService.getState();

    expect(state.agents).toHaveLength(1);
    expect(state.agents[0].external.externalId).toBe('researcher');
    expect(state.agents[0].agent.id).toBe('hermes:researcher');
    expect(state.error).toBeNull();
  });

  it('converts external references to agents with provider metadata', () => {
    const external: ExternalAgentReference = {
      providerId: 'hermes',
      externalId: 'coder',
      displayName: 'Coder',
      tagline: 'Codes things',
      capabilities: ['chat', 'tools'],
    };

    const agent = externalToAgent(external);
    expect(agent.id).toBe('hermes:coder');
    expect(agent.isBot).toBe(true);
    expect(agent.botProfile?.displayName).toBe('Coder');
    expect(agent.botProfile?.providerId).toBe('hermes');
    expect(agent.botProfile?.externalId).toBe('coder');
    expect(agent.config.providerId).toBe('hermes');
  });

  it('notifies subscribers on sync', async () => {
    const listener = vi.fn();
    stackedAgentService.subscribe(listener);
    listener.mockClear();

    stackedAgentService.registerProviders([
      fakeProvider('hermes', true, [
        { providerId: 'hermes', externalId: 'x', displayName: 'X', capabilities: ['chat'] },
      ]),
    ]);

    await stackedAgentService.sync();
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        agents: expect.any(Array),
        isLoading: false,
        error: null,
      }),
    );
  });
});
