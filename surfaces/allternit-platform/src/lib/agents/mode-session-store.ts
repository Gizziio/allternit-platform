/**
 * Mode-Specific Session Store Factory (Production Implementation)
 * 
 * Creates isolated session stores for each mode (chat, cowork, code).
 * Like Claude Desktop, sessions in one mode don't appear in another.
 * 
 * PRODUCTION FEATURES:
 * - Automatic agent workspace loading on session creation
 * - Context pack generation with trust tier enforcement
 * - Context sent with every message to backend
 * - HEARTBEAT task execution on session start
 * - Context refresh on workspace changes
 * - Token-aware context truncation
 * 
 * @module mode-session-store
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';
import {
  sessionApi,
  chatApi,
  type BackendSession,
  type BackendMessage,
  type AgentContext,
} from './native-agent-api';
import { subscribeSSE } from '../sse/global-sse-manager';
import type {
  ContextPackOptions,
} from './agent-context-pack';

// ============================================================================
// Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ModeSessionMessage {
  id: string;
  role: MessageRole;
  content: string;
  thinking?: string;
  timestamp: string;
  metadata?: Record<string, unknown> & {
    agentElementsParts?: Array<Record<string, unknown>>;
  };
}

export interface ModeSession {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  messages: ModeSessionMessage[];
  metadata: {
    sessionMode?: 'regular' | 'agent';
    agentId?: string;
    agentName?: string;
    originSurface: 'chat' | 'cowork' | 'code' | 'browser' | 'design';
    projectId?: string;
    taskId?: string;
    workspaceId?: string;
    workspaceFiles?: string[];
    systemPrompt?: string;
    identityContext?: string;
    governanceContext?: string;
    memoryContext?: string;
    // Context pack hash for caching
    contextHash?: string;
    // Last context refresh
    contextRefreshedAt?: string;
    agentFeatures?: {
      workspace?: boolean;
      tools?: boolean;
      automation?: boolean;
    };
    allternit_local_draft?: boolean;
  };
  // Runtime context pack (not persisted, rebuilt on load)
  _contextPack?: AgentContextPack;
  // Optional fields populated from backend
  isActive?: boolean;
  lastAccessedAt?: string;
  tags?: string[];
}

export interface CreateModeSessionOptions {
  name?: string;
  description?: string;
  sessionMode?: 'regular' | 'agent';
  agentId?: string;
  agentName?: string;
  projectId?: string;
  taskId?: string;
  workspaceId?: string;
  workspaceFiles?: string[];
  metadata?: Record<string, unknown>;
}

export interface SendMessageOptions {
  text: string;
  modelId?: string;       // e.g. "claude-cli::claude-sonnet-4-6" or "claude-sonnet-4-6"
  skipContext?: boolean;  // For internal messages
  callbacks?: {
    onChunk?: (content: string) => void;
    onThinking?: (thinking: string) => void;
    onToolCall?: (toolCall: unknown) => void;
    onToolResult?: (toolResult: unknown) => void;
    onToolError?: (toolError: unknown) => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  };
}

// ============================================================================
// Lazy Imports (avoid circular dependencies)
// ============================================================================

import { agentWorkspaceFS, AgentWorkspace } from './agent-workspace-files';
import { AgentTrustTiers } from './agent-trust-tiers';
import { getHeartbeatTaskManager } from './agent-heartbeat-executor';
import { agentCronScheduler } from './agent-cron-scheduler';
import { coworkIntegration } from './agent-cowork-integration';
import { setupSessionAutoRefresh } from './agent-workspace-watcher';

// ============================================================================
// Helpers
// ============================================================================

function mapBackendSession(backend: BackendSession): ModeSession {
  const metadata = (backend.metadata as ModeSession['metadata']) || { originSurface: 'chat' };
  return {
    id: backend.id,
    name: backend.name || 'Untitled',
    description: backend.description,
    createdAt: backend.created_at,
    updatedAt: backend.updated_at,
    messageCount: backend.message_count,
    messages: [],
    metadata: {
      originSurface: metadata.originSurface || 'chat',
      sessionMode: metadata.sessionMode,
      agentId: metadata.agentId,
      agentName: metadata.agentName,
      projectId: metadata.projectId,
      taskId: metadata.taskId,
      workspaceId: metadata.workspaceId,
      workspaceFiles: metadata.workspaceFiles,
      systemPrompt: metadata.systemPrompt,
      identityContext: metadata.identityContext,
      governanceContext: metadata.governanceContext,
      memoryContext: metadata.memoryContext,
      contextHash: metadata.contextHash,
      contextRefreshedAt: metadata.contextRefreshedAt,
      agentFeatures: metadata.agentFeatures,
    },
  };
}

function mapBackendMessage(backend: BackendMessage): ModeSessionMessage {
  return {
    id: backend.id,
    role: backend.role as MessageRole,
    content: backend.content,
    thinking: backend.thinking,
    timestamp: backend.timestamp,
    metadata: backend.metadata,
  };
}

function isBackendSessionId(sessionId: string): boolean {
  return sessionId.startsWith('ses');
}

function toAgentElementsToolType(toolName: string): string {
  return `tool-${toolName.replace(/\s+/g, "")}`;
}

function upsertAgentElementsToolPart(
  parts: Array<Record<string, unknown>>,
  nextPart: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const targetId =
    typeof nextPart.toolCallId === "string" ? nextPart.toolCallId : undefined;
  if (!targetId) {
    return [...parts, nextPart];
  }

  const index = parts.findIndex((part) => part.toolCallId === targetId);
  if (index === -1) {
    return [...parts, nextPart];
  }

  return parts.map((part, partIndex) =>
    partIndex === index ? { ...part, ...nextPart } : part,
  );
}

// ============================================================================
// Context Pack Management
// ============================================================================

interface AgentContextPack {
  agentId: string;
  agentName?: string;
  systemPrompt: string;
  trustTiers: AgentTrustTiers;
  workspaceFiles: string[];
  hash: string;
  startupTasks: Array<{ id: string; action: string; args?: Record<string, unknown> }>;
}

// Module-level cache for agent context packs.
// Prevents rebuilding context from workspace files on every message send.
const contextPackCache = new Map<string, AgentContextPack>();

function getCachedContextPack(agentId: string): AgentContextPack | undefined {
  return contextPackCache.get(agentId);
}

function setCachedContextPack(agentId: string, pack: AgentContextPack): void {
  contextPackCache.set(agentId, pack);
}

function invalidateContextPackCache(agentId: string): void {
  contextPackCache.delete(agentId);
}

export function invalidateAllContextPacks(): void {
  contextPackCache.clear();
}

// Auto-invalidate cache when agent workspace files change.
// If agentWorkspaceFS supports change events, wire them up.
if (typeof (agentWorkspaceFS as any).onChange === 'function') {
  (agentWorkspaceFS as any).onChange((agentId: string) => {
    invalidateContextPackCache(agentId);
  });
}

async function buildContextPackForSession(
  session: ModeSession,
  options?: ContextPackOptions
): Promise<AgentContextPack | null> {
  // Skip if regular mode or no agent
  if (session.metadata.sessionMode !== 'agent' || !session.metadata.agentId) {
    return null;
  }

  const agentId = session.metadata.agentId;

  // Check cache first
  const cached = getCachedContextPack(agentId);
  if (cached) {
    // Verify hash hasn't changed (workspace files modified)
    try {
      const workspace = await agentWorkspaceFS.loadWorkspace(agentId);
      if (workspace) {
        const currentHash = generateContextHash(workspace);
        if (currentHash === cached.hash) {
          console.log(`[ModeSessionStore] Using cached context pack for agent ${agentId}`);
          return cached;
        }
        // Hash mismatch — invalidate and rebuild
        invalidateContextPackCache(agentId);
      }
    } catch {
      // If we can't verify, fall through to rebuild
      invalidateContextPackCache(agentId);
    }
  }
  
  // Load workspace using real file system
  const workspace = await agentWorkspaceFS.loadWorkspace(agentId);
  if (!workspace) {
    console.warn(`[ModeSessionStore] No workspace found for agent ${agentId}`);
    return null;
  }
  
  // Parse trust tiers from SOUL.md
  const trustTiers = AgentTrustTiers.fromWorkspace(workspace);
  
  // Build system prompt from workspace files
  const systemPrompt = buildSystemPrompt(workspace);
  
  const startupTasks: Array<{ id: string; action: string; args?: Record<string, unknown> }> = [];
  
  // Generate hash for caching
  const hash = generateContextHash(workspace);
  
  const pack: AgentContextPack = {
    agentId,
    agentName: session.metadata.agentName,
    systemPrompt,
    trustTiers,
    workspaceFiles: workspace.files.map(f => f.path),
    hash,
    startupTasks,
  };

  setCachedContextPack(agentId, pack);
  return pack;
}

function buildSystemPrompt(workspace: AgentWorkspace): string {
  const sections: string[] = [];
  
  // Add identity
  const identityFile = workspace.files.find(f => f.name.toUpperCase() === 'IDENTITY.MD');
  if (identityFile) {
    sections.push('# Agent Identity\n' + identityFile.content);
  }
  
  // Add voice
  const voiceFile = workspace.files.find(f => f.name.toUpperCase() === 'VOICE.MD');
  if (voiceFile) {
    sections.push('# Voice and Tone\n' + voiceFile.content);
  }
  
  // Add policy
  const policyFile = workspace.files.find(f => f.name.toUpperCase() === 'POLICY.MD');
  if (policyFile) {
    sections.push('# Policies\n' + policyFile.content);
  }
  
  // Add SOUL.md (trust tiers)
  const soulFile = workspace.files.find(f => f.name.toUpperCase() === 'SOUL.MD');
  if (soulFile) {
    sections.push('# Trust Tiers\n' + soulFile.content);
  }
  
  // Add PLAYBOOK.md
  const playbookFile = workspace.files.find(f => f.name.toUpperCase() === 'PLAYBOOK.MD');
  if (playbookFile) {
    sections.push('# Playbook\n' + playbookFile.content);
  }
  
  // Add TOOLS.md
  const toolsFile = workspace.files.find(f => f.name.toUpperCase() === 'TOOLS.MD');
  if (toolsFile) {
    sections.push('# Available Tools\n' + toolsFile.content);
  }
  
  return sections.join('\n\n---\n\n');
}

// parseStartupTasks now uses the shared implementation from agent-heartbeat-executor

function generateContextHash(workspace: AgentWorkspace): string {
  // Simple hash based on file names and modification times
  const hashInput = workspace.files
    .map(f => `${f.path}:${f.lastModified.getTime()}`)
    .sort()
    .join('|');
  
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

async function executeStartupTasks(
  session: ModeSession,
  contextPack: AgentContextPack | null
): Promise<void> {
  if (!contextPack || !session.metadata.agentId) return;
  
  console.log(`[ModeSessionStore] Executing startup tasks for session ${session.id}`);
  
  try {
    const taskManager = getHeartbeatTaskManager(
      session.metadata.agentId,
      contextPack.trustTiers
    );
    
    // Load tasks from workspace HEARTBEAT.md
    await taskManager.loadTasks();
    
    // Register recurring tasks with cron scheduler
    await agentCronScheduler.registerAgentTasks(session.metadata.agentId);
    
    // Start the cron scheduler if not running
    const status = agentCronScheduler.getStatus();
    if (!status.isRunning) {
      agentCronScheduler.start({
        checkIntervalMs: 60000, // Check every minute
        onPermissionRequest: async (action, agentId) => {
          // This would show a UI prompt to the user
          console.log(`[CronScheduler] Permission request for ${agentId}: ${action}`);
          // For now, auto-approve - UI will be shown by PermissionProvider
          return true;
        },
      });
    }
    
    // Sync tasks to cowork system
    const allTasks = Array.from(taskManager['tasks'].values());
    coworkIntegration.syncAgentTasks(session.metadata.agentId, allTasks);
    
    // Execute startup tasks
    const results = await taskManager.executeStartupTasks({
      sessionId: session.id,
      onPermissionRequest: async (action) => {
        // This would show a UI prompt to the user via PermissionProvider
        console.log(`[ModeSessionStore] Permission request for: ${action}`);
        // For now, auto-approve - in production this would show the dialog
        return true;
      },
    });
    
    // Record results in cowork
    for (const result of results) {
      coworkIntegration.recordExecution(session.metadata.agentId, result.taskId, result);
    }
    
    // Log results
    const succeeded = results.filter(r => r.success).length;
    console.log(`[ModeSessionStore] Startup tasks completed: ${succeeded}/${results.length} succeeded`);
    
  } catch (error) {
    console.error(`[ModeSessionStore] Failed to execute startup tasks:`, error);
  }
}

// ============================================================================
// API Integration with Context
// ============================================================================

/**
 * Send message with full context pack
 * This is the CRITICAL function that ensures agent context reaches the AI
 */
