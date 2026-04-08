/**
 * Agent Store - Production Implementation
 * 
 * Zustand store for agent state management with:
 * - Agent CRUD operations
 * - Real-time status updates
 * - Task and run tracking
 * - Optimistic updates
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Agent,
  CreateAgentInput,
  AgentTask,
  AgentRun,
  AgentTraceEntry,
  Checkpoint,
  Commit,
  AgentEvent,
  QueueItem,
  ExecutionPlan,
  AgentMailMessage,
  AgentMailThread,
  GateReview,
  GateDecision,
} from './agent.types';
import * as agentService from './agent.service';
import type {
  CharacterArtifactFile,
  CharacterCompiledConfig,
  CharacterLayerConfig,
  CharacterStats,
  CharacterTelemetryEvent,
} from './character.types';
import * as characterService from './character.service';

// ============================================================================
// Store State
// ============================================================================

interface AgentState {
  // Data
  agents: Agent[];
  activeAgentId: string | null;
  activeRunId: string | null;
  
  // Related data
  tasks: Record<string, AgentTask[]>; // keyed by agentId
  runs: Record<string, AgentRun[]>; // keyed by agentId
  checkpoints: Record<string, Checkpoint[]>; // keyed by agentId
  commits: Record<string, Commit[]>; // keyed by agentId
  queue: QueueItem[];
  plans: Record<string, ExecutionPlan>; // keyed by planId
  
  // UI State
  selectedAgentId: string | null;
  isCreating: boolean;
  isEditing: string | null;
  viewMode: 'list' | 'detail' | 'create' | 'edit';
  
  // Mail data
  mail: Record<string, AgentMailMessage[]>; // keyed by agentId
  mailThreads: Record<string, AgentMailThread[]>; // keyed by agentId
  unreadMailCount: Record<string, number>; // keyed by agentId
  selectedThreadId: string | null;
  
  // Loading states
  isLoadingAgents: boolean;
  isLoadingRuns: boolean;
  isLoadingTasks: boolean;
  isLoadingMail: boolean;
  isExecuting: boolean;
  
  // Error state
  error: string | null;
  
  // Event stream
  eventStreamConnected: boolean;
  
  // Runner integration - streaming output
  activeRunOutput: string;
  activeRunTrace: AgentTraceEntry[]; // This is the UI trace, not stored on AgentRun
  executionDraft: string;
  
  // Gate/Review data
  reviews: Record<string, GateReview[]>; // keyed by agentId
  pendingReviewCount: Record<string, number>; // keyed by agentId
  selectedReviewId: string | null;
  isLoadingReviews: boolean;

  // Character Layer (role card + bans + voice + relationships + progression + avatar)
  character: Record<string, CharacterLayerConfig>; // keyed by agentId
  compiledCharacter: Record<string, CharacterCompiledConfig>; // keyed by agentId
  characterArtifacts: Record<string, CharacterArtifactFile[]>; // keyed by agentId
  characterStats: Record<string, CharacterStats>; // keyed by agentId
  characterTelemetry: Record<string, CharacterTelemetryEvent[]>; // keyed by agentId
  isCompilingCharacter: boolean;
}

// ============================================================================
// Store Actions
// ============================================================================

interface AgentActions {
  // Agent CRUD
  fetchAgents: () => Promise<void>;
  selectAgent: (agentId: string | null) => Promise<void>;
  createAgent: (input: CreateAgentInput) => Promise<Agent>;
  updateAgent: (agentId: string, updates: Partial<CreateAgentInput>) => Promise<void>;
  deleteAgent: (agentId: string) => Promise<void>;
  
  // Agent execution
  startRun: (agentId: string, input: string, plan?: ExecutionPlan) => Promise<AgentRun>;
  cancelRun: (agentId: string, runId: string) => Promise<void>;
  pauseRun: (agentId: string, runId: string) => Promise<void>;
  resumeRun: (agentId: string, runId: string) => Promise<void>;
  fetchRuns: (agentId: string) => Promise<void>;
  selectRun: (runId: string | null) => void;
  
  // Tasks
  fetchTasks: (agentId: string, runId?: string) => Promise<void>;
  updateTask: (agentId: string, taskId: string, updates: Partial<AgentTask>) => Promise<void>;
  
  // Checkpoints
  fetchCheckpoints: (agentId: string, runId?: string) => Promise<void>;
  createCheckpoint: (
    agentId: string,
    runId: string,
    label: string,
    data: Record<string, unknown>
  ) => Promise<void>;
  restoreCheckpoint: (agentId: string, checkpointId: string) => Promise<void>;
  
  // Commits
  fetchCommits: (agentId: string) => Promise<void>;
  createCommit: (agentId: string, message: string, changes: Commit['changes']) => Promise<void>;
  
  // Queue
  fetchQueue: (agentId?: string) => Promise<void>;
  enqueue: (content: string, priority: number, agentId?: string) => Promise<void>;
  dequeue: (itemId: string) => Promise<void>;
  
  // Plans
  createPlan: (agentId: string, steps: ExecutionPlan['steps']) => Promise<void>;
  
  // Mail
  fetchMail: (agentId: string) => Promise<void>;
  fetchMailThreads: (agentId: string) => Promise<void>;
  sendMail: (fromAgentId: string, toAgentId: string, subject: string, body: string) => Promise<void>;
  acknowledgeMail: (agentId: string, messageId: string) => Promise<void>;
  selectThread: (threadId: string | null) => void;
  
  // Event handling
  connectEventStream: (agentId: string) => () => void;
  handleAgentEvent: (event: AgentEvent) => void;
  
  // UI actions
  setViewMode: (mode: AgentState['viewMode']) => void;
  setIsCreating: (isCreating: boolean) => void;
  setIsEditing: (agentId: string | null) => void;
  clearError: () => void;
  
  // Runner integration - trace and streaming
  appendTraceEntry: (entry: Omit<AgentTraceEntry, 'id' | 'timestamp'>) => void;
  clearTrace: () => void;
  appendRunOutput: (text: string) => void;
  setExecutionDraft: (draft: string) => void;
  submitFollowUp: () => Promise<void>;
  
  // Gate/Review actions
  fetchReviews: (agentId: string) => Promise<void>;
  submitReviewDecision: (reviewId: string, approved: boolean, note?: string) => Promise<void>;
  selectReview: (reviewId: string | null) => void;

  // Character Layer actions
  loadCharacterLayer: (agentId: string) => Promise<void>;
  saveCharacterLayer: (agentId: string, config: CharacterLayerConfig) => Promise<void>;
  compileCharacterLayer: (agentId: string) => Promise<void>;
  recordCharacterTelemetry: (
    agentId: string,
    event: Omit<CharacterTelemetryEvent, 'id' | 'timestamp'>
  ) => void;
  applyRelationshipDrift: (
    agentId: string,
    interactions: Array<{ agentA: string; agentB: string; interactionType: string }>
  ) => void;
}

// ============================================================================
// Store Implementation
// ============================================================================

const AGENT_FETCH_TIMEOUT_MS = 4500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      globalThis.setTimeout(() => {
        reject(new Error(`${label}_TIMEOUT`));
      }, timeoutMs);
    }),
  ]);
}

export const useAgentStore = create<AgentState & AgentActions>()(
  devtools(
    (set, get) => ({
      // Initial state
      agents: [],
      activeAgentId: null,
      activeRunId: null,
      tasks: {},
      runs: {},
      checkpoints: {},
      commits: {},
      mail: {},
      mailThreads: {},
      unreadMailCount: {},
      activeRunOutput: '',
      activeRunTrace: [],
      executionDraft: '',
      reviews: {},
      pendingReviewCount: {},
      selectedReviewId: null,
      isLoadingReviews: false,
      character: {},
      compiledCharacter: {},
      characterArtifacts: {},
      characterStats: {},
      characterTelemetry: {},
      isCompilingCharacter: false,
      selectedThreadId: null,
      isLoadingMail: false,
      queue: [],
      plans: {},
      selectedAgentId: null,
      isCreating: false,
      isEditing: null,
      viewMode: 'list',
      isLoadingAgents: false,
      isLoadingRuns: false,
      isLoadingTasks: false,
      isExecuting: false,
      error: null,
      eventStreamConnected: false,

      // ----------------------------------------------------------------------
      // Agent CRUD
      // ----------------------------------------------------------------------
      
      fetchAgents: async () => {
        set({ isLoadingAgents: true, error: null });
        try {
          const agents = await withTimeout(
            agentService.listAgents(),
            AGENT_FETCH_TIMEOUT_MS,
            'AGENT_FETCH',
          );
          set({ agents, isLoadingAgents: false });
        } catch (err) {
          // Don't block UI on network errors - just show empty state with warning
          const errorMsg = err instanceof Error ? err.message : 'Failed to fetch agents';
          set({ 
            agents: [],
            error:
              errorMsg.includes('Network') ||
              errorMsg.includes('fetch') ||
              errorMsg.includes('AGENT_FETCH_TIMEOUT')
              ? 'API_OFFLINE' // Special error code for offline state
              : errorMsg,
            isLoadingAgents: false 
          });
        }
      },

      selectAgent: async (agentId) => {
        set({ 
          selectedAgentId: agentId,
          activeAgentId: agentId,
          viewMode: agentId ? 'detail' : 'list'
        });
        
        if (agentId) {
          // Fetch related data
          await Promise.all([
            get().fetchRuns(agentId),
            get().fetchTasks(agentId),
            get().fetchCheckpoints(agentId),
            get().fetchCommits(agentId),
            get().loadCharacterLayer(agentId),
          ]);
        }
      },

      createAgent: async (input) => {
        set({ isCreating: true, error: null });
        try {
          const agent = await agentService.createAgent(input);
          set(state => ({ 
            agents: [agent, ...state.agents],
            isCreating: false,
            viewMode: 'list'
          }));
          await get().loadCharacterLayer(agent.id);
          await get().compileCharacterLayer(agent.id);
          return agent;
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to create agent',
            isCreating: false 
          });
          throw err;
        }
      },

      updateAgent: async (agentId, updates) => {
        set({ error: null });
        try {
          const updated = await agentService.updateAgent(agentId, updates);
          set(state => ({
            agents: state.agents.map(a => a.id === agentId ? updated : a),
            isEditing: null,
            viewMode: 'detail'
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to update agent' 
          });
          throw err;
        }
      },

      deleteAgent: async (agentId) => {
        set({ error: null });
        try {
          await agentService.deleteAgent(agentId);
          set(state => ({
            agents: state.agents.filter(a => a.id !== agentId),
            selectedAgentId: state.selectedAgentId === agentId ? null : state.selectedAgentId,
            viewMode: state.selectedAgentId === agentId ? 'list' : state.viewMode,
            character: Object.fromEntries(
              Object.entries(state.character).filter(([id]) => id !== agentId)
            ),
            compiledCharacter: Object.fromEntries(
              Object.entries(state.compiledCharacter).filter(([id]) => id !== agentId)
            ),
            characterArtifacts: Object.fromEntries(
              Object.entries(state.characterArtifacts).filter(([id]) => id !== agentId)
            ),
            characterStats: Object.fromEntries(
              Object.entries(state.characterStats).filter(([id]) => id !== agentId)
            ),
            characterTelemetry: Object.fromEntries(
              Object.entries(state.characterTelemetry).filter(([id]) => id !== agentId)
            ),
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to delete agent' 
          });
          throw err;
        }
      },

      // ----------------------------------------------------------------------
      // Agent Execution
      // ----------------------------------------------------------------------
      
      startRun: async (agentId, input, plan) => {
        set({ 
          isExecuting: true, 
          error: null,
          activeRunOutput: '',
          activeRunTrace: [{
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            kind: 'info',
            title: 'Run started',
            detail: input,
            status: 'running',
          }]
        });
        // Note: runnerTrace is not stored on AgentRun to avoid type conflict with AdvancedAgentRun
        try {
          const state = get();
          let characterConfig = state.character[agentId];
          if (!characterConfig) {
            await get().loadCharacterLayer(agentId);
            characterConfig = get().character[agentId];
          }
          if (characterConfig) {
            const banViolation = characterService.detectBanViolation(input, characterConfig.roleCard.hardBans);
            if (banViolation) {
              get().appendTraceEntry({
                kind: 'error',
                title: `Hard ban triggered: ${banViolation.label}`,
                detail: banViolation.reason,
                status: 'error',
              });
              get().recordCharacterTelemetry(agentId, {
                type: 'ban_triggered',
                payload: {
                  ban_id: banViolation.banId,
                  category: banViolation.category,
                  reason: banViolation.reason,
                },
              });
              get().recordCharacterTelemetry(agentId, {
                type: 'escalation_requested',
                payload: {
                  reason: `Hard ban triggered: ${banViolation.label}`,
                  severity: banViolation.severity,
                },
              });
              set({
                error: `Execution blocked by hard ban: ${banViolation.label}`,
                isExecuting: false,
              });
              throw new Error(`Execution blocked by hard ban: ${banViolation.label}`);
            }
          }

          if (!get().compiledCharacter[agentId]) {
            await get().compileCharacterLayer(agentId);
          }
          const compiled = get().compiledCharacter[agentId];
          const characterStats = get().characterStats[agentId];

          get().recordCharacterTelemetry(agentId, {
            type: 'mission_created',
            payload: { input },
          });

          const run = await agentService.startAgentRun(agentId, input, {
            plan,
            metadata: {
              character_layer: compiled,
              character_stats: characterStats,
            },
          });
          set(state => ({
            runs: {
              ...state.runs,
              [agentId]: [run, ...(state.runs[agentId] || [])]
            },
            activeRunId: run.id,
            isExecuting: false
          }));
          return run;
        } catch (err) {
          get().recordCharacterTelemetry(agentId, {
            type: 'mission_failed',
            payload: {
              reason: 'start_error',
              error: err instanceof Error ? err.message : 'unknown',
            },
          });
          set({ 
            error: err instanceof Error ? err.message : 'Failed to start run',
            isExecuting: false 
          });
          throw err;
        }
      },

      cancelRun: async (agentId, runId) => {
        try {
          await agentService.cancelAgentRun(agentId, runId);
          get().recordCharacterTelemetry(agentId, {
            type: 'mission_failed',
            runId,
            payload: { reason: 'cancelled_by_user' },
          });
          set(state => ({
            runs: {
              ...state.runs,
              [agentId]: (state.runs[agentId] || []).map(r =>
                r.id === runId 
                  ? { ...r, status: 'cancelled' as const, completedAt: new Date().toISOString() }
                  : r
              )
            }
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to cancel run' 
          });
        }
      },

      pauseRun: async (agentId, runId) => {
        try {
          await agentService.pauseAgentRun(agentId, runId);
          // Refresh runs to get updated status
          await get().fetchRuns(agentId);
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to pause run' 
          });
        }
      },

      resumeRun: async (agentId, runId) => {
        try {
          await agentService.resumeAgentRun(agentId, runId);
          // Refresh runs to get updated status
          await get().fetchRuns(agentId);
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to resume run' 
          });
        }
      },

      fetchRuns: async (agentId) => {
        set({ isLoadingRuns: true });
        try {
          const runs = await agentService.listAgentRuns(agentId);
          set(state => ({
            runs: { ...state.runs, [agentId]: runs },
            isLoadingRuns: false
          }));
        } catch (err) {
          set({ isLoadingRuns: false });
        }
      },

      selectRun: (runId) => {
        set({ activeRunId: runId });
      },

      // ----------------------------------------------------------------------
      // Tasks
      // ----------------------------------------------------------------------
      
      fetchTasks: async (agentId, runId) => {
        set({ isLoadingTasks: true });
        try {
          const tasks = await agentService.listAgentTasks(agentId, runId);
          set(state => ({
            tasks: { ...state.tasks, [agentId]: tasks },
            isLoadingTasks: false
          }));
        } catch (err) {
          set({ isLoadingTasks: false });
        }
      },

      updateTask: async (agentId, taskId, updates) => {
        try {
          const updated = await agentService.updateTaskStatus(
            agentId,
            taskId,
            updates.status || 'pending',
            updates.result,
            updates.error
          );
          set(state => ({
            tasks: {
              ...state.tasks,
              [agentId]: (state.tasks[agentId] || []).map(t =>
                t.id === taskId ? { ...t, ...updated } : t
              )
            }
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to update task' 
          });
        }
      },

      // ----------------------------------------------------------------------
      // Checkpoints
      // ----------------------------------------------------------------------
      
      fetchCheckpoints: async (agentId, runId) => {
        try {
          const checkpoints = await agentService.listCheckpoints(agentId, runId);
          set(state => ({
            checkpoints: { ...state.checkpoints, [agentId]: checkpoints }
          }));
        } catch (err) {
          console.error('Failed to fetch checkpoints:', err);
        }
      },

      createCheckpoint: async (agentId, runId, label, data) => {
        try {
          const checkpoint = await agentService.createCheckpoint(agentId, runId, label, data);
          set(state => ({
            checkpoints: {
              ...state.checkpoints,
              [agentId]: [...(state.checkpoints[agentId] || []), checkpoint]
            }
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to create checkpoint' 
          });
        }
      },

      restoreCheckpoint: async (agentId, checkpointId) => {
        try {
          const run = await agentService.restoreCheckpoint(agentId, checkpointId);
          set(state => ({
            runs: {
              ...state.runs,
              [agentId]: [run, ...(state.runs[agentId] || [])]
            },
            activeRunId: run.id
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to restore checkpoint' 
          });
        }
      },

      // ----------------------------------------------------------------------
      // Commits
      // ----------------------------------------------------------------------
      
      fetchCommits: async (agentId) => {
        try {
          const commits = await agentService.listCommits(agentId);
          set(state => ({
            commits: { ...state.commits, [agentId]: commits }
          }));
        } catch (err) {
          console.error('Failed to fetch commits:', err);
        }
      },

      createCommit: async (agentId, message, changes) => {
        try {
          const commit = await agentService.createCommit(agentId, message, changes);
          set(state => ({
            commits: {
              ...state.commits,
              [agentId]: [commit, ...(state.commits[agentId] || [])]
            }
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to create commit' 
          });
        }
      },

      // ----------------------------------------------------------------------
      // Queue
      // ----------------------------------------------------------------------
      
      fetchQueue: async (agentId) => {
        try {
          const items = await agentService.listQueueItems(agentId);
          set({ queue: items });
        } catch (err) {
          console.error('Failed to fetch queue:', err);
        }
      },

      enqueue: async (content, priority, agentId) => {
        try {
          const item = await agentService.enqueueTask(content, priority, agentId);
          set(state => ({ queue: [...state.queue, item] }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to enqueue task' 
          });
        }
      },

      dequeue: async (itemId) => {
        try {
          await agentService.dequeueTask(itemId);
          set(state => ({ queue: state.queue.filter(i => i.id !== itemId) }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to dequeue task' 
          });
        }
      },

      // ----------------------------------------------------------------------
      // Plans
      // ----------------------------------------------------------------------
      
      createPlan: async (agentId, steps) => {
        try {
          const plan = await agentService.createExecutionPlan(agentId, steps);
          set(state => ({
            plans: { ...state.plans, [plan.id]: plan }
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to create plan' 
          });
        }
      },

      // ----------------------------------------------------------------------
      // Event Handling
      // ----------------------------------------------------------------------
      
      connectEventStream: (agentId) => {
        const cleanup = agentService.connectAgentEventStream(agentId, {
          onConnected: () => {
            set({ eventStreamConnected: true });
          },
          onEvent: (event) => {
            get().handleAgentEvent(event);
          },
          onError: (error) => {
            console.error('[AgentStore] Event stream error:', error);
            set({ eventStreamConnected: false });
          },
        });

        return cleanup;
      },

      handleAgentEvent: (event) => {
        if (event.type === 'run.completed') {
          get().recordCharacterTelemetry(event.agentId, {
            type: 'mission_completed',
            runId: event.runId,
            payload: event.data as Record<string, unknown>,
          });
          const interactions = ((event.data as Record<string, unknown>)?.interactions || []) as Array<{
            agentA: string;
            agentB: string;
            interactionType: string;
          }>;
          if (interactions.length > 0) {
            get().applyRelationshipDrift(event.agentId, interactions);
            for (const interaction of interactions) {
              get().recordCharacterTelemetry(event.agentId, {
                type: 'interaction',
                runId: event.runId,
                payload: {
                  speaker: interaction.agentA,
                  target: interaction.agentB,
                  interaction_type: interaction.interactionType,
                },
              });
            }
          }
        }
        if (event.type === 'run.failed') {
          get().recordCharacterTelemetry(event.agentId, {
            type: 'mission_failed',
            runId: event.runId,
            payload: event.data as Record<string, unknown>,
          });
        }
        if (event.type === 'task.created' || event.type === 'task.updated') {
          get().recordCharacterTelemetry(event.agentId, {
            type: 'step_started',
            runId: event.runId,
            payload: {
              task_id: event.taskId,
              event_type: event.type,
            },
          });
        }
        if (event.type === 'task.completed') {
          get().recordCharacterTelemetry(event.agentId, {
            type: 'step_completed',
            runId: event.runId,
            payload: {
              task_id: event.taskId,
            },
          });
        }

        set(state => {
          switch (event.type) {
            case 'agent.status.changed':
              return {
                ...state,
                agents: state.agents.map(a =>
                  a.id === event.agentId
                    ? { ...a, status: (event.data as { status: Agent['status'] }).status }
                    : a
                )
              };

            case 'run.started':
            case 'run.completed':
            case 'run.failed':
              // Refresh runs when status changes
              get().fetchRuns(event.agentId);
              return state;

            case 'task.created':
            case 'task.updated':
            case 'task.completed': {
              const agentTasks = state.tasks[event.agentId] || [];
              const taskIndex = agentTasks.findIndex(t => t.id === event.taskId);
              const newTask = event.data as AgentTask;
              
              if (taskIndex !== -1) {
                return {
                  ...state,
                  tasks: {
                    ...state.tasks,
                    [event.agentId]: agentTasks.map((t, i) =>
                      i === taskIndex ? { ...t, ...newTask } : t
                    )
                  }
                };
              } else if (event.type === 'task.created') {
                return {
                  ...state,
                  tasks: {
                    ...state.tasks,
                    [event.agentId]: [...agentTasks, newTask]
                  }
                };
              }
              return state;
            }

            case 'checkpoint.created':
              return {
                ...state,
                checkpoints: {
                  ...state.checkpoints,
                  [event.agentId]: [
                    ...(state.checkpoints[event.agentId] || []),
                    event.data as Checkpoint
                  ]
                }
              };

            case 'commit.created':
              return {
                ...state,
                commits: {
                  ...state.commits,
                  [event.agentId]: [
                    event.data as Commit,
                    ...(state.commits[event.agentId] || [])
                  ]
                }
              };

            case 'mail.received': {
              const newMessage = event.data as AgentMailMessage;
              const existingMail = state.mail[event.agentId] || [];
              return {
                ...state,
                mail: {
                  ...state.mail,
                  [event.agentId]: [newMessage, ...existingMail]
                },
                unreadMailCount: {
                  ...state.unreadMailCount,
                  [event.agentId]: (state.unreadMailCount[event.agentId] || 0) + 1
                }
              };
            }

            case 'gate.review_requested': {
              const newReview = event.data as GateReview;
              const existingReviews = state.reviews[event.agentId] || [];
              return {
                ...state,
                reviews: {
                  ...state.reviews,
                  [event.agentId]: [newReview, ...existingReviews]
                },
                pendingReviewCount: {
                  ...state.pendingReviewCount,
                  [event.agentId]: (state.pendingReviewCount[event.agentId] || 0) + 1
                }
              };
            }

            default:
              return state;
          }
        });
      },

      // ----------------------------------------------------------------------
      // Mail
      // ----------------------------------------------------------------------
      
      fetchMail: async (agentId) => {
        set({ isLoadingMail: true });
        try {
          const messages = await agentService.getAgentInbox(agentId);
          const unreadCount = messages.filter(m => m.status === 'unread').length;
          set(state => ({
            mail: { ...state.mail, [agentId]: messages },
            unreadMailCount: { ...state.unreadMailCount, [agentId]: unreadCount },
            isLoadingMail: false
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to fetch mail',
            isLoadingMail: false
          });
        }
      },

      fetchMailThreads: async (agentId) => {
        try {
          const threads = await agentService.getAgentThreads(agentId);
          set(state => ({
            mailThreads: { ...state.mailThreads, [agentId]: threads }
          }));
        } catch (err) {
          console.error('[AgentStore] Failed to fetch threads:', err);
        }
      },

      sendMail: async (fromAgentId, toAgentId, subject, body) => {
        try {
          await agentService.sendAgentMail(fromAgentId, {
            toAgentId,
            subject,
            body,
            priority: 'normal',
          });
          // Refresh inbox after sending
          await get().fetchMail(fromAgentId);
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to send mail'
          });
        }
      },

      acknowledgeMail: async (agentId, messageId) => {
        try {
          await agentService.acknowledgeMail(agentId, messageId);
          set(state => {
            const messages = state.mail[agentId] || [];
            return {
              mail: {
                ...state.mail,
                [agentId]: messages.map(m =>
                  m.id === messageId ? { ...m, status: 'acknowledged' as const } : m
                )
              },
              unreadMailCount: {
                ...state.unreadMailCount,
                [agentId]: Math.max(0, (state.unreadMailCount[agentId] || 0) - 1)
              }
            };
          });
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to acknowledge mail'
          });
        }
      },

      selectThread: (threadId) => {
        set({ selectedThreadId: threadId });
      },

      // ----------------------------------------------------------------------
      // Character Layer
      // ----------------------------------------------------------------------

      loadCharacterLayer: async (agentId) => {
        const state = get();
        const agent = state.agents.find((a) => a.id === agentId);
        if (!agent) return;
        const blueprint = characterService.parseCharacterBlueprint(agent.config);
        const seed = characterService.parseCharacterSeed(agent.config);
        const config = characterService.loadCharacterLayer(agentId, agent.name, blueprint, seed);
        const telemetry = characterService.loadTelemetryEvents(agentId);
        const compiled =
          characterService.loadCompiledCharacterLayer(agentId) ||
          characterService.compileCharacterLayer(agentId, config, telemetry).compiled;
        const artifacts = characterService.loadCharacterArtifacts(agentId);
        const stats = characterService.computeCharacterStats(config, telemetry);
        set((prev) => ({
          character: { ...prev.character, [agentId]: config },
          compiledCharacter: { ...prev.compiledCharacter, [agentId]: compiled },
          characterArtifacts: { ...prev.characterArtifacts, [agentId]: artifacts },
          characterStats: { ...prev.characterStats, [agentId]: stats },
          characterTelemetry: { ...prev.characterTelemetry, [agentId]: telemetry },
        }));
      },

      saveCharacterLayer: async (agentId, config) => {
        characterService.saveCharacterLayer(agentId, config);
        const telemetry = get().characterTelemetry[agentId] || characterService.loadTelemetryEvents(agentId);
        const stats = characterService.computeCharacterStats(config, telemetry);
        set((prev) => ({
          character: { ...prev.character, [agentId]: config },
          characterStats: { ...prev.characterStats, [agentId]: stats },
        }));
      },

      compileCharacterLayer: async (agentId) => {
        const state = get();
        const config = state.character[agentId];
        if (!config) return;
        set({ isCompilingCharacter: true });
        try {
          const telemetry = state.characterTelemetry[agentId] || [];
          const { compiled, artifacts } = characterService.compileCharacterLayer(agentId, config, telemetry);
          const stats = characterService.computeCharacterStats(config, telemetry);
          set((prev) => ({
            compiledCharacter: { ...prev.compiledCharacter, [agentId]: compiled },
            characterArtifacts: { ...prev.characterArtifacts, [agentId]: artifacts },
            characterStats: { ...prev.characterStats, [agentId]: stats },
            isCompilingCharacter: false,
          }));
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Failed to compile character layer",
            isCompilingCharacter: false,
          });
        }
      },

      recordCharacterTelemetry: (agentId, event) => {
        const completeEvent: CharacterTelemetryEvent = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          ...event,
        };
        const nextEvents = characterService.appendTelemetryEvent(agentId, completeEvent);
        const config = get().character[agentId];
        set((prev) => {
          const nextState: Partial<AgentState> = {
            characterTelemetry: {
              ...prev.characterTelemetry,
              [agentId]: nextEvents,
            },
          };
          if (config) {
            nextState.characterStats = {
              ...prev.characterStats,
              [agentId]: characterService.computeCharacterStats(config, nextEvents),
            };
          }
          return nextState;
        });
      },

      applyRelationshipDrift: (agentId, interactions) => {
        const config = get().character[agentId];
        if (!config || interactions.length === 0) return;
        const relationships = characterService.applyRelationshipDrift(config.relationships, interactions);
        const nextConfig: CharacterLayerConfig = {
          ...config,
          relationships,
        };
        characterService.saveCharacterLayer(agentId, nextConfig);
        const telemetry = get().characterTelemetry[agentId] || [];
        set((prev) => ({
          character: { ...prev.character, [agentId]: nextConfig },
          characterStats: {
            ...prev.characterStats,
            [agentId]: characterService.computeCharacterStats(nextConfig, telemetry),
          },
        }));
      },

      // ----------------------------------------------------------------------
      // UI Actions
      // ----------------------------------------------------------------------
      
      setViewMode: (mode) => {
        set({ viewMode: mode });
      },

      setIsCreating: (isCreating) => {
        set({ 
          isCreating,
          viewMode: isCreating ? 'create' : 'list'
        });
      },

      setIsEditing: (agentId) => {
        set({ 
          isEditing: agentId,
          viewMode: agentId ? 'edit' : 'detail'
        });
      },

      clearError: () => {
        set({ error: null });
      },

      // ----------------------------------------------------------------------
      // Runner Integration - Trace and Streaming
      // ----------------------------------------------------------------------
      
      appendTraceEntry: (entry) => {
        const newEntry: AgentTraceEntry = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          kind: entry.kind,
          title: entry.title,
          detail: entry.detail,
          status: entry.status,
        };
        set(state => ({
          activeRunTrace: [...state.activeRunTrace, newEntry]
        }));
      },

      clearTrace: () => {
        set({ activeRunTrace: [] });
      },

      appendRunOutput: (text) => {
        set(state => ({
          activeRunOutput: state.activeRunOutput + text
        }));
      },

      setExecutionDraft: (draft) => {
        set({ executionDraft: draft });
      },

      submitFollowUp: async () => {
        const { executionDraft, activeAgentId } = get();
        if (!executionDraft.trim() || !activeAgentId) return;
        
        // Append to trace
        get().appendTraceEntry({
          kind: 'info',
          title: 'Follow-up submitted',
          detail: executionDraft,
          status: 'running',
        });
        
        // Start a new run with the follow-up
        await get().startRun(activeAgentId, executionDraft);
        
        // Clear draft
        set({ executionDraft: '' });
      },

      // ----------------------------------------------------------------------
      // Gate/Review Actions
      // ----------------------------------------------------------------------
      
      fetchReviews: async (agentId) => {
        set({ isLoadingReviews: true });
        try {
          const reviews = await agentService.getPendingReviews(agentId);
          const pendingCount = reviews.filter(r => r.status === 'pending').length;
          set(state => ({
            reviews: { ...state.reviews, [agentId]: reviews },
            pendingReviewCount: { ...state.pendingReviewCount, [agentId]: pendingCount },
            isLoadingReviews: false
          }));
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to fetch reviews',
            isLoadingReviews: false
          });
        }
      },

      submitReviewDecision: async (reviewId, approved, note) => {
        try {
          const decision = await agentService.submitGateDecision(reviewId, approved, note);
          // Update review status in store
          set(state => {
            const agentId = state.activeAgentId || '';
            const reviews = state.reviews[agentId] || [];
            return {
              reviews: {
                ...state.reviews,
                [agentId]: reviews.map(r =>
                  r.id === reviewId
                    ? { ...r, status: approved ? 'approved' : 'rejected', reviewNote: note, reviewedAt: decision.timestamp }
                    : r
                )
              },
              pendingReviewCount: {
                ...state.pendingReviewCount,
                [agentId]: Math.max(0, (state.pendingReviewCount[agentId] || 0) - 1)
              }
            };
          });
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to submit decision'
          });
        }
      },

      selectReview: (reviewId) => {
        set({ selectedReviewId: reviewId });
      },
    }),
    { name: 'agent-store' }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export function useSelectedAgent(): Agent | null {
  const { agents, selectedAgentId } = useAgentStore();
  return agents.find(a => a.id === selectedAgentId) || null;
}

export function useAgentRuns(agentId: string | null): AgentRun[] {
  const { runs } = useAgentStore();
  return agentId ? runs[agentId] || [] : [];
}

export function useAgentTasks(agentId: string | null): AgentTask[] {
  const { tasks } = useAgentStore();
  return agentId ? tasks[agentId] || [] : [];
}

export function useAgentMail(agentId: string | null): AgentMailMessage[] {
  const { mail } = useAgentStore();
  return agentId ? mail[agentId] || [] : [];
}

export function useAgentMailThreads(agentId: string | null): AgentMailThread[] {
  const { mailThreads } = useAgentStore();
  return agentId ? mailThreads[agentId] || [] : [];
}

export function useUnreadMailCount(agentId: string | null): number {
  const { unreadMailCount } = useAgentStore();
  return agentId ? unreadMailCount[agentId] || 0 : 0;
}

export function useAgentReviews(agentId: string | null): GateReview[] {
  const { reviews } = useAgentStore();
  return agentId ? reviews[agentId] || [] : [];
}

export function usePendingReviewCount(agentId: string | null): number {
  const { pendingReviewCount } = useAgentStore();
  return agentId ? pendingReviewCount[agentId] || 0 : 0;
}

export function useActiveRun(agentId: string | null, runId: string | null): AgentRun | null {
  const { runs } = useAgentStore();
  if (!agentId || !runId) return null;
  return runs[agentId]?.find(r => r.id === runId) || null;
}

export function useCharacterLayer(agentId: string | null): CharacterLayerConfig | null {
  const { character } = useAgentStore();
  return agentId ? character[agentId] || null : null;
}

export function useCharacterCompiled(agentId: string | null): CharacterCompiledConfig | null {
  const { compiledCharacter } = useAgentStore();
  return agentId ? compiledCharacter[agentId] || null : null;
}

export function useCharacterStats(agentId: string | null): CharacterStats | null {
  const { characterStats } = useAgentStore();
  return agentId ? characterStats[agentId] || null : null;
}
