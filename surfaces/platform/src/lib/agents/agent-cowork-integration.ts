/**
 * Agent Cowork Integration
 * 
 * Bridges HEARTBEAT tasks with the cowork task system.
 * Creates and manages cowork tasks from HEARTBEAT scheduled tasks.
 */

import { useCoworkStore, Task } from '@/views/cowork/CoworkStore';
import { HeartbeatTask, TaskExecutionResult } from './agent-heartbeat-executor';

export interface CoworkIntegrationConfig {
  // Project to assign HEARTBEAT tasks to
  defaultProjectId?: string;
  // Create tasks as 'agent' mode (autonomous) or 'task' mode (supervised)
  defaultTaskMode: 'agent' | 'task';
  // Auto-start cowork session when task is created
  autoStartSession: boolean;
  // Prefix for task titles
  taskTitlePrefix: string;
}

const DEFAULT_CONFIG: CoworkIntegrationConfig = {
  defaultTaskMode: 'agent',
  autoStartSession: false,
  taskTitlePrefix: '🤖',
};

/**
 * Sync a HEARTBEAT task to a cowork task
 */
export function syncHeartbeatToCoworkTask(
  heartbeatTask: HeartbeatTask,
  agentId: string,
  config: Partial<CoworkIntegrationConfig> = {}
): Task {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const coworkStore = useCoworkStore.getState();
  
  // Generate a unique task ID based on agent and heartbeat task
  const taskId = `heartbeat_${agentId}_${heartbeatTask.id}`;
  
  // Check if task already exists
  const existingTask = coworkStore.tasks.find(t => t.id === taskId);
  if (existingTask) {
    console.log(`[CoworkIntegration] Task ${taskId} already exists, updating`);
    return existingTask;
  }
  
  // Create title with prefix
  const title = `${fullConfig.taskTitlePrefix} ${formatFrequency(heartbeatTask.frequency)}: ${heartbeatTask.action}`;
  
  // Create the task
  const task = coworkStore.createTask(
    title,
    fullConfig.defaultTaskMode,
    fullConfig.defaultProjectId
  );
  
  // Override the generated ID with our stable ID
  const customTask: Task = {
    ...task,
    id: taskId,
    description: buildTaskDescription(heartbeatTask, agentId),
    recurring: heartbeatTask.frequency !== 'startup',
  };
  
  // Update the task in store (hacky but necessary since createTask generates its own ID)
  const { tasks } = useCoworkStore.getState();
  const taskIndex = tasks.findIndex(t => t.id === task.id);
  if (taskIndex >= 0) {
    tasks[taskIndex] = customTask;
    useCoworkStore.setState({ tasks: [...tasks] });
  }
  
  console.log(`[CoworkIntegration] Created cowork task ${taskId} for HEARTBEAT task ${heartbeatTask.id}`);
  
  // Auto-start session if configured
  if (fullConfig.autoStartSession && heartbeatTask.frequency === 'startup') {
    startCoworkSessionForTask(customTask.id, heartbeatTask.action);
  }
  
  return customTask;
}

/**
 * Update cowork task with execution result
 */
export function updateCoworkTaskWithResult(
  taskId: string,
  result: TaskExecutionResult
): void {
  const coworkStore = useCoworkStore.getState();
  
  // Find the task
  const task = coworkStore.tasks.find(t => t.id === taskId);
  if (!task) {
    console.warn(`[CoworkIntegration] Task ${taskId} not found`);
    return;
  }
  
  // Update status based on result
  const newStatus = result.success ? 'completed' : 'pending';
  coworkStore.updateTaskStatus(taskId, newStatus);
  
  // Update description with result
  const resultNote = result.success
    ? `✅ Completed at ${result.timestamp.toISOString()}\n\nOutput:\n${result.output || 'No output'}`
    : `❌ Failed at ${result.timestamp.toISOString()}\n\nError:\n${result.error || 'Unknown error'}`;
  
  const updatedDescription = task.description 
    ? `${task.description}\n\n---\n${resultNote}`
    : resultNote;
  
  // Update task in store
  const { tasks } = useCoworkStore.getState();
  const taskIndex = tasks.findIndex(t => t.id === taskId);
  if (taskIndex >= 0) {
    tasks[taskIndex] = { ...task, description: updatedDescription };
    useCoworkStore.setState({ tasks: [...tasks] });
  }
  
  console.log(`[CoworkIntegration] Updated task ${taskId} with result: ${result.success ? 'success' : 'failed'}`);
}

/**
 * Start a cowork session for a task
 */
export function startCoworkSessionForTask(
  taskId: string,
  context?: string
): string | null {
  const coworkStore = useCoworkStore.getState();
  
  // Set the task as active
  coworkStore.setActiveTask(taskId);
  
  // Start a session
  const sessionId = coworkStore.startSession('desktop', context || 'HEARTBEAT task execution');
  
  console.log(`[CoworkIntegration] Started cowork session ${sessionId} for task ${taskId}`);
  
  return sessionId;
}

