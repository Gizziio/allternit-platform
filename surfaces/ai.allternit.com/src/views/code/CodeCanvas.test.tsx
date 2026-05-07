import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentSurfaceModeStore } from '@/stores/agent-surface-mode.store';

const embeddedSessionState = vi.hoisted(() => ({
  isEmbedded: false,
  sessionId: null as string | null,
  session: null,
  descriptor: { sessionMode: 'regular' as 'agent' | 'regular', agentId: null as string | null },
}));



vi.mock('@/lib/agents/surface-agent-context', () => ({
  useSurfaceAgentSelection: () => ({
    agentModeEnabled: embeddedSessionState.isEmbedded && embeddedSessionState.descriptor.sessionMode === 'agent',
    selectedAgentId: null,
    selectedAgent: null,
  }),
  useSurfaceAgentModeEnabled: () => embeddedSessionState.isEmbedded && embeddedSessionState.descriptor.sessionMode === 'agent',
  buildAgentConversationContext: () => ({ conversationMode: 'llm' }),
}));

const { createThread, openDrawer, setConsoleTab, chatState } = vi.hoisted(() => {
  const createThread = vi.fn(() => Promise.resolve('thread-code'));
  const openDrawer = vi.fn();
  const setConsoleTab = vi.fn();
  const chatState = {
    threads: [{ id: 'thread-code' }],
    activeThreadId: 'thread-code',
  };

  return { createThread, openDrawer, setConsoleTab, chatState };
});

vi.mock('../chat/ChatStore', () => ({
  useChatStore: () => ({
    threads: chatState.threads,
    activeThreadId: chatState.activeThreadId,
    createThread,
  }),
}));

vi.mock('../../runner/runner.store', () => ({
  useRunnerStore: Object.assign(vi.fn(() => ({ activeRun: null })), {
    setState: vi.fn(),
    getState: vi.fn(() => ({ submit: vi.fn() })),
  }),
}));

interface MockDrawerStore {
  openDrawer: ReturnType<typeof vi.fn>;
  setConsoleTab: ReturnType<typeof vi.fn>;
  drawers: { console: { open: boolean; height: number; activeTab: string } };
}

vi.mock('../../drawers/drawer.store', () => ({
  useDrawerStore: (selector: (state: MockDrawerStore) => unknown) =>
    selector({
      openDrawer,
      setConsoleTab,
      drawers: { console: { open: false, height: 300, activeTab: 'queue' } },
    }),
}));

vi.mock('./CodeLaunchBranding', () => ({
  CodeLaunchBranding: () => <div data-testid="mock-code-launch-branding" />,
}));

vi.mock('@/components/ai-elements/GizziMascot', () => ({
  GizziMascot: () => <div data-testid="mock-gizzi-mascot" />,
}));

vi.mock('../chat/ChatComposer', () => ({
  ChatComposer: ({ inputValue, showTopActions }: { inputValue?: string; showTopActions?: boolean }) => (
    <div data-testid="mock-chat-composer">
      <span data-testid="mock-chat-composer-input">{inputValue || ''}</span>
      <span data-testid="mock-chat-composer-top-actions">{String(showTopActions)}</span>
    </div>
  ),
}));

vi.mock('@/components/ai-elements/conversation', () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationScrollButton: () => <div data-testid="mock-scroll-button" />,
}));

vi.mock('@/components/ai-elements/message', () => ({
  Message: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageAction: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
}));

vi.mock('@/components/ai-elements/code-block', () => ({
  CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>,
}));

