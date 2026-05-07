import { OptimizationStrategy } from './OptimizationStrategy';
import type { IntelliScheduleInput, IntelliScheduleOutput } from '../types';
import { getDependencyDepth } from '../utils/dependencyGraph';

export class DependencyAwareStrategy extends OptimizationStrategy {
  readonly name = 'dependency-aware';

  optimize(input: IntelliScheduleInput): IntelliScheduleOutput {
    const { tasks, constraints } = input;
    const dayAllocations: Record<string, number> = {};
    const scheduledMap = new Map<string, { startTime: Date; endTime: Date }>();
    const orderedTasks: string[] = [];
    const schedule: IntelliScheduleOutput['schedule'] = [];
    const unrunnable: string[] = [];

    const sorted = [...tasks].sort((a, b) => {
      const depthA = getDependencyDepth(tasks, a.id);
      const depthB = getDependencyDepth(tasks, b.id);
      if (depthA !== depthB) return depthB - depthA;
      const dlA = a.deadline?.getTime() ?? Infinity;
      const dlB = b.deadline?.getTime() ?? Infinity;
      if (dlA !== dlB) return dlA - dlB;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.estimatedMinutes - b.estimatedMinutes;
    });

    const startRef = constraints.startTime.getTime();
    const hoursPerDay = constraints.availableHoursPerDay;
    const bufferMs = constraints.bufferMinutes * 60 * 1000;

    if (hoursPerDay <= 0) {
      for (const task of sorted) unrunnable.push(task.id);
      return { orderedTasks, schedule, unrunnable };
    }

    for (const task of sorted) {
      const result = this.allocateTask(task, startRef, hoursPerDay, bufferMs, dayAllocations, scheduledMap);
      if (result) {
        const risk = this.calculateRisk(result.endTime, task.deadline);
        scheduledMap.set(task.id, result);
        orderedTasks.push(task.id);
        schedule.push({ taskId: task.id, startTime: result.startTime, endTime: result.endTime, risk });
      } else {
        unrunnable.push(task.id);
      }
    }

    return { orderedTasks, schedule, unrunnable };
  }
}
