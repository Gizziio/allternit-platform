/**
 * Browser Agent Store - State management for agentic browsing
 * 
 * Manages:
 * - Agent status (Idle/Running/Waiting/Blocked/Done)
 * - Mode (Human/Assist/Agent)
 * - Current action execution
 * - Receipt stream
 * - Event subscriptions
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  BrowserAgentStatus,
  BrowserAgentMode,
  BrowserEndpoint,
  BrowserAction,
  RiskTier,
} from './browserAgent.types';
import {
  ReceiptQueryParams,
  ReceiptQueryResult,
  getReceiptGenerator,
} from './receiptService';
import type { PageAgentBridgeConfig } from '@/lib/page-agent/config';
import {
  getPageAgentRunEndpoint,
  getPageAgentStopEndpoint,
  getPageAgentStreamEndpoint,
} from '@/lib/page-agent/runtime-client';

export type PageAgentStatus = 'idle' | 'running' | 'completed' | 'error';

export type PageAgentActivity =
  | { type: 'thinking' }
  | { type: 'executing'; tool: string; input?: unknown }
  | { type: 'executed'; tool: string; input?: unknown; output?: string; duration?: number }
  | { type: 'retrying'; attempt: number; maxAttempts: number }
  | { type: 'error'; message: string };

export type PageAgentHistoricalEvent =
  | {
      type: 'step';
      stepIndex?: number;
      reflection?: {
        evaluation_previous_goal?: string;
        memory?: string;
        next_goal?: string;
      };
      action?: {
        name: string;
        input: unknown;
        output: string;
      };
      rawRequest?: unknown;
      rawResponse?: unknown;
    }
  | {
      type: 'observation';
      content: string;
    }
  | {
      type: 'retry';
      message: string;
      attempt: number;
      maxAttempts: number;
    }
  | {
      type: 'error';
      message: string;
      rawResponse?: unknown;
    }
  | {
      type: 'user_takeover';
      message?: string;
    };

export interface PageAgentSessionRecord {
  id: string;
  sessionId: string | null;
  task: string;
  status: Extract<PageAgentStatus, 'completed' | 'error'>;
  history: PageAgentHistoricalEvent[];
  createdAt: number;
}

const PAGE_AGENT_SESSION_LIMIT = 20;

function mapRemotePageAgentStatus(status: string): PageAgentStatus {
  if (status === 'running') return 'running';
  if (status === 'completed') return 'completed';
  if (status === 'error') return 'error';
  return 'idle';
}

function createPageAgentSessionId() {
  return globalThis.crypto?.randomUUID?.() ?? `page-agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensurePageAgentHistory(
  history: PageAgentHistoricalEvent[],
  fallback: { success?: boolean; data?: string; message?: string },
): PageAgentHistoricalEvent[] {
  if (history.length > 0) {
    return history;
  }

  if (fallback.message) {
    return [{ type: 'error', message: fallback.message }];
  }

  if (fallback.data) {
    return [{ type: 'observation', content: fallback.data }];
  }

  if (fallback.success === false) {
    return [{ type: 'error', message: 'Task failed.' }];
  }

  return history;
}

function appendPageAgentSession(
  sessions: PageAgentSessionRecord[],
  record: PageAgentSessionRecord,
) {
  return [
    record,
    ...sessions.filter((session) => session.id !== record.id && session.sessionId !== record.sessionId),
  ].slice(0, PAGE_AGENT_SESSION_LIMIT);
}

// ============================================================================
// Store State
// ============================================================================

export interface BrowserAgentState {
  // Agent status
  status: BrowserAgentStatus;
  mode: BrowserAgentMode;
  endpoint: BrowserEndpoint | null;

  // Current execution
  currentRunId: string | null;
  currentAction: {
    action: BrowserAction;
    stepIndex: number;
    totalSteps: number;
    boundingBox?: { x: number; y: number; width: number; height: number } | null;
    label?: string;
    selector?: string;
    type?: string;
  } | null;

  // Goal
  goal: string;

  // Streaming / observable state
  lastEventMessage: string | null;
  currentAdapterId: string | null;
  currentLayer: string | null;
  fallbackCount: number;

  // Approval
  requiresApproval: boolean;
  approvalActionSummary?: string;
  approvalRiskTier?: RiskTier;

  // Receipts
  receipts: string[];  // Receipt IDs

  // Connected endpoints
  connectedEndpoints: BrowserEndpoint[];

  // Active ACI engine session (set when runGoal posts to /api/aci/run)
  aciSessionId: string | null;

  // Live screenshot from the ACI SSE stream (base64 PNG, no data: prefix)
  screenshot: string | null;

  // Page-agent session (extension path via thin-client)
  pageAgentSessionId: string | null;
  pageAgentStatus: PageAgentStatus;
  pageAgentActivity: PageAgentActivity | null;
  pageAgentHistory: PageAgentHistoricalEvent[];
  pageAgentSessions: PageAgentSessionRecord[];

  // AI SDK model string used for computer-use runs — any vision-capable model
  // e.g. 'anthropic/claude-sonnet-4.6', 'openai/gpt-5.4', 'google/gemini-2.5-pro'
  aciModel: string;
  setAciModel: (model: string) => void;

  // BrowserCapsule mount tracking — used by ACIComputerUseSidecar to suppress
  // the global portal panel when the capsule is already showing its own viewport
  isBrowserCapsuleMounted: boolean;
  setIsBrowserCapsuleMounted: (mounted: boolean) => void;

  // ACI sidecar expanded/collapsed — shared between the right panel and the
  // above-input compact bar so both use the same toggle
  aciSidecarExpanded: boolean;
  setAciSidecarExpanded: (expanded: boolean) => void;
  toggleAciSidecar: () => void;

  // Actions
  setGoal: (goal: string) => void;
  runGoal: (goal: string) => void;
  runPageAgentGoal: (goal: string, config?: PageAgentBridgeConfig) => void;
  stopExecution: () => void;
  stopPageAgent: () => void;
  deletePageAgentSession: (id: string) => void;
  clearPageAgentSessions: () => void;
  pauseExecution: () => void;
  resumeExecution: () => void;
  takeOver: () => void;
  handOff: () => void;
  approveAction: () => void;
  denyAction: () => void;
  captureScreenshot: () => void;
  openDrawer: () => void;

  // Mode
  setMode: (mode: BrowserAgentMode) => void;

  // Endpoint
  setEndpoint: (endpoint: BrowserEndpoint | null) => void;
  addEndpoint: (endpoint: BrowserEndpoint) => void;
  removeEndpoint: (endpointId: string) => void;

  // Receipts
  addReceipt: (receiptId: string) => void;
  queryReceipts: (params: ReceiptQueryParams) => Promise<ReceiptQueryResult>;

  // Execution simulation (for demo)
  _simulateExecution: () => void;
}

// ============================================================================
// Store Creation
// ============================================================================

export const useBrowserAgentStore = create<BrowserAgentState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    status: 'Idle',
    mode: 'Human',
    endpoint: null,
    currentRunId: null,
    currentAction: null,
    goal: '',
    lastEventMessage: null,
    currentAdapterId: null,
    currentLayer: null,
    fallbackCount: 0,
    requiresApproval: false,
    approvalActionSummary: undefined,
    approvalRiskTier: undefined,
    receipts: [],
    connectedEndpoints: [],
    aciSessionId: null,
    screenshot: null,
    pageAgentSessionId: null,
    pageAgentStatus: 'idle',
    pageAgentActivity: null,
    pageAgentHistory: [],
    pageAgentSessions: [],
    aciModel: 'anthropic/claude-sonnet-4.6',
    setAciModel: (model) => set({ aciModel: model }),
    isBrowserCapsuleMounted: false,
    setIsBrowserCapsuleMounted: (mounted) => set({ isBrowserCapsuleMounted: mounted }),
    aciSidecarExpanded: true,
    setAciSidecarExpanded: (expanded) => set({ aciSidecarExpanded: expanded }),
    toggleAciSidecar: () => set((s) => ({ aciSidecarExpanded: !s.aciSidecarExpanded })),
    
    // Goal
    setGoal: (goal) => set({ goal }),
    
    // Run goal
    runGoal: (goal) => {
      set({
        goal,
        status: 'Running',
        currentAction: null,
        screenshot: null,
        aciSessionId: null,
        pageAgentSessionId: null,
        pageAgentStatus: 'idle',
        pageAgentActivity: null,
        pageAgentHistory: [],
      });

      fetch('/api/aci/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, model: get().aciModel }),
      })
        .then((res) => res.json())
        .then(({ sessionId, adapterId }: { sessionId: string; adapterId: string }) => {
          set({ aciSessionId: sessionId, currentAdapterId: adapterId });

          const es = new EventSource(`/api/aci/stream/${sessionId}`);

          es.onmessage = (e) => {
            try {
              const event = JSON.parse(e.data) as { type: string; data: unknown; ts: number };

              if (event.type === 'state') {
                // RunState shape from lib/aci/types.ts
                const s = event.data as {
                  status?: string;
                  lastMessage?: string | null;
                  adapterId?: string;
                  stepIndex?: number;
                  totalSteps?: number | null;
                  currentAction?: {
                    type?: string;
                    label?: string;
                    selector?: string;
                    x?: number;
                    y?: number;
                    risk?: number;
                  } | null;
                };

                const update: Partial<BrowserAgentState> = {};

                if (s.status !== undefined) update.status = s.status as BrowserAgentStatus;
                if (s.lastMessage != null) update.lastEventMessage = s.lastMessage;
                if (s.adapterId) update.currentAdapterId = s.adapterId;

                // Map AciAction → BrowserAgentState.currentAction
                if ('currentAction' in s) {
                  if (!s.currentAction) {
                    update.currentAction = null;
                  } else {
                    const a = s.currentAction;
                    update.currentAction = {
                      action: { type: a.type } as BrowserAction,
                      stepIndex: s.stepIndex ?? 0,
                      totalSteps: s.totalSteps ?? undefined,
                      label: a.label,
                      selector: a.selector,
                      type: a.type,
                      boundingBox:
                        a.x != null && a.y != null
                          ? { x: a.x, y: a.y, width: 40, height: 20 }
                          : null,
                    };
                  }
                }

                // Derive approval state from status
                const isWaiting = s.status === 'WaitingApproval';
                update.requiresApproval = isWaiting;
                if (isWaiting && s.currentAction) {
                  update.approvalActionSummary = s.currentAction.label ?? s.currentAction.type;
                  update.approvalRiskTier = (s.currentAction.risk ?? 3) as RiskTier;
                }

                set(update);
              } else if (event.type === 'screenshot') {
                // runner sends { screenshot: base64 }
                const d = event.data as { screenshot?: string };
                if (d.screenshot) set({ screenshot: d.screenshot });
              } else if (event.type === 'trace') {
                const t = event.data as { message?: string; adapterId?: string };
                if (t.message) set({ lastEventMessage: t.message });
                if (t.adapterId) set({ currentAdapterId: t.adapterId });
              } else if (event.type === 'done') {
                es.close();
              }
            } catch {
              // ignore malformed events
            }
          };

          es.onerror = () => {
            es.close();
            if (get().status === 'Running') set({ status: 'Done' });
          };
        })
        .catch(() => {
          set({ status: 'Done' });
        });
    },
    
    // Run goal via browser extension (page-agent path)
    runPageAgentGoal: (goal, config) => {
      set({
        goal,
        status: 'Idle',
        currentAction: null,
        currentAdapterId: null,
        currentLayer: null,
        lastEventMessage: null,
        fallbackCount: 0,
        requiresApproval: false,
        approvalActionSummary: undefined,
        approvalRiskTier: undefined,
        aciSessionId: null,
        screenshot: null,
        pageAgentSessionId: null,
        pageAgentStatus: 'running',
        pageAgentActivity: { type: 'thinking' },
        pageAgentHistory: [],
      });

      fetch(getPageAgentRunEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: goal, config }),
      })
        .then((res) => res.json())
        .then(({ sessionId, error }: { sessionId?: string; error?: string }) => {
          if (error || !sessionId) {
            set({
              status: 'Idle',
              pageAgentStatus: 'error',
              pageAgentActivity: { type: 'error', message: error ?? 'Failed to start' },
            });
            return;
          }

          set({ pageAgentSessionId: sessionId });

          const es = new EventSource(getPageAgentStreamEndpoint(sessionId));

          es.onmessage = (e) => {
            try {
              const msg = JSON.parse(e.data) as {
                type: string;
                payload?: unknown;
                timestamp: number;
              };

              if (msg.type === 'status') {
                const { status } = msg.payload as { status: string };
                const nextStatus = mapRemotePageAgentStatus(status);
                set({
                  pageAgentStatus: nextStatus,
                  pageAgentActivity: nextStatus === 'running' ? get().pageAgentActivity : null,
                });
              } else if (msg.type === 'activity') {
                const activity = msg.payload as PageAgentActivity;
                set({ pageAgentActivity: activity });
              } else if (msg.type === 'history') {
                const payload = msg.payload as { events?: PageAgentHistoricalEvent[] };
                set({ pageAgentHistory: payload.events ?? [] });
              } else if (msg.type === 'done') {
                const { success, data } = msg.payload as { success: boolean; data?: string };
                set((s) => ({
                  status: 'Idle',
                  pageAgentStatus: success ? 'completed' : 'error',
                  pageAgentActivity: null,
                  pageAgentHistory: ensurePageAgentHistory(s.pageAgentHistory, { success, data }),
                  pageAgentSessions: appendPageAgentSession(s.pageAgentSessions, {
                    id: createPageAgentSessionId(),
                    sessionId,
                    task: goal,
                    status: success ? 'completed' : 'error',
                    history: ensurePageAgentHistory(s.pageAgentHistory, { success, data }),
                    createdAt: Date.now(),
                  }),
                }));
                es.close();
              } else if (msg.type === 'error') {
                const { message } = msg.payload as { message: string };
                set((s) => ({
                  status: 'Idle',
                  pageAgentStatus: 'error',
                  pageAgentActivity: null,
                  pageAgentHistory: ensurePageAgentHistory(s.pageAgentHistory, { message }),
                  pageAgentSessions: appendPageAgentSession(s.pageAgentSessions, {
                    id: createPageAgentSessionId(),
                    sessionId,
                    task: goal,
                    status: 'error',
                    history: ensurePageAgentHistory(s.pageAgentHistory, { message }),
                    createdAt: Date.now(),
                  }),
                }));
                es.close();
              }
            } catch {
              // ignore malformed events
            }
          };

          es.onerror = () => {
            es.close();
            if (get().pageAgentStatus === 'running') {
              set({
                status: 'Idle',
                pageAgentStatus: 'error',
                pageAgentActivity: { type: 'error', message: 'Connection to the extension bridge was interrupted.' },
              });
            }
          };
        })
        .catch(() => {
          set({
            status: 'Idle',
            pageAgentStatus: 'error',
            pageAgentActivity: { type: 'error', message: 'Could not reach desktop app.' },
          });
        });
    },

    // Stop page-agent task
    stopPageAgent: () => {
      const { pageAgentSessionId } = get();
      set({ status: 'Idle', pageAgentStatus: 'idle', pageAgentActivity: null, currentAction: null });
      if (pageAgentSessionId) {
        fetch(getPageAgentStopEndpoint(pageAgentSessionId), { method: 'POST' }).catch(() => {});
      }
    },

    deletePageAgentSession: (id) => {
      set((state) => ({
        pageAgentSessions: state.pageAgentSessions.filter((session) => session.id !== id),
      }));
    },

    clearPageAgentSessions: () => {
      set({ pageAgentSessions: [] });
    },

    // Stop execution
    stopExecution: () => {
      const { aciSessionId } = get();
      set({ status: 'Done', currentAction: null, requiresApproval: false });

      if (aciSessionId) {
        fetch(`/api/aci/stop/${aciSessionId}`, { method: 'POST' }).catch(() => {});
      }
    },
    
    // Pause / resume
    pauseExecution: () => {
      if (get().status === 'Running') set({ status: 'Blocked' });
    },
    resumeExecution: () => {
      if (get().status === 'Blocked') set({ status: 'Running' });
    },

    // Take over control
    takeOver: () => {
      set({ mode: 'Human', status: 'Blocked' });
    },
    
    // Hand off to agent
    handOff: () => {
      set({ mode: 'Agent', status: 'Running' });
    },
    
    // Approve action
    approveAction: () => {
      const { aciSessionId } = get();
      set({ requiresApproval: false });
      if (aciSessionId) {
        fetch(`/api/aci/approve/${aciSessionId}`, { method: 'POST' }).catch(() => {});
      }
    },

    // Deny action
    denyAction: () => {
      const { aciSessionId } = get();
      set({ requiresApproval: false, status: 'Blocked' });
      if (aciSessionId) {
        fetch(`/api/aci/approve/${aciSessionId}?deny=true`, { method: 'POST' }).catch(() => {});
      }
    },
    
    // Capture screenshot
    captureScreenshot: () => {
      console.log('Capturing screenshot...');
      // @placeholder APPROVED - Browser runtime integration pending
      // @ticket GAP-56
    },

    // Open drawer
    openDrawer: () => {
      console.log('Opening drawer...');
      // @placeholder APPROVED - Drawer event dispatch pending
      // @ticket GAP-56
      // Stub: dispatch drawer open event
    },
    
    // Set mode
    setMode: (mode) => set({ mode }),
    
    // Set endpoint
    setEndpoint: (endpoint) => set({ endpoint }),
    
    // Add endpoint
    addEndpoint: (endpoint) => {
      const endpoints = get().connectedEndpoints;
      set({ connectedEndpoints: [...endpoints, endpoint] });
    },
    
    // Remove endpoint
    removeEndpoint: (endpointId) => {
      const endpoints = get().connectedEndpoints.filter(e => {
        if (e.type === 'shell_browser') {
          return e.sessionId !== endpointId;
        }
        return e.endpointId !== endpointId;
      });
      set({ connectedEndpoints: endpoints });
    },
    
    // Add receipt
    addReceipt: (receiptId) => {
      const receipts = get().receipts;
      set({ receipts: [...receipts, receiptId] });
    },
    
    // Query receipts
    queryReceipts: async (params) => {
      const generator = getReceiptGenerator();
      return generator.queryReceipts(params);
    },
    
    // No-op — kept for interface compatibility; real execution runs via runGoal → SSE
    _simulateExecution: () => {},
  }))
);

// ============================================================================
// Selectors
// ============================================================================

export const selectStatus = (state: BrowserAgentState) => state.status;
export const selectMode = (state: BrowserAgentState) => state.mode;
export const selectCurrentAction = (state: BrowserAgentState) => state.currentAction;
export const selectRequiresApproval = (state: BrowserAgentState) => state.requiresApproval;
export const selectGoal = (state: BrowserAgentState) => state.goal;
export const selectReceipts = (state: BrowserAgentState) => state.receipts;

export default useBrowserAgentStore;
