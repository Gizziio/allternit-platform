/**
 * CoworkStore - Production store for Cowork mode session state
 * 
 * Backend Integration Points:
 * 
 * 1. connectCoworkStream() - WebSocket/SSE connection to backend
 *    Endpoint: wss://api.allternit.local/v1/cowork/{sessionId}/stream
 *    
 * 2. Events from backend (AnyCoworkEvent):
 *    - cowork.session.start/end
 *    - cowork.observation (screenshot + metadata)
 *    - cowork.action (click, type, scroll)
 *    - cowork.approval_request (safety gates)
 *    - cowork.checkpoint (save points)
 *    - cowork.narration (assistant text)
 *    
 * 3. Controls to backend (CoworkControlAction):
 *    - pause, resume, step, stop
 *    - approve, reject (for approval requests)
 *    - takeover, release_takeover
 *    - restore (checkpoint)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GATEWAY_URL } from '../../integration/api-client';
import type {
  CoworkSession,
  AnyCoworkEvent,
  ObservationEvent,
  ApprovalRequestEvent,
  CheckpointEvent,
  CoworkControlAction,
  CoworkSessionStatus,
} from './cowork.types';

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
}

export interface TaskProject {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface CoworkState {
  // Current active session
  session: CoworkSession | null;
  
  // History of past sessions
  sessionHistory: CoworkSession[];
  
  // Tasks
  tasks: Task[];
  activeTaskId: string | null;
  taskSessions: Record<string, CoworkSession>;
  
  // Projects
  projects: TaskProject[];
  activeProjectId: string | null;
  
  // Active tab state
  activeTab: 'tasks' | 'agent-tasks';
  setActiveTab: (tab: 'tasks' | 'agent-tasks') => void;
  
  // UI state
  selectedEventId: string | null;
  isTimelineExpanded: boolean;
  viewportZoom: number;
  showOcr: boolean;
  showLabels: boolean;
  
  // Actions
  startSession: (viewportType: 'browser' | 'desktop' | 'remote', task: string) => string;
  endSession: (reason: 'completed' | 'error' | 'user_terminated', summary?: string) => void;
  addEvent: (event: AnyCoworkEvent) => void;
  sendControl: (action: CoworkControlAction) => void;
  
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
  bindCurrentSessionToTask: (taskId: string) => void;
  
  // Selection
  selectEvent: (eventId: string | null) => void;
  
  // UI toggles
  toggleTimeline: () => void;
  setViewportZoom: (zoom: number) => void;
  toggleOcr: () => void;
  toggleLabels: () => void;
  
  // Helpers
  getCurrentObservation: () => ObservationEvent | undefined;
  getPendingApprovals: () => ApprovalRequestEvent[];
  getCheckpoints: () => CheckpointEvent[];
  canApprove: (actionId: string) => boolean;
}

function generateId(): string {
  return `cowork_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function snapshotActiveTaskSession(
  taskSessions: Record<string, CoworkSession>,
  activeTaskId: string | null,
  session: CoworkSession | null,
): Record<string, CoworkSession> {
  if (!activeTaskId || !session) {
    return taskSessions;
  }
  return { ...taskSessions, [activeTaskId]: session };
}

export const useCoworkStore = create<CoworkState>()(
  persist(
    (set, get) => ({
      // Initial state
      session: null,
      sessionHistory: [],
      selectedEventId: null,
      isTimelineExpanded: true,
      viewportZoom: 1,
      showOcr: false,
      showLabels: true,
      
      // Tasks initial state
      tasks: [
        {
          id: 'task-1',
          title: 'Review quarterly report',
          mode: 'task',
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task-2',
          title: 'Analyze competitor data',
          mode: 'agent',
          status: 'in_progress',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      activeTaskId: null,
      taskSessions: {},
      
      // Projects initial state
      projects: [
        {
          id: 'proj-1',
          title: 'Q4 Planning',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      activeProjectId: null,
      
      // Active tab initial state
      activeTab: 'tasks',
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      // Task CRUD
      createTask: (title, mode = 'task', projectId) => {
        const task: Task = {
          id: `task-${Date.now()}`,
          title,
          mode,
          projectId,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
        return task;
      },
      
      deleteTask: (id) => {
        set((state) => {
          const { [id]: _removed, ...remainingTaskSessions } = state.taskSessions;
          const deletingActiveTask = state.activeTaskId === id;
          return {
            tasks: state.tasks.filter((t) => t.id !== id),
            activeTaskId: deletingActiveTask ? null : state.activeTaskId,
            session: deletingActiveTask ? null : state.session,
            selectedEventId: deletingActiveTask ? null : state.selectedEventId,
            taskSessions: remainingTaskSessions,
          };
        });
      },
      
      renameTask: (id, title) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, title, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },
      
      updateTaskStatus: (id, status) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },
      
      // Project CRUD
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
          session: null,
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
        set((state) => {
          const taskSessions = snapshotActiveTaskSession(
            state.taskSessions,
            state.activeTaskId,
            state.session,
          );

          if (!id) {
            return {
              activeTaskId: null,
              session: null,
              selectedEventId: null,
              taskSessions,
            };
          }

          return {
            activeTaskId: id,
            activeProjectId: null,
            session: taskSessions[id] ?? null,
            selectedEventId: null,
            taskSessions,
          };
        }),
      setActiveProject: (id) =>
        set((state) => {
          const taskSessions = snapshotActiveTaskSession(
            state.taskSessions,
            state.activeTaskId,
            state.session,
          );

          if (!id) {
            return {
              activeProjectId: null,
              taskSessions,
            };
          }

          return {
            activeProjectId: id,
            activeTaskId: null,
            session: null,
            selectedEventId: null,
            taskSessions,
          };
        }),
      bindCurrentSessionToTask: (taskId) =>
        set((state) => {
          const taskSessions = state.session
            ? { ...state.taskSessions, [taskId]: state.session }
            : state.taskSessions;
          return {
            activeTaskId: taskId,
            activeProjectId: null,
            session: state.session ?? taskSessions[taskId] ?? null,
            taskSessions,
          };
        }),
      
      // Start a new Cowork session
      startSession: (viewportType, task) => {
        const sessionId = generateId();
        const now = Date.now();
        
        const session: CoworkSession = {
          id: sessionId,
          status: 'idle',
          viewportType,
          events: [{
            id: `evt_${now}`,
            type: 'cowork.session.start',
            timestamp: now,
            sessionId,
            viewportType,
            context: { task },
          } as AnyCoworkEvent],
          pendingApprovals: [],
          checkpoints: [],
          metrics: {
            actionsExecuted: 0,
            approvalsRequested: 0,
            timeRunning: 0,
          },
        };
        
        set((state) => {
          const existingTaskSessions = snapshotActiveTaskSession(
            state.taskSessions,
            state.activeTaskId,
            state.session,
          );
          const taskSessions = state.activeTaskId
            ? { ...existingTaskSessions, [state.activeTaskId]: session }
            : existingTaskSessions;

          return {
            session,
            selectedEventId: null,
            taskSessions,
          };
        });
        return sessionId;
      },
      
      // End the current session
      endSession: (reason, summary) => {
        const { session } = get();
        if (!session) return;
        
        const endEvent: AnyCoworkEvent = {
          id: `evt_${Date.now()}`,
          type: 'cowork.session.end',
          timestamp: Date.now(),
          sessionId: session.id,
          reason,
          summary,
        } as AnyCoworkEvent;
        
        const endedSession = {
          ...session,
          status: reason === 'completed' ? 'completed' : 'error' as CoworkSessionStatus,
          events: [...session.events, endEvent],
        };
        
        set((state) => {
          const taskSessions = state.activeTaskId
            ? { ...state.taskSessions, [state.activeTaskId]: endedSession }
            : state.taskSessions;
          return {
            session: null,
            sessionHistory: [endedSession, ...state.sessionHistory],
            taskSessions,
          };
        });
      },
      
      // Add an event to the current session
      addEvent: (event) => {
        set(state => {
          if (!state.session) return state;
          
          const session = state.session;
          const events = [...session.events, event];
          
          // Update session based on event type
          let updates: Partial<CoworkSession> = { events };
          
          // Track current observation
          if (event.type === 'cowork.observation') {
            updates.currentObservation = event as ObservationEvent;
          }
          
          // Track pending approvals
          if (event.type === 'cowork.approval_request') {
            updates.pendingApprovals = [...session.pendingApprovals, event as ApprovalRequestEvent];
            updates.metrics = {
              ...session.metrics,
              approvalsRequested: session.metrics.approvalsRequested + 1,
            };
            updates.status = 'waiting_approval';
          }
          
          // Remove approved/rejected from pending
          if (event.type === 'cowork.approval_result') {
            const approvalEvent = event as any;
            updates.pendingApprovals = session.pendingApprovals.filter(
              p => p.actionId !== approvalEvent.actionId
            );
            // Resume running if no more pending approvals
            if (updates.pendingApprovals?.length === 0) {
              updates.status = 'running';
            }
          }
          
          // Track checkpoints
          if (event.type === 'cowork.checkpoint') {
            updates.checkpoints = [...session.checkpoints, event as CheckpointEvent];
          }
          
          // Track actions
          if (event.type === 'cowork.action') {
            updates.metrics = {
              ...session.metrics,
              actionsExecuted: session.metrics.actionsExecuted + 1,
            };
          }
          
          // Track status changes
          if (event.type === 'cowork.takeover') {
            updates.status = 'takeover';
            updates.takeover = { active: true, startedAt: Date.now() };
          }
          
          const nextSession = { ...session, ...updates };
          const taskSessions = state.activeTaskId
            ? { ...state.taskSessions, [state.activeTaskId]: nextSession }
            : state.taskSessions;

          return {
            session: nextSession,
            taskSessions,
          };
        });
      },
      
      // Send control action to the session
      sendControl: (action) => {
        const { session } = get();
        if (!session) return;
        
        switch (action.type) {
          case 'pause':
            set((state) => {
              if (!state.session) return state;
              const nextSession = { ...state.session, status: 'paused' as CoworkSessionStatus };
              const taskSessions = state.activeTaskId
                ? { ...state.taskSessions, [state.activeTaskId]: nextSession }
                : state.taskSessions;
              return { session: nextSession, taskSessions };
            });
            break;
          case 'resume':
            set((state) => {
              if (!state.session) return state;
              const nextSession = { ...state.session, status: 'running' as CoworkSessionStatus };
              const taskSessions = state.activeTaskId
                ? { ...state.taskSessions, [state.activeTaskId]: nextSession }
                : state.taskSessions;
              return { session: nextSession, taskSessions };
            });
            break;
          case 'step':
            set((state) => {
              if (!state.session) return state;
              const nextSession = { ...state.session, status: 'running' as CoworkSessionStatus };
              const taskSessions = state.activeTaskId
                ? { ...state.taskSessions, [state.activeTaskId]: nextSession }
                : state.taskSessions;
              return { session: nextSession, taskSessions };
            });
            // In real implementation, this would trigger one action then pause
            break;
          case 'stop':
            get().endSession('user_terminated');
            break;
          case 'takeover':
            get().addEvent({
              id: `evt_${Date.now()}`,
              type: 'cowork.takeover',
              timestamp: Date.now(),
              sessionId: session.id,
              userId: 'current_user',
            } as AnyCoworkEvent);
            break;
          case 'release_takeover':
            set((state) => {
              if (!state.session) return state;
              const nextSession: CoworkSession = {
                ...state.session,
                status: 'running',
                takeover: { active: false },
              };
              const taskSessions = state.activeTaskId
                ? { ...state.taskSessions, [state.activeTaskId]: nextSession }
                : state.taskSessions;
              return {
                session: nextSession,
                taskSessions,
              };
            });
            break;
          case 'approve':
            get().addEvent({
              id: `evt_${Date.now()}`,
              type: 'cowork.approval_result',
              timestamp: Date.now(),
              sessionId: session.id,
              actionId: action.actionId,
              approved: true,
              userNote: action.note,
              responder: 'user',
            } as AnyCoworkEvent);
            break;
          case 'reject':
            get().addEvent({
              id: `evt_${Date.now()}`,
              type: 'cowork.approval_result',
              timestamp: Date.now(),
              sessionId: session.id,
              actionId: action.actionId,
              approved: false,
              userNote: action.note,
              responder: 'user',
            } as AnyCoworkEvent);
            break;
        }
      },
      
      // Select an event in the timeline
      selectEvent: (eventId) => set({ selectedEventId: eventId }),
      
      // UI toggles
      toggleTimeline: () => set(state => ({ isTimelineExpanded: !state.isTimelineExpanded })),
      setViewportZoom: (zoom) => set({ viewportZoom: Math.max(0.5, Math.min(2, zoom)) }),
      toggleOcr: () => set(state => ({ showOcr: !state.showOcr })),
      toggleLabels: () => set(state => ({ showLabels: !state.showLabels })),
      
      // Helpers
      getCurrentObservation: () => get().session?.currentObservation,
      getPendingApprovals: () => get().session?.pendingApprovals || [],
      getCheckpoints: () => get().session?.checkpoints || [],
      canApprove: (actionId) => {
        const session = get().session;
        if (!session) return false;
        return session.pendingApprovals.some(p => p.actionId === actionId);
      },
    }),
    {
      name: 'allternit-cowork-storage',
      partialize: (state) => ({
        sessionHistory: state.sessionHistory,
        viewportZoom: state.viewportZoom,
        showOcr: state.showOcr,
        showLabels: state.showLabels,
      }),
    }
  )
);

// ============================================================================
// Production Event Stream Hook
// ============================================================================

export interface CoworkStreamConnection {
  sendControl: (action: CoworkControlAction) => void;
  disconnect: () => void;
}

/**
 * Connect to a Cowork session event stream
 * 
 * In production, this connects to the backend WebSocket/SSE endpoint.
 * The backend sends events: observation, action, approval_request, etc.
 */