vi.mock('@/components/ai-elements/shimmer', () => ({
  Shimmer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { createCodeModeFixtureState, useCodeModeStore, type CodeWorkspaceRecord } from './CodeModeStore';
import { CodeCanvas } from './CodeCanvas';

describe('CodeCanvas', () => {
  beforeEach(() => {
    useCodeModeStore.setState(createCodeModeFixtureState());
    embeddedSessionState.isEmbedded = false;
    embeddedSessionState.sessionId = null;
    embeddedSessionState.session = null;
    embeddedSessionState.descriptor = { sessionMode: 'regular', agentId: null };
    useAgentSurfaceModeStore.setState({
      selectedAgentIdBySurface: {
        chat: null,
        cowork: null,
        code: null,
        browser: null,
      },
    });
    window.localStorage.clear();
    chatState.activeThreadId = 'thread-code';
    chatState.threads = [{ id: 'thread-code' }];
    createThread.mockClear();
    openDrawer.mockClear();
    setConsoleTab.mockClear();
  });

  it('renders the minimal launchpad with the shared composer and bottom utility controls', () => {
    render(<CodeCanvas isPreviewCollapsed={false} />);

    expect(screen.getByTestId('code-canvas-shell')).toBeInTheDocument();
    expect(screen.getByTestId('mock-code-launch-branding')).toBeInTheDocument();
    expect(screen.getByTestId('mock-chat-composer')).toBeInTheDocument();
    expect(screen.getByTestId('mock-chat-composer-top-actions')).toHaveTextContent('false');
    expect(screen.getByTestId('code-session-selector')).toBeInTheDocument();
    expect(screen.getByTestId('code-folder-button')).toBeInTheDocument();
    expect(screen.getByText('Scaffold')).toBeInTheDocument();
    expect(screen.getByText('Refactor')).toBeInTheDocument();
    expect(screen.getByText('Debug')).toBeInTheDocument();
    expect(screen.getByText('Optimize')).toBeInTheDocument();
    expect(screen.getByText('Explore')).toBeInTheDocument();
  });

  it('seeds the shared composer when a quick action template is selected', () => {
    render(<CodeCanvas isPreviewCollapsed={false} />);

    fireEvent.click(screen.getByText('Scaffold'));
    fireEvent.click(screen.getByText('New component'));

    expect(screen.getByTestId('mock-chat-composer-input')).toHaveTextContent(
      'Create a production-ready UI component for this workspace.',
    );
  });

  it('previews the first action prompt in the composer on hover before opening the panel', () => {
    render(<CodeCanvas isPreviewCollapsed={false} />);

    fireEvent.mouseEnter(screen.getByText('Optimize'));

    expect(screen.getByTestId('mock-chat-composer-input')).toHaveTextContent(
      'Review this UI path for avoidable renders and expensive layout work.',
    );
  });

  it('opens the session popover with consistent overlay styling controls', () => {
    render(<CodeCanvas isPreviewCollapsed={false} />);

    fireEvent.click(screen.getByTestId('code-session-selector'));

    const popover = screen.getByTestId('code-session-popover');

    expect(popover).toBeInTheDocument();
    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(popover).toHaveTextContent('Code Mode Layout Stabilization');
  });

  it('opens the shared console drawer terminal tab from the utility row', () => {
    render(<CodeCanvas isPreviewCollapsed={false} />);

    fireEvent.click(screen.getByTestId('code-console-button'));

    expect(setConsoleTab).toHaveBeenCalledWith('terminal');
    expect(openDrawer).toHaveBeenCalledWith('console', { tab: 'terminal', minHeight: 320 });
  });

  it('keeps rendering when persisted workspace data is missing repo status', () => {
    const fixtureState = createCodeModeFixtureState();
    useCodeModeStore.setState({
      ...fixtureState,
      workspaces: fixtureState.workspaces.map((workspace, index) =>
        index === 0 ? ({ ...workspace, repo_status: undefined } as unknown as CodeWorkspaceRecord) : workspace,
      ),
    });
    chatState.threads = [{ id: 'thread-code' }];

    render(<CodeCanvas isPreviewCollapsed={false} />);

    expect(screen.getByTestId('code-canvas-shell')).toBeInTheDocument();
    expect(screen.getByTestId('code-folder-button')).toHaveTextContent('Select folder');
  });

  it('renders the code agent backdrop when code agent mode is enabled', () => {
    embeddedSessionState.isEmbedded = true;
    embeddedSessionState.sessionId = 'session-code-1';
    embeddedSessionState.descriptor = { sessionMode: 'agent', agentId: 'agent-1' };
    useAgentSurfaceModeStore.setState({
      selectedAgentIdBySurface: {
        chat: null,
        cowork: null,
        code: 'agent-1',
        browser: null,
      },
    });

    render(<CodeCanvas isPreviewCollapsed={false} />);

    expect(screen.getByTestId('agent-mode-code-backdrop')).toHaveAttribute('data-surface', 'code');
  });
});
