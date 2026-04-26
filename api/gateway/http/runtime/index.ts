/**
 * Allternit Gateway Core - Extended with UI v0 Events
 * 
 * Transport-agnostic core providing:
 * - Request routing (logical operations)
 * - Event bus (server-side pub/sub)
 * - Session store with directory partitioning
 * - Tool invocation interface
 * - Message/parts model and receipts
 * - UI v0 canonical event types
 * 
 * NO transport logic in core.
 * 
 * @module @allternit/gateway-core
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Gateway configuration
 */
export interface GatewayConfig {
  services: Record<string, string>;
  rateLimit: {
    max: number;
    timeWindow: number;
  };
  timeouts: {
    request: number;
    health: number;
  };
  auth: {
    enabled: boolean;
    jwtSecret?: string;
    apiKeys?: string[];
  };
}

/**
 * Directory-scoped session model
 */
export interface Session {
  id: string;
  directory?: string;
  profile_id: string;
  status: 'active' | 'paused' | 'completed' | 'error' | 'running' | 'idle';
  created_at: string;
  updated_at?: string;
  expires_at?: string;
  capsules: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Message part types - extended for UI v0
 */
export type MessagePart =
  | { type: 'text'; text: string; id: string; directory?: string }
  | { type: 'reasoning'; reasoning: string; id: string; directory?: string }
  | { type: 'file'; file: FileAttachment; id: string; directory?: string }
  | { type: 'source'; source: SourceCitation; id: string; directory?: string }
  | { type: 'code'; code: string; language: string; id: string; directory?: string }
  | { type: 'image'; image: ImageAttachment; id: string; directory?: string }
  | { type: 'audio'; audio: AudioAttachment; id: string; directory?: string }
  | { 
      type: 'tool'; 
      tool_call_id: string; 
      tool_name: string; 
      state: 'loading' | 'result' | 'error';
      input?: unknown;
      output?: unknown;
      error?: string;
      id: string;
      directory?: string;
    }
  | { type: 'data'; data_type: string; data: unknown; id: string; directory?: string };

export interface FileAttachment {
  id: string;
  name: string;
  content_type: string;
  size: number;
  url?: string;
}

export interface SourceCitation {
  id: string;
  url: string;
  title: string;
  excerpt?: string;
}

export interface ImageAttachment {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface AudioAttachment {
  url: string;
  duration?: number;
  format?: string;
}

/**
 * Message model - extended for UI v0
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  session_id: string;
  directory?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

/**
 * Token usage
 */
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'unknown';
  last_check: string;
  latency_ms?: number;
  error?: string;
}

// =============================================================================
// Event Bus Types - Extended with UI v0 Canonical Events
// =============================================================================

/**
 * UI v0 Canonical Event Types
 * 
 * All events MUST originate from kernel adapter layer.
 * Binding layer only translates, never generates.
 */
export interface UIv0Events {
  // Server lifecycle
  'server.connected': {
    directory: string;
    timestamp: string;
  };
  'server.heartbeat': {
    directory: string;
    timestamp: string;
  };
  
  // Session lifecycle
  'session.created': { 
    directory: string;
    session_id: string; 
    profile_id: string; 
    capsules: string[];
    created_at: string;
  };
  'session.updated': {
    directory: string;
    session_id: string;
    changes: Record<string, unknown>;
    updated_at: string;
  };
  'session.deleted': {
    directory: string;
    session_id: string;
    deleted_at: string;
  };
  'session.status_changed': {
    directory: string;
    session_id: string;
    old_status: string;
    new_status: string;
    timestamp: string;
  };
  
  // Message lifecycle
  'message.created': {
    directory: string;
    message_id: string;
    session_id: string;
    role: string;
    content?: string;
    created_at: string;
  };
  'message.updated': {
    directory: string;
    message_id: string;
    changes: Record<string, unknown>;
    updated_at: string;
  };
  'message.removed': {
    directory: string;
    message_id: string;
    reason: string;
    removed_at: string;
  };
  
  // Part lifecycle (critical for streaming)
  'part.created': {
    directory: string;
    part_id: string;
    message_id: string;
    type: string;
    content?: string;
    created_at: string;
  };
  'part.updated': {
    directory: string;
    part_id: string;
    message_id: string;
    changes: Record<string, unknown>;
    updated_at: string;
  };
  'part.delta': {
    directory: string;
    part_id: string;
    message_id: string;
    delta: string;
    index: number;
    timestamp: string;
  };
  'part.removed': {
    directory: string;
    part_id: string;
    message_id: string;
    reason: string;
    removed_at: string;
  };
  
