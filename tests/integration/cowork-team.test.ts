import { describe, it, expect, beforeEach } from 'vitest';
import { useCoworkStore } from '../../surfaces/allternit-platform/src/views/cowork/CoworkStore';

function resetStore() {
  useCoworkStore.setState({
    tasks: [],
    activeTaskId: null,
    taskSessions: {},
    projects: [],
    activeProjectId: null,
    session: null,
    sessionHistory: [],
    selectedEventId: null,
    isTimelineExpanded: true,
    viewportZoom: 1,
    showOcr: false,
    showLabels: true,
    activeTab: 'tasks',
    parts: {},
  });
}

describe('Cowork Team Integration', () => {
  beforeEach(() => {
    resetStore();
  });

  it('creates a task with workspaceId and persists it in store', () => {
    const store = useCoworkStore.getState();
    const task = store.createTask('Team Task', 'task');
    store.setTaskWorkspaceId(task.id, 'workspace-1');

    const persisted = useCoworkStore.getState().tasks.find((t) => t.id === task.id);
    expect(persisted).toBeDefined();
    expect(persisted!.workspaceId).toBe('workspace-1');
  });

  it('assigns task to agent and sets assigneeType, assigneeId, assigneeName', () => {
    const store = useCoworkStore.getState();
    const task = store.createTask('Agent Task', 'agent');
    store.assignTask(task.id, 'agent', 'agent-123', '@build-agent');

    const persisted = useCoworkStore.getState().tasks.find((t) => t.id === task.id);
    expect(persisted!.assigneeType).toBe('agent');
    expect(persisted!.assigneeId).toBe('agent-123');
    expect(persisted!.assigneeName).toBe('@build-agent');
  });

  it('unassigns task and clears assignee fields', () => {
    const store = useCoworkStore.getState();
    const task = store.createTask('Assigned Task', 'task');
    store.assignTask(task.id, 'human', 'user-1', 'Alice');
    store.unassignTask(task.id);

    const persisted = useCoworkStore.getState().tasks.find((t) => t.id === task.id);
    expect(persisted!.assigneeType).toBeUndefined();
    expect(persisted!.assigneeId).toBeUndefined();
    expect(persisted!.assigneeName).toBeUndefined();
  });

  it('adds comment to task and updates comments array', () => {
    const store = useCoworkStore.getState();
    const task = store.createTask('Comment Task', 'task');
    store.addComment(task.id, 'Bob', 'This needs review');

    const persisted = useCoworkStore.getState().tasks.find((t) => t.id === task.id);
    expect(persisted!.comments).toHaveLength(1);
    expect(persisted!.comments![0].author).toBe('Bob');
    expect(persisted!.comments![0].body).toBe('This needs review');
  });

  it('filters tasks by workspace', () => {
    const store = useCoworkStore.getState();
    const taskA = store.createTask('Task A', 'task');
    const taskB = store.createTask('Task B', 'task');
    store.setTaskWorkspaceId(taskA.id, 'ws-alpha');
    store.setTaskWorkspaceId(taskB.id, 'ws-beta');

    const alphaTasks = useCoworkStore.getState().tasks.filter((t) => t.workspaceId === 'ws-alpha');
    const betaTasks = useCoworkStore.getState().tasks.filter((t) => t.workspaceId === 'ws-beta');

    expect(alphaTasks).toHaveLength(1);
    expect(alphaTasks[0].title).toBe('Task A');
    expect(betaTasks).toHaveLength(1);
    expect(betaTasks[0].title).toBe('Task B');
  });
});
