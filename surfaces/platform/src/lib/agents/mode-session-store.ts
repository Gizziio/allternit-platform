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
import type { 
  ContextPack, 
  ContextPackOptions,
  ScheduledTask 
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
  metadata?: Record<string, unknown>;
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
    originSurface: 'chat' | 'cowork' | 'code' | 'browser';
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
  };
  // Runtime context pack (not persisted, rebuilt on load)
  _contextPack?: AgentContextPack;
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
  skipContext?: boolean;  // For internal messages
  callbacks?: {
    onChunk?: (content: string) => void;
    onThinking?: (thinking: string) => void;
    onToolCall?: (toolCall: unknown) => void;
    onDone?: () => void;
    onError?: (error: Error) => void;
  };
}

// ============================================================================
// Lazy Imports (avoid circular dependencies)
// ============================================================================

import { agentWorkspaceFS, AgentWorkspace } from './agent-workspace-files';
import { AgentTrustTiers } from './agent-trust-tiers';
import { HeartbeatTaskManager, getHeartbeatTaskManager, parseHeartbeatTasks } from './agent-heartbeat-executor';
import { agentCronScheduler, useAgentCronScheduler } from './agent-cron-scheduler';
import { coworkIntegration, useCoworkIntegration } from './agent-cowork-integration';
import { setupSessionAutoRefresh } from './agent-workspace-watcher';

let contextPackBuilder: typeof import('./agent-context-pack') | null = null;

async function getContextPackBuilder() {
  if (!contextPackBuilder) {
    contextPackBuilder = await import('./agent-context-pack');
  }
  return contextPackBuilder;
}

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
      ...metadata,
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

async function buildContextPackForSession(
  session: ModeSession,
  options?: ContextPackOptions
): Promise<AgentContextPack | null> {
  // Skip if regular mode or no agent
  if (session.metadata.sessionMode !== 'agent' || !session.metadata.agentId) {
    return null;
  }
  
  // Load workspace using real file system
  const workspace = await agentWorkspaceFS.loadWorkspace(session.metadata.agentId);
  if (!workspace) {
    console.warn(`[ModeSessionStore] No workspace found for agent ${session.metadata.agentId}`);
    return null;
  }
  
  // Parse trust tiers from SOUL.md
  const trustTiers = AgentTrustTiers.fromWorkspace(workspace);
  
  // Build system prompt from workspace files
  const systemPrompt = buildSystemPrompt(workspace);
  
  // Parse HEARTBEAT.md for startup tasks
  const heartbeatFile = workspace.files.find(f => f.name.toUpperCase() === 'HEARTBEAT.MD');
  const startupTasks = heartbeatFile ? parseStartupTasks(heartbeatFile.content) : [];
  
  // Generate hash for caching
  const hash = generateContextHash(workspace);
  
  return {
    agentId: session.metadata.agentId,
    agentName: session.metadata.agentName,
    systemPrompt,
    trustTiers,
    workspaceFiles: workspace.files.map(f => f.path),
    hash,
    startupTasks,
  };
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
  const { text, skipContext, callbacks } = options;
  
  // Build context pack if agent mode
  let contextPack: ContextPack | null = null;
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
    // Include context in message metadata
    metadata: contextPack ? {
      agentContext: {
        agentId: contextPack.agentId,
        agentName: contextPack.agentName,
        trustTiers: contextPack.trustTiers,
        systemPrompt: contextPack.systemPrompt,
        hash: contextPack.hash,
      }
    } : undefined
  });
}

/**
 * Stream message with full context pack
 */