  // Tool state
  'tool.state_changed': {
    directory: string;
    tool_call_id: string;
    tool_name: string;
    state: 'loading' | 'running' | 'completed' | 'error';
    input?: unknown;
    output?: unknown;
    error?: string;
    timestamp: string;
  };
  
  // Permission system
  'permission.requested': {
    directory: string;
    permission_id: string;
    type: string;
    description: string;
    required: boolean;
    timestamp: string;
  };
  'permission.resolved': {
    directory: string;
    permission_id: string;
    granted: boolean;
    resolved_at: string;
  };
  
  // Question system
  'question.requested': {
    directory: string;
    question_id: string;
    question: string;
    type: 'clarification' | 'confirmation' | 'input';
    options?: string[];
    timestamp: string;
  };
  'question.resolved': {
    directory: string;
    question_id: string;
    answer: unknown;
    resolved_at: string;
  };
  'question.rejected': {
    directory: string;
    question_id: string;
    reason: string;
    rejected_at: string;
  };
  
  // TODO system
  'todo.updated': {
    directory: string;
    todo_id: string;
    action: 'created' | 'updated' | 'completed' | 'removed';
    content?: string;
    completed?: boolean;
    timestamp: string;
  };
  
  // LSP events
  'lsp.updated': {
    directory: string;
    file_path: string;
    diagnostics: unknown[];
    timestamp: string;
  };
  
  // VCS events
  'vcs.updated': {
    directory: string;
    repo_path: string;
    branch?: string;
    status?: string;
    timestamp: string;
  };
  
  // File watch events
  'file_watch.updated': {
    directory: string;
    file_path: string;
    event_type: 'create' | 'change' | 'delete';
    timestamp: string;
  };
  
  // PTY events
  'pty.output': {
    directory: string;
    pty_id: string;
    data: string;
    type: 'stdout' | 'stderr';
    timestamp: string;
  };
  'pty.exited': {
    directory: string;
    pty_id: string;
    exit_code: number;
    exited_at: string;
  };
  
  // Worktree events
  'worktree.ready': {
    directory: string;
    worktree_id: string;
    path: string;
    ready_at: string;
  };
  'worktree.failed': {
    directory: string;
    worktree_id: string;
    error: string;
    failed_at: string;
  };
  
  // System events (from original core)
  'health.check': {
    services: Record<string, ServiceHealth>;
  };
  'error': {
    code: string;
    message: string;
    details?: unknown;
    trace_id?: string;
    directory?: string;
  };
}

export type EventType = keyof UIv0Events;

export interface GatewayEvent<T extends EventType = EventType> {
  type: T;
  data: UIv0Events[T];
  timestamp: string;
  trace_id?: string;
}

// =============================================================================
// Tool Interface
// =============================================================================

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

export interface ToolExecutionRequest {
  tool_id: string;
  arguments: Record<string, unknown>;
  session_id?: string;
  directory?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration_ms?: number;
}

// =============================================================================
// Receipt Interface
// =============================================================================

export interface Receipt {
  id: string;
  type: string;
  operation: string;
  status: 'success' | 'error';
  created_at: string;
  session_id?: string;
  directory?: string;
  input_hash?: string;
  output_hash?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Event Bus Implementation - Extended
// =============================================================================

export class EventBus extends EventEmitter {
  private maxListeners = 100;
  private eventHistory: GatewayEvent[] = [];
  private readonly maxHistory = 1000;
  private directorySubscribers: Map<string, Set<(event: GatewayEvent) => void>> = new Map();

  constructor() {
    super();
    this.setMaxListeners(this.maxListeners);
  }

  /**
   * Publish an event to all subscribers
   * Directory-scoped publishing
   */
  publish<T extends EventType>(type: T, data: UIv0Events[T], trace_id?: string): void {
    const event: GatewayEvent<T> = {
      type,
      data,
      timestamp: new Date().toISOString(),
      trace_id,
    };

    // Add to history
    this.eventHistory.push(event as GatewayEvent);
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory.shift();
    }

