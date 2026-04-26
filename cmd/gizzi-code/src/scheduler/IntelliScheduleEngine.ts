export interface IntelliScheduleInput {
  tasks: Array<{
    id: string;
    title: string;
    priority: number; // 1-100
    estimatedMinutes: number;
    deadline?: number; // timestamp (ms since epoch)
    dependencies: string[]; // task IDs that must complete first
    tags?: string[];
  }>;
  constraints: {
    availableHoursPerDay: number; // default 8
    startTime: number; // timestamp (ms since epoch)
    bufferMinutes: number; // default 15
  };
}

export interface IntelliScheduleOutput {
  orderedTasks: string[]; // Optimal execution order (task IDs)
  schedule: Array<{
    taskId: string;
    startTime: number; // timestamp
    endTime: number; // timestamp
    risk: 'low' | 'medium' | 'high';
  }>;
  unrunnable: string[]; // Tasks that cannot fit before deadline
}

interface ScheduleEntry {
  taskId: string;
  startTime: number;
  endTime: number;
  risk: 'low' | 'medium' | 'high';
}

export class IntelliScheduleEngine {
  optimize(input: IntelliScheduleInput): IntelliScheduleOutput {
    const { tasks, constraints } = input;
    const dayAllocations: Record<string, number> = {};
    const scheduledMap = new Map<string, ScheduleEntry>();
    const orderedTasks: string[] = [];
    const schedule: ScheduleEntry[] = [];
    const unrunnable: string[] = [];

    // Compute blocking counts (how many tasks depend on each task)
    const blockingCount: Record<string, number> = {};
    for (const task of tasks) {
      blockingCount[task.id] = 0;
    }
    for (const task of tasks) {
      for (const depId of task.dependencies) {
        if (depId in blockingCount) {
          blockingCount[depId]++;
        }
      }
    }

    // Sort by (-blocking_count, deadline_asc, -priority, estimated_duration_asc, id_asc)
    const sorted = [...tasks].sort((a, b) => {
      const bcA = blockingCount[a.id] ?? 0;
      const bcB = blockingCount[b.id] ?? 0;
      if (bcA !== bcB) return bcB - bcA;

      const dlA = a.deadline ?? Infinity;
      const dlB = b.deadline ?? Infinity;
      if (dlA !== dlB) return dlA - dlB;

      if (b.priority !== a.priority) return b.priority - a.priority;

      if (a.estimatedMinutes !== b.estimatedMinutes) {
        return a.estimatedMinutes - b.estimatedMinutes;
      }

      return a.id.localeCompare(b.id);
    });

    const startRef = constraints.startTime;
    const hoursPerDay = constraints.availableHoursPerDay;
    const bufferMs = constraints.bufferMinutes * 60 * 1000;

    if (hoursPerDay <= 0) {
      for (const task of sorted) {
        unrunnable.push(task.id);
      }
      return { orderedTasks, schedule, unrunnable };
    }

    for (const task of sorted) {
      const result = this.allocateTask(
        task,
        startRef,
        hoursPerDay,
        bufferMs,
        dayAllocations,
        scheduledMap,
      );
      if (result) {
        const risk = this.calculateRisk(result.endTime, task.deadline);
        const entry: ScheduleEntry = {
          taskId: task.id,
          startTime: result.startTime,
          endTime: result.endTime,
          risk,
        };
        scheduledMap.set(task.id, entry);
        orderedTasks.push(task.id);
        schedule.push(entry);
      } else {
        unrunnable.push(task.id);
      }
    }

    return { orderedTasks, schedule, unrunnable };
  }

  private allocateTask(
    task: IntelliScheduleInput['tasks'][number],
    startRef: number,
    hoursPerDay: number,
    bufferMs: number,
    dayAllocations: Record<string, number>,
    scheduledMap: Map<string, ScheduleEntry>,
  ): { startTime: number; endTime: number } | null {
    const durationMs = task.estimatedMinutes * 60 * 1000;
    const deadlineMs = task.deadline;

    // Find earliest start considering dependencies
    let earliestStart = startRef;
    for (const depId of task.dependencies) {
      const dep = scheduledMap.get(depId);
      if (dep) {
        earliestStart = Math.max(earliestStart, dep.endTime + bufferMs);
      }
    }

    let remainingMs = durationMs;
    const taskAllocations: Record<string, number> = {};
    let taskStartTime: number | null = null;
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
        currentStart = this.getWorkDayStart(
          this.getNextWorkDayStart(currentStart, startRef),
          startRef,
        );
        continue;
      }

      if (currentStart < dayWorkStart) {
        currentStart = dayWorkStart;
      }

      const allocateUntil =
        deadlineMs !== undefined ? Math.min(dayWorkEnd, deadlineMs) : dayWorkEnd;
      const availableInDay = allocateUntil - currentStart;

      if (availableInDay <= 0.0001) {
        currentStart = this.getWorkDayStart(
          this.getNextWorkDayStart(currentStart, startRef),
          startRef,
        );
        continue;
      }

      const wantToAllocate = Math.min(remainingMs, availableInDay);
      const usedMs = (dayAllocations[dayKey] || 0) * 60 * 1000;
      const capacityMs = hoursPerDay * 60 * 60 * 1000;
      const actualAllocateMs = Math.min(
        wantToAllocate,
        Math.max(0, capacityMs - usedMs),
      );

      if (actualAllocateMs > 0.0001) {
        if (taskStartTime === null) {
          taskStartTime = currentStart;
        }
        const addedMinutes = actualAllocateMs / (60 * 1000);
        taskAllocations[dayKey] = (taskAllocations[dayKey] || 0) + addedMinutes;
        dayAllocations[dayKey] = (dayAllocations[dayKey] || 0) + addedMinutes;
        remainingMs -= actualAllocateMs;
        currentStart += actualAllocateMs;
      } else {
        currentStart = this.getWorkDayStart(
          this.getNextWorkDayStart(currentStart, startRef),
          startRef,
        );
      }
    }

    if (taskStartTime !== null) {
      return { startTime: taskStartTime, endTime: currentStart };
    }

    return null;
  }

  private calculateRisk(
    endTime: number,
    deadline?: number,
  ): 'low' | 'medium' | 'high' {
    if (deadline === undefined) return 'low';
    const msUntilDeadline = deadline - endTime;
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
