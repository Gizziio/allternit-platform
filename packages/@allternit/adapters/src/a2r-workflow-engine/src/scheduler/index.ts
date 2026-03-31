/**
 * Workflow Scheduler
 * 
 * Handles parallel execution, queuing, and resource management.
 */

import type { WorkflowExecution, WorkflowNode, ExecutionContext } from '../types';

export interface SchedulerConfig {
  /** Max concurrent tasks */
  maxConcurrency?: number;
  /** Queue size limit */
  queueLimit?: number;
  /** Default task timeout (ms) */
  defaultTimeout?: number;
  /** Enable task prioritization */
  enablePriority?: boolean;
}

export interface Task {
  id: string;
  node: WorkflowNode;
  execution: WorkflowExecution;
  priority?: number;
  timeout?: number;
}

export interface Scheduler {
  /** Submit task for execution */
  submit(task: Task): Promise<unknown>;
  /** Submit multiple tasks (parallel) */
  submitAll(tasks: Task[]): Promise<unknown[]>;
  /** Cancel task */
  cancel(taskId: string): boolean;
  /** Get queue status */
  getStatus(): SchedulerStatus;
  /** Pause scheduler */
  pause(): void;
  /** Resume scheduler */
  resume(): void;
}

export interface SchedulerStatus {
  running: number;
  queued: number;
  completed: number;
  failed: number;
  isPaused: boolean;
}

/**
 * Create workflow scheduler
 */
export function createScheduler(config: SchedulerConfig = {}): Scheduler {
  const {
    maxConcurrency = 5,
    queueLimit = 100,
    defaultTimeout = 60000,
    enablePriority = false,
  } = config;

  const queue: Task[] = [];
  const running = new Map<string, AbortController>();
  let isPaused = false;
  let completed = 0;
  let failed = 0;

  /**
   * Process queue
   */
  async function processQueue(): Promise<void> {
    if (isPaused || running.size >= maxConcurrency || queue.length === 0) {
      return;
    }

    // Sort by priority if enabled
    if (enablePriority) {
      queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    const task = queue.shift();
    if (!task) return;

    const controller = new AbortController();
    running.set(task.id, controller);

    try {
      const timeout = task.timeout || defaultTimeout;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Execute task
      const result = await executeTask(task, controller.signal);
      
      clearTimeout(timeoutId);
      completed++;
      
      return;
    } catch (error) {
      failed++;
      throw error;
    } finally {
      running.delete(task.id);
      // Process next
      processQueue();
    }
  }

  /**
   * Execute task
   */
  async function executeTask(task: Task, signal: AbortSignal): Promise<unknown> {
    if (signal.aborted) {
      throw new Error('Task cancelled');
    }

    // Task execution logic here
    // This would integrate with the workflow engine
    return { taskId: task.id, status: 'completed' };
  }

  /**
   * Submit task
   */
  async function submit(task: Task): Promise<unknown> {
    if (queue.length >= queueLimit) {
      throw new Error('Queue limit reached');
    }

    queue.push(task);
    
    // Start processing
    return processQueue();
  }

  /**
   * Submit multiple tasks
   */
  async function submitAll(tasks: Task[]): Promise<unknown[]> {
    return Promise.all(tasks.map(task => submit(task)));
  }

  /**
   * Cancel task
   */
  function cancel(taskId: string): boolean {
    // Cancel if running
    const controller = running.get(taskId);
    if (controller) {
      controller.abort();
      return true;
    }

    // Remove from queue
    const index = queue.findIndex(t => t.id === taskId);
    if (index >= 0) {
      queue.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * Get status
   */
  function getStatus(): SchedulerStatus {
    return {
      running: running.size,
      queued: queue.length,
      completed,
      failed,
      isPaused,
    };
  }

  /**
   * Pause scheduler
   */
  function pause(): void {
    isPaused = true;
  }

  /**
   * Resume scheduler
   */
  function resume(): void {
    isPaused = false;
    processQueue();
  }

  return {
    submit,
    submitAll,
    cancel,
    getStatus,
    pause,
    resume,
  };
}

/**
 * Global scheduler instance
 */
export const globalScheduler = createScheduler();