    // Emit to global subscribers
    this.emit('event', event);
    this.emit(type, event);

    // Emit to directory-scoped subscribers
    const directory = (data as any).directory;
    if (directory) {
      const subscribers = this.directorySubscribers.get(directory);
      if (subscribers) {
        subscribers.forEach(cb => cb(event));
      }
      
      // Also emit to wildcard subscribers
      const wildcardSubscribers = this.directorySubscribers.get('*');
      if (wildcardSubscribers) {
        wildcardSubscribers.forEach(cb => cb(event));
      }
    }
  }

  /**
   * Subscribe to all events globally
   */
  subscribeAll(callback: (event: GatewayEvent) => void): () => void {
    this.on('event', callback);
    return () => this.off('event', callback);
  }

  /**
   * Subscribe to specific event type globally
   */
  subscribe<T extends EventType>(type: T, callback: (event: GatewayEvent<T>) => void): () => void {
    this.on(type, callback);
    return () => this.off(type, callback);
  }

  /**
   * Subscribe to events for a specific directory
   */
  subscribeDirectory(directory: string, callback: (event: GatewayEvent) => void): () => void {
    if (!this.directorySubscribers.has(directory)) {
      this.directorySubscribers.set(directory, new Set());
    }
    this.directorySubscribers.get(directory)!.add(callback);
    
    return () => {
      const subscribers = this.directorySubscribers.get(directory);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          this.directorySubscribers.delete(directory);
        }
      }
    };
  }

  /**
   * Get recent events, optionally filtered by directory
   */
  getHistory(since?: string, directory?: string): GatewayEvent[] {
    let events = [...this.eventHistory];
    
    if (since) {
      events = events.filter(e => e.timestamp >= since);
    }
    
    if (directory) {
      events = events.filter(e => {
        const eventDir = (e.data as any).directory;
        return eventDir === directory || eventDir === undefined;
      });
    }
    
    return events;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

// =============================================================================
// Session Store Implementation - Extended with Directory Partitioning
// =============================================================================

export interface SessionStore {
  create(profile_id: string, capsules?: string[], timeout?: number, directory?: string): Promise<Session>;
  get(id: string, directory?: string): Promise<Session | null>;
  list(directory?: string, status?: string): Promise<Session[]>;
  update(id: string, data: Partial<Session>, directory?: string): Promise<Session | null>;
  delete(id: string, directory?: string): Promise<boolean>;
}

export class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private defaultTimeout: number = 3600000) {
    this.startCleanup();
  }

  async create(profile_id: string, capsules: string[] = [], timeout?: number, directory?: string): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: uuidv4(),
      directory,
      profile_id,
      status: 'active',
      created_at: now,
      expires_at: new Date(Date.now() + (timeout || this.defaultTimeout)).toISOString(),
      capsules,
      metadata: {},
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async get(id: string, directory?: string): Promise<Session | null> {
    const session = this.sessions.get(id);
    if (!session) return null;
    
    // Directory scoping
    if (directory && session.directory && session.directory !== directory) {
      return null;
    }
    
    if (session.expires_at && new Date() > new Date(session.expires_at)) {
      this.sessions.delete(id);
      return null;
    }
    
    return session;
  }

  async list(directory?: string, status?: string): Promise<Session[]> {
    const now = new Date();
    const active: Session[] = [];

    for (const session of this.sessions.values()) {
      // Directory scoping
      if (directory && session.directory && session.directory !== directory) {
        continue;
      }
      
      if (session.expires_at && now > new Date(session.expires_at)) {
        this.sessions.delete(session.id);
        continue;
      }
      
      if (!status || session.status === status) {
        active.push(session);
      }
    }

    return active;
  }

  async update(id: string, data: Partial<Session>, directory?: string): Promise<Session | null> {
    const session = await this.get(id, directory);
    if (!session) return null;

    Object.assign(session, data, {
      updated_at: new Date().toISOString(),
    });
    
    this.sessions.set(id, session);
    return session;
  }

  async delete(id: string, directory?: string): Promise<boolean> {
    const session = await this.get(id, directory);
    if (!session) return false;
    
    return this.sessions.delete(id);
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      for (const [id, session] of this.sessions.entries()) {
        if (session.expires_at && now > new Date(session.expires_at)) {
          this.sessions.delete(id);
        }
      }
    }, 60000);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}

