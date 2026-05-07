import { describe, it, expect } from 'vitest';
import { IntelliScheduleEngine } from './IntelliScheduleEngine';
import type { IntelliScheduleInput } from './types';

describe('IntelliScheduleEngine', () => {
  it('schedules high priority tasks first', () => {
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
    expect(result.schedule).toHaveLength(3);
  });

  it('schedules urgent deadlines first when priority is equal', () => {
    const start = new Date('2024-01-01T09:00:00');
    const input: IntelliScheduleInput = {
      tasks: [
        {
          id: 't1',
          title: 'Later',
          priority: 50,
          estimatedMinutes: 60,
          deadline: new Date('2024-01-05T17:00:00'),
          dependencies: [],
        },
        {
          id: 't2',
          title: 'Sooner',
          priority: 50,
          estimatedMinutes: 60,
          deadline: new Date('2024-01-03T17:00:00'),
          dependencies: [],
        },
      ],
      constraints: { availableHoursPerDay: 8, startTime: start, bufferMinutes: 15 },
    };

    const result = new IntelliScheduleEngine().optimize(input);

    expect(result.orderedTasks[0]).toBe('t2');
    expect(result.orderedTasks[1]).toBe('t1');
  });

  it('respects dependency chains', () => {
    const start = new Date('2024-01-01T09:00:00');
    const input: IntelliScheduleInput = {
      tasks: [
        {
          id: 't2',
          title: 'Dependent',
          priority: 100,
          estimatedMinutes: 60,
          dependencies: ['t1'],
        },
        {
          id: 't1',
          title: 'Base',
          priority: 10,
          estimatedMinutes: 60,
          dependencies: [],
        },
      ],
      constraints: { availableHoursPerDay: 8, startTime: start, bufferMinutes: 15 },
    };

    const result = new IntelliScheduleEngine().optimize(input);

    expect(result.orderedTasks[0]).toBe('t1');
    expect(result.orderedTasks[1]).toBe('t2');

    const t1Schedule = result.schedule.find(s => s.taskId === 't1')!;
    const t2Schedule = result.schedule.find(s => s.taskId === 't2')!;

    expect(t2Schedule.startTime.getTime()).toBeGreaterThanOrEqual(
      t1Schedule.endTime.getTime() + 15 * 60 * 1000,
    );
  });

  it('marks tasks that cannot fit before deadline as unrunnable', () => {
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

  it('handles 10 mixed tasks respecting all constraints', () => {
    const start = new Date('2024-01-01T09:00:00');
    const tasks: IntelliScheduleInput['tasks'] = [
      {
        id: 't1',
        title: 'A',
        priority: 80,
        estimatedMinutes: 120,
        deadline: new Date('2024-01-03T17:00:00'),
        dependencies: [],
      },
      { id: 't2', title: 'B', priority: 60, estimatedMinutes: 60, dependencies: ['t1'] },
      { id: 't3', title: 'C', priority: 90, estimatedMinutes: 30, dependencies: [] },
      {
        id: 't4',
        title: 'D',
        priority: 40,
        estimatedMinutes: 180,
        deadline: new Date('2024-01-05T17:00:00'),
        dependencies: [],
      },
      { id: 't5', title: 'E', priority: 70, estimatedMinutes: 45, dependencies: ['t3'] },
      { id: 't6', title: 'F', priority: 50, estimatedMinutes: 90, dependencies: [] },
      {
        id: 't7',
        title: 'G',
        priority: 30,
        estimatedMinutes: 240,
        deadline: new Date('2024-01-10T17:00:00'),
        dependencies: [],
      },
      { id: 't8', title: 'H', priority: 20, estimatedMinutes: 15, dependencies: ['t5', 't6'] },
      {
        id: 't9',
        title: 'I',
        priority: 10,
        estimatedMinutes: 3000,
        deadline: new Date('2024-01-04T17:00:00'),
        dependencies: [],
      },
      { id: 't10', title: 'J', priority: 100, estimatedMinutes: 60, dependencies: [] },
    ];

    const input: IntelliScheduleInput = {
      tasks,
      constraints: { availableHoursPerDay: 8, startTime: start, bufferMinutes: 15 },
    };

    const result = new IntelliScheduleEngine().optimize(input);

    // t9 should be unrunnable (3000 min = 50h > 4 days * 8h = 32h)
    expect(result.unrunnable).toContain('t9');

    // Dependency order respected
    const idx = (id: string) => result.orderedTasks.indexOf(id);
    expect(idx('t1')).toBeLessThan(idx('t2'));
    expect(idx('t3')).toBeLessThan(idx('t5'));
    expect(idx('t5')).toBeLessThan(idx('t8'));
    expect(idx('t6')).toBeLessThan(idx('t8'));

    // All scheduled tasks should meet deadlines
    for (const entry of result.schedule) {
      const task = tasks.find(t => t.id === entry.taskId)!;
      if (task.deadline) {
        expect(entry.endTime.getTime()).toBeLessThanOrEqual(task.deadline.getTime());
      }
    }

    // Buffer respected
    for (const entry of result.schedule) {
      const task = tasks.find(t => t.id === entry.taskId)!;
      for (const depId of task.dependencies) {
        const depEntry = result.schedule.find(s => s.taskId === depId)!;
        expect(entry.startTime.getTime()).toBeGreaterThanOrEqual(
          depEntry.endTime.getTime() + 15 * 60 * 1000,
        );
      }
    }
  });
});
