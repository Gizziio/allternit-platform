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
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import {
  sessionApi,
  chatApi,
  canvasApi,
  NativeAgentApiError,
  type BackendSession,
  type BackendMessage,
  type AgentContext,
} from './native-agent-api';
import { useAgentStore } from './agent.store';
import type { HarnessConfig } from './agent.types';
import { subscribeSSE } from '../sse/global-sse-manager';
import { createModuleLogger } from '@/lib/logger';
import { emitArtifact } from '@/lib/canvas/canvas-artifact-events';
import type { ArtifactUIPart } from '@/lib/ai/ui-parts.types';
import type { AgentArtifactKind, CanonicalAgentModeId } from './agent-mode-contracts';
import { getAgentModeContract, validateAgentModeExecution } from './agent-mode-contracts';
import { executeAgentMode } from './agent-mode-executor';
import { gizziBaseUrl } from './api-config';

const logger = createModuleLogger('ModeSessionStore');
import type {
  ContextPackOptions,
} from './agent-context-pack';

// ============================================================================
// Types
// ============================================================================

type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

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
    [key: string]: unknown;
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
    resumedFrom?: string;
    // Context pack hash for caching
    contextHash?: string;
    // Last context refresh
    contextRefreshedAt?: string;
    agentFeatures?: {
      workspace?: boolean;
      tools?: boolean;
      automation?: boolean;
    };
    agentModeId?: CanonicalAgentModeId;
    agentModeLabel?: string;
    templateTitle?: string;
    artifactKind?: AgentArtifactKind;
    requiredCapabilities?: string[];
    requiredEvidence?: string[];
    executionStatus?: 'pending' | 'running' | 'complete' | 'blocked' | 'invalid';
    validationErrors?: string[];
    isolation?: 'worktree' | 'none';
    codePermissionMode?: 'default' | 'acceptEdits' | 'plan';
    gizziPermissionModeApplied?: 'default' | 'acceptEdits' | 'plan';
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
  systemPrompt?: string;
  isolation?: 'worktree' | 'none';
  metadata?: Record<string, unknown>;
}

