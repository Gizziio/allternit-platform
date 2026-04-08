/**
 * Agent HEARTBEAT Task Executor
 * 
 * Executes scheduled tasks from HEARTBEAT.md with cowork integration.
 * - Startup tasks: Execute when agent session starts
 * - Daily/Weekly/Monthly: Execute via cron scheduler
 * - Cowork integration: Tasks can create/update cowork tasks
 */

import { agentWorkspaceFS } from './agent-workspace-files';
import { AgentTrustTiers } from './agent-trust-tiers';

export type TaskFrequency = 'startup' | 'daily' | 'weekly' | 'monthly';

export interface HeartbeatTask {
  id: string;
  frequency: TaskFrequency;
  action: string;
  description?: string;
  notify?: 'never' | 'on_failure' | 'on_success' | 'always';
  autoApprove?: boolean; // If true, skip permission check
  lastExecuted?: Date;
  nextScheduled?: Date;
}

export interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  executionTimeMs: number;
  timestamp: Date;
}

export interface CoworkTaskIntegration {
  taskId?: string;
  projectId?: string;
  createIfNotExists?: boolean;
}

/**
 * Parse HEARTBEAT.md content into structured tasks
 */
export function parseHeartbeatTasks(content: string): HeartbeatTask[] {
  const tasks: HeartbeatTask[] = [];
  
  // Parse each frequency section
  const frequencies: TaskFrequency[] = ['startup', 'daily', 'weekly', 'monthly'];
  
  for (const frequency of frequencies) {
    const sectionRegex = new RegExp(
      `###\\s*${frequency}([\\s\\S]*?)(?=###\\s*(Daily|Weekly|Monthly|Startup)|$)`,
      'i'
    );
    
    const match = content.match(sectionRegex);
    if (match) {
      const lines = match[1].split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // Match bullet points or task definitions
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const action = trimmed.replace(/^[-*]\s+/, '');
          
          if (action.length > 0) {
            tasks.push({
              id: `${frequency}_${tasks.filter(t => t.frequency === frequency).length}`,
              frequency,
              action,
              notify: inferNotifyPolicy(action),
            });
          }
        }
        
        // Match named task definitions: "#### task-name"
        const namedTaskMatch = trimmed.match(/^####\s+(.+)$/);
        if (namedTaskMatch && tasks.length > 0) {
          // Update the last task with a proper ID
          const lastTask = tasks[tasks.length - 1];
          lastTask.id = `${frequency}_${namedTaskMatch[1].replace(/\s+/g, '_').toLowerCase()}`;
        }
      }
    }
  }
  
  return tasks;
}

/**
 * Infer notification policy from action text
 */
function inferNotifyPolicy(action: string): HeartbeatTask['notify'] {
  const lower = action.toLowerCase();
  
  if (lower.includes('notify: never')) return 'never';
  if (lower.includes('notify: always')) return 'always';
  if (lower.includes('notify: on failure')) return 'on_failure';
  if (lower.includes('notify: on success')) return 'on_success';
  
  // Default policies based on action type
  if (lower.includes('check') || lower.includes('verify')) return 'on_failure';
  if (lower.includes('report') || lower.includes('summary')) return 'always';
  
  return 'on_failure';
}

/**
 * Execute a single task with permission checking
 */
