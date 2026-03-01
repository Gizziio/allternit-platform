import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from './ChatStore';

const { sendMessage } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
}));

vi.mock('../../integration/kernel/chat', () => ({
  createThread: vi.fn(),
  sendMessage,
}));

vi.mock('../../integration/kernel/projects', () => ({
  createProject: vi.fn(),
}));

describe('ChatStore', () => {
  beforeEach(() => {
    localStorage.clear();
    sendMessage.mockReset();
    useChatStore.setState({
      threads: [
        {
          id: 'welcome',
          title: 'Welcome Session',
          mode: 'llm',
          messages: [{ id: 'm1', role: 'assistant', text: 'Hello! I am A2rchitech. How can I help?' }],
          updatedAt: Date.now(),
        },
      ],
      projects: [],
      activeThreadId: 'welcome',
      sandboxMode: 'read-only',
      activeProjectId: null,
      openclawConnected: false,
      agentSessions: new Map(),
    });
  });

  it('adds the user message locally before the backend send resolves', async () => {
    let resolveSend: (() => void) | undefined;
    sendMessage.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );

    const addMessagePromise = useChatStore.getState().addMessage('welcome', 'user', 'Ship it');
    const optimisticThread = useChatStore.getState().threads.find((thread) => thread.id === 'welcome');

    expect(optimisticThread?.messages.at(-1)?.text).toBe('Ship it');
    expect(optimisticThread?.messages.at(-1)?.role).toBe('user');

    resolveSend?.();
    await addMessagePromise;
  });
});