export function connectCoworkStream(
  sessionId: string,
  onEvent: (event: AnyCoworkEvent) => void,
  onError: (error: Error) => void,
  onStatusChange?: (status: CoworkSessionStatus) => void
): CoworkStreamConnection {
  // Use EventSource for SSE connection to backend
  const eventSource = new EventSource(`/api/cowork/${sessionId}/stream`);
  
  eventSource.onopen = () => {
    console.log('[CoworkStream] Connected to session:', sessionId);
    onStatusChange?.('running');
  };
  
  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as AnyCoworkEvent;
      onEvent(data);
      
      // Update status based on event type
      if (data.type === 'status_change' && onStatusChange) {
        onStatusChange((data as any).status);
      }
    } catch (e) {
      console.error('[CoworkStream] Failed to parse event:', e);
    }
  };
  
  eventSource.onerror = (error) => {
    console.error('[CoworkStream] Connection error:', error);
    onError(new Error('Cowork stream connection failed'));
    onStatusChange?.('error');
  };
  
  return {
    sendControl: async (action) => {
      try {
        const response = await fetch(`${GATEWAY_URL}/api/cowork/${sessionId}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });

        if (!response.ok) {
          throw new Error(`Control action failed: ${response.status}`);
        }
      } catch (e) {
        console.error('[CoworkStream] Control action failed:', e);
        throw e;
      }
    },
    disconnect: () => {
      console.log('[CoworkStream] Disconnecting from session:', sessionId);
      eventSource.close();
      onStatusChange?.('paused');
    },
  };
}
