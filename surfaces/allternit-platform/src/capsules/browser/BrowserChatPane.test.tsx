import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const browserAgentStoreState = vi.hoisted(() => ({
  goal: '',
  pageAgentStatus: 'idle',
  pageAgentActivity: null,
  pageAgentHistory: [] as Array<Record<string, unknown>>,
  pageAgentSessions: [] as Array<Record<string, unknown>>,
  runPageAgentGoal: vi.fn(),
  stopPageAgent: vi.fn(),
  deletePageAgentSession: vi.fn(),
  clearPageAgentSessions: vi.fn(),
}));

const browserPaneState = vi.hoisted(() => ({
  permissionMode: 'ask' as 'ask' | 'act',
  language: 'en',
  extensionApiKey: 'NA',
  extensionBaseUrl: 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run',
  extensionModel: 'qwen3.5-plus',
  extensionMaxSteps: 40,
  extensionSystemInstruction: '',
  extensionExperimentalLlmsTxt: false,
  browserBridgeToken: 'allternit_browser_bridge_token_1234',
  setPermissionMode: vi.fn((mode: 'ask' | 'act') => {
    browserPaneState.permissionMode = mode;
  }),
  setLanguage: vi.fn((language: string) => {
    browserPaneState.language = language;
  }),
  setExtensionSettings: vi.fn((settings: Record<string, unknown>) => {
    Object.assign(browserPaneState, settings);
  }),
}));

const browserState = vi.hoisted(() => ({
  activeTabId: 'tab-1',
  tabs: [
    {
      id: 'tab-1',
      title: 'Docs',
      isActive: true,
      contentType: 'web',
      url: 'https://docs.example.com/platform/browser-mode',
    },
  ],
}));

vi.mock('@/lib/agents', () => ({
  getOpenClawWorkspacePathFromAgent: vi.fn(),
  mapNativeMessagesToStreamMessages: vi.fn(() => []),
  useEmbeddedAgentSession: () => ({
    isEmbedded: false,
    sessionId: null,
    descriptor: { sessionMode: 'regular', agentId: null },
  }),
  useEmbeddedAgentSessionStore: Object.assign(
    () => ({ setSurfaceSession: vi.fn(), clearSurfaceSession: vi.fn() }),
    { getState: () => ({ setSurfaceSession: vi.fn(), clearSurfaceSession: vi.fn() }) },
  ),
  useNativeAgentStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      createSession: vi.fn(),
      setActiveSession: vi.fn(),
      fetchMessages: vi.fn(),
      fetchSessionCanvases: vi.fn(),
      sendMessageStream: vi.fn(),
      abortGeneration: vi.fn(),
      streamingBySession: {},
      messages: {},
      sessionCanvases: {},
      sessions: [],
      fetchSessions: vi.fn(),
    };

    return selector ? selector(state) : state;
  },
}));

vi.mock('@/lib/agents/surface-agent-context', () => ({
  useSurfaceAgentSelection: () => ({ selectedAgentId: null, selectedAgent: null }),
}));

