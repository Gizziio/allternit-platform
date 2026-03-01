/**
 * HTTP Client for Agent Workspace API
 * 
 * Communicates with the a2rchitech-api server (TUI/sidecar).
 * Uses Basic Auth for authentication.
 * 
 * Maps WorkspaceAPI interface to actual API endpoints:
 * - Sessions → /v1/shell_ui/session
 * - Tools → /v1/shell_ui/tool/list
 * - Config → /v1/shell_ui/config
 * - Health → /health
 */

import { WorkspaceAPI, Backend, WorkspaceInfo, Task, CreateTaskInput, TaskGraph, MemoryEntry, CreateMemoryInput, PolicyRule, PolicyDecision, Skill, Identity } from './index';

export interface HttpWorkspaceAPI extends WorkspaceAPI {
  backend: Backend.HTTP;
  serverUrl: string;
  
  /** Raw fetch with auth */
  fetch: (path: string, options?: RequestInit) => Promise<Response>;
  /** Get auth header for external use */
  getAuthHeader: () => string | undefined;
  /** Get session ID for current workspace */
  getSessionId: () => string | undefined;
}

export interface HttpClientOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retries for failed requests */
  retries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
}

export async function createHttpWorkspace(
  path: string,
  serverUrl: string,
  auth?: { username: string; password: string },
  options: HttpClientOptions = {}
): Promise<HttpWorkspaceAPI> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
  } = options;

  // Normalize server URL
  const baseUrl = serverUrl.replace(/\/$/, '');
  
  // Create auth header
  const authHeader = auth 
    ? `Basic ${btoa(`${auth.username}:${auth.password}`)}`
    : undefined;

  console.log('[HTTP Client] Creating HTTP workspace:', { path, serverUrl: baseUrl });

  // Track session ID for this workspace
  let sessionId: string | undefined;

  // Helper for authenticated fetch with retries
  async function authFetch(
    path: string, 
    fetchOptions: RequestInit = {},
    attempt: number = 1
  ): Promise<Response> {
    const url = `${baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry on network errors or 5xx responses
      if (attempt < retries) {
        const isRetryable = error instanceof TypeError || // Network error
          (error instanceof Error && error.message.startsWith('HTTP 5'));
        
        if (isRetryable) {
          console.log(`[HTTP Client] Retry ${attempt}/${retries} for ${path}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          return authFetch(path, fetchOptions, attempt + 1);
        }
      }

      throw error;
    }
  }

  // Helper for JSON responses
  async function jsonFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await authFetch(path, options);
    return response.json();
  }

  // Helper to create a session for this workspace
  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId;
    
    const result = await jsonFetch<{ session_id: string }>('/v1/shell_ui/session', {
      method: 'POST',
      body: JSON.stringify({
        project_path: path,
        mode: 'workspace',
      }),
    });
    
    sessionId = result.session_id;
    return sessionId;
  }

  return {
    backend: Backend.HTTP,
    serverUrl: baseUrl,
    path,

    // Raw fetch for advanced use
    fetch: (path: string, options?: RequestInit) => authFetch(path, options),
    
    // Auth header getter
    getAuthHeader: () => authHeader,

    // Session ID getter
    getSessionId: () => sessionId,

    // Workspace operations - map to sessions
    getInfo: async () => {
      const sid = await ensureSession();
      const session = await jsonFetch<{
        session_id: string;
        project_path: string;
        status: string;
        created_at: string;
      }>(`/v1/shell_ui/session/${sid}`);
      
      return {
        id: session.session_id,
        name: path.split('/').pop() || 'Workspace',
        path: session.project_path,
        version: '1.0.0',
        isBooted: session.status === 'active',
        lastSyncAt: session.created_at,
      };
    },
    
    boot: async () => {
      await ensureSession();
      // Session creation is the boot process
    },
    
    sync: async () => {
      // Sync is implicit in HTTP model
      console.log('[HTTP Client] Sync called (no-op for HTTP backend)');
    },

    // Brain (Task Graph) - mapped to session todos
    listTasks: async (): Promise<Task[]> => {
      const sid = await ensureSession();
      const todos = await jsonFetch<Array<{
        id: string;
        title: string;
        description?: string;
        status: string;
        priority?: string;
        created_at: string;
        updated_at: string;
      }>>(`/v1/shell_ui/session/${sid}/todo`);
      
      return todos.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: (t.status as Task['status']) || 'pending',
        priority: (t.priority as Task['priority']) || 'medium',
        dependencies: [],
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
    },
    
    getTask: async (id: string) => {
      const sid = await ensureSession();
      const todos = await jsonFetch<Array<{
        id: string;
        title: string;
        description?: string;
        status: string;
        priority?: string;
        created_at: string;
        updated_at: string;
      }>>(`/v1/shell_ui/session/${sid}/todo`);
      
      const tasks = todos.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: (t.status as Task['status']) || 'pending',
        priority: (t.priority as Task['priority']) || 'medium',
        dependencies: [],
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
      return tasks.find(t => t.id === id) || null;
    },
    
    createTask: async (input: CreateTaskInput) => {
      const sid = await ensureSession();
      // Send as a message to create a task
      const result = await jsonFetch<{ message_id: string; content: string }>(
        `/v1/shell_ui/session/${sid}/message`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: `Create task: ${input.title}${input.description ? ` - ${input.description}` : ''}`,
            type: 'task',
          }),
        }
      );
      
      return {
        id: result.message_id,
        title: input.title,
        description: input.description || '',
        status: 'pending' as const,
        priority: input.priority || 'medium',
        dependencies: input.dependencies || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    
    updateTask: async (id: string, updates: Partial<Task>) => {
      // Updates happen via messages
      const sid = await ensureSession();
      await authFetch(`/v1/shell_ui/session/${sid}/message`, {
        method: 'POST',
        body: JSON.stringify({
          content: `Update task ${id}: ${JSON.stringify(updates)}`,
          type: 'task_update',
          task_id: id,
        }),
      });
      
      return {
        id,
        title: updates.title || '',
        description: updates.description,
        status: updates.status || 'pending',
        priority: updates.priority || 'medium',
        dependencies: updates.dependencies || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    },
    
    deleteTask: async (id: string) => {
      const sid = await ensureSession();
      await authFetch(`/v1/shell_ui/session/${sid}/message`, {
        method: 'POST',
        body: JSON.stringify({
          content: `Delete task ${id}`,
          type: 'task_delete',
          task_id: id,
        }),
      });
    },
    
    getTaskGraph: async (): Promise<TaskGraph> => {
      const sid = await ensureSession();
      const todos = await jsonFetch<Array<{
        id: string;
        title: string;
        description?: string;
        status: string;
        priority?: string;
        created_at: string;
        updated_at: string;
      }>>(`/v1/shell_ui/session/${sid}/todo`);
      
      const tasks = todos.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: (t.status as Task['status']) || 'pending',
        priority: (t.priority as Task['priority']) || 'medium',
        dependencies: [],
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
      return { 
        tasks, 
        edges: tasks.flatMap((t: Task) => 
          t.dependencies.map((dep: string) => ({ from: dep, to: t.id }))
        ) 
      };
    },

    // Memory - mapped to session messages
    listMemoryEntries: async (): Promise<MemoryEntry[]> => {
      const sid = await ensureSession();
      const messages = await jsonFetch<Array<{
        id: string;
        content: string;
        type: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
      }>>(`/v1/shell_ui/session/${sid}/messages`);
      
      return messages.map(m => ({
        id: m.id,
        type: (m.type as MemoryEntry['type']) || 'note',
        content: m.content,
        tags: m.metadata?.tags as string[] || [],
        timestamp: m.timestamp,
      }));
    },
    
    getMemoryEntry: async (id: string) => {
      const sid = await ensureSession();
      const messages = await jsonFetch<Array<{
        id: string;
        content: string;
        type: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
      }>>(`/v1/shell_ui/session/${sid}/messages`);
      
      const entries = messages.map(m => ({
        id: m.id,
        type: (m.type as MemoryEntry['type']) || 'note',
        content: m.content,
        tags: m.metadata?.tags as string[] || [],
        timestamp: m.timestamp,
      }));
      return entries.find(e => e.id === id) || null;
    },
    
    createMemoryEntry: async (input: CreateMemoryInput) => {
      const sid = await ensureSession();
      const result = await jsonFetch<{ message_id: string }>(
        `/v1/shell_ui/session/${sid}/message`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: input.content,
            type: input.type,
            tags: input.tags,
          }),
        }
      );
      
      return {
        id: result.message_id,
        type: input.type,
        content: input.content,
        tags: input.tags || [],
        timestamp: new Date().toISOString(),
      };
    },
    
    searchMemory: async (query: string) => {
      const sid = await ensureSession();
      const messages = await jsonFetch<Array<{
        id: string;
        content: string;
        type: string;
        timestamp: string;
        metadata?: Record<string, unknown>;
      }>>(`/v1/shell_ui/session/${sid}/messages`);
      
      const entries = messages.map(m => ({
        id: m.id,
        type: (m.type as MemoryEntry['type']) || 'note',
        content: m.content,
        tags: m.metadata?.tags as string[] || [],
        timestamp: m.timestamp,
      }));

      const lowerQuery = query.toLowerCase();
      return entries.filter(e =>
        e.content.toLowerCase().includes(lowerQuery) ||
        e.tags.some((t: string) => t.toLowerCase().includes(lowerQuery))
      );
    },

    // Policy - mapped to registry/policy
    listPolicyRules: async () => {
      // Policy rules come from the registry
      const config = await jsonFetch<{
        policies?: Array<{
          id: string;
          name: string;
          description: string;
          effect: string;
        }>;
      }>('/v1/shell_ui/config');
      
      return (config.policies || []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        condition: 'true', // Simplified
        action: (p.effect as PolicyRule['action']) || 'allow',
      }));
    },
    
    checkPolicy: async (action: string, params: Record<string, unknown>): Promise<PolicyDecision> => {
      // Policy check happens server-side
      const sid = await ensureSession();
      const result = await jsonFetch<{ allowed: boolean; reason?: string }>(
        `/v1/shell_ui/session/${sid}/message`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: `Check policy for ${action}`,
            type: 'policy_check',
            action,
            params,
          }),
        }
      );
      
      return {
        allowed: result.allowed,
        reason: result.reason,
      };
    },

    // Skills - mapped to registry/skills
    listSkills: async () => {
      const result = await jsonFetch<{
        skills: Array<{
          id: string;
          name: string;
          description: string;
          version?: string;
        }>;
      }>('/v1/shell_ui/app/skills');
      
      return result.skills.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        version: s.version || '1.0.0',
        installed: true, // From app skills = installed
      }));
    },
    
    installSkill: async (id: string) => {
      await authFetch('/v1/shell_ui/mcp/connect', {
        method: 'POST',
        body: JSON.stringify({ skill_id: id }),
      });
    },
    
    uninstallSkill: async (id: string) => {
      await authFetch('/v1/shell_ui/mcp/disconnect', {
        method: 'POST',
        body: JSON.stringify({ skill_id: id }),
      });
    },

    // Identity - mapped to config/agent
    getIdentity: async () => {
      const config = await jsonFetch<{
        agent?: {
          name: string;
          role?: string;
          capabilities?: string[];
        };
      }>('/v1/shell_ui/config');
      
      return {
        name: config.agent?.name || 'A2R Agent',
        role: config.agent?.role || 'assistant',
        capabilities: config.agent?.capabilities || ['code', 'analysis'],
      };
    },
    
    updateIdentity: async (updates: Partial<Identity>) => {
      // Identity updates go through config
      await authFetch('/v1/shell_ui/global/config', {
        method: 'POST',
        body: JSON.stringify({
          agent: updates,
        }),
      });
      
      return {
        name: updates.name || 'A2R Agent',
        role: updates.role || 'assistant',
        capabilities: updates.capabilities || ['code', 'analysis'],
        soul: updates.soul,
      };
    },

    // Connection
    isConnected: () => true, // HTTP client is always "connected"
    
    reconnect: async () => {
      try {
        const response = await authFetch('/health', { method: 'GET' }, 1);
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}

export default createHttpWorkspace;
