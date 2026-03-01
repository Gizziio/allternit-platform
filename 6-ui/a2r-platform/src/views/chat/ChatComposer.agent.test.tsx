import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentSurfaceModeStore } from '@/stores/agent-surface-mode.store';

const agentStoreState = vi.hoisted(() => {
  const fetchAgents = vi.fn(() => Promise.resolve());
  const createAgent = vi.fn(() => Promise.resolve({
    id: 'imported-agent',
    name: 'Imported Agent',
    provider: 'custom',
    model: 'openclaw/default',
    capabilities: [],
    config: {},
  }));
  const compileCharacterLayer = vi.fn(() => Promise.resolve());
  const loadCharacterLayer = vi.fn(() => Promise.resolve());

  return {
    fetchAgents,
    createAgent,
    compileCharacterLayer,
    loadCharacterLayer,
    agents: [
      {
        id: 'agent-1',
        name: 'Forge',
        provider: 'anthropic',
        model: 'claude-sonnet',
        capabilities: [],
        config: {},
      },
    ],
    isLoadingAgents: false,
    error: null,
    characterArtifacts: {},
  };
});

vi.mock('@/integration/api-client', () => ({
  useModelDiscovery: () => ({
    authenticatedProviders: [],
    discoverModels: vi.fn(),
    discoveryResult: null,
    fetchProviders: vi.fn(),
    realModels: [],
  }),
}));

vi.mock('@/lib/agents', () => ({
  useAgentStore: (selector: (state: any) => unknown) => selector(agentStoreState),
  discoverOpenClawAgents: vi.fn(() => Promise.resolve({ agents: [], total: 0, unregistered: 0 })),
  buildOpenClawImportInput: vi.fn(() => ({
    name: 'Imported Agent',
    description: 'Imported',
    model: 'openclaw/default',
    provider: 'custom',
    config: {},
  })),
  getOpenClawWorkspacePathFromAgent: vi.fn(() => null),
}));

vi.mock('./AgentModeGizzi', () => ({
  AgentModeGizzi: ({
    active,
    surface,
    selectedAgentName,
  }: {
    active: boolean;
    surface: string;
    selectedAgentName?: string | null;
  }) =>
    active ? (
      <div
        data-testid="mock-agent-mode-gizzi"
        data-surface={surface}
        data-agent={selectedAgentName ?? ''}
      />
    ) : null,
}));

import { ChatComposer } from './ChatComposer';

describe('ChatComposer agent mascot rail', () => {
  beforeEach(() => {
    useAgentSurfaceModeStore.setState({
      enabledBySurface: {
        chat: false,
        cowork: false,
        code: false,
        browser: false,
      },
      pulseBySurface: {
        chat: 0,
        cowork: 0,
        code: 0,
        browser: 0,
      },
      selectedAgentIdBySurface: {
        chat: null,
        cowork: null,
        code: null,
        browser: null,
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({}),
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the Gizzi rail only when agent mode is enabled for the surface', async () => {
    let rerender!: ReturnType<typeof render>['rerender'];

    await act(async () => {
      const rendered = render(
        <ChatComposer
          onSend={() => undefined}
          selectedModel="big-pickle"
          selectedModelDisplayName="Big Pickle"
          showTopActions={false}
          agentModeSurface="chat"
        />,
      );
      rerender = rendered.rerender;
      await Promise.resolve();
    });

    expect(screen.queryByTestId('mock-agent-mode-gizzi')).not.toBeInTheDocument();

    await act(async () => {
      useAgentSurfaceModeStore.setState({
        enabledBySurface: {
          chat: true,
          cowork: false,
          code: false,
          browser: false,
        },
        pulseBySurface: {
          chat: 1,
          cowork: 0,
          code: 0,
          browser: 0,
        },
        selectedAgentIdBySurface: {
          chat: 'agent-1',
          cowork: null,
          code: null,
          browser: null,
        },
      });
      await Promise.resolve();
    });

    await act(async () => {
      rerender(
        <ChatComposer
          onSend={() => undefined}
          selectedModel="big-pickle"
          selectedModelDisplayName="Big Pickle"
          showTopActions={false}
          agentModeSurface="chat"
        />,
      );
      await Promise.resolve();
    });

    expect(screen.getByTestId('mock-agent-mode-gizzi')).toHaveAttribute('data-surface', 'chat');
    expect(screen.getByTestId('mock-agent-mode-gizzi')).toHaveAttribute('data-agent', 'Forge');
  });

  it('does not mount the rail mascot for code mode', async () => {
    await act(async () => {
      useAgentSurfaceModeStore.setState({
        enabledBySurface: {
          chat: false,
          cowork: false,
          code: true,
          browser: false,
        },
        pulseBySurface: {
          chat: 0,
          cowork: 0,
          code: 1,
          browser: 0,
        },
        selectedAgentIdBySurface: {
          chat: null,
          cowork: null,
          code: 'agent-1',
          browser: null,
        },
      });
      await Promise.resolve();
    });

    await act(async () => {
      render(
        <ChatComposer
          onSend={() => undefined}
          selectedModel="big-pickle"
          selectedModelDisplayName="Big Pickle"
          showTopActions={false}
          agentModeSurface="code"
        />,
      );
      await Promise.resolve();
    });

    expect(screen.queryByTestId('mock-agent-mode-gizzi')).not.toBeInTheDocument();
  });

  it('does not mount the rail mascot for browser mode', async () => {
    await act(async () => {
      useAgentSurfaceModeStore.setState({
        enabledBySurface: {
          chat: false,
          cowork: false,
          code: false,
          browser: true,
        },
        pulseBySurface: {
          chat: 0,
          cowork: 0,
          code: 0,
          browser: 1,
        },
        selectedAgentIdBySurface: {
          chat: null,
          cowork: null,
          code: null,
          browser: 'agent-1',
        },
      });
      await Promise.resolve();
    });

    await act(async () => {
      render(
        <ChatComposer
          onSend={() => undefined}
          selectedModel="big-pickle"
          selectedModelDisplayName="Big Pickle"
          showTopActions={false}
          agentModeSurface="browser"
        />,
      );
      await Promise.resolve();
    });

    expect(screen.queryByTestId('mock-agent-mode-gizzi')).not.toBeInTheDocument();
  });
});
