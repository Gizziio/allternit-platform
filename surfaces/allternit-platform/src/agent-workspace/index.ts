/**
 * Agent Workspace API
 * 
 * Main entry point for workspace operations.
 * Uses real backends only - no mocks:
 * 1. HTTP API (via sidecar or external server like TUI)
 * 2. WASM (in-browser using allternit-agent-workspace crate)
 * 
 * Pattern ported from agent-shell integration guide.
 */

import { discoverServer } from './discovery';
import { createHttpWorkspace, HttpWorkspaceAPI } from './http-client';
import { createWasmWorkspace, WasmWorkspaceAPI } from './wasm-wrapper';
import type { AllternitNativeState } from './types';

export enum Backend {
  HTTP = 'http',
  WASM = 'wasm',
}

export interface WorkspaceAPI {
  /** Backend type being used */
  backend: Backend;
  
  /** Server URL (for HTTP backend) */
  serverUrl?: string;
  
  /** Workspace path */
  path: string;
  
  // Workspace operations
  getInfo: () => Promise<WorkspaceInfo>;
  boot: () => Promise<void>;
  sync: () => Promise<void>;
  
  // Brain (Task Graph)
  listTasks: () => Promise<Task[]>;
  getTask: (id: string) => Promise<Task | null>;
  createTask: (task: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  getTaskGraph: () => Promise<TaskGraph>;
  
  // Memory
  listMemoryEntries: () => Promise<MemoryEntry[]>;
  getMemoryEntry: (id: string) => Promise<MemoryEntry | null>;
  createMemoryEntry: (entry: CreateMemoryInput) => Promise<MemoryEntry>;
  searchMemory: (query: string) => Promise<MemoryEntry[]>;
  
  // Policy
  listPolicyRules: () => Promise<PolicyRule[]>;
  checkPolicy: (action: string, params: Record<string, unknown>) => Promise<PolicyDecision>;
  
  // Skills
  listSkills: () => Promise<Skill[]>;
  installSkill: (id: string) => Promise<void>;
  uninstallSkill: (id: string) => Promise<void>;
  
  // Identity
  getIdentity: () => Promise<Identity>;
  updateIdentity: (identity: Partial<Identity>) => Promise<Identity>;
  
  // Connection
  isConnected: () => boolean;
  reconnect: () => Promise<boolean>;

  // Allternit Native state (optional — not available on all backends)
  allternitNative?: {
    getState(): Promise<AllternitNativeState>;
    refreshState(): Promise<AllternitNativeState>;
  };
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  version: string;
  isBooted: boolean;
  lastSyncAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  dependencies?: string[];
}

export interface TaskGraph {
  tasks: Task[];
  edges: Array<{ from: string; to: string }>;
}

export interface MemoryEntry {
  id: string;
  type: 'note' | 'event' | 'observation' | 'decision' | 'lesson' | 'preference' | 'fact';
  content: string;
  tags: string[];
  timestamp: string;
}

export interface CreateMemoryInput {
  type: MemoryEntry['type'];
  content: string;
  tags?: string[];
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: 'allow' | 'deny' | 'require_approval';
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  installed: boolean;
  category?: string;
  tags?: string[];
  author?: string;
  entryPoint?: string;
  dependencies?: string[];
  documentation?: string;
}

export interface Identity {
  name: string;
  role: string;
  capabilities: string[];
  soul?: {
    values: string[];
    personality: string;
  };
}

export interface CreateWorkspaceOptions {
  /** Preferred backend (defaults to auto-selection) */
  backend?: Backend;
  /** Force HTTP even if server not immediately available */
  preferHttp?: boolean;
  /** Server URL (skip auto-discovery) */
  serverUrl?: string;
  /** Auth credentials for HTTP backend */
  auth?: {
    username: string;
    password: string;
  };
  /** Timeout for auto-discovery */
  discoveryTimeout?: number;
}

/**
 * Create a workspace API instance
 * 
 * Automatically selects the best available backend:
 * 1. HTTP - Full functionality via API server (TUI, sidecar, etc.)
 * 2. WASM - In-browser functionality using allternit-agent-workspace
 * 
 * @param path - Workspace path
 * @param options - Creation options
 * @returns Workspace API instance
 * @throws Error if no suitable backend available
 */
export async function createWorkspace(
  path: string,
  options: CreateWorkspaceOptions = {}
): Promise<WorkspaceAPI> {
  const {
    backend: preferredBackend,
    preferHttp = true,
    serverUrl: manualServerUrl,
    auth: manualAuth,
    discoveryTimeout = 10000,
  } = options;

  console.log('[Workspace] Creating workspace for path:', path);

  // Strategy 1: Manual server URL provided
  if (manualServerUrl) {
    console.log('[Workspace] Using manual server URL:', manualServerUrl);
    return createHttpWorkspace(path, manualServerUrl, manualAuth);
  }

  // Strategy 2: HTTP preferred - try to discover server
  if (preferHttp && preferredBackend !== Backend.WASM) {
    console.log('[Workspace] Attempting HTTP backend...');
    
    const server = await discoverServer({ timeout: discoveryTimeout });
    
    if (server) {
      console.log('[Workspace] Using HTTP backend:', server.url);
      return createHttpWorkspace(path, server.url, server.password ? {
        username: server.username || 'allternit',
        password: server.password,
      } : undefined);
    }
    
    console.log('[Workspace] No HTTP server available');
  }

  // Strategy 3: WASM backend
  console.log('[Workspace] Attempting WASM backend...');
  
  try {
    const wasmWorkspace = await createWasmWorkspace(path);
    console.log('[Workspace] Using WASM backend');
    return wasmWorkspace;
  } catch (error) {
    console.error('[Workspace] WASM backend failed:', error);
    throw new Error(
      `No suitable backend available for workspace. ` +
      `HTTP discovery failed and WASM initialization error: ${error}`
    );
  }
}

/**
 * Create workspace with explicit HTTP backend
 * Connects to TUI server, sidecar, or any compatible HTTP API
 */
export async function createHttpWorkspaceExplicit(
  path: string,
  serverUrl: string,
  auth?: { username: string; password: string }
): Promise<HttpWorkspaceAPI> {
  return createHttpWorkspace(path, serverUrl, auth);
}

/**
 * Create workspace with explicit WASM backend
 * Uses the allternit-agent-workspace WASM module
 */
export async function createWasmWorkspaceExplicit(
  path: string
): Promise<WasmWorkspaceAPI> {
  return createWasmWorkspace(path);
}

// Re-exports
export { discoverServer } from './discovery';
export type { DiscoveredServer } from './discovery';
export { healthCheck, getHealthStatus, pollUntilHealthy } from './health';
export { createHttpWorkspace } from './http-client';
export type { HttpWorkspaceAPI } from './http-client';
export { createWasmWorkspace } from './wasm-wrapper';
export type { WasmWorkspaceAPI } from './wasm-wrapper';
export { WorkspaceWebSocket, createWebSocketUrl } from './websocket';
export { useWorkspaceWebSocket } from './useWorkspaceWebSocket';
export { useAllternitStream } from './useAllternitStream';

// Types from types.ts that aren't already declared in this file
export type { AllternitNativeState, BootEvent, ContextSummary, FileOperation, ICheckpoint, ICheckpointManager, IPolicyEngine, ISkillsRegistry, IWorkspace, IWorkspaceAPI, IdentityConfig, MemoryEntryType, PolicyAction, PolicyCheckResult, PolicyTier, SessionStatus, SkillDefinition, TaskPriority, TaskStatus, ToolPolicy, WorkspaceLayers, WorkspaceMetadata } from './types';

export default createWorkspace;
