import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from './ChatStore';

const createSession = vi.fn(() =>
  Promise.resolve({
    id: 'test-session-id',
    name: 'Test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    messageCount: 0,
    isActive: true,
    tags: [],
  }),
);
const deleteSession = vi.fn(() => Promise.resolve());
const updateSession = vi.fn(() => Promise.resolve());
const setActiveSession = vi.fn();

vi.mock('@/lib/agents/native-agent.store', () => ({
  useNativeAgentStore: Object.assign(
    (selector?: (state: any) => unknown) => {
      const state = {
        sessions: [],
        activeSessionId: null,
        sessionIdBySurface: { chat: null, cowork: null, code: null, browser: null },
        setSurfaceSession: vi.fn(),
        clearSurfaceSession: vi.fn(),
        clearAllSurfaceSessions: vi.fn(),
        createSession,
        deleteSession,
        updateSession,
        setActiveSession,
      };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        sessions: [],
        activeSessionId: null,
        sessionIdBySurface: { chat: null, cowork: null, code: null, browser: null },
        setSurfaceSession: vi.fn(),
        clearSurfaceSession: vi.fn(),
        clearAllSurfaceSessions: vi.fn(),
        createSession,
        deleteSession,
        updateSession,
        setActiveSession,
      }),
      subscribe: vi.fn(() => () => {}),
    },
  ),
}));

vi.mock('../../integration/kernel/projects', () => ({
  createProject: vi.fn(() => Promise.resolve({ id: 'test-project-id' })),
}));

describe('ChatStore', () => {
  beforeEach(() => {
    localStorage.clear();
    createSession.mockClear();
    deleteSession.mockClear();
    updateSession.mockClear();
    setActiveSession.mockClear();
    useChatStore.setState({
      threads: [],
      activeThreadId: null,
      projects: [],
      activeProjectId: null,
      activeProjectLocalKey: null,
      sandboxMode: 'read-only',
    });
  });

  it('createThread calls NativeAgentStore.createSession and returns the id', async () => {
    const id = await useChatStore.getState().createThread('My Thread');
    expect(createSession).toHaveBeenCalledWith('My Thread', undefined, expect.objectContaining({ sessionMode: 'regular' }));
    expect(typeof id).toBe('string');
  });

  it('deleteThread calls NativeAgentStore.deleteSession', () => {
    useChatStore.getState().deleteThread('some-id');
    expect(deleteSession).toHaveBeenCalledWith('some-id');
  });

  it('renameThread calls NativeAgentStore.updateSession', () => {
    useChatStore.getState().renameThread('some-id', 'New Name');
    expect(updateSession).toHaveBeenCalledWith('some-id', { name: 'New Name' });
  });

  it('setActiveThread calls NativeAgentStore.setActiveSession', () => {
    useChatStore.getState().setActiveThread('some-id');
    expect(setActiveSession).toHaveBeenCalledWith('some-id');
  });

  it('sandboxMode persists and toggles', () => {
    expect(useChatStore.getState().sandboxMode).toBe('read-only');
    useChatStore.getState().setSandboxMode('full');
    expect(useChatStore.getState().sandboxMode).toBe('full');
  });
});
