/**
 * Plan Manager
 * 
 * Manages plan artifacts:
 * - plan.md: Overall plan and goals
 * - todo.md: Task list with status
 * - progress.md: Progress updates
 * - findings.md: Key findings and decisions
 * 
 * All updates are append-only for traceability.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PlanFiles {
  planPath: string;
  todoPath: string;
  progressPath: string;
  findingsPath: string;
}

export interface TodoItem {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  assignedTo?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ProgressEntry {
  timestamp: string;
  message: string;
  iterationId?: string;
}

export interface Finding {
  timestamp: string;
  category: 'decision' | 'observation' | 'issue' | 'solution';
  description: string;
  relatedFiles?: string[];
}

export class PlanManager {
  private baseDir: string;

  constructor(baseDir: string = '.allternit/runner/plans') {
    this.baseDir = baseDir;
  }

  /**
   * Initialize plan files for a new run
   */
  async initialize(runId: string, initialPlan?: string): Promise<PlanFiles> {
    const runDir = path.join(this.baseDir, runId);
    fs.mkdirSync(runDir, { recursive: true });

    const files: PlanFiles = {
      planPath: path.join(runDir, 'plan.md'),
      todoPath: path.join(runDir, 'todo.md'),
      progressPath: path.join(runDir, 'progress.md'),
      findingsPath: path.join(runDir, 'findings.md'),
    };

    // Initialize with headers
    if (!fs.existsSync(files.planPath)) {
      fs.writeFileSync(files.planPath, `# Plan\n\n${initialPlan || 'Initial plan TBD.'}\n`, 'utf-8');
    }

    if (!fs.existsSync(files.todoPath)) {
      fs.writeFileSync(files.todoPath, '# Todo\n\n', 'utf-8');
    }

    if (!fs.existsSync(files.progressPath)) {
      fs.writeFileSync(files.progressPath, '# Progress\n\n', 'utf-8');
    }

    if (!fs.existsSync(files.findingsPath)) {
      fs.writeFileSync(files.findingsPath, '# Findings\n\n', 'utf-8');
    }

    return files;
  }

  /**
   * Append to plan.md (append-only)
   */
  async appendToPlan(planPath: string, content: string, metadata?: { iterationId?: string }): Promise<void> {
    const timestamp = new Date().toISOString();
    const entry = `
## Update ${timestamp}${metadata?.iterationId ? ` (${metadata.iterationId})` : ''}

${content}

---
`;
    fs.appendFileSync(planPath, entry, 'utf-8');
  }

  /**
   * Add a todo item
   */
  async addTodo(todoPath: string, item: Omit<TodoItem, 'id' | 'createdAt'>): Promise<TodoItem> {
    const todo: TodoItem = {
      ...item,
      id: `todo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      createdAt: new Date().toISOString(),
    };

    const entry = `- [${this.statusToChar(todo.status)}] ${todo.description} (id: ${todo.id})\n`;
    fs.appendFileSync(todoPath, entry, 'utf-8');

    return todo;
  }

  /**
   * Update todo status
   * Note: This creates a new entry rather than modifying existing (append-only)
   */
  async updateTodoStatus(todoPath: string, todoId: string, newStatus: TodoItem['status']): Promise<void> {
    const timestamp = new Date().toISOString();
    const statusText = newStatus.toUpperCase();
    const entry = `- Status update ${timestamp}: ${todoId} → ${statusText}\n`;
    fs.appendFileSync(todoPath, entry, 'utf-8');
  }

  /**
   * Log progress
   */
  async logProgress(progressPath: string, message: string, iterationId?: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const entry = iterationId
      ? `- [${timestamp}] [${iterationId}] ${message}\n`
      : `- [${timestamp}] ${message}\n`;
    fs.appendFileSync(progressPath, entry, 'utf-8');
  }

  /**
   * Record a finding
   */
  async recordFinding(findingsPath: string, finding: Omit<Finding, 'timestamp'>): Promise<Finding> {
    const fullFinding: Finding = {
      ...finding,
      timestamp: new Date().toISOString(),
    };

    const entry = `
## ${fullFinding.category.toUpperCase()} (${fullFinding.timestamp})

${fullFinding.description}
${fullFinding.relatedFiles ? `\nRelated: ${fullFinding.relatedFiles.join(', ')}` : ''}

---
`;
    fs.appendFileSync(findingsPath, entry, 'utf-8');

    return fullFinding;
  }

  /**
   * Read plan content
   */
  async readPlan(planPath: string): Promise<string> {
    if (!fs.existsSync(planPath)) {
      return '';
    }
    return fs.readFileSync(planPath, 'utf-8');
  }

  /**
   * Read todos and parse
   */
  async readTodos(todoPath: string): Promise<TodoItem[]> {
    if (!fs.existsSync(todoPath)) {
      return [];
    }

    const content = fs.readFileSync(todoPath, 'utf-8');
    const todos: TodoItem[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^- \[([ x~])\] (.+) \(id: (\w+)\)$/);
      if (match) {
        const [, statusChar, description, id] = match;
        todos.push({
          id,
          description,
          status: this.charToStatus(statusChar),
          createdAt: '', // Not stored in simple format
        });
      }
    }

    return todos;
  }

  /**
   * Read progress log
   */
  async readProgress(progressPath: string): Promise<ProgressEntry[]> {
    if (!fs.existsSync(progressPath)) {
      return [];
    }

    const content = fs.readFileSync(progressPath, 'utf-8');
    const entries: ProgressEntry[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const match = line.match(/^- \[(.+?)\](?: \[(.+?)\])? (.+)$/);
      if (match) {
        const [, timestamp, iterationId, message] = match;
        entries.push({
          timestamp,
          message,
          iterationId,
        });
      }
    }

    return entries;
  }

  /**
   * Get plan state summary
   */
  async getPlanSummary(files: PlanFiles): Promise<{
    planLength: number;
    todoCount: number;
    completedCount: number;
    progressEntries: number;
    findingsCount: number;
  }> {
    const todos = await this.readTodos(files.todoPath);
    const progress = await this.readProgress(files.progressPath);
    
    let findingsCount = 0;
    if (fs.existsSync(files.findingsPath)) {
      const findings = fs.readFileSync(files.findingsPath, 'utf-8');
      findingsCount = (findings.match(/^## /gm) || []).length;
    }

    return {
      planLength: fs.existsSync(files.planPath) ? fs.readFileSync(files.planPath, 'utf-8').length : 0,
      todoCount: todos.length,
      completedCount: todos.filter(t => t.status === 'done').length,
      progressEntries: progress.length,
      findingsCount,
    };
  }

  // Private helpers

  private statusToChar(status: TodoItem['status']): string {
    switch (status) {
      case 'done': return 'x';
      case 'in_progress': return '~';
      case 'blocked': return '!';
      case 'pending':
      default: return ' ';
    }
  }

  private charToStatus(char: string): TodoItem['status'] {
    switch (char) {
      case 'x': return 'done';
      case '~': return 'in_progress';
      case '!': return 'blocked';
      case ' ':
      default: return 'pending';
    }
  }
}

// Factory function
export function createPlanManager(baseDir?: string): PlanManager {
  return new PlanManager(baseDir);
}