export interface SendMessageOptions {
  text: string;
  modelId?: string;       // e.g. "claude-cli::claude-sonnet-4-6" or "claude-sonnet-4-6"
  skipContext?: boolean;  // For internal messages
  /** @-mentioned plugin/connector this message targets (from the composer chip). */
  pluginMention?: { kind: 'plugin' | 'connector'; id: string; name: string };
  callbacks?: {
    onChunk?: (content: string) => void;
    onThinking?: (thinking: string) => void;
    onToolCall?: (toolCall: unknown) => void;
    onToolResult?: (toolResult: unknown) => void;
    onToolError?: (toolError: unknown) => void;
    onArtifact?: (artifact: ArtifactUIPart) => void;
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

type SessionApi = typeof sessionApi;
type ChatApi = typeof chatApi;

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
      ...metadata,
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
      isolation: metadata.isolation,
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

export async function persistArtifactToCanvas(
  sessionId: string,
  artifact: ArtifactUIPart,
  artifactCanvasIds: Map<string, string>,
): Promise<void> {
  if (!isBackendSessionId(sessionId)) return;

  const component = {
    type: 'artifact',
    artifactId: artifact.artifactId,
    kind: artifact.kind,
    title: artifact.title,
    content: artifact.content,
    url: artifact.url,
  };

  try {
    const existingCanvasId = artifactCanvasIds.get(artifact.artifactId);
    if (existingCanvasId) {
      await canvasApi.updateCanvas(existingCanvasId, {
        title: artifact.title,
        components: [component],
      });
    } else {
      const canvas = await canvasApi.createCanvas(sessionId, {
        title: artifact.title,
        components: [component],
        metadata: { artifactId: artifact.artifactId, kind: artifact.kind },
      });
      artifactCanvasIds.set(artifact.artifactId, canvas.id);
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to persist artifact to canvas');
  }
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

function invalidateAllContextPacks(): void {
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
          logger.debug(`Using cached context pack for agent ${agentId}`);
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
    logger.warn(`No workspace found for agent ${agentId}`);
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
  
  logger.debug(`Executing startup tasks for session ${session.id}`);
  
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
          logger.debug(`Permission request for ${agentId}: ${action}`);
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
        logger.debug(`Permission request for: ${action}`);
        return true;
      },
    });
    
    // Record results in cowork
    for (const result of results) {
      coworkIntegration.recordExecution(session.metadata.agentId, result.taskId, result);
    }
    
    // Log results
    const succeeded = results.filter(r => r.success).length;
    logger.debug(`Startup tasks completed: ${succeeded}/${results.length} succeeded`);
    
  } catch (error) {
    logger.error({ err: error }, `Failed to execute startup tasks:`);
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
  options: SendMessageOptions,
  sessionApi: SessionApi,
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
 * Resolve the provider/model string the kernel expects (`provider/modelId`).
 * Reads the composer's persisted model selection; falls back to the embedded
 * local model (sidecar, no API key required) so offline sends always work.
 */
const MODEL_SELECTION_STORAGE_KEY = 'allternit:model-selection';
const EMBEDDED_FALLBACK_MODEL_ID = 'sidecar/qwen3.5:4b';

function resolveRuntimeModelId(): string {
  try {
    const raw = typeof window !== 'undefined'
      ? window.localStorage.getItem(MODEL_SELECTION_STORAGE_KEY)
      : null;
    if (raw) {
      const parsed = JSON.parse(raw) as { providerId?: string; modelId?: string } | null;
      if (parsed?.providerId && parsed?.modelId) {
        return `${parsed.providerId}/${parsed.modelId}`;
      }
    }
  } catch { /* malformed or unavailable storage */ }
  return EMBEDDED_FALLBACK_MODEL_ID;
}

/**
 * Stream message with full context pack
 */
async function streamMessageWithContext(
  session: ModeSession,
  options: SendMessageOptions,
  signal: AbortSignal | undefined,
  chatApi: ChatApi,
): Promise<void> {
  const { text, skipContext, callbacks } = options;
  // The kernel splits runtimeModelId into provider/model — sending nothing
  // makes gizzi reject with ProviderModelNotFoundError and the bridge returns
  // an empty 200, so the message vanishes. Always resolve a model: explicit
  // option → persisted composer selection → embedded local fallback.
  const modelId = options.modelId ?? resolveRuntimeModelId();

  if (
    session.metadata.executionPersistence === 'local' &&
    session.metadata.originSurface === 'code' &&
    modelId
  ) {
    await streamLocalCodeMessageThroughGizzi(session, text, modelId, callbacks, signal);
    return;
  }

  if (!skipContext && session.metadata.agentModeId) {
    try {
      await executeAgentMode(session.metadata.agentModeId, text, session.metadata.templateTitle, {
        onChunk: (content) => callbacks?.onChunk?.(content),
        onToolCall: (event) => callbacks?.onToolCall?.(event),
        onToolResult: (event) => callbacks?.onToolResult?.(event),
        onArtifact: (artifact) => callbacks?.onArtifact?.(artifact),
      }, signal);
      callbacks?.onDone?.();
    } catch (error) {
      callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
    return;
  }
  
  // Build context pack if agent mode
  let agentContext: AgentContext | undefined;
  if (!skipContext && session.metadata.sessionMode === 'agent') {
    const contextPack = session._contextPack || await buildContextPackForSession(session);
    if (contextPack) {
      session._contextPack = contextPack;
      // Look up agent runtime/harness config
      const agent = session.metadata.agentId
        ? useAgentStore.getState().agents.find((a) => a.id === session.metadata.agentId)
        : undefined;
      // Convert to API context format
      agentContext = {
        agentId: contextPack.agentId,
        agentName: contextPack.agentName || agent?.name,
        agentProvider: agent?.provider,
        agentModel: agent?.model,
        harness: agent?.harness,
        systemPrompt: [contextPack.systemPrompt, session.metadata.systemPrompt]
          .filter(Boolean)
          .join('\n\n'),
        agentModeId: session.metadata.agentModeId,
        artifactKind: session.metadata.artifactKind,
        templateTitle: session.metadata.templateTitle,
        requiredCapabilities: session.metadata.requiredCapabilities,
        requiredEvidence: session.metadata.requiredEvidence,
        identityContext: {
          trustTiers: contextPack.trustTiers as unknown as string[],
          agentName: contextPack.agentName,
        },
        governanceContext: {
          workspaceFiles: contextPack.workspaceFiles,
        },
      };
    } else if (session.metadata.systemPrompt) {
      // Session has a custom system prompt but no agent workspace (e.g. Studio mode)
      agentContext = {
        systemPrompt: session.metadata.systemPrompt as string,
      };
    }
  }

  // A plugin/connector @-mention rides along with the message, even for
  // regular (non-agent) sessions — AgentContext is spread verbatim into the
  // POST body by chatApi.streamChat.
  if (!skipContext && options.pluginMention) {
    const mentionNote = `The user explicitly invoked the "${options.pluginMention.name}" ${options.pluginMention.kind} for this message.`;
    agentContext = {
      ...(agentContext ?? {}),
      pluginId: options.pluginMention.id,
      pluginKind: options.pluginMention.kind,
      pluginName: options.pluginMention.name,
      systemPrompt: agentContext?.systemPrompt
        ? `${agentContext.systemPrompt}\n\n${mentionNote}`
        : mentionNote,
    };
  }
  
  // Use chat API with context
  await chatApi.streamChat(
    session.id,
    text,
    modelId,
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
      onArtifact: (artifact) => {
        callbacks?.onArtifact?.(artifact);
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

async function streamLocalCodeMessageThroughGizzi(
  session: ModeSession,
  text: string,
  modelId: string,
  callbacks: SendMessageOptions['callbacks'],
  signal?: AbortSignal,
): Promise<void> {
  const sidecar = typeof window !== 'undefined' ? window.allternitSidecar : undefined;
  const apiUrl = sidecar && typeof sidecar.getApiUrl === 'function'
    ? await sidecar.getApiUrl()
    : undefined;
  // In the Electron shell the sidecar returns a credential-brokering custom
  // protocol URL (allternit-gizzi://runtime). Outside Electron, or when the
  // sidecar has not brokered a runtime, fall back to the direct loopback URL.
  const base = (apiUrl || gizziBaseUrl()).replace(/\/$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let gizziSessionId = typeof session.metadata.gizziSessionId === 'string'
    ? session.metadata.gizziSessionId
    : null;
  const permissionMode = session.metadata.codePermissionMode ?? 'default';
  const permission = codePermissionRules(permissionMode);

  if (!gizziSessionId) {
    const createResponse = await fetch(`${base}/v1/session`, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({ title: session.name, surface: 'code', permission }),
    });
    if (!createResponse.ok) throw new Error(`Gizzi session creation failed (${createResponse.status})`);
    const created = await createResponse.json() as { id?: string };
    if (!created.id) throw new Error('Gizzi runtime did not return a session ID');
    gizziSessionId = created.id;
    session.metadata.gizziSessionId = created.id;
    session.metadata.gizziPermissionModeApplied = permissionMode;
  } else if (session.metadata.gizziPermissionModeApplied !== permissionMode) {
    const permissionResponse = await fetch(`${base}/v1/session/${encodeURIComponent(gizziSessionId)}`, {
      method: 'PATCH',
      headers,
      signal,
      body: JSON.stringify({ permission }),
    });
    if (!permissionResponse.ok) {
      throw new Error(`Gizzi permission update failed (${permissionResponse.status})`);
    }
    session.metadata.gizziPermissionModeApplied = permissionMode;
  }

  const separator = modelId.indexOf('/');
  const providerID = separator > 0 ? modelId.slice(0, separator) : 'opencode';
  const runtimeModelID = separator > 0 ? modelId.slice(separator + 1) : modelId;
  const response = await fetch(`${base}/v1/session/${encodeURIComponent(gizziSessionId)}/message`, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      sessionID: gizziSessionId,
      parts: [{ type: 'text', text }],
      model: { providerID, modelID: runtimeModelID },
    }),
  });
  if (!response.ok) throw new Error(`Gizzi model request failed (${response.status})`);
  const message = await response.json() as { parts?: Array<{ type?: string; text?: string }> };
  const content = (message.parts ?? [])
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n')
    .trim();
  if (content) callbacks?.onChunk?.(content);
  callbacks?.onDone?.();
}

function codePermissionRules(mode: 'default' | 'acceptEdits' | 'plan') {
  const allow = (permission: string) => ({ permission, pattern: '*', action: 'allow' as const });
  const readPermissions = ['read', 'glob', 'grep', 'list', 'websearch', 'codesearch', 'question', 'todoread', 'lsp'];

  if (mode === 'default') return [];
  if (mode === 'acceptEdits') {
    return [
      ...readPermissions.map(allow),
      ...['edit', 'write', 'patch', 'multiedit'].map(allow),
    ];
  }

  return [
    { permission: '*', pattern: '*', action: 'deny' as const },
    ...readPermissions.map(allow),
  ];
}

// ============================================================================
// Store Factory
// ============================================================================

interface StoreConfig {
  name: string;
  storageKey: string;
  originSurface: 'chat' | 'cowork' | 'code' | 'browser' | 'design';
  sessionApi?: SessionApi;
  chatApi?: ChatApi;
}

interface StreamingSessionState {
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

  // Canvas persistence
  createCanvas: (
    sessionId: string,
    options?: {
      title?: string;
      components?: unknown[];
      layout?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ) => Promise<string>;
  updateCanvas: (
    canvasId: string,
    options: {
      title?: string;
      components?: unknown[];
      layout?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    },
  ) => Promise<void>;

  // Agent mode integration
  appendOptimisticEvent: (sessionId: string, event: unknown) => void;
  appendAssistantMessage: (sessionId: string, message: { id: string; content: string; metadata?: Record<string, unknown> }) => void;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ModeSessionMessage>) => void;
}

export function createModeSessionStore(config: StoreConfig) {
  const sessionApiClient = config.sessionApi ?? sessionApi;
  const chatApiClient = config.chatApi ?? chatApi;
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
                ...options.metadata,
                originSurface: config.originSurface,
                sessionMode: options.sessionMode || 'regular',
                agentId: options.agentId,
                agentName: options.agentName,
                projectId: options.projectId,
                taskId: options.taskId,
                workspaceId: options.workspaceId,
                workspaceFiles: options.workspaceFiles,
                systemPrompt: options.systemPrompt,
                isolation: options.isolation,
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
                  logger.debug(`[${config.name}] Loaded workspace for agent ${options.agentId}: ${workspace?.files.length || 0} files`);
                } catch (err) {
                  logger.error({ err }, `[${config.name}] Failed to load workspace`);
                }
              }

              // Build system prompt from workspace
              const workspaceSystemPrompt = workspace ? buildSystemPrompt(workspace) : undefined;
              const systemPrompt = [workspaceSystemPrompt, options.systemPrompt]
                .filter(Boolean)
                .join('\n\n') || undefined;

              // Create backend session
              const backendSession = await sessionApiClient.createSession({
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
                  isolation: options.isolation,
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
                      logger.debug(`Auto-refreshing context for session ${s.id}`);
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
              const localModeId = typeof options.metadata?.agentModeId === 'string'
                ? options.metadata.agentModeId
                : config.originSurface === 'code'
                  ? 'code'
                  : null;
              const canRunLocally = Boolean(localModeId) && (
                options.sessionMode === 'agent' || config.originSurface === 'code'
              );
              if (canRunLocally) {
                logger.warn({ err: error }, `[${config.name}] Backend session unavailable; running built-in mode locally`);
                set((state) => ({
                  error: null,
                  isLoading: false,
                  sessions: state.sessions.map((session) =>
                    session.id === optimisticId
                      ? {
                          ...session,
                          metadata: {
                            ...session.metadata,
                            agentModeId: localModeId as CanonicalAgentModeId,
                            executionPersistence: 'local',
                          },
                        }
                      : session
                  ),
                  activeSessionId: optimisticId,
                }));
                return optimisticId;
              }
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
              await sessionApiClient.deleteSession(sessionId);
            } catch (error) {
              logger.error({ err: error }, `Failed to delete session ${sessionId} from backend:`);
            }
          },

          updateSession: async (sessionId: string, updates: Partial<ModeSession>) => {
            const currentSession = get().sessions.find((session) => session.id === sessionId);
            set((state) => ({
              sessions: state.sessions.map((session) =>
                session.id === sessionId
                  ? {
                      ...session,
                      ...updates,
                      metadata: updates.metadata
                        ? { ...session.metadata, ...updates.metadata }
                        : session.metadata,
                    }
                  : session
              ),
            }));

            // A session retained after backend creation failed intentionally
            // lives in the persisted Zustand store. Its metadata must remain
            // editable without retrying an API call that cannot succeed.
            if (!isBackendSessionId(sessionId) || currentSession?.metadata.executionPersistence === 'local') {
              return;
            }

            try {
              const backendSession = await sessionApi.updateSession(sessionId, {
                name: updates.name,
                description: updates.description,
                active: updates.isActive,
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
                  ? { ...s, messages: [...s.messages, userMessage], messageCount: s.messageCount + 1 }
                  : s
              ),
            }));

            try {
              await sendMessageWithContext(session, options, sessionApiClient);
              
              // Reload messages
              const backendMessages = await sessionApiClient.listMessages(sessionId);
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
            const isLocalModeSession = session.metadata.executionPersistence === 'local'
              && Boolean(session.metadata.agentModeId);
            if (!isBackendSessionId(sessionId) && !isLocalModeSession) {
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
              ...(options.pluginMention
                ? { metadata: { pluginMention: options.pluginMention } }
                : {}),
            };

            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? { ...s, messages: [...s.messages, userMessage], messageCount: s.messageCount + 1 }
                  : s
              ),
            }));

            // Accumulate assistant response
            let assistantContent = '';
            let reasoningContent = '';
            let assistantToolParts: Array<Record<string, unknown>> = [];
            const assistantMessageId = `assistant-${Date.now()}`;
            const artifactCanvasIds = new Map<string, string>();
            let emittedArtifactCount = 0;
            const executedToolNames = new Set<string>();

            // Add placeholder assistant message IMMEDIATELY so React renders it
            // while isStreaming=true. Without this, when the backend responds in a
            // single chunk, all set() calls land in one React render with
            // isStreaming=false, causing StreamingChatComposer to mount with
            // isActivelyStreaming=false and show the full text as a blob.
            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === sessionId
                  ? { ...s, messages: [...s.messages, {
                      id: assistantMessageId,
                      role: 'assistant' as const,
                      content: '',
                      timestamp: new Date().toISOString(),
                    }] }
                  : s
              ),
            }));

            // Yield so React processes isStreaming=true + the placeholder render
            // before any streaming chunks arrive and mutate the message content.
            await new Promise<void>((resolve) => setTimeout(resolve, 0));

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
                    const toolName = (toolCall as { toolName?: string } | undefined)?.toolName;
                    if (toolName) executedToolNames.add(toolName);
                    deltaBuffer.push({ type: 'toolCall', toolCall });
                    scheduleDeltaFlush();
                    options.callbacks?.onToolCall?.(toolCall);
                  },
                  onToolResult: (toolResult) => {
                    deltaBuffer.push({ type: 'toolResult', toolResult });
                    scheduleDeltaFlush();

                    // Generate-web-artifact tools emit a real ArtifactUIPart so the
                    // canvas view can render them without requiring a backend artifact
                    // event. This mirrors the behavior in rust-stream-adapter.ts.
                    const tr = toolResult as { toolName?: string; result?: unknown } | undefined;
                    if (tr?.toolName === 'generateWebArtifact' && tr.result && typeof tr.result === 'object') {
                      const r = tr.result as { content?: string; kind?: string; title?: string };
                      if (r.content) {
                        emittedArtifactCount += 1;
                        const artifact: ArtifactUIPart = {
                          type: 'artifact',
                          artifactId: `artifact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          kind: (r.kind ?? 'html') as ArtifactUIPart['kind'],
                          content: r.content,
                          title: r.title ?? 'Generated Artifact',
                        };
                        void persistArtifactToCanvas(sessionId, artifact, artifactCanvasIds);
                        emitArtifact(sessionId, artifact);
                        options.callbacks?.onArtifact?.(artifact);
                      }
                    }
                  },
                  onToolError: (toolError) => {
                    deltaBuffer.push({ type: 'toolError', toolError });
                    scheduleDeltaFlush();
                  },
                  onArtifact: (artifact) => {
                    emittedArtifactCount += 1;
                    // Persist artifact to backend canvas so it survives reloads
                    // and can be reopened from any surface.
                    void persistArtifactToCanvas(sessionId, artifact, artifactCanvasIds);
                    // Broadcast to any open AllternitCanvasView for the same session.
                    emitArtifact(sessionId, artifact);
                    options.callbacks?.onArtifact?.(artifact);
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
                    const contract = session.metadata.sessionMode === 'agent'
                      ? getAgentModeContract(session.metadata.agentModeId)
                      : null;
                    const validation = contract
                      ? validateAgentModeExecution(contract, {
                          content: assistantContent,
                          toolNames: [...executedToolNames],
                          artifactCount: emittedArtifactCount,
                        })
                      : null;
                    const validationNotice = validation?.status === 'invalid'
                      ? `\n\nMODE_EXECUTION_INVALID\n${validation.errors.map((error) => `- ${error}`).join('\n')}`
                      : '';

                    set((state) => ({
                      streamingBySession: {
                        ...state.streamingBySession,
                        [sessionId]: { isStreaming: false, error: null, abortController: null },
                      },
                      sessions: state.sessions.map((s) =>
                        s.id === sessionId
                          ? {
                              ...s,
                              messageCount: s.messageCount + 1,
                              messages: validationNotice
                                ? s.messages.map((message) =>
                                    message.id === assistantMessageId
                                      ? { ...message, content: `${message.content}${validationNotice}` }
                                      : message
                                  )
                                : s.messages,
                              metadata: validation
                                ? {
                                    ...s.metadata,
                                    executionStatus: validation.status,
                                    validationErrors: validation.errors,
                                  }
                                : s.metadata,
                            }
                          : s
                      ),
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
              await streamMessageWithContext(session, wrappedOptions, abortController.signal, chatApiClient);
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
              logger.warn({ err }, `Failed to abort generation on backend:`);
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
                sessions: state.sessions.map((s) => {
                  if (s.id !== sessionId) return s;
                  // Never drop local messages when the backend is behind — e.g.
                  // while a stream is in flight the optimistic user/assistant
                  // messages exist only locally, and clobbering them unmounts the
                  // thread. The backend wins once it has caught up.
                  if (messages.length < s.messages.length) {
                    const localIds = new Set(s.messages.map((m) => m.id));
                    const missing = messages.filter((m) => !localIds.has(m.id));
                    return missing.length
                      ? { ...s, messages: [...missing, ...s.messages] }
                      : s;
                  }
                  return { ...s, messages };
                }),
              }));
            } catch (error) {
              logger.error({ err: error }, `[${config.name}] Failed to fetch messages`);
            }
          },

          fetchSessionCanvases: async (sessionId: string) => {
            if (!isBackendSessionId(sessionId)) return;

            // Extract artifact IDs from all messages in this session
            const session = get().sessions.find(s => s.id === sessionId);
            const messageCanvasIds: string[] = [];
            if (session) {
              for (const msg of session.messages) {
                try {
                  const meta = typeof msg.metadata === 'object' && msg.metadata ? msg.metadata as Record<string, unknown> : {};
                  if (meta.artifactId && typeof meta.artifactId === 'string') {
                    messageCanvasIds.push(meta.artifactId);
                  }
                  if (msg.content?.includes('"kind":"artifact"')) {
                    const matches = msg.content.match(/"artifactId":"([^"]+)"/g) ?? [];
                    matches.forEach(m => {
                      const id = m.match(/"artifactId":"([^"]+)"/)?.[1];
                      if (id) messageCanvasIds.push(id);
                    });
                  }
                } catch { /* ignore parse errors */ }
              }
            }

            // Merge with persisted canvases from the backend
            try {
              const backendCanvases = await canvasApi.listCanvases(sessionId);
              const backendIds = backendCanvases.map((c) => c.id);
              const unique = [...new Set([...messageCanvasIds, ...backendIds])];
              set((state) => ({
                sessionCanvases: { ...state.sessionCanvases, [sessionId]: unique },
              }));
            } catch (error) {
              logger.error({ err: error }, `[${config.name}] Failed to fetch canvases`);
              // Fall back to message-extracted IDs
              const unique = [...new Set(messageCanvasIds)];
              if (unique.length > 0) {
                set((state) => ({
                  sessionCanvases: { ...state.sessionCanvases, [sessionId]: unique },
                }));
              }
            }
          },

          createCanvas: async (sessionId, options = {}) => {
            if (!isBackendSessionId(sessionId)) {
              throw new Error(`Cannot create a canvas before a live session exists: ${sessionId}`);
            }
            const canvas = await canvasApi.createCanvas(sessionId, options);
            set((state) => ({
              sessionCanvases: {
                ...state.sessionCanvases,
                [sessionId]: [...new Set([...(state.sessionCanvases[sessionId] ?? []), canvas.id])],
              },
            }));
            return canvas.id;
          },

          updateCanvas: async (canvasId, options) => {
            await canvasApi.updateCanvas(canvasId, options);
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
              const currentSessions = get().sessions;

              const sessions = backendSessions
                .filter((s) => {
                  const metadata = s.metadata as ModeSession['metadata'] | undefined;
                  return metadata?.originSurface === config.originSurface;
                })
                .map((backend) => {
                  const mapped = mapBackendSession(backend);
                  const local = currentSessions.find((s) => s.id === mapped.id);
                  if (local) {
                    // Preserve locally streamed messages and context that the
                    // backend list endpoint does not return.
                    mapped.messages = local.messages.length > 0 ? local.messages : mapped.messages;
                    mapped._contextPack = local._contextPack ?? mapped._contextPack;
                  }
                  return mapped;
                });

              // Rebuild context packs for agent sessions
              for (const session of sessions) {
                if (session.metadata.sessionMode === 'agent') {
                  session._contextPack = await buildContextPackForSession(session) ?? undefined;
                }
              }

              const currentActiveId = get().activeSessionId;
              // Merge in-memory sessions that aren't in the backend list yet (e.g. newly created optimistic sessions)
              const inMemoryOnly = currentSessions.filter(s => !sessions.some(bs => bs.id === s.id));
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
              logger.error({ err: error }, 'Failed to refresh context');
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
	              void sessionApi.listSessions()
	                .then(() => {
	                  if (cancelled) return;
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
	                })
	                .catch((error) => {
	                  unsubscribe?.();
	                  unsubscribe = null;
	                  if (error instanceof NativeAgentApiError && error.isAuthError()) {
	                    set({
	                      isSyncConnected: false,
	                      syncError: 'Agent session sync unavailable until you sign in.',
	                    });
	                    return;
	                  }
	                  set({ isSyncConnected: false, syncError: 'Sync unavailable — retrying…' });
	                  if (!cancelled) {
	                    setTimeout(() => {
	                      retryDelay = Math.min(retryDelay * 1.5, MAX_RETRY_DELAY);
	                      connect();
	                    }, retryDelay);
	                  }
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
          storage: createBrowserJSONStorage(),
          partialize: (state) => ({
            // Only persist session metadata, NOT messages or streaming state.
            // Messages are rebuilt from SSE on page load. Persisting them causes
            // localStorage bloat (5-10MB limit) and stale state bugs.
            // Never persist optimistic temp sessions — if the backend create fails
            // or the tab reloads mid-create, they would linger as zombie rows.
            // Local-only sessions retained after backend failure are the exception:
            // they must survive reloads and detached windows.
            sessions: state.sessions
              .filter((s) => !s.id.startsWith('temp-') || s.metadata.executionPersistence === 'local')
              .map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
                messageCount: s.messageCount,
                metadata: s.metadata,
                tags: s.tags,
                // Explicitly strip large/runtime fields for backend-synced sessions.
                // Local-only sessions retain messages because they cannot be rebuilt
                // from a backend and must render correctly in detached windows.
                messages: s.metadata.executionPersistence === 'local' ? s.messages : [],
                _contextPack: undefined,
              })),
            activeSessionId: (() => {
              if (!state.activeSessionId?.startsWith('temp-')) return state.activeSessionId;
              const active = state.sessions.find((s) => s.id === state.activeSessionId);
              return active?.metadata.executionPersistence === 'local' ? state.activeSessionId : null;
            })(),
          }),
          // Sweep any zombie temp sessions persisted by older builds.
          onRehydrateStorage: () => (state) => {
            if (!state) return;
            state.sessions = state.sessions.filter((s) => !s.id.startsWith('temp-') || s.metadata.executionPersistence === 'local');
            if (state.activeSessionId?.startsWith('temp-')) {
              const active = state.sessions.find((s) => s.id === state.activeSessionId);
              if (!active) state.activeSessionId = null;
            }
          },
        }
      ),
      { name: config.name }
    )
  );
}
