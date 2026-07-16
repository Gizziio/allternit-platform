import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentSurfaceModeStore } from '@/stores/agent-surface-mode.store';
import { GlobalDropzoneProvider } from '@/components/GlobalDropzone';

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

vi.mock('../chat/ChatComposer', () => ({
  ChatComposer: ({ inputValue, showTopActions, topDeckContent, bottomDockContent }: { inputValue?: string; showTopActions?: boolean; topDeckContent?: React.ReactNode; bottomDockContent?: React.ReactNode }) => (
    <div data-testid="mock-chat-composer">
      {topDeckContent ? <div data-testid="mock-chat-composer-top-deck">{topDeckContent}</div> : null}
      <span data-testid="mock-chat-composer-input">{inputValue || ''}</span>
      <span data-testid="mock-chat-composer-top-actions">{String(showTopActions)}</span>
      {bottomDockContent ? <div data-testid="mock-chat-composer-bottom-dock">{bottomDockContent}</div> : null}
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

vi.mock('./CodeUsageDashboard', () => ({
  CodeUsageDashboard: ({ onClose }: { onClose?: () => void }) => (
    <div data-testid="code-usage-dashboard">
      Usage Dashboard
      <button type="button" onClick={onClose}>Close usage</button>
    </div>
  ),
}));

import { createCodeModeFixtureState, useCodeModeStore, type CodeWorkspaceRecord } from './CodeModeStore';
import { CodeCanvas } from './CodeCanvas';

function renderWithDropzone(ui: React.ReactElement) {
  return render(<GlobalDropzoneProvider>{ui}</GlobalDropzoneProvider>);
}

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

  it('renders the launchpad shell with header, shared composer and branding', async () => {
    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    expect(await screen.findByTestId('code-canvas-shell')).toBeInTheDocument();
    expect(screen.getByTestId('code-launchpad-greeting')).toBeInTheDocument();
    expect(screen.getByText('Run a command or describe a task to start coding.')).toBeInTheDocument();
    expect(screen.getByTestId('mock-code-launch-branding')).toBeInTheDocument();
    expect(screen.getByTestId('mock-chat-composer')).toBeInTheDocument();
    expect(screen.getByTestId('mock-chat-composer-top-actions')).toHaveTextContent('false');
  });

  it('renders the workspace bar above the composer', async () => {
    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    expect(await screen.findByTestId('code-workspace-bar')).toBeInTheDocument();
    expect(screen.getByTestId('code-workspace-bar-workspace')).toHaveTextContent('Allternit Platform');
  });

  it('shows the connected top deck with environment, workspace, branch, worktree and sync pills', async () => {
    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    expect(await screen.findByTestId('code-workspace-bar')).toBeInTheDocument();
    expect(screen.getByTestId('code-workspace-bar-environment')).toHaveTextContent('Local');
    expect(screen.getByTestId('code-workspace-bar-workspace')).toHaveTextContent('Allternit Platform');
    expect(screen.getByTestId('code-workspace-bar-branch')).toHaveTextContent('main');
    expect(screen.getByTestId('code-workspace-bar-worktree')).toHaveTextContent('worktree');
    expect(screen.getByTestId('code-workspace-bar-sync')).toBeInTheDocument();
  });

  it('updates the active session permission mode from the bottom status bar', async () => {
    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    const modeButton = await screen.findByTestId('code-bottom-status-mode');
    expect(modeButton).toHaveTextContent('Plan first');

    fireEvent.click(modeButton);
    const autoOption = screen.getByText('Auto');
    fireEvent.click(autoOption);

    expect(useCodeModeStore.getState().sessions.find((s) => s.session_id === 'sess_code_ui')?.mode).toBe('AUTO');
    expect(modeButton).toHaveTextContent('Accept edits');
  });

  it('toggles worktree isolation from the top deck', async () => {
    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    const worktreePill = await screen.findByTestId('code-workspace-bar-worktree');
    expect(worktreePill).toHaveTextContent('worktree');

    fireEvent.click(worktreePill);

    expect(useCodeModeStore.getState().sessions.find((s) => s.session_id === 'sess_code_ui')?.isolation).toBe('sandbox');
    expect(worktreePill).toHaveTextContent('worktree');
  });

  it('keeps rendering when persisted workspace data is missing repo status', async () => {
    const fixtureState = createCodeModeFixtureState();
    useCodeModeStore.setState({
      ...fixtureState,
      workspaces: fixtureState.workspaces.map((workspace, index) =>
        index === 0 ? ({ ...workspace, repo_status: undefined } as unknown as CodeWorkspaceRecord) : workspace,
      ),
    });

    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    expect(await screen.findByTestId('code-canvas-shell')).toBeInTheDocument();
    expect(screen.getByTestId('code-workspace-bar-workspace')).toHaveTextContent('Allternit Platform');
  });

  it('renders a clickable workspace picker in the workspace bar', async () => {
    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    const workspacePill = await screen.findByTestId('code-workspace-bar-workspace');

    expect(workspacePill).toHaveTextContent('Allternit Platform');
    expect(workspacePill).not.toBeDisabled();
  });

  it('renders the bottom status bar with mode selector and plus menu', async () => {
    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    expect(await screen.findByTestId('code-bottom-status-bar')).toBeInTheDocument();
    expect(screen.getByTestId('code-bottom-status-mode')).toBeInTheDocument();
    expect(screen.getByTestId('code-bottom-status-plus')).toBeInTheDocument();
    expect(screen.getByTestId('code-composer-metadata')).toBeInTheDocument();
  });

  it('renders usage stats on the landing page', async () => {
    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    expect(await screen.findByTestId('code-usage-dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('code-launchpad-actions')).not.toBeInTheDocument();
  });

  it('replaces closed usage stats with a control that restores them', async () => {
    renderWithDropzone(<CodeCanvas isPreviewCollapsed={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Close usage' }));
    expect(screen.queryByTestId('code-usage-dashboard')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('code-show-usage'));
    expect(await screen.findByTestId('code-usage-dashboard')).toBeInTheDocument();
  });
});