// =============================================================================
// Routing Engine
// =============================================================================

export class RoutingEngine {
  private healthCache: Map<string, ServiceHealth> = new Map();
  private httpModule: typeof import('http') | null = null;

  constructor(
    private config: GatewayConfig,
    private eventBus: EventBus
  ) {}

  /**
   * Initialize HTTP module
   */
  async initialize(): Promise<void> {
    this.httpModule = await import('http');
  }

  /**
   * Determine target service for a path
   */
  resolveTarget(path: string): string {
    const { services } = this.config;

    if (path.startsWith('v1/voice/')) return services.voice;
    if (path.startsWith('v1/operator/') || path.startsWith('v1/browser/') || path.startsWith('v1/vision/')) {
      return services.operator;
    }
    if (path.startsWith('v1/rails/') || path.startsWith('v1/plan') || path.startsWith('v1/dags/')) {
      return services.rails;
    }
    if (path.startsWith('v1/')) return services.api;
    if (path.startsWith('webvm/')) return services.webvm;

    return services.api;
  }

  /**
   * Make HTTP request to backend service
   */
  async proxyRequest(options: {
    method: string;
    path: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
  }): Promise<{ status: number; headers: Record<string, string>; body: string }> {
    if (!this.httpModule) {
      throw new Error('RoutingEngine not initialized');
    }

    const { method, path, body, headers = {}, timeout = this.config.timeouts.request } = options;

    const targetBase = this.resolveTarget(path);
    const url = new URL(path.replace(/^\//, ''), targetBase);

    return new Promise((resolve, reject) => {
      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout,
      };

      const req = this.httpModule!.request(reqOptions, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 500,
            headers: res.headers as Record<string, string>,
            body: Buffer.concat(chunks).toString(),
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  /**
   * Check health of a backend service
   */
  async checkHealth(name: string, baseUrl: string): Promise<ServiceHealth> {
    try {
      const response = await this.proxyRequest({
        method: 'GET',
        path: '/health',
        timeout: this.config.timeouts.health,
      });

      const health: ServiceHealth = {
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        last_check: new Date().toISOString(),
        latency_ms: response.headers['x-response-time'] ? parseInt(response.headers['x-response-time']) : undefined,
      };

      this.healthCache.set(name, health);
      return health;
    } catch (err) {
      const health: ServiceHealth = {
        status: 'unhealthy',
        last_check: new Date().toISOString(),
        error: (err as Error).message,
      };

      this.healthCache.set(name, health);
      return health;
    }
  }

  /**
   * Get health status of all services
   */
  getAllHealth(): Record<string, ServiceHealth> {
    const result: Record<string, ServiceHealth> = {};

    for (const [name] of Object.entries(this.config.services)) {
      result[name] = this.healthCache.get(name) || {
        status: 'unknown',
        last_check: new Date().toISOString(),
      };
    }

    return result;
  }

  /**
   * Update health of all services
   */
  async updateAllHealth(): Promise<void> {
    const promises = Object.entries(this.config.services).map(
      ([name, url]) => this.checkHealth(name, url)
    );
    await Promise.all(promises);

    // Publish health event
    this.eventBus.publish('health.check', {
      services: this.getAllHealth(),
    });
  }
}

// =============================================================================
// Gateway Core (Facade) - Extended
// =============================================================================

export class GatewayCore {
  public readonly eventBus: EventBus;
  public readonly sessionStore: SessionStore;
  public readonly routingEngine: RoutingEngine;
  private healthInterval: ReturnType<typeof setInterval> | null = null;

  constructor(public config: GatewayConfig) {
    this.eventBus = new EventBus();
    this.sessionStore = new InMemorySessionStore();
    this.routingEngine = new RoutingEngine(config, this.eventBus);
  }

  /**
   * Initialize the gateway core
   */
  async initialize(): Promise<void> {
    await this.routingEngine.initialize();
    await this.routingEngine.updateAllHealth();

    // Start periodic health checks
    this.healthInterval = setInterval(
      () => this.routingEngine.updateAllHealth().catch(console.error),
      30000
    );

    console.log('[GatewayCore] Initialized');
  }

  /**
   * Get gateway status
   */
  getStatus(): {
    status: string;
    service: string;
    version: string;
    timestamp: string;
    backends: Record<string, string>;
  } {
    const health = this.routingEngine.getAllHealth();

    return {
      status: 'healthy',
      service: 'allternit-gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      backends: Object.fromEntries(
        Object.entries(health).map(([name, h]) => [name, h.status])
      ),
    };
  }

  /**
   * Get service discovery
   */
  getDiscovery(): {
    gateway: { version: string; transport: string };
    services: Array<{ name: string; status: string; endpoints: string[] }>;
  } {
    const health = this.routingEngine.getAllHealth();

    return {
      gateway: {
        version: '1.0.0',
        transport: 'multi',
      },
      services: Object.entries(this.config.services).map(([name, url]) => ({
        name,
        status: health[name]?.status || 'unknown',
        endpoints: this.getEndpointsForService(name),
      })),
    };
  }

  private getEndpointsForService(service: string): string[] {
    const endpoints: Record<string, string[]> = {
      api: ['/v1/chat', '/v1/agents', '/v1/sessions', '/v1/tools'],
      operator: ['/v1/operator/browser', '/v1/operator/vision'],
      rails: ['/v1/rails/plan', '/v1/rails/dags'],
      voice: ['/v1/voice/tts', '/v1/voice/voices'],
      webvm: ['/webvm'],
    };
    return endpoints[service] || [];
  }

  /**
   * Create a session
   */
  async createSession(profile_id: string, capsules?: string[], timeout?: number, directory?: string): Promise<Session> {
    const session = await this.sessionStore.create(profile_id, capsules, timeout, directory);

    // Publish canonical event
    this.eventBus.publish('session.created', {
      directory: directory || '*',
      session_id: session.id,
      profile_id,
      capsules: session.capsules,
      created_at: session.created_at,
    });

    return session;
  }

  /**
   * Get a session
   */
  async getSession(session_id: string, directory?: string): Promise<Session | null> {
    return this.sessionStore.get(session_id, directory);
  }

  /**
   * List sessions
   */
  async listSessions(directory?: string, status?: string): Promise<Session[]> {
    return this.sessionStore.list(directory, status);
  }

  /**
   * Update a session
   */
  async updateSession(session_id: string, data: Partial<Session>, directory?: string): Promise<Session | null> {
    const session = await this.sessionStore.update(session_id, data, directory);
    
    if (session) {
      // Publish canonical event
      this.eventBus.publish('session.updated', {
        directory: directory || session.directory || '*',
        session_id,
        changes: data,
        updated_at: new Date().toISOString(),
      });
    }
    
    return session;
  }

  /**
   * Delete a session
   */
  async deleteSession(session_id: string, directory?: string): Promise<boolean> {
    const session = await this.getSession(session_id, directory);
    const deleted = await this.sessionStore.delete(session_id);
    
    if (deleted && session) {
      // Publish canonical event
      this.eventBus.publish('session.deleted', {
        directory: directory || session.directory || '*',
        session_id,
        deleted_at: new Date().toISOString(),
      });
    }
    
    return deleted;
  }

  /**
   * Shutdown the gateway core
   */
  async shutdown(): Promise<void> {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }

    (this.sessionStore as InMemorySessionStore).destroy();
    console.log('[GatewayCore] Shutdown complete');
  }
}

// =============================================================================
// Default Configuration
// =============================================================================

export const DEFAULT_CONFIG: GatewayConfig = {
  services: {
    api: process.env.ALLTERNIT_API_URL || 'http://127.0.0.1:3000',
    kernel: process.env.ALLTERNIT_KERNEL_URL || 'http://127.0.0.1:3004',
    voice: process.env.ALLTERNIT_VOICE_URL || 'http://127.0.0.1:8001',
    operator: process.env.ALLTERNIT_OPERATOR_URL || 'http://127.0.0.1:3010',
    rails: process.env.ALLTERNIT_RAILS_URL || 'http://127.0.0.1:3011',
    webvm: process.env.ALLTERNIT_WEBVM_URL || 'http://127.0.0.1:8002',
  },
  rateLimit: {
    max: 120,
    timeWindow: 60000,
  },
  timeouts: {
    request: 60000,
    health: 5000,
  },
  auth: {
    enabled: false,
  },
};

// =============================================================================
// Exports
// =============================================================================

export { uuidv4 };
