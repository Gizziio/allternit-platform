/**
 * CoworkStore — Backward-compatible task/project/UI state store
 *
 * ARCHITECTURE:
 * This store maintains its own reactive state but delegates to:
 * - useTaskStore (canonical source for tasks, projects, time tracking)
 * - useCoworkUIStore (canonical source for UI chrome)
 *
 * A subscription bridge copies state from the underlying stores into this
 * store on every change, ensuring existing components that subscribe to
 * useCoworkStore continue to receive reactive updates.
 *
 * NOTE: This store does NOT use persist middleware. Persistence is handled
 * by the underlying stores.
 */

import { create } from 'zustand';
import { useTaskStore, type Task, type TaskProject } from './useTaskStore';
import { useCoworkUIStore, type CoworkTab } from './useCoworkUIStore';
import { IntelliScheduleEngine } from '@/lib/intelli-schedule/IntelliScheduleEngine';

// Re-export types for backward compatibility
export type { Task, TaskProject };

interface CoworkState {
  // === Task/Project State (mirrored from useTaskStore) ===
  tasks: Task[];
  activeTaskId: string | null;
  projects: TaskProject[];
  activeProjectId: string | null;

  // === UI State (mirrored from useCoworkUIStore) ===
  activeTab: 'tasks' | 'agent-tasks';
  setActiveTab: (tab: 'tasks' | 'agent-tasks') => void;
  selectedEventId: string | null;
  isTimelineExpanded: boolean;
  viewportZoom: number;
  showOcr: boolean;
  showLabels: boolean;

  // === API Sync (mirrored from useTaskStore) ===
  apiEnabled: boolean;
  setApiEnabled: (enabled: boolean) => void;
  pendingMutations: Array<{ type: string; id: string; timestamp: number }>;

  // === Time Tracking & Audit (mirrored from useTaskStore) ===
  taskTimers: Record<string, number>;
  auditLogs: Array<{ id: string; taskId: string; action: string; actor: string; timestamp: string; details?: string }>;

  // === Task CRUD (delegates to useTaskStore) ===
  createTask: (title: string, mode?: 'agent' | 'task', projectId?: string) => Task;
  deleteTask: (id: string) => void;
  renameTask: (id: string, title: string) => void;
  updateTaskStatus: (id: string, status: Task['status']) => void;

  // === Project CRUD (delegates to useTaskStore) ===
  createProject: (title: string) => TaskProject;
  deleteProject: (id: string) => void;
  renameProject: (id: string, title: string) => void;
  moveTaskToProject: (taskId: string, projectId: string | null) => void;
  setActiveTask: (id: string | null) => void;
  setActiveProject: (id: string | null) => void;
  // === Team Assignment (delegates to useTaskStore) ===
  assignTask: (taskId: string, assigneeType: 'human' | 'agent', assigneeId: string, assigneeName: string) => void;
  unassignTask: (taskId: string) => void;
  addComment: (taskId: string, author: string, body: string) => void;
  setTaskWorkspaceId: (taskId: string, workspaceId: string) => void;

  // === Intelli-schedule (delegates to useTaskStore) ===
  optimizeSchedule: () => void;
  setTaskEstimate: (taskId: string, estimatedMinutes: number) => void;
  setTaskDeadline: (taskId: string, deadline: string | null) => void;
  setTaskDependencies: (taskId: string, deps: string[]) => void;
  setTaskPriority: (taskId: string, priority: number) => void;
  setTaskWorkspace: (taskId: string, workspaceId: string | null) => void;

  // === Time Tracking (delegates to useTaskStore) ===
  startTaskTimer: (taskId: string) => void;
  stopTaskTimer: (taskId: string) => void;

  // === Tags & Notes (delegates to useTaskStore) ===
  setTaskTags: (taskId: string, tags: string[]) => void;
  setTaskNotes: (taskId: string, notes: string) => void;

