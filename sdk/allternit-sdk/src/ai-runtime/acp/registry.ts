/**
 * ACP (Agent Capability Protocol) Registry
 * Manages agent capability registration and discovery
 */

import { ACPRegistryEntry, ACPMessage, ACPSession, ACPEvent } from './schema.js';

export interface RegistryOptions {
  maxEntries?: number;
  ttlMs?: number;
  enableHeartbeat?: boolean;
  heartbeatIntervalMs?: number;
}

export interface RegistryStats {
  totalAgents: number;
  activeAgents: number;
  totalCapabilities: number;
  totalSessions: number;
  lastUpdated: Date;
}

/**
 * ACP Registry
 * Central registry for agent capability management
 */
export class ACPRegistry {
  private entries: Map<string, ACPRegistryEntry>;
  private sessions: Map<string, ACPSession>;
  private eventHandlers: Map<string, Array<(event: ACPEvent) => void>>;
  private options: Required<RegistryOptions>;
  private heartbeatTimer?: ReturnType<typeof setTimeout>;

  constructor(options: RegistryOptions = {}) {
    this.entries = new Map();
    this.sessions = new Map();
    this.eventHandlers = new Map();
    this.options = {
      maxEntries: options.maxEntries ?? 1000,
      ttlMs: options.ttlMs ?? 3600000, // 1 hour
      enableHeartbeat: options.enableHeartbeat ?? true,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? 30000, // 30 seconds
    };

    if (this.options.enableHeartbeat) {
      this.startHeartbeat();
    }
  }

  /**
   * Register a new agent
   */
  register(entry: ACPRegistryEntry): void {
    if (this.entries.size >= this.options.maxEntries) {
      this.evictOldest();
    }

    this.entries.set(entry.agentId, {
      ...entry,
      registeredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });

    this.emit('capability.registered', { agentId: entry.agentId });
  }

  /**
   * Unregister an agent
   */
  unregister(agentId: string): boolean {
    const existed = this.entries.delete(agentId);
    if (existed) {
      // Clean up associated sessions
      for (const [sessionId, session] of this.sessions) {
        if (session.agentId === agentId) {
          this.sessions.delete(sessionId);
        }
      }
    }
    return existed;
  }

  /**
   * Get a registry entry
   */
  get(agentId: string): ACPRegistryEntry | undefined {
    const entry = this.entries.get(agentId);
    if (entry) {
      entry.lastSeenAt = new Date().toISOString();
    }
    return entry;
  }

  /**
   * List all registered agents
   */
  list(filter?: { status?: string; category?: string }): ACPRegistryEntry[] {
    let entries = Array.from(this.entries.values());

    if (filter?.status) {
      entries = entries.filter(e => e.status === filter.status);
    }

    if (filter?.category) {
      entries = entries.filter(e => e.metadata.category === filter.category);
    }

    return entries.sort((a, b) => 
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    );
  }

  /**
   * Find agents by capability
   */
  findByCapability(capabilityName: string): ACPRegistryEntry[] {
    return this.list().filter(entry =>
      entry.capabilities.some(cap => cap.name === capabilityName)
    );
  }

  /**
   * Search agents by name or description
   */
  search(query: string): ACPRegistryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.list().filter(entry =>
      entry.name.toLowerCase().includes(lowerQuery) ||
      entry.description.toLowerCase().includes(lowerQuery) ||
      entry.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Create a new session
   */
  createSession(agentId: string, permissions: string[] = ['read']): ACPSession {
    const entry = this.get(agentId);
    if (!entry) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const session: ACPSession = {
      id: crypto.randomUUID(),
      agentId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      capabilities: entry.capabilities.map(c => c.name),
      permissions: permissions as ACPSession['permissions'],
      metrics: {
        messagesSent: 0,
        messagesReceived: 0,
        errors: 0,
        lastActivity: new Date().toISOString(),
      },
    };

    this.sessions.set(session.id, session);
    this.emit('session.created', { sessionId: session.id, agentId });

    return session;
  }

  /**
   * Get a session
   */
  getSession(sessionId: string): ACPSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Terminate a session
   */
  terminateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'terminated';
    session.updatedAt = new Date().toISOString();
    
    this.sessions.delete(sessionId);
    this.emit('session.terminated', { sessionId, agentId: session.agentId });
    
    return true;
  }

  /**
   * Update session metrics
   */
  updateSessionMetrics(
    sessionId: string,
    updates: Partial<ACPSession['metrics']>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.metrics = { ...session.metrics, ...updates };
      session.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Validate message against registry
   */
  validateMessage(message: ACPMessage): { valid: boolean; error?: string } {
    const entry = this.get(message.source.agentId);
    if (!entry) {
      return { valid: false, error: 'Source agent not registered' };
    }

    const target = this.get(message.target.agentId);
    if (!target && message.target.agentId !== '*') {
      return { valid: false, error: 'Target agent not found' };
    }

    if (message.source.capability) {
      const hasCapability = entry.capabilities.some(
        cap => cap.name === message.source.capability
      );
      if (!hasCapability) {
        return { valid: false, error: 'Source agent does not have claimed capability' };
      }
    }

    return { valid: true };
  }

  /**
   * Subscribe to registry events
   */
  on(event: string, handler: (event: ACPEvent) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const entries = Array.from(this.entries.values());
    const sessions = Array.from(this.sessions.values());

    return {
      totalAgents: entries.length,
      activeAgents: entries.filter(e => e.status === 'active').length,
      totalCapabilities: entries.reduce(
        (sum, e) => sum + e.capabilities.length, 0
      ),
      totalSessions: sessions.length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Clear all entries and sessions
   */
  clear(): void {
    this.entries.clear();
    this.sessions.clear();
    this.eventHandlers.clear();
  }

  /**
   * Dispose of the registry
   */
  dispose(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    this.clear();
  }

  private emit(type: string, data: unknown): void {
    const event: ACPEvent = {
      type: type as ACPEvent['type'],
      timestamp: new Date().toISOString(),
      data,
    };

    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      handlers.forEach(h => {
        try {
          h(event);
        } catch {
          // Ignore handler errors
        }
      });
    }

    // Also emit to wildcard handlers
    const wildcards = this.eventHandlers.get('*');
    if (wildcards) {
      wildcards.forEach(h => {
        try {
          h(event);
        } catch {
          // Ignore handler errors
        }
      });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.options.heartbeatIntervalMs);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, entry] of this.entries) {
      const lastSeen = new Date(entry.lastSeenAt).getTime();
      if (now - lastSeen > this.options.ttlMs) {
        this.entries.delete(id);
      }
    }

    for (const [id, session] of this.sessions) {
      const lastActivity = new Date(session.metrics.lastActivity).getTime();
      if (now - lastActivity > this.options.ttlMs) {
        this.terminateSession(id);
      }
    }
  }

  private evictOldest(): void {
    let oldest: [string, ACPRegistryEntry] | null = null;
    
    for (const entry of this.entries) {
      if (!oldest || new Date(entry[1].lastSeenAt) < new Date(oldest[1].lastSeenAt)) {
        oldest = entry;
      }
    }

    if (oldest) {
      this.entries.delete(oldest[0]);
    }
  }
}

/**
 * Global registry instance
 */
export const acpRegistry = new ACPRegistry();

export default ACPRegistry;
