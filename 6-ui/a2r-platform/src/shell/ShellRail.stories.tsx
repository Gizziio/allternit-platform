import type { Meta, StoryObj } from '@storybook/react';
import { useRef, useState } from 'react';
import { ShellRail } from './ShellRail';
import { useChatStore } from '../views/chat/ChatStore';
import { useNativeAgentStore } from '../lib/agents/native-agent.store';

/**
 * ShellRail Component
 * 
 * Sidebar navigation rail with collapsible categories, project folders,
 * and session management. Provides quick access to all application areas.
 * 
 * @evidence UI_TEST, VISUAL_REGRESSION
 */
const meta: Meta<typeof ShellRail> = {
  title: 'Shell/Rail',
  component: ShellRail,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    a2r: {
      componentId: 'shell-rail',
      evidence: {
        types: ['VISUAL_SNAPSHOT'],
        dagNode: 'ui-components/shell/rail',
      },
    },
  },
  argTypes: {
    mode: {
      control: 'select',
      options: ['chat', 'cowork', 'code'],
      description: 'Rail mode configuration',
    },
    isCollapsed: {
      control: 'boolean',
      description: 'Whether the rail is collapsed',
    },
    activeViewType: {
      control: 'select',
      options: ['chat', 'native-agent', 'runtime-ops', 'workspace', 'browser', 'code', 'terminal'],
      description: 'Currently active view',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function seedRailStores() {
  useChatStore.setState({
    threads: [
      {
        id: 'chat-welcome',
        title: 'Welcome Session',
        mode: 'llm',
        messages: [],
        updatedAt: Date.now(),
      },
      {
        id: 'chat-agent-review',
        title: 'Design review',
        mode: 'agent',
        agentId: 'agent-shell',
        messages: [],
        updatedAt: Date.now() - 1000 * 60 * 8,
      },
    ],
    projects: [
      {
        id: 'project-runtime',
        title: 'Runtime refresh',
        threadIds: [],
        files: [],
        createdAt: Date.now() - 1000 * 60 * 60,
      },
    ],
    activeThreadId: 'chat-welcome',
    activeProjectId: null,
  });

  useNativeAgentStore.setState({
    sessions: [
      {
        id: 'session-strategy',
        name: 'Strategic Review',
        description: 'Primary operator workspace for runtime and shell QA.',
        createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
        lastAccessedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
        messageCount: 14,
        isActive: true,
        tags: ['priority', 'brand'],
      },
      {
        id: 'session-implementation',
        name: 'Implementation Draft',
        description: 'Secondary durable thread for follow-up UI wiring.',
        createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 43).toISOString(),
        lastAccessedAt: new Date(Date.now() - 1000 * 60 * 43).toISOString(),
        messageCount: 7,
        isActive: false,
        tags: ['handoff'],
      },
    ],
    activeSessionId: 'session-strategy',
    executionMode: {
      mode: 'safe',
      updatedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      supportedModes: ['plan', 'safe', 'auto'],
    },
    isLoadingSessions: false,
    isLoadingExecutionMode: false,
    fetchSessions: async () => {},
    fetchExecutionMode: async () => {},
    setActiveSession: (sessionId) => {
      useNativeAgentStore.setState({ activeSessionId: sessionId });
    },
    createSession: async () => {
      const nextSession = {
        id: `session-${Date.now()}`,
        name: 'New Agent Session',
        description: 'Fresh operator workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 0,
        isActive: true,
        tags: [],
      };

      useNativeAgentStore.setState((state) => ({
        sessions: [nextSession, ...state.sessions],
        activeSessionId: nextSession.id,
      }));

      return nextSession;
    },
  });
}

function SeededShellRail({
  activeViewType = 'chat',
}: {
  activeViewType?: string;
}) {
  const hasSeeded = useRef(false);

  if (!hasSeeded.current) {
    seedRailStores();
    hasSeeded.current = true;
  }

  return (
    <div style={{ height: '100%', background: '#11100f', padding: '24px' }}>
      <div style={{ height: 'calc(100vh - 48px)', maxHeight: 720 }}>
        <ShellRail
          mode="chat"
          isCollapsed={false}
          activeViewType={activeViewType}
          onOpen={() => {}}
        />
      </div>
    </div>
  );
}

/**
 * Default ShellRail
 */
export const Default: Story = {
  render: () => <SeededShellRail activeViewType="chat" />,
};

/**
 * Collapsed state
 */
export const Collapsed: Story = {
  args: {
    mode: 'chat',
    isCollapsed: true,
    activeViewType: 'chat',
  },
};

/**
 * Chat mode
 */
export const ChatMode: Story = {
  render: () => <SeededShellRail activeViewType="chat" />,
};

export const ConversationsHub: Story = {
  render: () => <SeededShellRail activeViewType="native-agent" />,
};

/**
 * Cowork mode
 */
export const CoworkMode: Story = {
  args: {
    mode: 'cowork',
    isCollapsed: false,
    activeViewType: 'workspace',
  },
};

/**
 * Code mode
 */
export const CodeMode: Story = {
  args: {
    mode: 'code',
    isCollapsed: false,
    activeViewType: 'code',
  },
};

/**
 * All mode variants
 */
export const AllModes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '16px', height: '600px' }}>
      <div style={{ width: '316px', height: '100%' }}>
        <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>Chat Mode</p>
        <div style={{ height: '500px', background: 'var(--bg-primary)', borderRadius: '12px', overflow: 'hidden' }}>
          <SeededShellRail activeViewType="chat" />
        </div>
      </div>
      <div style={{ width: '316px', height: '100%' }}>
        <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '8px' }}>Agent Sessions Active</p>
        <div style={{ height: '500px', background: 'var(--bg-primary)', borderRadius: '12px', overflow: 'hidden' }}>
          <SeededShellRail activeViewType="native-agent" />
        </div>
      </div>
    </div>
  ),
  parameters: {
    chromatic: {
      delay: 500,
    },
  },
};