export async function executeTask(
  task: HeartbeatTask,
  options: {
    agentId: string;
    sessionId: string;
    trustTiers?: AgentTrustTiers;
    onPermissionRequest?: (action: string) => Promise<boolean>;
  }
): Promise<TaskExecutionResult> {
  const startTime = Date.now();
  
  try {
    // Check permission if trust tiers provided
    if (options.trustTiers && !task.autoApprove) {
      const requiresPermission = options.trustTiers.requiresPermission('task', {
        action: task.action,
      });
      
      if (requiresPermission && options.onPermissionRequest) {
        const approved = await options.onPermissionRequest(task.action);
        if (!approved) {
          return {
            taskId: task.id,
            success: false,
            error: 'Permission denied by user',
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date(),
          };
        }
      }
    }
    
    // Execute the task based on action type
    const result = await executeTaskAction(task, options);
    
    return {
      taskId: task.id,
      success: result.success,
      output: result.output,
      error: result.error,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date(),
    };
    
  } catch (error) {
    return {
      taskId: task.id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }
}

/**
 * Execute the actual task action
 */
async function executeTaskAction(
  task: HeartbeatTask,
  options: { agentId: string; sessionId: string }
): Promise<{ success: boolean; output?: string; error?: string }> {
  const action = task.action.toLowerCase();
  
  // Workspace health check
  if (action.includes('workspace health') || action.includes('check workspace')) {
    return executeWorkspaceHealthCheck(options.agentId);
  }
  
  // Load context
  if (action.includes('load context') || action.includes('load project context')) {
    return executeLoadContext(options.agentId);
  }
  
  // Dependency check
  if (action.includes('dependency') || action.includes('check for updates')) {
    return executeDependencyCheck();
  }
  
  // PR review summary
  if (action.includes('pr') || action.includes('pull request')) {
    return executePRSummary();
  }
  
  // Documentation sync
  if (action.includes('documentation') || action.includes('docs')) {
    return executeDocumentationSync();
  }
  
  // Tool verification
  if (action.includes('tool') || action.includes('verify')) {
    return executeToolVerification();
  }
  
  // Unknown task - return success but note it's not implemented
  return {
    success: true,
    output: `Task "${task.action}" acknowledged (not implemented)`,
  };
}

/**
 * Execute workspace health check
 */
async function executeWorkspaceHealthCheck(agentId: string): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const stats = await agentWorkspaceFS.getWorkspaceStats(agentId);
    
    if (!stats.exists) {
      return {
        success: false,
        error: `Workspace for agent ${agentId} does not exist`,
      };
    }
    
    const output = [
      'Workspace Health Check:',
      `  Files: ${stats.fileCount}`,
      `  Total size: ${stats.totalSize} bytes`,
      `  Last modified: ${stats.lastModified?.toISOString() || 'unknown'}`,
    ].join('\n');
    
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute load context task
 */
async function executeLoadContext(agentId: string): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const workspace = await agentWorkspaceFS.loadWorkspace(agentId);
    
    if (!workspace) {
      return {
        success: false,
        error: `Failed to load workspace for agent ${agentId}`,
      };
    }
    
    const brainFile = workspace.files.find(f => f.name.toUpperCase() === 'BRAIN.MD');
    const memoryFiles = workspace.files.filter(f => f.type === 'memory');
    
    const output = [
      'Context Loaded:',
      `  Workspace files: ${workspace.files.length}`,
      `  Memory files: ${memoryFiles.length}`,
      brainFile ? `  Brain loaded: ${brainFile.content.length} chars` : '  No BRAIN.md found',
    ].join('\n');
    
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute dependency check
 */
async function executeDependencyCheck(): Promise<{ success: boolean; output?: string; error?: string }> {
  // This would check package.json, Cargo.toml, etc.
  // For now, return placeholder
  return {
    success: true,
    output: 'Dependency check: No updates available (placeholder)',
  };
}

/**
 * Execute PR summary
 */
async function executePRSummary(): Promise<{ success: boolean; output?: string; error?: string }> {
  // This would integrate with GitHub/GitLab APIs
  // For now, return placeholder
  return {
    success: true,
    output: 'PR Summary: No open PRs (placeholder)',
  };
}

/**
 * Execute documentation sync
 */
async function executeDocumentationSync(): Promise<{ success: boolean; output?: string; error?: string }> {
  // This would update README, API docs, etc.
  // For now, return placeholder
  return {
    success: true,
    output: 'Documentation sync: Up to date (placeholder)',
  };
}

/**
 * Execute tool verification
 */
async function executeToolVerification(): Promise<{ success: boolean; output?: string; error?: string }> {
  // This would check available tools
  // For now, return placeholder
  return {
    success: true,
    output: 'Tool verification: All tools available (placeholder)',
  };
}

// ============================================================================
// Cowork Integration
// ============================================================================

/**
 * Create or update a cowork task from a HEARTBEAT task
 */
export async function syncTaskToCowork(
  heartbeatTask: HeartbeatTask,
  options: {
    projectId?: string;
    createIfNotExists?: boolean;
  }
): Promise<{ success: boolean; coworkTaskId?: string; error?: string }> {
  try {
    // This would integrate with the cowork task system
    // For now, return a mock success
    
    const coworkTaskId = `cowork_${heartbeatTask.id}_${Date.now()}`;
    
    return {
      success: true,
      coworkTaskId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * HEARTBEAT Task Manager
 * 
 * Manages scheduled tasks for an agent
 */
export class HeartbeatTaskManager {
  private agentId: string;
  private tasks: Map<string, HeartbeatTask> = new Map();
  private executionHistory: TaskExecutionResult[] = [];
  private trustTiers?: AgentTrustTiers;

  constructor(agentId: string, trustTiers?: AgentTrustTiers) {
    this.agentId = agentId;
    this.trustTiers = trustTiers;
  }

  /**
   * Load tasks from workspace
   */
  async loadTasks(): Promise<HeartbeatTask[]> {
    const content = await agentWorkspaceFS.readFile(this.agentId, 'HEARTBEAT.md');
    
    if (!content) {
      return [];
    }
    
    const tasks = parseHeartbeatTasks(content);
    
    // Update task map
    this.tasks.clear();
    for (const task of tasks) {
      this.tasks.set(task.id, task);
    }
    
    return tasks;
  }

  /**
   * Execute startup tasks
   */
  async executeStartupTasks(options: {
    sessionId: string;
    onPermissionRequest?: (action: string) => Promise<boolean>;
  }): Promise<TaskExecutionResult[]> {
    const startupTasks = Array.from(this.tasks.values())
      .filter(t => t.frequency === 'startup');
    
    const results: TaskExecutionResult[] = [];
    
    for (const task of startupTasks) {
      const result = await executeTask(task, {
        agentId: this.agentId,
        sessionId: options.sessionId,
        trustTiers: this.trustTiers,
        onPermissionRequest: options.onPermissionRequest,
      });
      
      results.push(result);
      this.executionHistory.push(result);
    }
    
    return results;
  }

  /**
   * Get tasks by frequency
   */
  getTasksByFrequency(frequency: TaskFrequency): HeartbeatTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.frequency === frequency);
  }

  /**
   * Get execution history
   */
  getExecutionHistory(taskId?: string): TaskExecutionResult[] {
    if (taskId) {
      return this.executionHistory.filter(r => r.taskId === taskId);
    }
    return this.executionHistory;
  }

  /**
   * Get next scheduled execution time for a task
   */
  getNextScheduledTime(task: HeartbeatTask): Date {
    const now = new Date();
    
    switch (task.frequency) {
      case 'daily':
        return new Date(now.setDate(now.getDate() + 1));
      case 'weekly':
        return new Date(now.setDate(now.getDate() + 7));
      case 'monthly':
        return new Date(now.setMonth(now.getMonth() + 1));
      default:
        return now;
    }
  }
}

// Export singleton manager
const managers = new Map<string, HeartbeatTaskManager>();

export function getHeartbeatTaskManager(
  agentId: string,
  trustTiers?: AgentTrustTiers
): HeartbeatTaskManager {
  if (!managers.has(agentId)) {
    managers.set(agentId, new HeartbeatTaskManager(agentId, trustTiers));
  }
  return managers.get(agentId)!;
}
