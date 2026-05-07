/**
 * Agent Cron Scheduler
 * 
 * Manages scheduled execution of HEARTBEAT tasks:
 * - Daily tasks: Run every 24 hours
 * - Weekly tasks: Run every 7 days
 * - Monthly tasks: Run every 30 days
 * 
 * Uses persistent storage to track last execution times.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HeartbeatTask, TaskFrequency, executeTask } from './agent-heartbeat-executor';
import { AgentTrustTiers } from './agent-trust-tiers';

export interface ScheduledJob {
  id: string;
  taskId: string;
  agentId: string;
  frequency: TaskFrequency;
  nextRunAt: number;
  lastRunAt?: number;
  lastResult?: {
    success: boolean;
    output?: string;
    error?: string;
  };
  enabled: boolean;
}

export interface CronSchedulerState {
  jobs: Map<string, ScheduledJob>;
  isRunning: boolean;
  checkIntervalMs: number;
  
  // Actions
  addJob: (task: HeartbeatTask, agentId: string) => string;
  removeJob: (jobId: string) => void;
  enableJob: (jobId: string) => void;
  disableJob: (jobId: string) => void;
  updateJobSchedule: (jobId: string, nextRunAt: number) => void;
  recordExecution: (jobId: string, result: { success: boolean; output?: string; error?: string }) => void;
  getDueJobs: () => ScheduledJob[];
  getJobsForAgent: (agentId: string) => ScheduledJob[];
}

// Calculate next run time based on frequency
function calculateNextRun(frequency: TaskFrequency, fromTimestamp: number = Date.now()): number {
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;
  
  switch (frequency) {
    case 'daily':
      return fromTimestamp + ONE_DAY;
    case 'weekly':
      return fromTimestamp + 7 * ONE_DAY;
    case 'monthly':
      // Approximate month as 30 days
      return fromTimestamp + 30 * ONE_DAY;
    default:
      return fromTimestamp + ONE_DAY;
  }
}

// Check if we're in a test environment
const isTestEnvironment = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

// Create the scheduler store
const createCronSchedulerStore = () => create<CronSchedulerState>()(
  isTestEnvironment 
    ? (set, get) => ({
        jobs: new Map(),
        isRunning: false,
        checkIntervalMs: 60000,
        addJob: (task, agentId) => {
          const jobId = `${agentId}_${task.id}`;
          const job: ScheduledJob = {
            id: jobId,
            taskId: task.id,
            agentId,
            frequency: task.frequency,
            nextRunAt: calculateNextRun(task.frequency),
            enabled: true,
          };
          set((state) => {
            const jobs = new Map(state.jobs);
            jobs.set(jobId, job);
            return { jobs };
          });
          return jobId;
        },
        removeJob: (jobId) => {
          set((state) => {
            const jobs = new Map(state.jobs);
            jobs.delete(jobId);
            return { jobs };
          });
        },
        enableJob: (jobId) => {
          set((state) => {
            const jobs = new Map(state.jobs);
            const job = jobs.get(jobId);
            if (job) {
              job.enabled = true;
              job.nextRunAt = calculateNextRun(job.frequency);
              jobs.set(jobId, job);
            }
            return { jobs };
          });
        },
        disableJob: (jobId) => {
          set((state) => {
            const jobs = new Map(state.jobs);
            const job = jobs.get(jobId);
            if (job) {
              job.enabled = false;
              jobs.set(jobId, job);
            }
            return { jobs };
          });
        },
        updateJobSchedule: (jobId, nextRunAt) => {
          set((state) => {
            const jobs = new Map(state.jobs);
            const job = jobs.get(jobId);
            if (job) {
              job.nextRunAt = nextRunAt;
              jobs.set(jobId, job);
            }
            return { jobs };
          });
        },
        recordExecution: (jobId, result) => {
          set((state) => {
            const jobs = new Map(state.jobs);
            const job = jobs.get(jobId);
            if (job) {
              job.lastRunAt = Date.now();
              job.lastResult = result;
              job.nextRunAt = calculateNextRun(job.frequency);
              jobs.set(jobId, job);
            }
            return { jobs };
          });
        },
        getDueJobs: () => {
          const now = Date.now();
          const jobs = get().jobs;
          return Array.from(jobs.values()).filter(
            (job) => job.enabled && job.nextRunAt <= now
          );
        },
        getJobsForAgent: (agentId) => {
          const jobs = get().jobs;
          return Array.from(jobs.values()).filter((job) => job.agentId === agentId);
        },
      })
    : persist(
        (set, get) => ({
          jobs: new Map(),
          isRunning: false,
          checkIntervalMs: 60000, // Check every minute

          addJob: (task, agentId) => {
            const jobId = `${agentId}_${task.id}`;
            const job: ScheduledJob = {
              id: jobId,
              taskId: task.id,
              agentId,
              frequency: task.frequency,
              nextRunAt: calculateNextRun(task.frequency),
              enabled: true,
            };

            set((state) => {
              const jobs = new Map(state.jobs);
              jobs.set(jobId, job);
              return { jobs };
            });

            console.log(`[CronScheduler] Added job ${jobId}, next run at ${new Date(job.nextRunAt).toISOString()}`);
            return jobId;
          },

          removeJob: (jobId) => {
            set((state) => {
              const jobs = new Map(state.jobs);
              jobs.delete(jobId);
              return { jobs };
            });
            console.log(`[CronScheduler] Removed job ${jobId}`);
          },

          enableJob: (jobId) => {
            set((state) => {
              const jobs = new Map(state.jobs);
              const job = jobs.get(jobId);
              if (job) {
                job.enabled = true;
                // Recalculate next run from now
                job.nextRunAt = calculateNextRun(job.frequency);
                jobs.set(jobId, job);
              }
              return { jobs };
            });
          },

          disableJob: (jobId) => {
            set((state) => {
              const jobs = new Map(state.jobs);
              const job = jobs.get(jobId);
              if (job) {
                job.enabled = false;
                jobs.set(jobId, job);
              }
              return { jobs };
            });
          },

          updateJobSchedule: (jobId, nextRunAt) => {
            set((state) => {
              const jobs = new Map(state.jobs);
              const job = jobs.get(jobId);
              if (job) {
                job.nextRunAt = nextRunAt;
                jobs.set(jobId, job);
              }
              return { jobs };
            });
          },

          recordExecution: (jobId, result) => {
            set((state) => {
              const jobs = new Map(state.jobs);
              const job = jobs.get(jobId);
              if (job) {
                job.lastRunAt = Date.now();
                job.lastResult = result;
                job.nextRunAt = calculateNextRun(job.frequency);
                jobs.set(jobId, job);
              }
              return { jobs };
            });
          },

          getDueJobs: () => {
            const now = Date.now();
            const jobs = get().jobs;
            return Array.from(jobs.values()).filter(
              (job) => job.enabled && job.nextRunAt <= now
            );
          },

          getJobsForAgent: (agentId) => {
            const jobs = get().jobs;
            return Array.from(jobs.values()).filter((job) => job.agentId === agentId);
          },
        }),
        {
          name: 'agent-cron-scheduler',
          // Custom serialization for Map
          storage: typeof localStorage !== 'undefined' ? localStorage as any : undefined,
          serialize: (state) => {
            return JSON.stringify({
              state: {
                ...state.state,
                jobs: Array.from(state.state.jobs.entries()),
              },
              version: state.version,
            });
          },
          deserialize: (str) => {
            const parsed = JSON.parse(str);
            return {
              state: {
                ...parsed.state,
                jobs: new Map(parsed.state.jobs),
              },
              version: parsed.version,
            };
          },
        }
      )
);

export const useCronScheduler = createCronSchedulerStore();

// Global scheduler instance
class AgentCronScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private onPermissionRequest?: (action: string, agentId: string) => Promise<boolean>;

  start(options?: {
    checkIntervalMs?: number;
    onPermissionRequest?: (action: string, agentId: string) => Promise<boolean>;
  }) {
    if (this.isRunning) {
      console.log('[AgentCronScheduler] Already running');
      return;
    }

    this.onPermissionRequest = options?.onPermissionRequest;
    const checkInterval = options?.checkIntervalMs || 60000;

    console.log(`[AgentCronScheduler] Starting with ${checkInterval}ms interval`);
    this.isRunning = true;

    this.intervalId = setInterval(() => {
      this.checkAndExecuteJobs();
    }, checkInterval);

    // Initial check
    this.checkAndExecuteJobs();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[AgentCronScheduler] Stopped');
  }

  private async checkAndExecuteJobs() {
    const store = useCronScheduler.getState();
    const dueJobs = store.getDueJobs();

    if (dueJobs.length === 0) return;

    console.log(`[AgentCronScheduler] ${dueJobs.length} jobs due for execution`);

    for (const job of dueJobs) {
      await this.executeJob(job);
    }
  }

  private async executeJob(job: ScheduledJob) {
    const store = useCronScheduler.getState();
    
    console.log(`[AgentCronScheduler] Executing job ${job.id}`);

    try {
      // Import dynamically to avoid circular deps
      const { agentWorkspaceFS } = await import('./agent-workspace-files');
      const { HeartbeatTaskManager } = await import('./agent-heartbeat-executor');
      const { AgentTrustTiers } = await import('./agent-trust-tiers');

      // Load workspace and trust tiers
      const workspace = await agentWorkspaceFS.loadWorkspace(job.agentId);
      if (!workspace) {
        throw new Error(`Workspace not found for agent ${job.agentId}`);
      }

      const trustTiers = AgentTrustTiers.fromWorkspace(workspace);

      // Reconstruct the task
      const taskManager = new HeartbeatTaskManager(job.agentId, trustTiers);
      await taskManager.loadTasks();
      const task = taskManager.getTasksByFrequency(job.frequency)
        .find(t => t.id === job.taskId);

      if (!task) {
        throw new Error(`Task ${job.taskId} not found`);
      }

      // Execute the task
      const result = await executeTask(task, {
        agentId: job.agentId,
        sessionId: `cron_${job.id}_${Date.now()}`,
        trustTiers,
        onPermissionRequest: this.onPermissionRequest 
          ? (action) => this.onPermissionRequest!(action, job.agentId)
          : undefined,
      });

      // Record execution
      store.recordExecution(job.id, {
        success: result.success,
        output: result.output,
        error: result.error,
      });

      console.log(`[AgentCronScheduler] Job ${job.id} completed: ${result.success ? 'success' : 'failed'}`);

    } catch (error) {
      console.error(`[AgentCronScheduler] Job ${job.id} failed:`, error);
      store.recordExecution(job.id, {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Register all tasks from an agent's HEARTBEAT.md
  async registerAgentTasks(agentId: string) {
    const { agentWorkspaceFS } = await import('./agent-workspace-files');
    const { parseHeartbeatTasks } = await import('./agent-heartbeat-executor');
    const store = useCronScheduler.getState();

    const content = await agentWorkspaceFS.readFile(agentId, 'HEARTBEAT.md');
    if (!content) {
      console.log(`[AgentCronScheduler] No HEARTBEAT.md found for agent ${agentId}`);
      return;
    }

    const tasks = parseHeartbeatTasks(content);
    const recurringTasks = tasks.filter(t => t.frequency !== 'startup');

    // Remove existing jobs for this agent
    const existingJobs = store.getJobsForAgent(agentId);
    for (const job of existingJobs) {
      store.removeJob(job.id);
    }

    // Add new jobs
    for (const task of recurringTasks) {
      store.addJob(task, agentId);
    }

    console.log(`[AgentCronScheduler] Registered ${recurringTasks.length} recurring tasks for agent ${agentId}`);
  }

  // Unregister all tasks for an agent
  unregisterAgentTasks(agentId: string) {
    const store = useCronScheduler.getState();
    const jobs = store.getJobsForAgent(agentId);
    
    for (const job of jobs) {
      store.removeJob(job.id);
    }

    console.log(`[AgentCronScheduler] Unregistered ${jobs.length} tasks for agent ${agentId}`);
  }

  // Get scheduler status
  getStatus() {
    const store = useCronScheduler.getState();
    const jobs = Array.from(store.jobs.values());
    
    return {
      isRunning: this.isRunning,
      totalJobs: jobs.length,
      enabledJobs: jobs.filter(j => j.enabled).length,
      dueJobs: store.getDueJobs().length,
      nextJob: jobs
        .filter(j => j.enabled)
        .sort((a, b) => a.nextRunAt - b.nextRunAt)[0],
    };
  }
}

// Export singleton instance
export const agentCronScheduler = new AgentCronScheduler();

// React hook for using the scheduler
export function useAgentCronScheduler(agentId?: string) {
  const store = useCronScheduler();
  
  return {
    jobs: agentId ? store.getJobsForAgent(agentId) : Array.from(store.jobs.values()),
    addJob: store.addJob,
    removeJob: store.removeJob,
    enableJob: store.enableJob,
    disableJob: store.disableJob,
    getStatus: () => agentCronScheduler.getStatus(),
    start: (options?: Parameters<typeof agentCronScheduler.start>[0]) => agentCronScheduler.start(options),
    stop: () => agentCronScheduler.stop(),
    registerAgentTasks: (id: string) => agentCronScheduler.registerAgentTasks(id),
    unregisterAgentTasks: (id: string) => agentCronScheduler.unregisterAgentTasks(id),
  };
}
