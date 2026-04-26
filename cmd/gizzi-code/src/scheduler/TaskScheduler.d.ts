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
 * Task Scheduler for Gizzi
 */
export declare class TaskScheduler {
    private jobs;
    private intervalId;
    private checkIntervalMs;
    private isRunning;
    private onTaskExecute?;
    constructor(options?: {
        checkIntervalMs?: number;
        onTaskExecute?: (task: SchedulerJob) => Promise<void>;
    });
    /**
     * Start the scheduler
     */
    start(): void;
    /**
     * Stop the scheduler
     */
    stop(): void;
    /**
     * Register tasks from HEARTBEAT.md
     */
    registerTasks(agentId: string, tasks: ScheduledTask[]): void;
    /**
     * Unregister all tasks for an agent
     */
    unregisterAgentTasks(agentId: string): void;
    /**
     * Get all jobs
     */
    getJobs(): SchedulerJob[];
    /**
     * Get jobs for a specific agent
     */
    getJobsForAgent(agentId: string): SchedulerJob[];
    /**
     * Get jobs that are due for execution
     */
    getDueJobs(): SchedulerJob[];
    /**
     * Get scheduler status
     */
    getStatus(): {
        isRunning: boolean;
        totalJobs: number;
        dueJobs: number;
        nextJob: SchedulerJob | null;
    };
    /**
     * Enable a job
     */
    enableJob(jobId: string): void;
    /**
     * Disable a job
     */
    disableJob(jobId: string): void;
    /**
     * Record job execution
     */
    recordExecution(jobId: string, success: boolean): void;
    /**
     * Check and execute due jobs
     */
    private checkAndExecuteJobs;
    /**
     * Execute a single job
     */
    private executeJob;
}
export declare const taskScheduler: TaskScheduler;
