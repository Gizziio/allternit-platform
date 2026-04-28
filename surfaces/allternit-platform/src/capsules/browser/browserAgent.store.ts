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
import { getPlatformComputerUseBaseUrl } from '@/integration/computer-use-engine';
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

// ── Computer-Use types ────────────────────────────────────────

export type CursorEffect = 'ripple' | 'glow' | 'spark' | 'none';

export interface RefEntry {
  ref_id: string;
  role: string;
  name: string;
  value: string;
  bounds: { x: number; y: number; width: number; height: number };
  surface: string;
  app_name: string;
}

export interface WindowEntry {
  window_id: number;
  title: string;
  app_name: string;
  bundle_id: string;
  frame: { x: number; y: number; width: number; height: number };
  is_focused: boolean;
  is_minimized: boolean;
}

export interface AppEntry {
  pid: number;
  name: string;
  bundle_id: string;
  is_active: boolean;
}

export interface NotificationEntry {
  notification_id: string;
  title: string;
  body: string;
  app_name: string;
  timestamp: string;
  actions: string[];
}

export interface CoordinateContract {
  scale_factor: number;
  offset_x: number;
  offset_y: number;
  raw_width: number;
  raw_height: number;
  model_width: number;
  model_height: number;
}

export interface AXTreeNode {
  ref_id?: string;
  role: string;
  name?: string;
  value?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  is_interactive?: boolean;
  children?: AXTreeNode[];
}

