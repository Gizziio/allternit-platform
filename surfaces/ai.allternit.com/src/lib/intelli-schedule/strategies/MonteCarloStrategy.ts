import { OptimizationStrategy } from './OptimizationStrategy';
import type { IntelliScheduleInput, IntelliScheduleOutput } from '../types';
import { GreedyStrategy } from './GreedyStrategy';

export class MonteCarloStrategy extends OptimizationStrategy {
  readonly name = 'monte-carlo';
  private iterations = 200;

  optimize(input: IntelliScheduleInput): IntelliScheduleOutput {
    const greedy = new GreedyStrategy();
    let bestResult = greedy.optimize(input);
    let bestScore = this.score(bestResult);

    if (input.tasks.length < 3) return bestResult;

    const taskIds = input.tasks.map((t) => t.id);

    for (let i = 0; i < this.iterations; i++) {
      const shuffled = this.shuffle([...taskIds]);
      const result = this.buildResult(shuffled, input);
      const s = this.score(result);
      if (s > bestScore) {
        bestScore = s;
        bestResult = result;
      }
    }

    return bestResult;
  }

  private shuffle(arr: string[]): string[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private score(result: IntelliScheduleOutput): number {
    let s = result.orderedTasks.length * 100;
    for (const entry of result.schedule) {
      if (entry.risk === 'low') s += 10;
      else if (entry.risk === 'medium') s += 5;
    }
    s -= result.unrunnable.length * 50;
    return s;
  }

  private buildResult(order: string[], input: IntelliScheduleInput): IntelliScheduleOutput {
    const { constraints } = input;
    const taskMap = new Map(input.tasks.map((t) => [t.id, t]));
    const dayAllocations: Record<string, number> = {};
    const scheduledMap = new Map<string, { startTime: Date; endTime: Date }>();
    const orderedTasks: string[] = [];
    const schedule: IntelliScheduleOutput['schedule'] = [];
    const unrunnable: string[] = [];

    const startRef = constraints.startTime.getTime();
    const hoursPerDay = constraints.availableHoursPerDay;
    const bufferMs = constraints.bufferMinutes * 60 * 1000;

    for (const taskId of order) {
      const task = taskMap.get(taskId);
      if (!task) continue;
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
