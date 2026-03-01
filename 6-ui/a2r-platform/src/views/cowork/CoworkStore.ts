/**
 * CoworkStore - Production store for Cowork mode session state
 * 
 * Backend Integration Points:
 * 
 * 1. connectCoworkStream() - WebSocket/SSE connection to backend
 *    Endpoint: wss://api.a2r.local/v1/cowork/{sessionId}/stream
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
import type {
  CoworkSession,
  AnyCoworkEvent,
  ObservationEvent,
  ApprovalRequestEvent,
  CheckpointEvent,
  CoworkControlAction,
  CoworkSessionStatus,
} from './cowork.types';

interface CoworkState {
  // Current active session
  session: CoworkSession | null;
  
  // History of past sessions
  sessionHistory: CoworkSession[];
  
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
        
        set({ session, selectedEventId: null });
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
        
        set(state => ({
          session: null,
          sessionHistory: [endedSession, ...state.sessionHistory],
        }));
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
          
          return {
            session: { ...session, ...updates },
          };
        });
      },
      
      // Send control action to the session
      sendControl: (action) => {
        const { session } = get();
        if (!session) return;
        
        switch (action.type) {
          case 'pause':
            set({ session: { ...session, status: 'paused' } });
            break;
          case 'resume':
            set({ session: { ...session, status: 'running' } });
            break;
          case 'step':
            set({ session: { ...session, status: 'running' } });
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
            set({ 
              session: { 
                ...session, 
                status: 'running',
                takeover: { active: false },
              } 
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
      name: 'a2r-cowork-storage',
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
  // TODO: Replace with actual WebSocket/SSE connection to backend
  // const ws = new WebSocket(`wss://api.a2r.local/v1/cowork/${sessionId}/stream`);
  
  // For now, return a stub that logs the expected integration point
  console.warn('[CoworkStream] Backend connection not implemented. Expected:');
  console.warn('  - WebSocket: wss://api.a2r.local/v1/cowork/${sessionId}/stream');
  console.warn('  - Events: observation, action, approval_request, checkpoint, etc.');
  console.warn('  - Controls: pause, resume, step, approve, reject, takeover');
  
  return {
    sendControl: (action) => {
      console.log('[CoworkStream] Control action:', action);
      // TODO: Send control action to backend
    },
    disconnect: () => {
      console.log('[CoworkStream] Disconnecting from session:', sessionId);
      // TODO: Close WebSocket connection
    },
  };
}