export interface VerificationEvidence {
  verified_success: boolean;
  confidence: number;
  changed: boolean;
  notes: string[];
}

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

  // Run summary / completion
  runSummary: string | null;

  // Engine health / connection
  engineBaseUrl: string;
  engineHealthy: boolean;
  engineStatusMessage: string | null;
  engineRuntimeSource: 'sidecar' | 'remote' | 'local' | null;
  engineRuntimeStatus: 'connecting' | 'connected' | 'disconnected' | 'error' | null;
  setEngineBaseUrl: (url: string) => void;
  refreshEngineHealth: () => Promise<void>;

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
  pageAgentTargetTabId: string | null;
  setPageAgentTargetTabId: (id: string | null) => void;

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
  runAcuTask: (task: string, options?: { targetScope?: string; maxSteps?: number }) => void;
  stopAcuTask: () => void;
  approveAcuAction: () => void;
  denyAcuAction: () => void;
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

  // Cursor
  cursorPosition: { x: number; y: number; agentId: string; effect: CursorEffect } | null;
  setCursorPosition: (pos: { x: number; y: number; agentId: string; effect: CursorEffect } | null) => void;

  // Accessibility
  elementRefs: Record<string, RefEntry> | null;
  axTree: AXTreeNode | null;
  axSurface: string | null;
  setElementRefs: (refs: Record<string, RefEntry>) => void;
  setAxTree: (tree: AXTreeNode | null, surface: string) => void;

  // Coordinate system
  coordinateContract: CoordinateContract | null;
  setCoordinateContract: (contract: CoordinateContract | null) => void;

  // Verification
  lastVerification: VerificationEvidence | null;
  setLastVerification: (evidence: VerificationEvidence | null) => void;

  // Step targeting
  targetedElement: RefEntry | null;
  setTargetedElement: (el: RefEntry | null) => void;

  // Desktop discovery
  windows: WindowEntry[];
  apps: AppEntry[];
  notifications: NotificationEntry[];
  windowsLoading: boolean;
  notificationsLoading: boolean;
  fetchWindows: () => Promise<void>;
  fetchApps: () => Promise<void>;
  launchApp: (name: string, bundleId?: string) => Promise<void>;
  closeApp: (name: string) => Promise<void>;
  focusWindow: (windowId?: number, title?: string, appName?: string) => Promise<void>;
  resizeWindow: (windowId: number, frame: Partial<{ x: number; y: number; width: number; height: number }>) => Promise<void>;
  dragWindow: (windowId: number, deltaX: number, deltaY: number) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  performNotificationAction: (notificationId: string, action: string) => Promise<void>;

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
    runSummary: null,
    engineBaseUrl: '',
    engineHealthy: false,
    engineStatusMessage: null,
    engineRuntimeSource: null,
    engineRuntimeStatus: null,
    setEngineBaseUrl: (url) => set({ engineBaseUrl: url }),
    refreshEngineHealth: async () => {
      const { engineBaseUrl } = get();
      if (!engineBaseUrl) {
        set({ engineHealthy: false, engineStatusMessage: 'No engine URL configured' });
        return;
      }
      try {
        const res = await fetch(`${engineBaseUrl}/health`);
        set({ engineHealthy: res.ok, engineStatusMessage: res.ok ? null : `HTTP ${res.status}`, engineRuntimeStatus: res.ok ? 'connected' : 'error' });
      } catch (err) {
        set({ engineHealthy: false, engineStatusMessage: String(err), engineRuntimeStatus: 'error' });
      }
    },
    aciSessionId: null,
    screenshot: null,
    pageAgentSessionId: null,
    pageAgentStatus: 'idle',
    pageAgentActivity: null,
    pageAgentHistory: [],
    pageAgentSessions: [],
    pageAgentTargetTabId: null,
    aciModel: 'anthropic/claude-sonnet-4.6',
    setAciModel: (model) => set({ aciModel: model }),
    isBrowserCapsuleMounted: false,
    setIsBrowserCapsuleMounted: (mounted) => set({ isBrowserCapsuleMounted: mounted }),
    aciSidecarExpanded: true,
    setAciSidecarExpanded: (expanded) => set({ aciSidecarExpanded: expanded }),
    toggleAciSidecar: () => set((s) => ({ aciSidecarExpanded: !s.aciSidecarExpanded })),

    // New field initial state
    cursorPosition: null,
    elementRefs: null,
    axTree: null,
    axSurface: null,
    coordinateContract: null,
    lastVerification: null,
    targetedElement: null,
    windows: [],
    apps: [],
    notifications: [],
    windowsLoading: false,
    notificationsLoading: false,

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
                      totalSteps: s.totalSteps ?? 0,
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
              pageAgentTargetTabId: null,
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
                  pageAgentTargetTabId: null,
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

    // ── ACU planning-loop path ────────────────────────────────────────────
    // Routes directly to /v1/computer-use/execute on the ACU gateway.
    // Events streamed via SSE feed screenshot + action state into the sidecar.
    runAcuTask: (task, options = {}) => {
      const runId = `cu-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const sessionId = `sess-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
      set({
        goal: task,
        status: 'Running',
        currentRunId: runId,
        currentAction: null,
        screenshot: null,
        lastEventMessage: null,
        requiresApproval: false,
        aciSessionId: sessionId,
      });

      const baseUrl = getPlatformComputerUseBaseUrl();
      const body = JSON.stringify({
        task,
        run_id: runId,
        session_id: sessionId,
        target_scope: options.targetScope ?? 'browser',
        mode: 'intent',
        options: { max_steps: options.maxSteps ?? 20 },
      });

      // Use streaming path so we get live events without polling
      fetch(`${baseUrl}/v1/computer-use/execute?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
        .then(async (res) => {
          if (!res.body) throw new Error('No SSE body');
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const ev = JSON.parse(line.slice(6)) as {
                  event_type: string;
                  run_id: string;
                  message: string;
                  data: Record<string, unknown>;
                };
                const d = ev.data ?? {};

                if (ev.event_type === 'screenshot.captured') {
                  const b64 = (d.screenshot_b64 as string) || null;
                  if (b64) set({ screenshot: b64 });
                } else if (ev.event_type === 'plan.created') {
                  const actionType = (d.action_type as string) ?? '';
                  if (actionType && actionType !== 'screenshot') {
                    set({
                      currentAction: {
                        action: { type: actionType } as BrowserAction,
                        stepIndex: (d.step as number) ?? 0,
                        totalSteps: 0,
                        type: actionType,
                        label: (d.reasoning as string)?.slice(0, 80) ?? actionType,
                      },
                      lastEventMessage: (d.reasoning as string)?.slice(0, 120) ?? null,
                    });
                  }
                } else if (ev.event_type === 'approval.required') {
                  set({
                    requiresApproval: true,
                    approvalActionSummary: (d.reason as string) ?? 'Action requires approval',
                    approvalRiskTier: 3 as RiskTier,
                  });
                } else if (ev.event_type === 'run.ended' || ev.event_type === 'run.completed') {
                  const runData = ev.data as { status?: string; result?: { summary?: string } };
                  const failed = runData?.status === 'failed';
                  set({
                    status: failed ? 'Done' : 'Done',
                    currentAction: null,
                    requiresApproval: false,
                    lastEventMessage: runData?.result?.summary ?? (failed ? 'Run failed' : 'Done'),
                  });
                } else if (ev.event_type === 'run.failed') {
                  set({ status: 'Done', currentAction: null, requiresApproval: false,
                        lastEventMessage: ev.message ?? 'Run failed' });
                } else if (ev.event_type === 'ax_tree.captured') {
                  set({ axTree: (d.tree as AXTreeNode) ?? null, axSurface: (d.surface as string) ?? null });
                  if (d.ref_map) set({ elementRefs: d.ref_map as Record<string, RefEntry> });
                } else if (ev.event_type === 'coordinate.contract') {
                  set({ coordinateContract: {
                    scale_factor: (d.scale_factor as number) ?? 1,
                    offset_x: (d.offset_x as number) ?? 0,
                    offset_y: (d.offset_y as number) ?? 0,
                    raw_width: (d.raw_width as number) ?? 1280,
                    raw_height: (d.raw_height as number) ?? 800,
                    model_width: (d.model_width as number) ?? 1280,
                    model_height: (d.model_height as number) ?? 800,
                  }});
                } else if (ev.event_type === 'cursor.moved') {
                  set({ cursorPosition: {
                    x: (d.x as number) ?? 0,
                    y: (d.y as number) ?? 0,
                    agentId: (d.agent_id as string) ?? 'primary',
                    effect: ((d.effect as CursorEffect) ?? 'none'),
                  }});
                } else if (ev.event_type === 'action.verified') {
                  set({ lastVerification: {
                    verified_success: (d.verified_success as boolean) ?? false,
                    confidence: (d.confidence as number) ?? 0,
                    changed: (d.changed as boolean) ?? false,
                    notes: (d.notes as string[]) ?? [],
                  }});
                } else if (ev.event_type === 'element.targeted') {
                  if (d.ref_id && d.bounds) {
                    set({ targetedElement: {
                      ref_id: d.ref_id as string,
                      role: (d.role as string) ?? '',
                      name: (d.label as string) ?? '',
                      value: '',
                      bounds: d.bounds as { x: number; y: number; width: number; height: number },
                      surface: 'window',
                      app_name: '',
                    }});
                  }
                } else if (ev.message) {
                  set({ lastEventMessage: ev.message });
                }
              } catch {
                // ignore malformed SSE lines
              }
            }
          }

          if (get().status === 'Running') set({ status: 'Done', currentAction: null });
        })
        .catch(() => {
          set({ status: 'Done', currentAction: null, lastEventMessage: 'Connection to ACU failed' });
        });
    },

    stopAcuTask: () => {
      const { currentRunId } = get();
      set({ status: 'Done', currentAction: null, requiresApproval: false });
      if (currentRunId) {
        const baseUrl = getPlatformComputerUseBaseUrl();
        fetch(`${baseUrl}/v1/computer-use/runs/${currentRunId}/cancel`, { method: 'POST' }).catch(() => {});
      }
    },

    approveAcuAction: () => {
      const { currentRunId } = get();
      set({ requiresApproval: false });
      if (currentRunId) {
        const baseUrl = getPlatformComputerUseBaseUrl();
        fetch(`${baseUrl}/v1/computer-use/runs/${currentRunId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'approve' }),
        }).catch(() => {});
      }
    },

    denyAcuAction: () => {
      const { currentRunId } = get();
      set({ requiresApproval: false, status: 'Blocked' });
      if (currentRunId) {
        const baseUrl = getPlatformComputerUseBaseUrl();
        fetch(`${baseUrl}/v1/computer-use/runs/${currentRunId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision: 'deny' }),
        }).catch(() => {});
      }
    },

    // Stop page-agent task
    stopPageAgent: () => {
      const { pageAgentSessionId } = get();
      set({ status: 'Idle', pageAgentStatus: 'idle', pageAgentActivity: null, currentAction: null, pageAgentTargetTabId: null });
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
    setPageAgentTargetTabId: (id) => set({ pageAgentTargetTabId: id }),

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
        return (e as any).endpointId !== endpointId;
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
    
    // Cursor
    setCursorPosition: (pos) => set({ cursorPosition: pos }),

    // Accessibility
    setElementRefs: (refs) => set({ elementRefs: refs }),
    setAxTree: (tree, surface) => set({ axTree: tree, axSurface: surface }),
    setCoordinateContract: (contract) => set({ coordinateContract: contract }),
    setLastVerification: (evidence) => set({ lastVerification: evidence }),
    setTargetedElement: (el) => set({ targetedElement: el }),

    // Window/App management
    fetchWindows: async () => {
      set({ windowsLoading: true });
      try {
        const res = await fetch(`${getPlatformComputerUseBaseUrl()}/v1/windows`);
        if (res.ok) { const data = await res.json(); set({ windows: data.windows ?? [] }); }
      } catch { /* silently ignore */ } finally { set({ windowsLoading: false }); }
    },
    fetchApps: async () => {
      try {
        const res = await fetch(`${getPlatformComputerUseBaseUrl()}/v1/apps`);
        if (res.ok) { const data = await res.json(); set({ apps: data.apps ?? [] }); }
      } catch { }
    },
    launchApp: async (name, bundleId) => {
      await fetch(`${getPlatformComputerUseBaseUrl()}/v1/apps/launch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, bundle_id: bundleId }),
      }).catch(() => {});
    },
    closeApp: async (name) => {
      await fetch(`${getPlatformComputerUseBaseUrl()}/v1/apps/close`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).catch(() => {});
    },
    focusWindow: async (windowId, title, appName) => {
      await fetch(`${getPlatformComputerUseBaseUrl()}/v1/windows/focus`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ window_id: windowId, title, app_name: appName }),
      }).catch(() => {});
    },
    resizeWindow: async (windowId, frame) => {
      await fetch(`${getPlatformComputerUseBaseUrl()}/v1/windows/resize`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ window_id: windowId, ...frame }),
      }).catch(() => {});
    },
    dragWindow: async (windowId, deltaX, deltaY) => {
      await fetch(`${getPlatformComputerUseBaseUrl()}/v1/windows/drag`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ window_id: windowId, delta_x: deltaX, delta_y: deltaY }),
      }).catch(() => {});
    },
    fetchNotifications: async () => {
      set({ notificationsLoading: true });
      try {
        const res = await fetch(`${getPlatformComputerUseBaseUrl()}/v1/notifications`);
        if (res.ok) { const data = await res.json(); set({ notifications: data.notifications ?? [] }); }
      } catch { } finally { set({ notificationsLoading: false }); }
    },
    dismissNotification: async (id) => {
      await fetch(`${getPlatformComputerUseBaseUrl()}/v1/notifications/${id}/dismiss`, { method: 'POST' }).catch(() => {});
      set(s => ({ notifications: s.notifications.filter((n: NotificationEntry) => n.notification_id !== id) }));
    },
    performNotificationAction: async (id, action) => {
      await fetch(`${getPlatformComputerUseBaseUrl()}/v1/notifications/${id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).catch(() => {});
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