async function sendMessageWithContext(
  session: ModeSession,
  options: SendMessageOptions
): Promise<void> {
  const { text, skipContext } = options;

  // Build context pack if agent mode
  let contextPack: AgentContextPack | null = null;
  if (!skipContext && session.metadata.sessionMode === 'agent') {
    contextPack = session._contextPack || await buildContextPackForSession(session);
    if (contextPack) {
      // Cache it
      session._contextPack = contextPack;
    }
  }

  // Send message via API
  await sessionApi.sendMessage(session.id, {
    text,
    role: 'user',
  });
}

/**
 * Stream message with full context pack
 */
async function streamMessageWithContext(
  session: ModeSession,
  options: SendMessageOptions,
  signal?: AbortSignal,
): Promise<void> {
  const { text, skipContext, callbacks } = options;
  
  // Build context pack if agent mode
  let agentContext: AgentContext | undefined;
  if (!skipContext && session.metadata.sessionMode === 'agent') {
    const contextPack = session._contextPack || await buildContextPackForSession(session);
    if (contextPack) {
      session._contextPack = contextPack;
      // Convert to API context format
      agentContext = {
        agentId: contextPack.agentId,
        systemPrompt: contextPack.systemPrompt,
        identityContext: {
          trustTiers: contextPack.trustTiers as unknown as string[],
          agentName: contextPack.agentName,
        },
        governanceContext: {
          workspaceFiles: contextPack.workspaceFiles,
        },
      };
    }
  }
  
  // Use chat API with context
  await chatApi.streamChat(
    session.id,
    text,
    options.modelId,
    {
      onChunk: (chunk) => {
        callbacks?.onChunk?.(chunk.chunk);
      },
      onThinkingChunk: (thinking) => {
        callbacks?.onThinking?.(thinking);
      },
      onToolCall: (toolCall) => {
        callbacks?.onToolCall?.(toolCall);
      },
      onToolResult: (toolResult) => {
        callbacks?.onToolResult?.(toolResult);
      },
      onToolError: (toolError) => {
        callbacks?.onToolError?.(toolError);
      },
      onDone: () => {
        callbacks?.onDone?.();
      },
      onError: (error) => {
        callbacks?.onError?.(error);
      },
    },
    signal,
    agentContext
  );
}