  // === Audit Log (delegates to useTaskStore) ===
  getTaskAuditLog: (taskId: string) => Array<{ id: string; action: string; actor: string; timestamp: string; details?: string }>;
  addAuditLogEntry: (taskId: string, action: string, details?: string) => void;

  // === UI Toggles (delegates to useCoworkUIStore) ===
  selectEvent: (eventId: string | null) => void;
  toggleTimeline: () => void;
  setViewportZoom: (zoom: number) => void;
  toggleOcr: () => void;
  toggleLabels: () => void;

  // === Session (backward compat) ===
  startSession: (type: string, context: string) => string;

}


export const useCoworkStore = create<CoworkState>()((set, get) => {
  // Initialize state from underlying stores
  const initialTaskState = useTaskStore.getState();
  const initialUIState = useCoworkUIStore.getState();

  // Subscribe to underlying stores and mirror their state
  // This ensures components reading from useCoworkStore get reactive updates
  const unsubTask = useTaskStore.subscribe((taskState) => {
    set({
      tasks: taskState.tasks,
      activeTaskId: taskState.activeTaskId,
      projects: taskState.projects,
      activeProjectId: taskState.activeProjectId,
      taskTimers: taskState.taskTimers,
      auditLogs: taskState.auditLogs,
      pendingMutations: taskState.pendingMutations,
      apiEnabled: taskState.apiEnabled,
    });
  });

  const unsubUI = useCoworkUIStore.subscribe((uiState) => {
    set({
      activeTab: uiState.activeTab === 'agent-tasks' ? 'agent-tasks' : 'tasks',
      selectedEventId: uiState.selectedEventId,
      isTimelineExpanded: uiState.isTimelineExpanded,
      viewportZoom: uiState.viewportZoom,
      showOcr: uiState.showOcr,
      showLabels: uiState.showLabels,
    });
  });

  // Store cleanup on the state object for potential future use
  // (Zustand stores are module-level singletons, so cleanup is rarely needed)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      unsubTask();
      unsubUI();
    });
  }

  return {
    // === Initial state mirrored from underlying stores ===
    tasks: initialTaskState.tasks,
    activeTaskId: initialTaskState.activeTaskId,
    projects: initialTaskState.projects,
    activeProjectId: initialTaskState.activeProjectId,
    activeTab: initialUIState.activeTab === 'agent-tasks' ? 'agent-tasks' : 'tasks',
    selectedEventId: initialUIState.selectedEventId,
    isTimelineExpanded: initialUIState.isTimelineExpanded,
    viewportZoom: initialUIState.viewportZoom,
    showOcr: initialUIState.showOcr,
    showLabels: initialUIState.showLabels,
    apiEnabled: initialTaskState.apiEnabled,
    pendingMutations: initialTaskState.pendingMutations,
    taskTimers: initialTaskState.taskTimers,
    auditLogs: initialTaskState.auditLogs,

    // === Task CRUD (delegates to useTaskStore) ===
    createTask: (title, mode, projectId) => useTaskStore.getState().createTask(title, mode, projectId),
    deleteTask: (id) => useTaskStore.getState().deleteTask(id),
    renameTask: (id, title) => useTaskStore.getState().renameTask(id, title),
    updateTaskStatus: (id, status) => useTaskStore.getState().updateTaskStatus(id, status),

    // === Project CRUD (delegates to useTaskStore) ===
    createProject: (title) => useTaskStore.getState().createProject(title),
    deleteProject: (id) => useTaskStore.getState().deleteProject(id),
    renameProject: (id, title) => useTaskStore.getState().renameProject(id, title),
    moveTaskToProject: (taskId, projectId) => useTaskStore.getState().moveTaskToProject(taskId, projectId),
    setActiveTask: (id) => useTaskStore.getState().setActiveTask(id),
    setActiveProject: (id) => useTaskStore.getState().setActiveProject(id),
    // === Team Assignment (delegates to useTaskStore) ===
    assignTask: (taskId, assigneeType, assigneeId, assigneeName) =>
      useTaskStore.getState().assignTask(taskId, assigneeType, assigneeId, assigneeName),
    unassignTask: (taskId) => useTaskStore.getState().unassignTask(taskId),
    addComment: (taskId, author, body) => useTaskStore.getState().addComment(taskId, author, body),
    setTaskWorkspaceId: (taskId, workspaceId) => useTaskStore.getState().setTaskWorkspaceId(taskId, workspaceId),

    // === Intelli-schedule ===
    optimizeSchedule: () => {
      const { tasks } = useTaskStore.getState();
      const engine = new IntelliScheduleEngine();
      const inputTasks = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority ?? 50,
        estimatedMinutes: t.estimatedMinutes ?? 60,
        deadline: t.deadline ? new Date(t.deadline) : undefined,
        dependencies: t.dependencies ?? [],
        tags: [],
      }));
      const input = {
        tasks: inputTasks,
        constraints: {
          availableHoursPerDay: 8,
          startTime: new Date(),
          bufferMinutes: 15,
        },
      };
      const result = engine.optimize(input);
      const rankMap = new Map<string, number>(result.orderedTasks.map((id: string, idx: number) => [id, idx + 1]));
      const store = useTaskStore.getState();
      for (const t of tasks) {
        const rank = rankMap.get(t.id);
        if (rank !== undefined) store.setTaskPriority(t.id, rank);
        // Risk is not a native task field — could be added to useTaskStore if needed
      }
    },
    setTaskEstimate: (taskId, estimatedMinutes) => useTaskStore.getState().setTaskEstimate(taskId, estimatedMinutes),
    setTaskDeadline: (taskId, deadline) => useTaskStore.getState().setTaskDeadline(taskId, deadline),
    setTaskDependencies: (taskId, deps) => useTaskStore.getState().setTaskDependencies(taskId, deps),
    setTaskPriority: (taskId, priority) => useTaskStore.getState().setTaskPriority(taskId, priority),
    setTaskWorkspace: (taskId, workspaceId) => useTaskStore.getState().setTaskWorkspace(taskId, workspaceId),

    // === Time Tracking (delegates to useTaskStore) ===
    startTaskTimer: (taskId) => useTaskStore.getState().startTaskTimer(taskId),
    stopTaskTimer: (taskId) => useTaskStore.getState().stopTaskTimer(taskId),

    // === Tags & Notes (delegates to useTaskStore) ===
    setTaskTags: (taskId, tags) => useTaskStore.getState().setTaskTags(taskId, tags),
    setTaskNotes: (taskId, notes) => useTaskStore.getState().setTaskNotes(taskId, notes),

    // === Audit Log (delegates to useTaskStore) ===
    getTaskAuditLog: (taskId) => useTaskStore.getState().getTaskAuditLog(taskId),
    addAuditLogEntry: (taskId, action, details) => useTaskStore.getState().addAuditLogEntry(taskId, action, details),

    // === UI Toggles (delegates to useCoworkUIStore) ===
    selectEvent: (eventId) => useCoworkUIStore.getState().selectEvent(eventId),
    toggleTimeline: () => useCoworkUIStore.getState().toggleTimeline(),
    setViewportZoom: (zoom) => useCoworkUIStore.getState().setViewportZoom(Math.max(0.5, Math.min(2, zoom))),
    toggleOcr: () => useCoworkUIStore.getState().toggleOcr(),
    toggleLabels: () => useCoworkUIStore.getState().toggleLabels(),
    setActiveTab: (tab) => useCoworkUIStore.getState().setActiveTab(tab as CoworkTab),
    setApiEnabled: (enabled) => useTaskStore.getState().setApiEnabled(enabled),
    startSession: (_type: string, _context: string) => {
      return `cowork-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    },

  };
});
