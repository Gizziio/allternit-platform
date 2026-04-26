/**
 * Task Store — Clean domain store for tasks and projects
 *
 * This is the canonical store for task/project state.
 * It does NOT own session, chat, or streaming state.
 *
 * Previously part of CoworkStore. Extracted for single-responsibility.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GATEWAY_URL } from '../../integration/api-client';

export interface Task {
  id: string;
  title: string;
  mode: 'agent' | 'task';
  projectId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  recurring?: boolean;
  description?: string;
  workspaceId?: string;
  assigneeType?: 'human' | 'agent';
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  comments?: Array<{ id: string; author: string; body: string; createdAt: string }>;
  estimatedMinutes?: number;
  deadline?: string;
  dependencies?: string[];
  priority?: number;
  optimizeRank?: number;
  risk?: 'low' | 'medium' | 'high';
  actualMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  tags?: string[];
  notes?: string;
  sessionId?: string; // Reference to chat session, not owned session state
}

export interface TaskProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface PendingMutation {
  type: string;
  id: string;
  timestamp: number;
}

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  projects: TaskProject[];
  activeProjectId: string | null;

  apiEnabled: boolean;
  setApiEnabled: (enabled: boolean) => void;
  pendingMutations: PendingMutation[];

  taskTimers: Record<string, number>;
  auditLogs: Array<{
    id: string;
    taskId: string;
    action: string;
    actor: string;
    timestamp: string;
    details?: string;
  }>;

  // Task CRUD
  createTask: (title: string, mode?: 'agent' | 'task', projectId?: string) => Task;
  deleteTask: (id: string) => void;
  renameTask: (id: string, title: string) => void;
  updateTaskStatus: (id: string, status: Task['status']) => void;

  // Project CRUD
  createProject: (title: string) => TaskProject;
  deleteProject: (id: string) => void;
  renameProject: (id: string, title: string) => void;
  moveTaskToProject: (taskId: string, projectId: string | null) => void;
  setActiveTask: (id: string | null) => void;
  setActiveProject: (id: string | null) => void;
  bindSessionToTask: (taskId: string, sessionId: string) => void;

  // Team assignment
  assignTask: (taskId: string, assigneeType: 'human' | 'agent', assigneeId: string, assigneeName: string) => void;
  unassignTask: (taskId: string) => void;
  addComment: (taskId: string, author: string, body: string) => void;
  setTaskWorkspaceId: (taskId: string, workspaceId: string) => void;

  // Scheduling
  setTaskEstimate: (taskId: string, estimatedMinutes: number) => void;
  setTaskDeadline: (taskId: string, deadline: string | null) => void;
  setTaskDependencies: (taskId: string, deps: string[]) => void;
  setTaskPriority: (taskId: string, priority: number) => void;
  setTaskWorkspace: (taskId: string, workspaceId: string | null) => void;

  // Time tracking
  startTaskTimer: (taskId: string) => void;
  stopTaskTimer: (taskId: string) => void;

  // Tags & notes
  setTaskTags: (taskId: string, tags: string[]) => void;
  setTaskNotes: (taskId: string, notes: string) => void;

  // Audit
  addAuditLogEntry: (taskId: string, action: string, details?: string) => void;
  getTaskAuditLog: (taskId: string) => Array<{ id: string; action: string; actor: string; timestamp: string; details?: string }>;
}

function mapStoreStatusToApiStatus(status: Task['status']): string {
  switch (status) {
    case 'pending': return 'backlog';
    case 'in_progress': return 'in-progress';
    case 'completed': return 'done';
    case 'archived': return 'done';
    default: return 'backlog';
  }
}

async function syncTaskToApi(
  endpoint: string,
  method: string,
  body?: Record<string, unknown>
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = typeof window !== 'undefined' ? localStorage.getItem('allternit_api_token') : null;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,
      projects: [],
      activeProjectId: null,

      apiEnabled: true,
      setApiEnabled: (enabled) => set({ apiEnabled: enabled }),
      pendingMutations: [],

      taskTimers: {},
      auditLogs: [],

      createTask: (title, mode = 'task', projectId) => {
        const task: Task = {
          id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          title,
          mode,
          projectId,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const previousTasks = get().tasks;
        set((state) => ({
          tasks: [...state.tasks, task],
          pendingMutations: [
            ...state.pendingMutations,
            { type: 'create', id: task.id, timestamp: Date.now() },
          ],
        }));

        if (get().apiEnabled) {
          syncTaskToApi('/api/v1/tasks', 'POST', {
            title,
            workspace_id: task.workspaceId || 'default',
            status: mapStoreStatusToApiStatus(task.status),
          }).catch(() => {
            set({ tasks: previousTasks });
          }).finally(() => {
            set((state) => ({
              pendingMutations: state.pendingMutations.filter(
                (m) => !(m.type === 'create' && m.id === task.id)
              ),
            }));
          });
        }
        return task;
      },

      deleteTask: (id) => {
        const previousTasks = get().tasks;
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== id),
          activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
          pendingMutations: [
            ...state.pendingMutations,
            { type: 'delete', id, timestamp: Date.now() },
          ],
        }));

        if (get().apiEnabled) {
          syncTaskToApi(`/api/v1/tasks/${id}`, 'DELETE').catch(() => {
            set({ tasks: previousTasks });
          }).finally(() => {
            set((state) => ({
              pendingMutations: state.pendingMutations.filter(
                (m) => !(m.type === 'delete' && m.id === id)
              ),
            }));
          });
        }
      },

      renameTask: (id, title) => {
        const previousTasks = get().tasks;
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, title, updatedAt: new Date().toISOString() } : t
          ),
          pendingMutations: [
            ...state.pendingMutations,
            { type: 'update', id, timestamp: Date.now() },
          ],
        }));

        if (get().apiEnabled) {
          syncTaskToApi(`/api/v1/tasks/${id}`, 'PUT', { title }).catch(() => {
            set({ tasks: previousTasks });
          }).finally(() => {
            set((state) => ({
              pendingMutations: state.pendingMutations.filter(
                (m) => !(m.type === 'update' && m.id === id)
              ),
            }));
          });
        }
      },

      updateTaskStatus: (id, status) => {
        const previousTasks = get().tasks;
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
          ),
          pendingMutations: [
            ...state.pendingMutations,
            { type: 'update', id, timestamp: Date.now() },
          ],
        }));

        if (get().apiEnabled) {
          syncTaskToApi(`/api/v1/tasks/${id}`, 'PUT', {
            status: mapStoreStatusToApiStatus(status),
          }).catch(() => {
            set({ tasks: previousTasks });
          }).finally(() => {
            set((state) => ({
              pendingMutations: state.pendingMutations.filter(
                (m) => !(m.type === 'update' && m.id === id)
              ),
            }));
          });
        }
      },

      createProject: (title) => {
        const project: TaskProject = {
          id: `proj-${Date.now()}`,
          title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
          activeTaskId: null,
        }));
        return project;
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          tasks: state.tasks.map((t) =>
            t.projectId === id ? { ...t, projectId: undefined } : t
          ),
          activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
        }));
      },

      renameProject: (id, title) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, title, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      moveTaskToProject: (taskId, projectId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, projectId: projectId || undefined, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },

      setActiveTask: (id) =>
        set({ activeTaskId: id, activeProjectId: null }),

      setActiveProject: (id) =>
        set({ activeProjectId: id, activeTaskId: null }),

      bindSessionToTask: (taskId, sessionId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, sessionId, updatedAt: new Date().toISOString() } : t
          ),
        })),

      assignTask: (taskId, assigneeType, assigneeId, assigneeName) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, assigneeType, assigneeId, assigneeName, updatedAt: new Date().toISOString() }
              : t
          ),
        })),

      unassignTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, assigneeType: undefined, assigneeId: undefined, assigneeName: undefined, updatedAt: new Date().toISOString() }
              : t
          ),
        })),

      addComment: (taskId, author, body) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  comments: [
                    ...(t.comments || []),
                    { id: `comment-${Date.now()}`, author, body, createdAt: new Date().toISOString() },
                  ],
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        })),

      setTaskWorkspaceId: (taskId, workspaceId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, workspaceId, updatedAt: new Date().toISOString() } : t
          ),
        })),

      setTaskEstimate: (taskId, estimatedMinutes) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, estimatedMinutes, updatedAt: new Date().toISOString() } : t
          ),
        })),

      setTaskDeadline: (taskId, deadline) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, deadline: deadline || undefined, updatedAt: new Date().toISOString() } : t
          ),
        })),

      setTaskDependencies: (taskId, deps) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, dependencies: deps, updatedAt: new Date().toISOString() } : t
          ),
        })),

      setTaskPriority: (taskId, priority) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, priority, updatedAt: new Date().toISOString() } : t
          ),
        })),

      setTaskWorkspace: (taskId, workspaceId) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, workspaceId: workspaceId || undefined, updatedAt: new Date().toISOString() } : t
          ),
        })),

      startTaskTimer: (taskId) =>
        set((state) => ({
          taskTimers: { ...state.taskTimers, [taskId]: Date.now() },
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, startedAt: new Date().toISOString(), status: 'in_progress' } : t
          ),
        })),

      stopTaskTimer: (taskId) =>
        set((state) => {
          const startTime = state.taskTimers[taskId];
          const elapsed = startTime ? Math.round((Date.now() - startTime) / 60000) : 0;
          return {
            taskTimers: { ...state.taskTimers, [taskId]: 0 },
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, actualMinutes: (t.actualMinutes || 0) + elapsed, completedAt: new Date().toISOString() }
                : t
            ),
          };
        }),

      setTaskTags: (taskId, tags) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, tags, updatedAt: new Date().toISOString() } : t
          ),
        })),

      setTaskNotes: (taskId, notes) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, notes, updatedAt: new Date().toISOString() } : t
          ),
        })),

      addAuditLogEntry: (taskId, action, details) =>
        set((state) => ({
          auditLogs: [
            ...state.auditLogs,
            {
              id: `audit-${Date.now()}`,
              taskId,
              action,
              actor: 'user',
              timestamp: new Date().toISOString(),
              details,
            },
          ],
        })),

      getTaskAuditLog: (taskId) =>
        get().auditLogs.filter((log) => log.taskId === taskId),
    }),
    {
      name: 'allternit-task-storage',
      partialize: (state) => ({
        tasks: state.tasks,
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        activeTaskId: state.activeTaskId,
        taskTimers: state.taskTimers,
      }),
    }
  )
);