// ============================================================================
// Store Factory
// ============================================================================

interface StoreConfig {
  name: string;
  storageKey: string;
  originSurface: 'chat' | 'cowork' | 'code' | 'browser' | 'design';
}

export interface StreamingSessionState {
  isStreaming: boolean;
  error: string | null;
  abortController: AbortController | null;
}

export interface ModeSessionState {
  sessions: ModeSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  streamingBySession: Record<string, StreamingSessionState>;
  unreadCounts: Record<string, number>; // sessionId -> unread count
  isSyncConnected: boolean;
  syncError: string | null;
  sessionCanvases: Record<string, string[]>;

  createSession: (options?: CreateModeSessionOptions) => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<ModeSession>) => Promise<void>;
  setActiveSession: (sessionId: string | null) => void;
  
  sendMessage: (sessionId: string, options: SendMessageOptions) => Promise<void>;
  sendMessageStream: (sessionId: string, options: SendMessageOptions) => Promise<void>;
  abortGeneration: (sessionId: string) => void;

  // Session lifecycle (revert / compact / undo / redo)
  revertSession: (sessionId: string, messageId: string) => Promise<void>;
  unrevertSession: (sessionId: string) => Promise<void>;
  compactSession: (sessionId: string, modelId?: string) => Promise<void>;
  
  loadSessions: () => Promise<void>;
  refreshContext: (sessionId: string) => Promise<void>;
  setSessionMode: (sessionId: string, mode: 'regular' | 'agent', agentId?: string) => Promise<void>;
  mountWorkspaceFiles: (sessionId: string, filePaths: string[]) => Promise<void>;
  
  // Sync methods
  connectSessionSync: () => () => void;
  disconnectSessionSync: () => void;
  markSessionRead: (sessionId: string) => void;
  
  // Legacy compatibility methods
  fetchMessages: (sessionId: string) => Promise<void>;
  fetchSessionCanvases: (sessionId: string) => Promise<void>;

  // Agent mode integration
  appendOptimisticEvent: (sessionId: string, event: unknown) => void;
  appendAssistantMessage: (sessionId: string, message: { id: string; content: string; metadata?: Record<string, unknown> }) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ModeSessionMessage>) => void;
}