vi.mock('@/stores/sidecar-store', () => ({
  useSidecarStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { toggle: vi.fn(), setOpen: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('./browserAgent.store', () => ({
  useBrowserAgentStore: Object.assign(
    (selector?: (state: typeof browserAgentStoreState) => unknown) =>
      selector ? selector(browserAgentStoreState) : browserAgentStoreState,
    {
      subscribe: vi.fn(() => () => {}),
      getState: () => browserAgentStoreState,
    },
  ),
}));

vi.mock('./browserChatPane.store', () => ({
  useBrowserChatPaneStore: (selector?: (state: typeof browserPaneState) => unknown) =>
    selector ? selector(browserPaneState) : browserPaneState,
}));

vi.mock('./browser.store', () => ({
  useBrowserStore: (selector?: (state: typeof browserState) => unknown) =>
    selector ? selector(browserState) : browserState,
}));

vi.mock('@/views/chat/ChatComposer', () => ({
  ChatComposer: ({
    agentModeSurface,
    inputValue = '',
    isLoading,
    onSend,
    onStop,
    placeholder = 'How can I help you today?',
    selectedModelDisplayName = 'Kimi K2.5 (Coding)',
    showTopActions,
  }: {
    agentModeSurface?: string;
    inputValue?: string;
    isLoading?: boolean;
    onSend: (value: string) => void;
    onStop?: () => void;
    placeholder?: string;
    selectedModelDisplayName?: string;
    showTopActions?: boolean;
  }) => {
    let currentValue = inputValue;

    return (
      <div data-testid="browser-native-composer">
        <div>Agent Off</div>
        <div>{selectedModelDisplayName}</div>
        <textarea
          aria-label="Browser chat input"
          defaultValue={inputValue}
          placeholder={placeholder}
          onChange={(event) => {
            currentValue = event.currentTarget.value;
          }}
        />
        <button
          type="button"
          aria-label={isLoading ? 'Stop message' : 'Send message'}
          onClick={() => {
            if (isLoading) {
              onStop?.();
              return;
            }
            onSend(currentValue);
          }}
        >
          {isLoading ? 'Stop' : 'Send'}
        </button>
        <div>{agentModeSurface === 'browser' ? 'Choose Agent' : 'Composer Surface Mismatch'}</div>
        <div>Build</div>
        <div>{showTopActions ? 'Top Actions Visible' : 'Top Actions Hidden'}</div>
      </div>
    );
  },
}));

import { BrowserChatPane } from './BrowserChatPane';

describe('BrowserChatPane', () => {
  beforeEach(() => {
    browserAgentStoreState.goal = '';
    browserAgentStoreState.pageAgentStatus = 'idle';
    browserAgentStoreState.pageAgentActivity = null;
    browserAgentStoreState.pageAgentHistory = [];
    browserAgentStoreState.pageAgentSessions = [];
    browserAgentStoreState.runPageAgentGoal.mockReset();
    browserAgentStoreState.stopPageAgent.mockReset();
    browserAgentStoreState.deletePageAgentSession.mockReset();
    browserAgentStoreState.clearPageAgentSessions.mockReset();

    browserPaneState.permissionMode = 'ask';
    browserPaneState.language = 'en';
    browserPaneState.extensionApiKey = 'NA';
    browserPaneState.extensionBaseUrl = 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run';
    browserPaneState.extensionModel = 'qwen3.5-plus';
    browserPaneState.extensionMaxSteps = 40;
    browserPaneState.extensionSystemInstruction = '';
    browserPaneState.extensionExperimentalLlmsTxt = false;
    browserPaneState.browserBridgeToken = 'allternit_browser_bridge_token_1234';
    browserPaneState.setPermissionMode.mockClear();
    browserPaneState.setLanguage.mockClear();
    browserPaneState.setExtensionSettings.mockClear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    });
  });

  it('renders the extension shell with native-browser page context', () => {
    render(<BrowserChatPane />);

    expect(screen.getByTestId('browser-extension-pane')).toBeInTheDocument();
    expect(screen.getAllByText('Allternit Extension')).toHaveLength(2);
    expect(screen.getAllByAltText('Page Agent')).toHaveLength(2);
    expect(screen.getByLabelText('Open history')).toBeInTheDocument();
    expect(screen.getByLabelText('Open settings')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('How can I help you today?')).toBeInTheDocument();
    expect(screen.getByText('Agent Off')).toBeInTheDocument();
    expect(screen.getByText('Kimi K2.5 (Coding)')).toBeInTheDocument();
    expect(screen.getByText('Choose Agent')).toBeInTheDocument();
    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByText('Top Actions Hidden')).toBeInTheDocument();
    expect(screen.queryByText(/docs\.example\.com/)).not.toBeInTheDocument();
  });

  it('submits browser tasks through the page-agent extension flow', () => {
    render(<BrowserChatPane />);

    fireEvent.change(screen.getByLabelText('Browser chat input'), {
      target: { value: 'Summarize the pricing page' },
    });
    fireEvent.click(screen.getByLabelText('Send message'));

    expect(browserAgentStoreState.runPageAgentGoal).toHaveBeenCalledWith(
      'Summarize the pricing page',
      {
        apiKey: 'NA',
        baseURL: 'https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run',
        model: 'qwen3.5-plus',
        language: 'en-US',
        maxSteps: 40,
        systemInstruction: null,
        experimentalLlmsTxt: false,
      },
    );
  });

  it('opens history and shows session details with extension events', () => {
    browserAgentStoreState.pageAgentSessions = [
      {
        id: 'session-1',
        sessionId: 'page-1',
        task: 'Extract the pricing table',
        status: 'completed',
        createdAt: Date.now(),
        history: [{ type: 'observation', content: 'Captured the pricing table rows.' }],
      },
    ];

    render(<BrowserChatPane />);

    fireEvent.click(screen.getByLabelText('Open history'));
    expect(screen.getByText('Extract the pricing table')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Extract the pricing table'));
    expect(screen.getByText('Captured the pricing table rows.')).toBeInTheDocument();
  });

  it('supports extension-style history session controls through the browser adapter', () => {
    browserAgentStoreState.pageAgentSessions = [
      {
        id: 'session-1',
        sessionId: 'page-1',
        task: 'Extract the pricing table',
        status: 'completed',
        createdAt: Date.now(),
        history: [{ type: 'observation', content: 'Captured the pricing table rows.' }],
      },
    ];

    render(<BrowserChatPane />);

    fireEvent.click(screen.getByLabelText('Open history'));
    fireEvent.click(screen.getByText('Clear All'));
    fireEvent.click(screen.getByLabelText('Delete history entry Extract the pricing table'));

    expect(browserAgentStoreState.clearPageAgentSessions).toHaveBeenCalledTimes(1);
    expect(browserAgentStoreState.deletePageAgentSession).toHaveBeenCalledWith('session-1');
  });

  it('applies extension-style browser settings through the browser adapter seam', async () => {
    render(<BrowserChatPane />);

    fireEvent.click(screen.getByLabelText('Open settings'));
    expect(screen.getByText('User Auth Token')).toBeInTheDocument();
    expect(screen.getByText('Base URL')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('https://page-ag-testing-ohftxirgbn.cn-shanghai.fcapp.run'), {
      target: { value: 'https://api.example.com/v1' },
    });
    fireEvent.change(screen.getByDisplayValue('Ask before acting'), {
      target: { value: 'act' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/page-agent/config',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          config: {
            apiKey: 'NA',
            baseURL: 'https://api.example.com/v1',
            model: 'qwen3.5-plus',
            language: 'en-US',
            maxSteps: 40,
            systemInstruction: null,
            experimentalLlmsTxt: false,
          },
        }),
      }),
    );
    expect(browserPaneState.setPermissionMode).toHaveBeenCalledWith('act');
    expect(browserPaneState.setLanguage).toHaveBeenCalledWith('en');
    expect(browserPaneState.setExtensionSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionApiKey: 'NA',
        extensionBaseUrl: 'https://api.example.com/v1',
        extensionModel: 'qwen3.5-plus',
        extensionMaxSteps: 40,
        extensionSystemInstruction: '',
        extensionExperimentalLlmsTxt: false,
      }),
    );
  });
});