/**
 * Get all HEARTBEAT-related cowork tasks for an agent
 */
export function getAgentCoworkTasks(agentId: string): Task[] {
  const { tasks } = useCoworkStore.getState();
  const prefix = `heartbeat_${agentId}_`;
  
  return tasks.filter(t => t.id.startsWith(prefix));
}

/**
 * Delete all HEARTBEAT tasks for an agent
 */
export function deleteAgentCoworkTasks(agentId: string): void {
  const coworkStore = useCoworkStore.getState();
  const tasks = getAgentCoworkTasks(agentId);
  
  for (const task of tasks) {
    coworkStore.deleteTask(task.id);
  }
  
  console.log(`[CoworkIntegration] Deleted ${tasks.length} cowork tasks for agent ${agentId}`);
}

/**
 * Build task description from HEARTBEAT task
 */
function buildTaskDescription(task: HeartbeatTask, agentId: string): string {
  const lines = [
    `**Agent:** ${agentId}`,
    `**Frequency:** ${formatFrequency(task.frequency)}`,
    `**Action:** ${task.action}`,
  ];
  
  if (task.description) {
    lines.push(`**Description:** ${task.description}`);
  }
  
  if (task.notify) {
    lines.push(`**Notification:** ${task.notify}`);
  }
  
  lines.push(
    '',
    '---',
    '',
    'This task was automatically created from the agent HEARTBEAT configuration.'
  );
  
  return lines.join('\n');
}

/**
 * Format frequency for display
 */
function formatFrequency(frequency: string): string {
  const map: Record<string, string> = {
    startup: '🚀 Startup',
    daily: '📅 Daily',
    weekly: '📆 Weekly',
    monthly: '🗓️ Monthly',
  };
  return map[frequency] || frequency;
}

/**
 * Cowork Integration Manager
 * 
 * Manages the sync between HEARTBEAT tasks and cowork tasks
 */
export class CoworkIntegrationManager {
  private config: CoworkIntegrationConfig;
  private agentConfigs = new Map<string, Partial<CoworkIntegrationConfig>>();

  constructor(config: Partial<CoworkIntegrationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set config for a specific agent
   */
  setAgentConfig(agentId: string, config: Partial<CoworkIntegrationConfig>): void {
    this.agentConfigs.set(agentId, config);
  }

  /**
   * Get effective config for an agent
   */
  getAgentConfig(agentId: string): CoworkIntegrationConfig {
    const agentConfig = this.agentConfigs.get(agentId) || {};
    return { ...this.config, ...agentConfig };
  }

  /**
   * Sync all HEARTBEAT tasks for an agent to cowork tasks
   */
  syncAgentTasks(agentId: string, tasks: HeartbeatTask[]): Task[] {
    const config = this.getAgentConfig(agentId);
    const createdTasks: Task[] = [];

    // Filter out startup tasks (they run immediately, not scheduled)
    const recurringTasks = tasks.filter(t => t.frequency !== 'startup');

    for (const task of recurringTasks) {
      const coworkTask = syncHeartbeatToCoworkTask(task, agentId, config);
      createdTasks.push(coworkTask);
    }

    console.log(`[CoworkIntegration] Synced ${createdTasks.length} tasks for agent ${agentId}`);
    return createdTasks;
  }

  /**
   * Record task execution result
   */
  recordExecution(agentId: string, heartbeatTaskId: string, result: TaskExecutionResult): void {
    const taskId = `heartbeat_${agentId}_${heartbeatTaskId}`;
    updateCoworkTaskWithResult(taskId, result);
  }

  /**
   * Clean up all tasks for an agent
   */
  cleanupAgent(agentId: string): void {
    deleteAgentCoworkTasks(agentId);
    this.agentConfigs.delete(agentId);
  }
}

// Export singleton
export const coworkIntegration = new CoworkIntegrationManager();

// React hook for using cowork integration
export function useCoworkIntegration(agentId?: string) {
  return {
    syncTasks: (tasks: HeartbeatTask[], config?: Partial<CoworkIntegrationConfig>) => {
      if (!agentId) throw new Error('agentId required');
      return coworkIntegration.syncAgentTasks(agentId, tasks);
    },
    getTasks: () => agentId ? getAgentCoworkTasks(agentId) : [],
    recordExecution: (heartbeatTaskId: string, result: TaskExecutionResult) => {
      if (!agentId) throw new Error('agentId required');
      coworkIntegration.recordExecution(agentId, heartbeatTaskId, result);
    },
    cleanup: () => {
      if (!agentId) throw new Error('agentId required');
      coworkIntegration.cleanupAgent(agentId);
    },
    setConfig: (config: Partial<CoworkIntegrationConfig>) => {
      if (!agentId) throw new Error('agentId required');
      coworkIntegration.setAgentConfig(agentId, config);
    },
  };
}