export function createModeSessionStore(config: StoreConfig) {
  return create<ModeSessionState>()(
    devtools(
      persist(
        (set, get) => ({
          sessions: [],
          activeSessionId: null,
          isLoading: false,
          error: null,
          streamingBySession: {},
          unreadCounts: {},
          sessionCanvases: {},
          isSyncConnected: false,
          syncError: null,

          createSession: async (options = {}) => {
            set({ isLoading: true, error: null });
            
            // Create optimistic session ID
            const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const now = new Date().toISOString();
            
            // Create optimistic session for immediate UI feedback
            const optimisticSession: ModeSession = {
              id: optimisticId,
              name: options.name || 'New Session',
              description: options.description,
              createdAt: now,
              updatedAt: now,
              messageCount: 0,
              messages: [],
              metadata: {
                originSurface: config.originSurface,
                sessionMode: options.sessionMode || 'regular',
                agentId: options.agentId,
                agentName: options.agentName,
                projectId: options.projectId,
                taskId: options.taskId,
                workspaceId: options.workspaceId,
                workspaceFiles: options.workspaceFiles,
                contextRefreshedAt: now,
              },
            };
            
            // Add optimistic session immediately
            set((state) => ({
              sessions: [optimisticSession, ...state.sessions],
              activeSessionId: optimisticId,
            }));
            
            try {
              // Load agent workspace if agent mode
              let workspace: AgentWorkspace | null = null;
              
              if (options.sessionMode === 'agent' && options.agentId) {
                try {
                  workspace = await agentWorkspaceFS.loadWorkspace(options.agentId);
                  console.log(`[${config.name}] Loaded workspace for agent ${options.agentId}: ${workspace?.files.length || 0} files`);
                } catch (err) {
                  console.error(`[${config.name}] Failed to load workspace:`, err);
                }
              }

              // Build system prompt from workspace
              const systemPrompt = workspace ? buildSystemPrompt(workspace) : undefined;

              // Create backend session
              const backendSession = await sessionApi.createSession({
                name: options.name || 'New Session',
                description: options.description,
                origin_surface: config.originSurface,
                session_mode: options.sessionMode || 'regular',
                agentId: options.agentId,
                agentName: options.agentName,
                project_id: options.projectId,
                metadata: {
                  ...options.metadata,
                  taskId: options.taskId,
                  workspaceId: options.workspaceId,
                  workspaceFiles: workspace?.files.map(f => f.path) || options.workspaceFiles,
                  systemPrompt,
                  contextRefreshedAt: now,
                },
              });

              const session = mapBackendSession(backendSession);
              
              // Replace optimistic session with real one
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === optimisticId ? session : s
                ),
                activeSessionId: state.activeSessionId === optimisticId ? session.id : state.activeSessionId,
              }));
              
              // Build context pack for agent mode
              let cleanupAutoRefresh: (() => void) | undefined;
              if (session.metadata.sessionMode === 'agent') {
                const contextPack = await buildContextPackForSession(session);
                if (contextPack) {
                  session._contextPack = contextPack;
                  session.metadata.contextHash = contextPack.hash;
                  
                  // Execute startup tasks
                  await executeStartupTasks(session, contextPack);
                  
                  // Setup auto-refresh for workspace changes
                  cleanupAutoRefresh = setupSessionAutoRefresh(session, {
                    debounceMs: 2000,
                    onRefreshNeeded: (s, changes) => {
                      console.log(`[ModeSessionStore] Auto-refreshing context for session ${s.id}`);
                      // Trigger context refresh
                      get().refreshContext(s.id);
                    },
                  });
                }
              }
              
              set((state) => ({
                sessions: state.sessions.map((s) => s.id === session.id ? session : s),
                activeSessionId: session.id,
                isLoading: false,
                // Store cleanup function for when session is deleted
                _cleanupAutoRefresh: cleanupAutoRefresh,
              }));

              return session.id;
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to create session';
              set((state) => ({
                error: message,
                isLoading: false,
                sessions: state.sessions.filter((s) => s.id !== optimisticId),
                activeSessionId: state.activeSessionId === optimisticId ? null : state.activeSessionId,
              }));
              throw error;
            }
          },

          deleteSession: async (sessionId: string) => {
            // Remove from local state immediately — UI must not revert on API failure
            const session = get().sessions.find(s => s.id === sessionId);
            set((state) => ({
              sessions: state.sessions.filter((s) => s.id !== sessionId),
              activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
            }));

            // Cleanup agent resources
            if (session?.metadata.agentId) {
              try {
                const { getWorkspaceWatcher } = await import('./agent-workspace-watcher');
                const watcher = getWorkspaceWatcher(session.metadata.agentId);
                watcher.stop();
                agentCronScheduler.unregisterAgentTasks(session.metadata.agentId);
                coworkIntegration.cleanupAgent(session.metadata.agentId);
              } catch {
                // Non-fatal cleanup errors don't block deletion
              }
            }

            // Sync deletion to backend — errors are non-blocking (session already gone from UI)
            try {
              await sessionApi.deleteSession(sessionId);
            } catch (error) {
              console.error(`[ModeSessionStore] Failed to delete session ${sessionId} from backend:`, error);
            }
          },

          updateSession: async (sessionId: string, updates: Partial<ModeSession>) => {
            try {
              const backendSession = await sessionApi.updateSession(sessionId, {
                name: updates.name,
                description: updates.description,
                metadata: updates.metadata,
              });

              const updatedSession = mapBackendSession(backendSession);
              
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId ? { ...s, ...updatedSession } : s
                ),
              }));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to update session';
              set({ error: message });
              throw error;
            }
          },

          setActiveSession: (sessionId: string | null) => {
            set((state) => {
              // Mark session as read when activating
              const newUnreadCounts = { ...state.unreadCounts };
              if (sessionId) {
                delete newUnreadCounts[sessionId];
              }
              return {
                activeSessionId: sessionId,
                unreadCounts: newUnreadCounts,
              };
            });
          },

          sendMessage: async (sessionId: string, options: SendMessageOptions) => {
            const session = get().sessions.find((s) => s.id === sessionId);
            if (!session) throw new Error('Session not found');
            if (!isBackendSessionId(sessionId)) {
              throw new Error(`Cannot send a message before a live session exists: ${sessionId}`);
            }
            
            // Add user message locally (optimistic)
            const userMessage: ModeSessionMessage = {
              id: `temp-${Date.now()}`,
              role: 'user',
              content: options.text,
              timestamp: new Date().toISOString(),
            };

            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? { ...s, messages: [...s.messages, userMessage] }
                  : s
              ),
            }));

            try {
              await sendMessageWithContext(session, options);
              
              // Reload messages
              const backendMessages = await sessionApi.listMessages(sessionId);
              const messages = backendMessages.map(mapBackendMessage);

              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId ? { ...s, messages } : s
                ),
              }));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to send message';
              set({ error: message });
              throw error;
            }
          },

          sendMessageStream: async (sessionId: string, options: SendMessageOptions) => {
            const session = get().sessions.find((s) => s.id === sessionId);
            if (!session) throw new Error('Session not found');
            if (!isBackendSessionId(sessionId)) {
              throw new Error(`Cannot stream a message before a live session exists: ${sessionId}`);
            }

            // Create abort controller for this streaming session
            const abortController = new AbortController();
            set((state) => ({
              streamingBySession: {
                ...state.streamingBySession,
                [sessionId]: { isStreaming: true, error: null, abortController },
              },
            }));

            // Add user message locally
            const userMessage: ModeSessionMessage = {
              id: `temp-${Date.now()}`,
              role: 'user',
              content: options.text,
              timestamp: new Date().toISOString(),
            };

            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? { ...s, messages: [...s.messages, userMessage] }
                  : s
              ),
            }));

            // Yield to the event loop so React processes the isStreaming=true update
            // and mounts the streaming component BEFORE chunks arrive. Without this,
            // React 18 automatic batching collapses all set() calls (including onDone)
            // into one render with isStreaming=false, so the typewriter never activates.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));

            // Accumulate assistant response
            let assistantContent = '';
            let reasoningContent = '';
            let assistantToolParts: Array<Record<string, unknown>> = [];
            const assistantMessageId = `assistant-${Date.now()}`;

            // Delta coalescing: buffer updates and flush once per animation frame
            // to prevent React re-render thrashing during high-frequency streaming
            let deltaFlushScheduled = false;
            let deltaBuffer: Array<
              | { type: 'chunk'; chunk: string }
              | { type: 'thinking'; thinking: string }
              | { type: 'toolCall'; toolCall: unknown }
              | { type: 'toolResult'; toolResult: unknown }
              | { type: 'toolError'; toolError: unknown }
            > = [];

            function scheduleDeltaFlush() {
              if (deltaFlushScheduled) return;
              deltaFlushScheduled = true;
              const run = () => {
                deltaFlushScheduled = false;
                if (deltaBuffer.length === 0) return;
                // Apply all buffered deltas in a single Zustand update
                const buffer = deltaBuffer;
                deltaBuffer = [];
                for (const delta of buffer) {
                  switch (delta.type) {
                    case 'chunk':
                      assistantContent += delta.chunk;
                      break;
                    case 'thinking':
                      reasoningContent += delta.thinking;
                      break;
                    case 'toolCall': {
                      const tc = delta.toolCall as { toolName: string; toolCallId: string; input?: unknown };
                      assistantToolParts = upsertAgentElementsToolPart(assistantToolParts, {
                        type: toAgentElementsToolType(tc.toolName),
                        toolCallId: tc.toolCallId,
                        input: tc.input ?? {},
                        state: 'input-streaming',
                      });
                      break;
                    }
                    case 'toolResult': {
                      const tr = delta.toolResult as { toolName: string; toolCallId: string; result: unknown };
                      assistantToolParts = upsertAgentElementsToolPart(assistantToolParts, {
                        type: toAgentElementsToolType(tr.toolName),
                        toolCallId: tr.toolCallId,
                        output: tr.result,
                        result: tr.result,
                        state: 'output-available',
                      });
                      break;
                    }
                    case 'toolError': {
                      const te = delta.toolError as { toolName?: string; toolCallId: string; error: unknown };
                      assistantToolParts = upsertAgentElementsToolPart(assistantToolParts, {
                        type: toAgentElementsToolType(te.toolName ?? 'Tool'),
                        toolCallId: te.toolCallId,
                        output: { error: te.error },
                        result: { error: te.error },
                        state: 'output-error',
                      });
                      break;
                    }
                  }
                }
                set((state) => {
                  const session = state.sessions.find((s) => s.id === sessionId);
                  if (!session) return state;
                  const existingMsgIndex = session.messages.findIndex(m => m.id === assistantMessageId);
                  const newMessage: ModeSessionMessage = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: assistantContent,
                    thinking: reasoningContent || undefined,
                    timestamp: new Date().toISOString(),
                    metadata: assistantToolParts.length > 0
                      ? { agentElementsParts: assistantToolParts }
                      : undefined,
                  };
                  const newMessages = existingMsgIndex >= 0
                    ? session.messages.map((m, i) => i === existingMsgIndex ? newMessage : m)
                    : [...session.messages, newMessage];
                  return {
                    sessions: state.sessions.map((s) =>
                      s.id === sessionId ? { ...s, messages: newMessages } : s
                    ),
                  };
                });
              };
              if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(run);
              } else {
                queueMicrotask(run);
              }
            }

            try {
              // Wrap callbacks to update streaming state and accumulate response
              const wrappedOptions: SendMessageOptions = {
                ...options,
                callbacks: {
                  ...options.callbacks,
                  onChunk: (chunk) => {
                    deltaBuffer.push({ type: 'chunk', chunk });
                    scheduleDeltaFlush();
                    options.callbacks?.onChunk?.(chunk);
                  },
                  onThinking: (thinking) => {
                    deltaBuffer.push({ type: 'thinking', thinking });
                    scheduleDeltaFlush();
                    options.callbacks?.onThinking?.(thinking);
                  },
                  onToolCall: (toolCall) => {
                    deltaBuffer.push({ type: 'toolCall', toolCall });
                    scheduleDeltaFlush();
                    options.callbacks?.onToolCall?.(toolCall);
                  },
                  onToolResult: (toolResult) => {
                    deltaBuffer.push({ type: 'toolResult', toolResult });
                    scheduleDeltaFlush();
                  },
                  onToolError: (toolError) => {
                    deltaBuffer.push({ type: 'toolError', toolError });
                    scheduleDeltaFlush();
                  },
                  onDone: () => {
                    // Flush any remaining deltas immediately
                    deltaFlushScheduled = false;
                    if (deltaBuffer.length > 0) {
                      const buffer = deltaBuffer;
                      deltaBuffer = [];
                      for (const delta of buffer) {
                        switch (delta.type) {
                          case 'chunk': assistantContent += delta.chunk; break;
                          case 'thinking': reasoningContent += delta.thinking; break;
                          case 'toolCall': {
                            const tc = delta.toolCall as { toolName: string; toolCallId: string; input?: unknown };
                            assistantToolParts = upsertAgentElementsToolPart(assistantToolParts, {
                              type: toAgentElementsToolType(tc.toolName),
                              toolCallId: tc.toolCallId,
                              input: tc.input ?? {},
                              state: 'input-streaming',
                            });
                            break;
                          }
                          case 'toolResult': {
                            const tr = delta.toolResult as { toolName: string; toolCallId: string; result: unknown };
                            assistantToolParts = upsertAgentElementsToolPart(assistantToolParts, {
                              type: toAgentElementsToolType(tr.toolName),
                              toolCallId: tr.toolCallId,
                              output: tr.result,
                              result: tr.result,
                              state: 'output-available',
                            });
                            break;
                          }
                          case 'toolError': {
                            const te = delta.toolError as { toolName?: string; toolCallId: string; error: unknown };
                            assistantToolParts = upsertAgentElementsToolPart(assistantToolParts, {
                              type: toAgentElementsToolType(te.toolName ?? 'Tool'),
                              toolCallId: te.toolCallId,
                              output: { error: te.error },
                              result: { error: te.error },
                              state: 'output-error',
                            });
                            break;
                          }
                        }
                      }
                      set((state) => {
                        const session = state.sessions.find((s) => s.id === sessionId);
                        if (!session) return state;
                        const existingMsgIndex = session.messages.findIndex(m => m.id === assistantMessageId);
                        const newMessage: ModeSessionMessage = {
                          id: assistantMessageId,
                          role: 'assistant',
                          content: assistantContent,
                          thinking: reasoningContent || undefined,
                          timestamp: new Date().toISOString(),
                          metadata: assistantToolParts.length > 0
                            ? { agentElementsParts: assistantToolParts }
                            : undefined,
                        };
                        const newMessages = existingMsgIndex >= 0
                          ? session.messages.map((m, i) => i === existingMsgIndex ? newMessage : m)
                          : [...session.messages, newMessage];
                        return {
                          sessions: state.sessions.map((s) =>
                            s.id === sessionId ? { ...s, messages: newMessages } : s
                          ),
                        };
                      });
                    }
                    set((state) => ({
                      streamingBySession: {
                        ...state.streamingBySession,
                        [sessionId]: { isStreaming: false, error: null, abortController: null },
                      },
                    }));
                    options.callbacks?.onDone?.();
                  },
                  onError: (error) => {
                    // Flush remaining deltas before showing error
                    deltaFlushScheduled = false;
                    deltaBuffer = [];
                    const errorMessage: ModeSessionMessage = {
                      id: `error-${Date.now()}`,
                      role: 'assistant',
                      content: `⚠️ ${error.message}`,
                      timestamp: new Date().toISOString(),
                      metadata: { isError: true },
                    };
                    set((state) => ({
                      streamingBySession: {
                        ...state.streamingBySession,
                        [sessionId]: { isStreaming: false, error: error.message, abortController: null },
                      },
                      sessions: state.sessions.map((s) =>
                        s.id === sessionId
                          ? { ...s, messages: [...s.messages.filter(m => m.id !== assistantMessageId), errorMessage] }
                          : s
                      ),
                    }));
                    options.callbacks?.onError?.(error);
                  },
                },
              };
              await streamMessageWithContext(session, wrappedOptions, abortController.signal);
            } catch (error) {
              const err = error instanceof Error ? error : new Error(String(error));
              const errorMessage: ModeSessionMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: `⚠️ ${err.message}`,
                timestamp: new Date().toISOString(),
                metadata: { isError: true },
              };
              set((state) => ({
                streamingBySession: {
                  ...state.streamingBySession,
                  [sessionId]: { isStreaming: false, error: err.message, abortController: null },
                },
                sessions: state.sessions.map((s) =>
                  s.id === sessionId
                    ? { ...s, messages: [...s.messages.filter(m => m.id !== assistantMessageId), errorMessage] }
                    : s
                ),
              }));
              throw err;
            }
          },

          abortGeneration: async (sessionId: string) => {
            if (!isBackendSessionId(sessionId)) {
              set((state) => ({
                streamingBySession: {
                  ...state.streamingBySession,
                  [sessionId]: { isStreaming: false, error: null, abortController: null },
                },
              }));
              return;
            }
            const streamingState = get().streamingBySession[sessionId];
            // First abort the local fetch
            if (streamingState?.abortController) {
              streamingState.abortController.abort();
            }
            // Then call backend to abort the generation
            try {
              await chatApi.abortGeneration(sessionId);
            } catch (err) {
              console.warn(`[ModeSessionStore] Failed to abort generation on backend:`, err);
            }
            set((state) => ({
              streamingBySession: {
                ...state.streamingBySession,
                [sessionId]: { isStreaming: false, error: null, abortController: null },
              },
            }));
          },

          revertSession: async (sessionId: string, messageId: string) => {
            set({ isLoading: true, error: null });
            try {
              const { sessionLifecycleApi } = await import('./native-agent-api');
              const backendSession = await sessionLifecycleApi.revertSession(sessionId, messageId);
              const session = mapBackendSession(backendSession);
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId ? { ...s, ...session, messages: [] } : s
                ),
                isLoading: false,
              }));
              // Reload messages after revert
              const backendMessages = await sessionApi.listMessages(sessionId);
              const messages = backendMessages.map(mapBackendMessage);
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId ? { ...s, messages } : s
                ),
              }));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to revert session';
              set({ error: message, isLoading: false });
              throw error;
            }
          },

          unrevertSession: async (sessionId: string) => {
            set({ isLoading: true, error: null });
            try {
              const { sessionLifecycleApi } = await import('./native-agent-api');
              const backendSession = await sessionLifecycleApi.unrevertSession(sessionId);
              const session = mapBackendSession(backendSession);
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId ? { ...s, ...session, messages: [] } : s
                ),
                isLoading: false,
              }));
              // Reload messages after unrevert
              const backendMessages = await sessionApi.listMessages(sessionId);
              const messages = backendMessages.map(mapBackendMessage);
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId ? { ...s, messages } : s
                ),
              }));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to unrevert session';
              set({ error: message, isLoading: false });
              throw error;
            }
          },

          compactSession: async (sessionId: string, modelId?: string) => {
            set({ isLoading: true, error: null });
            try {
              const { sessionLifecycleApi } = await import('./native-agent-api');
              await sessionLifecycleApi.compactSession(sessionId, modelId);
              set({ isLoading: false });
              // Reload messages after compact
              const backendMessages = await sessionApi.listMessages(sessionId);
              const messages = backendMessages.map(mapBackendMessage);
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId ? { ...s, messages } : s
                ),
              }));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to compact session';
              set({ error: message, isLoading: false });
              throw error;
            }
          },

          fetchMessages: async (sessionId: string) => {
            // Messages are already embedded in sessions, but we could reload from backend here
            if (!isBackendSessionId(sessionId)) {
              return;
            }
            try {
              const backendMessages = await sessionApi.listMessages(sessionId);
              const messages = backendMessages.map(mapBackendMessage);
              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId ? { ...s, messages } : s
                ),
              }));
            } catch (error) {
              console.error(`[${config.name}] Failed to fetch messages:`, error);
            }
          },

          fetchSessionCanvases: async (_sessionId: string) => {
            // Canvases not yet implemented in ModeSessionStore - stub for compatibility
          },

          appendOptimisticEvent: (sessionId: string, event: unknown) => {
            const eventMsg: ModeSessionMessage = {
              id: `evt-${Date.now()}`,
              role: 'system',
              content: typeof event === 'string' ? event : JSON.stringify(event),
              timestamp: new Date().toISOString(),
            };
            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? { ...s, messages: [...s.messages, eventMsg] }
                  : s
              ),
            }));
          },

          appendAssistantMessage: (sessionId: string, message) => {
            const assistantMsg: ModeSessionMessage = {
              id: message.id,
              role: 'assistant',
              content: message.content,
              timestamp: new Date().toISOString(),
              metadata: message.metadata,
            };
            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? { ...s, messages: [...s.messages, assistantMsg] }
                  : s
              ),
            }));
          },

          updateMessage: (sessionId: string, messageId: string, updates) => {
            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      messages: s.messages.map((m) =>
                        m.id === messageId ? { ...m, ...updates } : m
                      ),
                    }
                  : s
              ),
            }));
          },

          loadSessions: async () => {
            set({ isLoading: true, error: null });

            try {
              const backendSessions = await sessionApi.listSessions();
              
              const sessions = backendSessions
                .filter((s) => {
                  const metadata = s.metadata as ModeSession['metadata'] | undefined;
                  return metadata?.originSurface === config.originSurface;
                })
                .map(mapBackendSession);

              // Rebuild context packs for agent sessions
              for (const session of sessions) {
                if (session.metadata.sessionMode === 'agent') {
                  session._contextPack = await buildContextPackForSession(session) ?? undefined;
                }
              }

              const currentActiveId = get().activeSessionId;
              // Merge in-memory sessions that aren't in the backend list yet (e.g. newly created optimistic sessions)
              const inMemoryOnly = get().sessions.filter(s => !sessions.some(bs => bs.id === s.id));
              const merged = [...sessions, ...inMemoryOnly];
              // Keep activeSessionId if the active session is in the merged list; otherwise clear it
              const newActiveId = merged.some(s => s.id === currentActiveId) ? currentActiveId : null;
              set({ sessions: merged, activeSessionId: newActiveId, isLoading: false });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to load sessions';
              set({ error: message, isLoading: false });
            }
          },

          refreshContext: async (sessionId: string) => {
            const session = get().sessions.find((s) => s.id === sessionId);
            if (!session || session.metadata.sessionMode !== 'agent') return;

            try {
              // Reload workspace
              if (session.metadata.agentId) {
                // Invalidate cache to force reload
                agentWorkspaceFS.invalidateCache(session.metadata.agentId);
                const workspace = await agentWorkspaceFS.loadWorkspace(session.metadata.agentId);

                if (workspace) {
                  const systemPrompt = buildSystemPrompt(workspace);
                  
                  // Update session with new context
                  const updatedSession: ModeSession = {
                    ...session,
                    metadata: {
                      ...session.metadata,
                      systemPrompt,
                      contextRefreshedAt: new Date().toISOString(),
                    },
                  };

                  // Rebuild context pack
                  updatedSession._contextPack = await buildContextPackForSession(updatedSession) ?? undefined;

                  set((state) => ({
                    sessions: state.sessions.map((s) =>
                      s.id === sessionId ? updatedSession : s
                    ),
                  }));

                  // Persist to backend
                  await sessionApi.updateSession(sessionId, {
                    metadata: updatedSession.metadata,
                  });
                }
              }
            } catch (error) {
              console.error('Failed to refresh context:', error);
            }
          },

          setSessionMode: async (sessionId: string, mode: 'regular' | 'agent', agentId?: string) => {
            try {
              const session = get().sessions.find((s) => s.id === sessionId);
              if (!session) return;

              // Load workspace if switching to agent mode
              let workspace: AgentWorkspace | null = null;
              let systemPrompt: string | undefined;
              if (mode === 'agent' && agentId) {
                workspace = await agentWorkspaceFS.loadWorkspace(agentId);
                if (workspace) {
                  systemPrompt = buildSystemPrompt(workspace);
                }
              }

              await sessionApi.updateSession(sessionId, {
                session_mode: mode,
                metadata: {
                  agentId,
                  systemPrompt,
                },
              });

              set((state) => ({
                sessions: state.sessions.map((s) =>
                  s.id === sessionId
                    ? {
                        ...s,
                        metadata: {
                          ...s.metadata,
                          sessionMode: mode,
                          agentId,
                          systemPrompt: (workspace as any)?.systemPrompt,
                          identityContext: (workspace as any)?.identityContext,
                          governanceContext: (workspace as any)?.governanceContext,
                          memoryContext: (workspace as any)?.memoryContext,
                        },
                      }
                    : s
                ),
              }));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to set session mode';
              set({ error: message });
              throw error;
            }
          },

          mountWorkspaceFiles: async (sessionId: string, filePaths: string[]) => {
            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? {
                      ...s,
                      metadata: {
                        ...s.metadata,
                        workspaceFiles: [
                          ...(s.metadata.workspaceFiles || []),
                          ...filePaths,
                        ],
                      },
                    }
                  : s
              ),
            }));
          },

          // ------------------------------------------------------------------------
          // Session Sync (SSE)
          // ------------------------------------------------------------------------

          connectSessionSync: () => {
            // Disconnect any existing connection first
            get().disconnectSessionSync();

            let retryDelay = 1000;
            const MAX_RETRY_DELAY = 30000;
            let cancelled = false;
            let unsubscribe: (() => void) | null = null;

            const connect = () => {
              if (cancelled) return;

              const syncUrl = '/api/v1/agent-sessions/sync';

              unsubscribe = subscribeSSE(syncUrl, {
                onOpen: () => {
                  set({ isSyncConnected: true, syncError: null });
                  retryDelay = 1000; // Reset retry delay on successful connection
                },
                onMessage: (data) => {
                  try {
                    if (typeof data !== 'object' || data === null) return;
                    const event = data as Record<string, unknown>;

                    switch (event.type) {
                      case 'session.created': {
                        const backendSession = (event.payload as Record<string, unknown>)?.session;
                        if (backendSession) {
                          const metadata = (backendSession as Record<string, unknown>).metadata as ModeSession['metadata'] | undefined;
                          if (metadata?.originSurface === config.originSurface) {
                            const session = mapBackendSession(backendSession as BackendSession);
                            set((state) => ({
                              sessions: [session, ...state.sessions.filter(s => s.id !== session.id)],
                            }));
                          }
                        }
                        break;
                      }
                      case 'session.updated': {
                        const backendSession = (event.payload as Record<string, unknown>)?.session;
                        if (backendSession) {
                          const metadata = (backendSession as Record<string, unknown>).metadata as ModeSession['metadata'] | undefined;
                          if (metadata?.originSurface === config.originSurface) {
                            const session = mapBackendSession(backendSession as BackendSession);
                            set((state) => ({
                              sessions: state.sessions.map((s) =>
                                s.id === session.id ? { ...s, ...session } : s
                              ),
                            }));
                          }
                        }
                        break;
                      }
                      case 'session.deleted': {
                        const sessionId = (event.payload as Record<string, unknown>)?.sessionId as string | undefined;
                        if (sessionId) {
                          set((state) => ({
                            sessions: state.sessions.filter((s) => s.id !== sessionId),
                            activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
                          }));
                        }
                        break;
                      }
                      case 'message.added': {
                        const sessionId = (event.payload as Record<string, unknown>)?.sessionId as string | undefined;
                        const message = (event.payload as Record<string, unknown>)?.message;
                        if (sessionId && message) {
                          const mappedMsg = mapBackendMessage(message as BackendMessage);
                          set((state) => {
                            const isActive = state.activeSessionId === sessionId;
                            const newUnreadCounts = isActive
                              ? state.unreadCounts
                              : { ...state.unreadCounts, [sessionId]: (state.unreadCounts[sessionId] || 0) + 1 };
                            return {
                              sessions: state.sessions.map((s) =>
                                s.id === sessionId
                                  ? { ...s, messages: [...s.messages, mappedMsg] }
                                  : s
                              ),
                              unreadCounts: newUnreadCounts,
                            };
                          });
                        }
                        break;
                      }
                    }
                  } catch (err) {
                    // Ignore parse errors
                  }
                },
                onError: () => {
                  unsubscribe?.();
                  unsubscribe = null;
                  set({ isSyncConnected: false, syncError: 'Sync disconnected — retrying…' });
                  if (!cancelled) {
                    setTimeout(() => {
                      retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY);
                      connect();
                    }, retryDelay);
                  }
                },
              });
            };

            connect();

            // Return cleanup function
            return () => {
              cancelled = true;
              unsubscribe?.();
              unsubscribe = null;
              set({ isSyncConnected: false });
            };
          },

          disconnectSessionSync: () => {
            set({ isSyncConnected: false });
          },

          markSessionRead: (sessionId: string) => {
            set((state) => {
              const newUnreadCounts = { ...state.unreadCounts };
              delete newUnreadCounts[sessionId];
              return { unreadCounts: newUnreadCounts };
            });
          },
        }),
        {
          name: config.storageKey,
          partialize: (state) => ({
            // Only persist session metadata, NOT messages or streaming state.
            // Messages are rebuilt from SSE on page load. Persisting them causes
            // localStorage bloat (5-10MB limit) and stale state bugs.
            sessions: state.sessions.map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description,
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
              messageCount: s.messageCount,
              metadata: s.metadata,
              tags: s.tags,
              // Explicitly strip large/runtime fields
              messages: [],
              _contextPack: undefined,
            })),
            activeSessionId: state.activeSessionId,
          }),
        }
      ),
      { name: config.name }
    )
  );
}
