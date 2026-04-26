/**
 * Taskdog-style MCP integration for Gizzi Code
 * Exposes task management tools via Model Context Protocol
 */

export const TASKDOG_MCP_TOOLS = [
  {
    name: 'taskdog_create_task',
    description: 'Create a new task in the Allternit task system',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        priority: { type: 'number', description: 'Priority 1-100' },
        estimatedMinutes: { type: 'number', description: 'Estimated duration in minutes' },
        deadline: { type: 'string', description: 'ISO deadline date' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Task tags' },
      },
      required: ['title'],
    },
  },
  {
    name: 'taskdog_list_tasks',
    description: 'List all tasks with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'archived'] },
        tag: { type: 'string' },
      },
    },
  },
  {
    name: 'taskdog_optimize_schedule',
    description: 'Run the intelligent schedule optimizer on current tasks',
    inputSchema: {
      type: 'object',
      properties: {
        strategy: { type: 'string', enum: ['greedy', 'balanced', 'priority-first', 'earliest-deadline', 'genetic', 'monte-carlo'], default: 'greedy' },
      },
    },
  },
  {
    name: 'taskdog_start_timer',
    description: 'Start time tracking for a task',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'taskdog_get_workload',
    description: 'Get daily workload analysis for scheduled tasks',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
