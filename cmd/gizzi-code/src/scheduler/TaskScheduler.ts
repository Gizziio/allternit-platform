/**
 * Gizzi Task Scheduler
 * 
 * Manages recurring tasks from HEARTBEAT.md
 * - Daily tasks: Run every 24 hours
 * - Weekly tasks: Run every 7 days  
 * - Monthly tasks: Run every 30 days
 */

export type TaskFrequency = 'startup' | 'daily' | 'weekly' | 'monthly';

export interface ScheduledTask {
  id: string;
  action: string;
  frequency: TaskFrequency;
  completed: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export interface SchedulerJob {
  id: string;
  taskId: string;
  agentId: string;
  frequency: TaskFrequency;
  nextRunAt: number;
  lastRunAt?: number;
  enabled: boolean;
}

/**
 * Calculate next run time based on frequency
 */
function calculateNextRun(frequency: TaskFrequency, fromTimestamp: number = Date.now()): number {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  
  switch (frequency) {
    case 'daily':
      return fromTimestamp + ONE_DAY;
    case 'weekly':
      return fromTimestamp + 7 * ONE_DAY;
    case 'monthly':
      return fromTimestamp + 30 * ONE_DAY;
    default:
      return fromTimestamp + ONE_DAY;
  }
}

/**
 * Task Scheduler for Gizzi
 */
export class TaskScheduler {
  private jobs: Map<string, SchedulerJob> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 60000; // 1 minute
  private isRunning: boolean = false;
  private onTaskExecute?: (task: SchedulerJob) => Promise<void>;

  constructor(options?: {
    checkIntervalMs?: number;
    onTaskExecute?: (task: SchedulerJob) => Promise<void>;
  }) {
    this.checkIntervalMs = options?.checkIntervalMs || 60000;
    this.onTaskExecute = options?.onTaskExecute;
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('[TaskScheduler] Already running');
      return;
    }

    console.log(`[TaskScheduler] Starting with ${this.checkIntervalMs}ms interval`);
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.checkAndExecuteJobs();
    }, this.checkIntervalMs);

    // Initial check
    this.checkAndExecuteJobs();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[TaskScheduler] Stopped');
  }

  /**
   * Register tasks from HEARTBEAT.md
   */
  registerTasks(agentId: string, tasks: ScheduledTask[]): void {
    // Remove existing jobs for this agent
    for (const [id, job] of this.jobs) {
      if (job.agentId === agentId) {
        this.jobs.delete(id);
      }
    }

    // Add recurring tasks (not startup tasks)
    for (const task of tasks) {
      if (task.frequency === 'startup') continue;

      const jobId = `${agentId}_${task.id}`;
      const job: SchedulerJob = {
        id: jobId,
        taskId: task.id,
        agentId,
        frequency: task.frequency,
        nextRunAt: calculateNextRun(task.frequency),
        enabled: true,
      };

      this.jobs.set(jobId, job);
      console.log(`[TaskScheduler] Registered job ${jobId}, next run: ${new Date(job.nextRunAt).toISOString()}`);
    }
  }

  /**
   * Unregister all tasks for an agent
   */
  unregisterAgentTasks(agentId: string): void {
    for (const [id, job] of this.jobs) {
      if (job.agentId === agentId) {
        this.jobs.delete(id);
        console.log(`[TaskScheduler] Unregistered job ${id}`);
      }
    }
  }

  /**
   * Get all jobs
   */
  getJobs(): SchedulerJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get jobs for a specific agent
   */
  getJobsForAgent(agentId: string): SchedulerJob[] {
    return Array.from(this.jobs.values()).filter(job => job.agentId === agentId);
  }

  /**
   * Get jobs that are due for execution
   */
  getDueJobs(): SchedulerJob[] {
    const now = Date.now();
    return Array.from(this.jobs.values()).filter(
      job => job.enabled && job.nextRunAt <= now
    );
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    totalJobs: number;
    dueJobs: number;
    nextJob: SchedulerJob | null;
  } {
    const jobs = Array.from(this.jobs.values());
    const enabledJobs = jobs.filter(j => j.enabled);
    const nextJob = enabledJobs.length > 0
      ? enabledJobs.sort((a, b) => a.nextRunAt - b.nextRunAt)[0]
      : null;

    return {
      isRunning: this.isRunning,
      totalJobs: jobs.length,
      dueJobs: this.getDueJobs().length,
      nextJob,
    };
  }

  /**
   * Enable a job
   */
  enableJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = true;
      job.nextRunAt = calculateNextRun(job.frequency);
    }
  }

  /**
   * Disable a job
   */
  disableJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.enabled = false;
    }
  }

  /**
   * Record job execution
   */
  recordExecution(jobId: string, success: boolean): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.lastRunAt = Date.now();
      job.nextRunAt = calculateNextRun(job.frequency);
      console.log(`[TaskScheduler] Job ${jobId} executed: ${success ? 'success' : 'failed'}`);
    }
  }

  /**
   * Check and execute due jobs
   */
  private async checkAndExecuteJobs(): Promise<void> {
    const dueJobs = this.getDueJobs();

    if (dueJobs.length === 0) return;

    console.log(`[TaskScheduler] ${dueJobs.length} jobs due for execution`);

    for (const job of dueJobs) {
      await this.executeJob(job);
    }
  }

  /**
   * Execute a single job
   */
  private async executeJob(job: SchedulerJob): Promise<void> {
    console.log(`[TaskScheduler] Executing job ${job.id}`);

    try {
      if (this.onTaskExecute) {
        await this.onTaskExecute(job);
      } else {
        // Default execution - just log
        console.log(`[TaskScheduler] Would execute: ${job.taskId}`);
      }

      this.recordExecution(job.id, true);
    } catch (error) {
      console.error(`[TaskScheduler] Job ${job.id} failed:`, error);
      this.recordExecution(job.id, false);
    }
  }

  /**
   * Returns due jobs re-ordered by IntelliScheduleEngine priority.
   * Jobs without estimatedMinutes are given a default of 60 minutes.
   */
  optimize(tasks?: Array<{
    id: string;
    priority?: number;
    estimatedMinutes?: number;
    deadline?: number;
    dependencies?: string[];
  }>): SchedulerJob[] {
    const { IntelliScheduleEngine } = require('./IntelliScheduleEngine') as typeof import('./IntelliScheduleEngine');
    const engine = new IntelliScheduleEngine();

    const jobs = Array.from(this.jobs.values()).filter((j) => j.enabled);
    const taskMeta = new Map((tasks ?? []).map((t) => [t.id, t]));

    const input = {
      tasks: jobs.map((job) => {
        const meta = taskMeta.get(job.taskId);
        return {
          id: job.id,
          title: job.taskId,
          priority: meta?.priority ?? 50,
          estimatedMinutes: meta?.estimatedMinutes ?? 60,
          deadline: meta?.deadline,
          dependencies: meta?.dependencies ?? [],
        };
      }),
      constraints: {
        availableHoursPerDay: 8,
        startTime: Date.now(),
        bufferMinutes: 15,
      },
    };

    const result = engine.optimize(input);
    const rankMap = new Map(result.orderedTasks.map((id, idx) => [id, idx]));
    return jobs.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999));
  }
}

// Export singleton instance
export const taskScheduler = new TaskScheduler();
