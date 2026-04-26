import { describe, it, expect, beforeEach } from 'vitest';
import { IntelliScheduleEngine } from '../../surfaces/allternit-platform/src/lib/intelli-schedule/IntelliScheduleEngine';
import { useCoworkStore } from '../../surfaces/allternit-platform/src/views/cowork/CoworkStore';
import type { IntelliScheduleInput } from '../../surfaces/allternit-platform/src/lib/intelli-schedule/types';

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

describe('IntelliSchedule Engine', () => {
  it('optimizeSchedule reorders tasks by priority', () => {
    const start = new Date('2024-01-01T09:00:00');
    const input: IntelliScheduleInput = {
      tasks: [
        { id: 't1', title: 'Low', priority: 10, estimatedMinutes: 60, dependencies: [] },
        { id: 't2', title: 'High', priority: 90, estimatedMinutes: 60, dependencies: [] },
        { id: 't3', title: 'Medium', priority: 50, estimatedMinutes: 60, dependencies: [] },
      ],
      constraints: { availableHoursPerDay: 8, startTime: start, bufferMinutes: 15 },
    };

    const engine = new IntelliScheduleEngine();
    const result = engine.optimize(input);

    expect(result.orderedTasks).toEqual(['t2', 't3', 't1']);
    expect(result.unrunnable).toHaveLength(0);
  });

  it('optimizeSchedule respects dependencies', () => {
    const start = new Date('2024-01-01T09:00:00');
    const input: IntelliScheduleInput = {
      tasks: [
        { id: 't2', title: 'Dependent', priority: 100, estimatedMinutes: 60, dependencies: ['t1'] },
        { id: 't1', title: 'Base', priority: 10, estimatedMinutes: 60, dependencies: [] },
      ],
      constraints: { availableHoursPerDay: 8, startTime: start, bufferMinutes: 15 },
    };

    const result = new IntelliScheduleEngine().optimize(input);

    expect(result.orderedTasks[0]).toBe('t1');
    expect(result.orderedTasks[1]).toBe('t2');

    const t1Schedule = result.schedule.find((s) => s.taskId === 't1')!;
    const t2Schedule = result.schedule.find((s) => s.taskId === 't2')!;
    expect(t2Schedule.startTime.getTime()).toBeGreaterThanOrEqual(
      t1Schedule.endTime.getTime() + 15 * 60 * 1000,
    );
  });

  it('optimizeSchedule marks oversized tasks as unrunnable', () => {
    const start = new Date('2024-01-01T09:00:00');
    const input: IntelliScheduleInput = {
      tasks: [
        {
          id: 't1',
          title: 'Too Big',
          priority: 50,
          estimatedMinutes: 20 * 60,
          deadline: new Date('2024-01-02T17:00:00'),
          dependencies: [],
        },
      ],
      constraints: { availableHoursPerDay: 8, startTime: start, bufferMinutes: 15 },
    };

    const result = new IntelliScheduleEngine().optimize(input);
    expect(result.unrunnable).toContain('t1');
    expect(result.schedule).toHaveLength(0);
  });
});

describe('CoworkStore Intelli-Schedule Integration', () => {
  beforeEach(() => {
    resetStore();
  });

  it('setTaskEstimate updates estimatedMinutes', () => {
    const store = useCoworkStore.getState();
    const task = store.createTask('Estimation Task', 'task');
    store.setTaskEstimate(task.id, 120);

    const persisted = useCoworkStore.getState().tasks.find((t) => t.id === task.id);
    expect(persisted!.estimatedMinutes).toBe(120);
  });

  it('setTaskDeadline updates deadline', () => {
    const store = useCoworkStore.getState();
    const task = store.createTask('Deadline Task', 'task');
    const deadline = '2024-12-31T23:59:59Z';
    store.setTaskDeadline(task.id, deadline);

    const persisted = useCoworkStore.getState().tasks.find((t) => t.id === task.id);
    expect(persisted!.deadline).toBe(deadline);
  });

  it('setTaskPriority updates priority', () => {
    const store = useCoworkStore.getState();
    const task = store.createTask('Priority Task', 'task');
    store.setTaskPriority(task.id, 85);

    const persisted = useCoworkStore.getState().tasks.find((t) => t.id === task.id);
    expect(persisted!.priority).toBe(85);
  });

  it('setTaskDependencies updates dependencies', () => {
    const store = useCoworkStore.getState();
    const task = store.createTask('Dependency Task', 'task');
    store.setTaskDependencies(task.id, ['dep-1', 'dep-2']);

    const persisted = useCoworkStore.getState().tasks.find((t) => t.id === task.id);
    expect(persisted!.dependencies).toEqual(['dep-1', 'dep-2']);
  });

  it('optimizeSchedule sets optimizeRank and risk on tasks', () => {
    const store = useCoworkStore.getState();
    const task1 = store.createTask('High Priority', 'task');
    const task2 = store.createTask('Low Priority', 'task');
    store.setTaskPriority(task1.id, 90);
    store.setTaskEstimate(task1.id, 60);
    store.setTaskPriority(task2.id, 10);
    store.setTaskEstimate(task2.id, 60);

    store.optimizeSchedule();

    const persisted1 = useCoworkStore.getState().tasks.find((t) => t.id === task1.id);
    const persisted2 = useCoworkStore.getState().tasks.find((t) => t.id === task2.id);

    expect(persisted1!.optimizeRank).toBeDefined();
    expect(persisted2!.optimizeRank).toBeDefined();
    expect(persisted1!.risk).toBeDefined();
    expect(persisted2!.risk).toBeDefined();

    // Higher priority should be ranked first
    expect(persisted1!.optimizeRank).toBeLessThan(persisted2!.optimizeRank!);
  });
});
