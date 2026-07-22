/**
 * Agent Cowork Integration
 * 
 * Bridges HEARTBEAT tasks with the cowork task system.
 * Creates and manages cowork tasks from HEARTBEAT scheduled tasks.
 */

import { useCoworkStore, Task } from '@/views/cowork/CoworkStore';
import { useTaskStore } from '@/views/cowork/useTaskStore';
import { HeartbeatTask, TaskExecutionResult } from './agent-heartbeat-executor';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('AgentCoworkIntegration');

interface CoworkIntegrationConfig {
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
function syncHeartbeatToCoworkTask(
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
    logger.debug(`Task ${taskId} already exists, updating`);
    return existingTask;
  }
  
  // Create title with prefix
  const title = `${fullConfig.taskTitlePrefix} ${formatFrequency(heartbeatTask.frequency)}: ${heartbeatTask.action}`;

  // Create the task directly in the canonical task store so we can use a stable
  // ID and avoid the async API sync/revert path in useTaskStore.createTask.
  const now = new Date().toISOString();
  const customTask: Task = {
    id: taskId,
    title,
    mode: fullConfig.defaultTaskMode,
    projectId: fullConfig.defaultProjectId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    description: buildTaskDescription(heartbeatTask, agentId),
    recurring: heartbeatTask.frequency !== 'startup',
  };

  useTaskStore.setState((state) => ({
    tasks: [...state.tasks, customTask],
  }));

  logger.debug(`Created cowork task ${taskId} for HEARTBEAT task ${heartbeatTask.id}`);
  
  // Auto-start session if configured
  if (fullConfig.autoStartSession && heartbeatTask.frequency === 'startup') {
    startCoworkSessionForTask(customTask.id, heartbeatTask.action);
  }
  
  return customTask;
}

/**
 * Update cowork task with execution result
 */
function updateCoworkTaskWithResult(
  taskId: string,
  result: TaskExecutionResult
): void {
  const taskStore = useTaskStore.getState();

  // Find the task
  const task = taskStore.tasks.find(t => t.id === taskId);
  if (!task) {
    logger.warn(`Task ${taskId} not found`);
    return;
  }

  // Update status and description directly in the canonical task store to avoid
  // the async API sync/revert path in useTaskStore.updateTaskStatus.
  const newStatus = result.success ? 'completed' : 'pending';
  const resultNote = result.success
    ? `✅ Completed at ${result.timestamp.toISOString()}\n\nOutput:\n${result.output || 'No output'}`
    : `❌ Failed at ${result.timestamp.toISOString()}\n\nError:\n${result.error || 'Unknown error'}`;

  const updatedDescription = task.description
    ? `${task.description}\n\n---\n${resultNote}`
    : resultNote;

  useTaskStore.setState((state) => ({
    tasks: state.tasks.map((t) =>
      t.id === taskId
        ? { ...task, status: newStatus, description: updatedDescription, updatedAt: new Date().toISOString() }
        : t
    ),
  }));

  // Persist successful task output to cowork memory so future sessions have context
  if (result.success && result.output) {
    const memoryContent = `Task "${task.title}" completed.\n\nOutput: ${result.output.slice(0, 1000)}`;
    fetch('/api/v1/cowork/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: memoryContent,
        type: 'context',
        tags: ['task-completion', taskId],
        source: 'heartbeat',
      }),
    }).catch(() => {});
  }

  logger.debug(`Updated task ${taskId} with result: ${result.success ? 'success' : 'failed'}`);
}

/**
 * Start a cowork session for a task
 */
function startCoworkSessionForTask(
  taskId: string,
  context?: string
): string | null {
  const coworkStore = useCoworkStore.getState();
  
  // Set the task as active
  coworkStore.setActiveTask(taskId);
  
  // Start a session
  const sessionId = coworkStore.startSession('desktop', context || 'HEARTBEAT task execution');
  
  logger.debug(`Started cowork session ${sessionId} for task ${taskId}`);
  
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
function deleteAgentCoworkTasks(agentId: string): void {
  const prefix = `heartbeat_${agentId}_`;
  const tasksToDelete = getAgentCoworkTasks(agentId);

  useTaskStore.setState((state) => ({
    tasks: state.tasks.filter((t) => !t.id.startsWith(prefix)),
    activeTaskId: state.activeTaskId?.startsWith(prefix) ? null : state.activeTaskId,
  }));

  logger.debug(`Deleted ${tasksToDelete.length} cowork tasks for agent ${agentId}`);
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
class CoworkIntegrationManager {
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

    logger.debug(`Synced ${createdTasks.length} tasks for agent ${agentId}`);
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
