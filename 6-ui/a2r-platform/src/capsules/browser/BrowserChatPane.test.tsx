import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentSurfaceModeStore } from '@/stores/agent-surface-mode.store';

const browserAgentStoreState = vi.hoisted(() => ({
  mode: 'Human',
  status: 'Idle',
  currentAction: null as null | {
    label?: string;
    stepIndex?: number;
    totalSteps?: number;
  },
  approvalActionSummary: null as string | null,
  approvalRiskTier: 'medium',
  runGoal: vi.fn(),
  setMode: vi.fn(),
  stopExecution: vi.fn(),
  handOff: vi.fn(),
  approveAction: vi.fn(),
  denyAction: vi.fn(),
}));

const selectedAgentState = vi.hoisted(() => ({
  selectedAgentId: 'agent-1' as string | null,
}));

vi.mock('../../views/chat/ChatComposer', () => ({
  ChatComposer: () => <div data-testid="mock-browser-chat-composer" />,
}));

vi.mock('@/components/ai-elements/GizziMascot', () => ({
  GizziMascot: ({
    emotion,
    attention,
  }: {
    emotion: string;
    attention?: { state?: string } | null;
  }) => (
    <div
      data-testid="mock-browser-gizzi"
      data-emotion={emotion}
      data-attention={attention?.state ?? 'none'}
    />
  ),
}));

vi.mock('./browserAgent.store', () => ({
  useBrowserAgentStore: Object.assign(
    (selector?: (state: any) => unknown) =>
      selector ? selector(browserAgentStoreState) : browserAgentStoreState,
    {
      subscribe: vi.fn(() => () => {}),
      getState: () => browserAgentStoreState,
    },
  ),
}));

vi.mock('../../stores/sidecar-store', () => ({
  useSidecarStore: (selector?: (state: any) => unknown) => {
    const state = {
      toggle: vi.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/lib/agents/surface-agent-context', () => ({
  useSurfaceAgentSelection: () => selectedAgentState,
}));

import { BrowserChatPane } from './BrowserChatPane';

describe('BrowserChatPane', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: vi.fn(),
    });

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

    browserAgentStoreState.mode = 'Human';
    browserAgentStoreState.status = 'Idle';
    browserAgentStoreState.currentAction = null;
    browserAgentStoreState.approvalActionSummary = null;
    browserAgentStoreState.runGoal.mockReset();
    browserAgentStoreState.setMode.mockReset();
    browserAgentStoreState.stopExecution.mockReset();
    browserAgentStoreState.handOff.mockReset();
    browserAgentStoreState.approveAction.mockReset();
    browserAgentStoreState.denyAction.mockReset();
    selectedAgentState.selectedAgentId = 'agent-1';
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('uses the existing browser Gizzi for the agent-mode pulse', async () => {
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

    render(<BrowserChatPane />);

    expect(screen.getByTestId('mock-browser-gizzi')).toHaveAttribute('data-emotion', 'proud');
    expect(screen.getByTestId('mock-browser-gizzi')).toHaveAttribute('data-attention', 'locked-on');

    await act(async () => {
      vi.advanceTimersByTime(950);
      await Promise.resolve();
    });

    expect(screen.getByTestId('mock-browser-gizzi')).toHaveAttribute('data-emotion', 'focused');
    expect(screen.getByTestId('mock-browser-gizzi')).toHaveAttribute('data-attention', 'tracking');
  });

  it('renders the browser agent backdrop when browser agent mode is enabled', async () => {
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

    render(<BrowserChatPane />);

    expect(screen.getByTestId('agent-mode-browser-backdrop')).toHaveAttribute('data-surface', 'browser');
  });

  it('does not render the browser agent backdrop when browser agent mode is disabled', async () => {
    await act(async () => {
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
      await Promise.resolve();
    });

    render(<BrowserChatPane />);

    expect(screen.queryByTestId('agent-mode-browser-backdrop')).not.toBeInTheDocument();
  });
});
