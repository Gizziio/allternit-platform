/**
 * Tests for useTaskStore's server sync semantics:
 * - fetchTasks merges server tasks in by id instead of replacing the list,
 *   so local-only tasks (HEARTBEAT-injected heartbeat_* entries) survive;
 * - a failed mutation reverts only its own task and leaves concurrent
 *   mutations to other tasks intact.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useTaskStore, type Task } from './useTaskStore';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2, 9)}`,
    title: 'Task',
    mode: 'task',
    status: 'pending',
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
    ...overrides,
  };
}

function okResponse(): Response {
  return new Response(null, { status: 200 });
}

function flushAsync(): Promise<void> {
  // Mutation promises resolve over several microtask hops; a macrotask turn
  // settles them all without fake timers.
  return new Promise((r) => setTimeout(r, 10));
}

describe('useTaskStore fetchTasks merge', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{"tasks":[]}', { status: 200 }))),
    );
    useTaskStore.setState({ tasks: [], pendingMutations: [], apiEnabled: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('merges server tasks by id and preserves local-only heartbeat_* tasks intact', async () => {
    const localShared = makeTask({ id: 'task-shared', title: 'stale local title' });
    const heartbeat = makeTask({
      id: 'heartbeat_daily-standup',
      title: 'Daily standup',
      mode: 'agent',
      description: 'injected by HEARTBEAT.md',
      tags: ['recurring'],
    });
    useTaskStore.setState({ tasks: [localShared, heartbeat] });

    const serverShared = {
      id: 'task-shared',
      title: 'server title wins',
      workspace_id: 'ws_42',
      status: 'in-progress',
      created_at: '2026-09-12T00:00:00.000Z',
      updated_at: '2026-09-13T00:00:00.000Z',
    };
    const serverOnly = {
      id: 'task-server-only',
      title: 'from server',
      workspace_id: 'default',
      status: 'backlog',
      created_at: '2026-09-13T00:00:00.000Z',
      updated_at: '2026-09-13T00:00:00.000Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ tasks: [serverShared, serverOnly] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );

    await useTaskStore.getState().fetchTasks();

    const tasks = useTaskStore.getState().tasks;
    const byId = new Map(tasks.map((t) => [t.id, t]));

    // Server task wins the id conflict and is mapped onto store fields.
    expect(byId.get('task-shared')?.title).toBe('server title wins');
    expect(byId.get('task-shared')?.status).toBe('in_progress');
    expect(byId.get('task-shared')?.projectId).toBe('ws_42');
    expect(byId.get('task-server-only')?.title).toBe('from server');
    // The API never returns heartbeat tasks — they must survive untouched.
    const hb = byId.get('heartbeat_daily-standup');
    expect(hb).toBeDefined();
    expect(hb).toEqual(heartbeat);
  });

  it('keeps local tasks when the fetch fails', async () => {
    const local = makeTask({ id: 'task-local' });
    useTaskStore.setState({ tasks: [local] });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('boom', { status: 500 }))),
    );

    await useTaskStore.getState().fetchTasks();

    expect(useTaskStore.getState().tasks).toEqual([local]);
  });
});

describe('useTaskStore failed-mutation revert', () => {
  beforeEach(() => {
    useTaskStore.setState({ tasks: [], pendingMutations: [], apiEnabled: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reverts only the failed task and leaves concurrent mutations intact', async () => {
    const taskA = makeTask({ id: 'task-a', title: 'Alpha' });
    const taskB = makeTask({ id: 'task-b', title: 'Beta' });
    useTaskStore.setState({ tasks: [taskA, taskB] });

    vi.stubGlobal(
      'fetch',
      vi.fn((input: unknown) => {
        const url = String(input);
        if (url.endsWith('/api/v1/tasks/task-a')) {
          return Promise.resolve(new Response('nope', { status: 500 }));
        }
        return Promise.resolve(okResponse());
      }),
    );

    useTaskStore.getState().renameTask('task-a', 'Alpha edited');
    useTaskStore.getState().renameTask('task-b', 'Beta edited');

    // Both tasks are optimistically updated before the server answers.
    let tasks = useTaskStore.getState().tasks;
    expect(tasks.find((t) => t.id === 'task-a')?.title).toBe('Alpha edited');
    expect(tasks.find((t) => t.id === 'task-b')?.title).toBe('Beta edited');
    expect(useTaskStore.getState().pendingMutations).toHaveLength(2);

    await vi.waitFor(() => {
      expect(useTaskStore.getState().pendingMutations).toHaveLength(0);
    });

    tasks = useTaskStore.getState().tasks;
    // The failed mutation restores its own pre-mutation snapshot...
    expect(tasks.find((t) => t.id === 'task-a')?.title).toBe('Alpha');
    // ...without clobbering the concurrent mutation that succeeded.
    expect(tasks.find((t) => t.id === 'task-b')?.title).toBe('Beta edited');
  });

  it('rolls back a failed createTask by removing only the new task', async () => {
    const existing = makeTask({ id: 'task-existing', title: 'Existing' });
    useTaskStore.setState({ tasks: [existing] });

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('nope', { status: 500 }))),
    );

    const created = useTaskStore.getState().createTask('Doomed');
    expect(useTaskStore.getState().tasks.map((t) => t.id)).toContain(created.id);

    await vi.waitFor(() => {
      expect(useTaskStore.getState().tasks.map((t) => t.id)).not.toContain(created.id);
    });
    expect(useTaskStore.getState().tasks).toEqual([existing]);
  });

  it('does not touch tasks when apiEnabled is false', async () => {
    const taskA = makeTask({ id: 'task-a', title: 'Alpha' });
    useTaskStore.setState({ tasks: [taskA], apiEnabled: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    useTaskStore.getState().renameTask('task-a', 'Alpha edited');
    await flushAsync();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useTaskStore.getState().tasks.find((t) => t.id === 'task-a')?.title).toBe('Alpha edited');
  });
});
