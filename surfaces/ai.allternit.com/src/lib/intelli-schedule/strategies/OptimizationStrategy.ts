import type { IntelliScheduleInput, IntelliScheduleOutput } from '../types';

export abstract class OptimizationStrategy {
  abstract readonly name: string;
  abstract optimize(input: IntelliScheduleInput): IntelliScheduleOutput;

  protected allocateTask(
    task: IntelliScheduleInput['tasks'][number],
    startRef: number,
    hoursPerDay: number,
    bufferMs: number,
    dayAllocations: Record<string, number>,
    scheduledMap: Map<string, { startTime: Date; endTime: Date }>,
  ): { startTime: Date; endTime: Date } | null {
    const durationMs = task.estimatedMinutes * 60 * 1000;
    const deadlineMs = task.deadline?.getTime();

    let earliestStart = startRef;
    for (const depId of task.dependencies) {
      const dep = scheduledMap.get(depId);
      if (dep) {
        earliestStart = Math.max(earliestStart, dep.endTime.getTime() + bufferMs);
      }
    }

    let remainingMs = durationMs;
    const taskAllocations: Record<string, number> = {};
    let taskStartTime: Date | null = null;
    let currentStart = earliestStart;
    let totalDaysChecked = 0;
    const MAX_DAYS = 3650;

    const undoAllocations = () => {
      for (const [day, mins] of Object.entries(taskAllocations)) {
        dayAllocations[day] -= mins;
      }
    };

    while (remainingMs > 0.0001) {
      if (deadlineMs !== undefined && currentStart >= deadlineMs) {
        undoAllocations();
        return null;
      }
      if (totalDaysChecked > MAX_DAYS) {
        undoAllocations();
        return null;
      }
      totalDaysChecked++;

      const dayWorkStart = this.getWorkDayStart(currentStart, startRef);
      const dayWorkEnd = this.getWorkDayEnd(currentStart, startRef, hoursPerDay);
      const dayKey = this.formatDayKey(dayWorkStart);

      if (currentStart >= dayWorkEnd) {
        currentStart = this.getWorkDayStart(this.getNextWorkDayStart(currentStart, startRef), startRef);
        continue;
      }
      if (currentStart < dayWorkStart) {
        currentStart = dayWorkStart;
      }

      const allocateUntil = deadlineMs !== undefined ? Math.min(dayWorkEnd, deadlineMs) : dayWorkEnd;
      const availableInDay = allocateUntil - currentStart;

      if (availableInDay <= 0.0001) {
        currentStart = this.getWorkDayStart(this.getNextWorkDayStart(currentStart, startRef), startRef);
        continue;
      }

      const wantToAllocate = Math.min(remainingMs, availableInDay);
      const usedMs = (dayAllocations[dayKey] || 0) * 60 * 1000;
      const capacityMs = hoursPerDay * 60 * 60 * 1000;
      const actualAllocateMs = Math.min(wantToAllocate, Math.max(0, capacityMs - usedMs));

      if (actualAllocateMs > 0.0001) {
        if (!taskStartTime) {
          taskStartTime = new Date(currentStart);
        }
        const addedMinutes = actualAllocateMs / (60 * 1000);
        taskAllocations[dayKey] = (taskAllocations[dayKey] || 0) + addedMinutes;
        dayAllocations[dayKey] = (dayAllocations[dayKey] || 0) + addedMinutes;
        remainingMs -= actualAllocateMs;
        currentStart += actualAllocateMs;
      } else {
        currentStart = this.getWorkDayStart(this.getNextWorkDayStart(currentStart, startRef), startRef);
      }
    }

    if (taskStartTime) {
      return { startTime: taskStartTime, endTime: new Date(currentStart) };
    }
    return null;
  }

  protected calculateRisk(endTime: Date, deadline?: Date): 'low' | 'medium' | 'high' {
    if (!deadline) return 'low';
    const msUntilDeadline = deadline.getTime() - endTime.getTime();
    const ONE_HOUR = 60 * 60 * 1000;
    if (msUntilDeadline < 24 * ONE_HOUR) return 'high';
    if (msUntilDeadline < 72 * ONE_HOUR) return 'medium';
    return 'low';
  }

  private getWorkDayStart(ms: number, refMs: number): number {
    const ref = new Date(refMs);
    const d = new Date(ms);
    d.setHours(ref.getHours(), ref.getMinutes(), ref.getSeconds(), ref.getMilliseconds());
    return d.getTime();
  }

  private getWorkDayEnd(ms: number, refMs: number, hoursPerDay: number): number {
    return this.getWorkDayStart(ms, refMs) + hoursPerDay * 60 * 60 * 1000;
  }

  private getNextWorkDayStart(ms: number, refMs: number): number {
    const d = new Date(ms);
    d.setDate(d.getDate() + 1);
    return this.getWorkDayStart(d.getTime(), refMs);
  }

  private formatDayKey(ms: number): string {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