/**
 * With theme toggle
 */
export const WithThemeToggle: Story = {
  render: () => {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    return (
      <div style={{ height: '500px', background: theme === 'dark' ? '#0f0f0f' : '#ffffff', borderRadius: '12px', overflow: 'hidden' }}>
        <ShellRail 
          mode="chat" 
          isCollapsed={false} 
          activeViewType="chat"
          theme={theme}
          onThemeToggle={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
        />
      </div>
    );
  },
};

/**
 * Dark background
 */
export const DarkMode: Story = {
  args: {
    mode: 'global',
    isCollapsed: false,
    activeViewType: 'chat',
    theme: 'dark',
  },
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

/**
 * Structure showcase
 */
export const Structure: Story = {
  render: () => (
    <div style={{ padding: '24px' }}>
      <h3 style={{ marginBottom: '16px' }}>ShellRail Structure</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
        <div>
          <h4 style={{ marginBottom: '12px' }}>Components</h4>
          <ul style={{ lineHeight: 1.8 }}>
            <li>Search input</li>
            <li>Collapsible categories</li>
            <li>Project folders with expand/collapse</li>
            <li>Session list (Agent & LLM)</li>
            <li>User menu with popover</li>
            <li>Environment selector</li>
            <li>Theme toggle</li>
          </ul>
        </div>
        <div>
          <h4 style={{ marginBottom: '12px' }}>Features</h4>
          <ul style={{ lineHeight: 1.8 }}>
            <li>Glass surface background</li>
            <li>Drag-to-reorder (via dots)</li>
            <li>Active state highlighting</li>
            <li>Context menus (row actions)</li>
            <li>Connection indicator</li>
            <li>Mode-specific configurations</li>
          </ul>
        </div>
      </div>
    </div>
  ),
};