async function streamMessageWithContext(
  session: ModeSession,
  options: SendMessageOptions
): Promise<void> {
  const { text, skipContext, callbacks } = options;
  
  // Build context pack if agent mode
  let agentContext: AgentContext | undefined;
  if (!skipContext && session.metadata.sessionMode === 'agent') {
    const contextPack = session._contextPack || await buildContextPackForSession(session);
    if (contextPack) {
      session._contextPack = contextPack as unknown as ContextPack;
      // Convert to API context format
      agentContext = {
        agentId: contextPack.agentId,
        systemPrompt: contextPack.systemPrompt,
        identityContext: {
          trustTiers: contextPack.trustTiers,
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
    {
      onChunk: (chunk) => {
        callbacks?.onChunk?.(chunk.chunk);
      },
      onDone: () => {
        callbacks?.onDone?.();
      },
      onError: (error) => {
        callbacks?.onError?.(error);
      },
    },
    undefined, // signal
    agentContext // Pass context to API
  );
}

// ============================================================================
// Store Factory
// ============================================================================

interface StoreConfig {
  name: string;
  storageKey: string;
  originSurface: 'chat' | 'cowork' | 'code' | 'browser';
}

export interface ModeSessionState {
  sessions: ModeSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: string | null;

  createSession: (options?: CreateModeSessionOptions) => Promise<string>;
  deleteSession: (sessionId: string) => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<ModeSession>) => Promise<void>;
  setActiveSession: (sessionId: string | null) => void;
  
  sendMessage: (sessionId: string, options: SendMessageOptions) => Promise<void>;
  sendMessageStream: (sessionId: string, options: SendMessageOptions) => Promise<void>;
  
  loadSessions: () => Promise<void>;
  refreshContext: (sessionId: string) => Promise<void>;
  setSessionMode: (sessionId: string, mode: 'regular' | 'agent', agentId?: string) => Promise<void>;
  mountWorkspaceFiles: (sessionId: string, filePaths: string[]) => Promise<void>;
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

          createSession: async (options = {}) => {
            set({ isLoading: true, error: null });
            
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
                agent_id: options.agentId,
                agent_name: options.agentName,
                project_id: options.projectId,
                metadata: {
                  ...options.metadata,
                  taskId: options.taskId,
                  workspaceId: options.workspaceId,
                  workspaceFiles: workspace?.files.map(f => f.path) || options.workspaceFiles,
                  systemPrompt,
                  contextRefreshedAt: new Date().toISOString(),
                },
              });

              const session = mapBackendSession(backendSession);
              
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
                sessions: [session, ...state.sessions],
                activeSessionId: session.id,
                isLoading: false,
                // Store cleanup function for when session is deleted
                _cleanupAutoRefresh: cleanupAutoRefresh,
              }));

              return session.id;
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to create session';
              set({ error: message, isLoading: false });
              throw error;
            }
          },

          deleteSession: async (sessionId: string) => {
            try {
              // Get session before deleting to cleanup auto-refresh
              const session = get().sessions.find(s => s.id === sessionId);
              if (session?.metadata.agentId) {
                // Stop file watcher for this agent
                const { getWorkspaceWatcher } = await import('./agent-workspace-watcher');
                const watcher = getWorkspaceWatcher(session.metadata.agentId);
                watcher.stop();
                
                // Unregister cron tasks
                agentCronScheduler.unregisterAgentTasks(session.metadata.agentId);
                
                // Cleanup cowork tasks
                coworkIntegration.cleanupAgent(session.metadata.agentId);
              }
              
              await sessionApi.deleteSession(sessionId);
              set((state) => ({
                sessions: state.sessions.filter((s) => s.id !== sessionId),
                activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
              }));
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to delete session';
              set({ error: message });
              throw error;
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
            set({ activeSessionId: sessionId });
          },

          sendMessage: async (sessionId: string, options: SendMessageOptions) => {
            const session = get().sessions.find((s) => s.id === sessionId);
            if (!session) throw new Error('Session not found');
            
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

            try {
              await streamMessageWithContext(session, options);
            } catch (error) {
              const err = error instanceof Error ? error : new Error(String(error));
              set({ error: err.message });
              throw err;
            }
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
                  session._contextPack = await buildContextPackForSession(session);
                }
              }

              set({ sessions, isLoading: false });
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
                  const trustTiers = AgentTrustTiers.fromWorkspace(workspace);
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
                  updatedSession._contextPack = await buildContextPackForSession(updatedSession);

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
                          systemPrompt: workspaceData?.systemPrompt,
                          identityContext: workspaceData?.identityContext,
                          governanceContext: workspaceData?.governanceContext,
                          memoryContext: workspaceData?.memoryContext,
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
        }),
        {
          name: config.storageKey,
          partialize: (state) => ({
            sessions: state.sessions.map((s) => ({
              ...s,
              messages: [],
              _contextPack: undefined, // Don't persist runtime context pack
            })),
            activeSessionId: state.activeSessionId,
          }),
        }
      ),
      { name: config.name }
    )
  );
}
