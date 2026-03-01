/**
 * Audit Trail Service
 *
 * Implements LAW-ENF-002: Auditability
 *
 * Required Surfaces:
 * 1. Immutable audit log (append-only)
 * 2. User action tracking (who did what, when)
 * 3. Policy decision logging
 * 4. Environment change tracking
 * 5. Receipt correlation
 *
 * Aligned with:
 * - SYSTEM_LAW.md LAW-ENF-002
 * - LAW-ENF-006 (Observability Legibility)
 * - LAW-AUT-004 (Evidence Queryability)
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export type AuditEventType =
  // Authentication & Authorization
  | 'auth.login'
  | 'auth.logout'
  | 'auth.token.refresh'
  | 'auth.permission.grant'
  | 'auth.permission.revoke'
  
  // Policy & Governance
  | 'policy.check'
  | 'policy.decision'
  | 'policy.confirmation.requested'
  | 'policy.confirmation.granted'
  | 'policy.confirmation.denied'
  | 'policy.allowlist.add'
  | 'policy.allowlist.remove'
  | 'policy.config.update'
  
  // Agent Execution
  | 'agent.run.start'
  | 'agent.run.stop'
  | 'agent.run.complete'
  | 'agent.action.execute'
  | 'agent.action.complete'
  | 'agent.handoff'
  | 'agent.mode.change'
  
  // Environment
  | 'environment.switch'
  | 'environment.deploy'
  | 'environment.scale'
  | 'environment.config.update'
  
  // Data & Evidence
  | 'receipt.generate'
  | 'receipt.query'
  | 'evidence.capture'
  | 'evidence.export'
  
  // System
  | 'system.config.update'
  | 'system.maintenance'
  | 'system.error';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AuditEvent {
  // Core identification
  event_id: string;
  event_type: AuditEventType;
  timestamp: string;
  
  // Actor identification
  actor: {
    user_id?: string;
    session_id: string;
    ip_address?: string;
    user_agent?: string;
  };
  
  // Target of the action
  target?: {
    type: string;  // 'receipt', 'policy', 'environment', 'agent', etc.
    id: string;
    name?: string;
  };
  
  // Action details
  action: {
    description: string;
    category: string;
    risk_level?: AuditSeverity;
  };
  
  // Context
  context: {
    workspace_id?: string;
    prefix_id?: string;
    toolset_id?: string;
    correlation_id?: string;
    run_id?: string;
  };
  
  // Outcome
  outcome: {
    success: boolean;
    error_code?: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
  };
  
  // Compliance markers
  compliance: {
    law_references: string[];  // e.g., ['LAW-ENF-002', 'LAW-AUT-004']
    retention_period_days: number;
    immutable: boolean;
  };
}

export interface AuditQueryParams {
  event_type?: AuditEventType;
  actor_user_id?: string;
  actor_session_id?: string;
  target_type?: string;
  target_id?: string;
  start_time?: string;
  end_time?: string;
  severity?: AuditSeverity;
  correlation_id?: string;
  run_id?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Audit Store Interface
// ============================================================================

export interface AuditStore {
  // Write operations (append-only)
  append(event: Omit<AuditEvent, 'event_id' | 'timestamp'>): Promise<AuditEvent>;
  
  // Query operations
  query(params: AuditQueryParams): Promise<AuditQueryResult>;
  getById(eventId: string): Promise<AuditEvent | null>;
  getByCorrelationId(correlationId: string): Promise<AuditEvent[]>;
  getByRunId(runId: string): Promise<AuditEvent[]>;
  getByActor(sessionId: string): Promise<AuditEvent[]>;
  
  // Export for compliance
  exportForPeriod(start: string, end: string): Promise<AuditEvent[]>;
  
  // Utility
  clear(): Promise<void>;
}

// ============================================================================
// In-Memory Store (for development)
// TODO: Replace with persistent storage for production
// ============================================================================

export class InMemoryAuditStore implements AuditStore {
  private events: Map<string, AuditEvent> = new Map();
  private correlationIndex: Map<string, string[]> = new Map();
  private runIndex: Map<string, string[]> = new Map();
  private actorIndex: Map<string, string[]> = new Map();

  async append(event: Omit<AuditEvent, 'event_id' | 'timestamp'>): Promise<AuditEvent> {
    const newEvent: AuditEvent = {
      ...event,
      event_id: 'audit_' + uuidv4(),
      timestamp: new Date().toISOString(),
    };
    
    this.events.set(newEvent.event_id, newEvent);
    
    // Update indexes
    if (event.context.correlation_id) {
      const existing = this.correlationIndex.get(event.context.correlation_id) || [];
      existing.push(newEvent.event_id);
      this.correlationIndex.set(event.context.correlation_id, existing);
    }
    
    if (event.context.run_id) {
      const existing = this.runIndex.get(event.context.run_id) || [];
      existing.push(newEvent.event_id);
      this.runIndex.set(event.context.run_id, existing);
    }
    
    const actorKey = event.actor.session_id;
    const existing = this.actorIndex.get(actorKey) || [];
    existing.push(newEvent.event_id);
    this.actorIndex.set(actorKey, existing);
    
    return newEvent;
  }

  async query(params: AuditQueryParams): Promise<AuditQueryResult> {
    let filtered = Array.from(this.events.values());
    
    // Apply filters
    if (params.event_type) {
      filtered = filtered.filter(e => e.event_type === params.event_type);
    }
    
    if (params.actor_user_id) {
      filtered = filtered.filter(e => e.actor.user_id === params.actor_user_id);
    }
    
    if (params.actor_session_id) {
      filtered = filtered.filter(e => e.actor.session_id === params.actor_session_id);
    }
    
    if (params.target_type) {
      filtered = filtered.filter(e => e.target?.type === params.target_type);
    }
    
    if (params.target_id) {
      filtered = filtered.filter(e => e.target?.id === params.target_id);
    }
    
    if (params.start_time) {
      filtered = filtered.filter(e => e.timestamp >= params.start_time!);
    }
    
    if (params.end_time) {
      filtered = filtered.filter(e => e.timestamp <= params.end_time!);
    }
    
    if (params.severity) {
      const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
      const minSeverity = severityOrder[params.severity];
      filtered = filtered.filter(e => {
        const eventSeverity = e.action.risk_level || 'low';
        return severityOrder[eventSeverity] >= minSeverity;
      });
    }
    
    if (params.correlation_id) {
      filtered = filtered.filter(e => e.context.correlation_id === params.correlation_id);
    }
    
    if (params.run_id) {
      filtered = filtered.filter(e => e.context.run_id === params.run_id);
    }
    
    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    
    // Pagination
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filtered.slice(start, end);
    
    return {
      events: paginated,
      total: filtered.length,
      page,
      pageSize,
      hasMore: end < filtered.length,
    };
  }

  async getById(eventId: string): Promise<AuditEvent | null> {
    return this.events.get(eventId) || null;
  }

  async getByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    const eventIds = this.correlationIndex.get(correlationId) || [];
    const events = eventIds.map(id => this.events.get(id)).filter((e): e is AuditEvent => !!e);
    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return events;
  }

  async getByRunId(runId: string): Promise<AuditEvent[]> {
    const eventIds = this.runIndex.get(runId) || [];
    const events = eventIds.map(id => this.events.get(id)).filter((e): e is AuditEvent => !!e);
    events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return events;
  }

  async getByActor(sessionId: string): Promise<AuditEvent[]> {
    const eventIds = this.actorIndex.get(sessionId) || [];
    const events = eventIds.map(id => this.events.get(id)).filter((e): e is AuditEvent => !!e);
    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return events;
  }

  async exportForPeriod(start: string, end: string): Promise<AuditEvent[]> {
    const filtered = Array.from(this.events.values())
      .filter(e => e.timestamp >= start && e.timestamp <= end)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return filtered;
  }

  async clear(): Promise<void> {
    this.events.clear();
    this.correlationIndex.clear();
    this.runIndex.clear();
    this.actorIndex.clear();
  }
}

// ============================================================================
// Audit Trail Service
// ============================================================================

export class AuditTrailService {
  private store: AuditStore;
  private defaultSessionId: string;
  private defaultCorrelationId: string;
  private defaultWorkspaceId?: string;

  constructor(
    store: AuditStore,
    sessionId?: string,
    correlationId?: string,
    workspaceId?: string
  ) {
    this.store = store;
    this.defaultSessionId = sessionId || 'session_' + uuidv4();
    this.defaultCorrelationId = correlationId || 'corr_' + uuidv4();
    this.defaultWorkspaceId = workspaceId;
  }

  /**
   * Record an audit event
   */
  async record(params: {
    event_type: AuditEventType;
    description: string;
    category: string;
    target?: { type: string; id: string; name?: string };
    risk_level?: AuditSeverity;
    success?: boolean;
    error_code?: string;
    error_message?: string;
    metadata?: Record<string, unknown>;
    law_references?: string[];
    retention_days?: number;
    session_id?: string;
    correlation_id?: string;
    run_id?: string;
    actor?: Partial<AuditEvent['actor']>;
  }): Promise<AuditEvent> {
    return this.store.append({
      event_type: params.event_type,
      actor: {
        session_id: params.session_id || this.defaultSessionId,
        user_id: params.actor?.user_id,
        ip_address: params.actor?.ip_address,
        user_agent: params.actor?.user_agent,
      },
      target: params.target,
      action: {
        description: params.description,
        category: params.category,
        risk_level: params.risk_level,
      },
      context: {
        workspace_id: this.defaultWorkspaceId,
        correlation_id: params.correlation_id || this.defaultCorrelationId,
        run_id: params.run_id,
      },
      outcome: {
        success: params.success ?? true,
        error_code: params.error_code,
        error_message: params.error_message,
        metadata: params.metadata,
      },
      compliance: {
        law_references: params.law_references || ['LAW-ENF-002'],
        retention_period_days: params.retention_days || 90,
        immutable: true,
      },
    });
  }

  /**
   * Record policy decision
   */
  async recordPolicyDecision(params: {
    decision: 'allow' | 'deny' | 'require_confirm';
    rule_id?: string;
    reason?: string;
    risk_tier?: number;
    capability?: string;
    session_id?: string;
    correlation_id?: string;
  }): Promise<AuditEvent> {
    return this.record({
      event_type: 'policy.decision',
      description: `Policy ${params.decision} decision`,
      category: 'policy',
      risk_level: params.decision === 'deny' ? 'high' : params.decision === 'require_confirm' ? 'medium' : 'low',
      success: params.decision !== 'deny',
      metadata: {
        decision: params.decision,
        rule_id: params.rule_id,
        reason: params.reason,
        risk_tier: params.risk_tier,
        capability: params.capability,
      },
      law_references: ['LAW-TOOL-002', 'LAW-ENF-002'],
      session_id: params.session_id,
      correlation_id: params.correlation_id,
    });
  }

  /**
   * Record agent execution event
   */
  async recordAgentEvent(params: {
    action: 'start' | 'stop' | 'complete' | 'handoff' | 'mode_change';
    run_id: string;
    details?: Record<string, unknown>;
    session_id?: string;
  }): Promise<AuditEvent> {
    const eventTypeMap: Record<string, AuditEventType> = {
      start: 'agent.run.start',
      stop: 'agent.run.stop',
      complete: 'agent.run.complete',
      handoff: 'agent.handoff',
      mode_change: 'agent.mode.change',
    };

    return this.record({
      event_type: eventTypeMap[params.action],
      description: `Agent ${params.action}`,
      category: 'agent',
      run_id: params.run_id,
      metadata: params.details,
      law_references: ['LAW-AUT-004', 'LAW-ENF-002'],
      session_id: params.session_id,
    });
  }

  /**
   * Record environment change
   */
  async recordEnvironmentChange(params: {
    action: 'switch' | 'deploy' | 'scale' | 'config_update';
    from_env?: string;
    to_env?: string;
    details?: Record<string, unknown>;
    session_id?: string;
  }): Promise<AuditEvent> {
    return this.record({
      event_type: ('environment.' + params.action) as AuditEventType,
      description: `Environment ${params.action}: ${params.from_env} → ${params.to_env}`,
      category: 'environment',
      target: params.to_env ? { type: 'environment', id: params.to_env } : undefined,
      metadata: {
        from: params.from_env,
        to: params.to_env,
        ...params.details,
      },
      law_references: ['LAW-ENF-002'],
      session_id: params.session_id,
    });
  }

  /**
   * Query audit events
   */
  async query(params: AuditQueryParams): Promise<AuditQueryResult> {
    return this.store.query(params);
  }

  /**
   * Get events by correlation ID
   */
  async getByCorrelationId(correlationId: string): Promise<AuditEvent[]> {
    return this.store.getByCorrelationId(correlationId);
  }

  /**
   * Get events by run ID
   */
  async getByRunId(runId: string): Promise<AuditEvent[]> {
    return this.store.getByRunId(runId);
  }

  /**
   * Export audit trail for compliance period
   */
  async exportForCompliance(start: string, end: string): Promise<AuditEvent[]> {
    return this.store.exportForPeriod(start, end);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _auditStore: AuditStore | null = null;
let _auditService: AuditTrailService | null = null;

export function getAuditStore(): AuditStore {
  if (!_auditStore) {
    _auditStore = new InMemoryAuditStore();
  }
  return _auditStore;
}

export function getAuditTrailService(
  sessionId?: string,
  correlationId?: string,
  workspaceId?: string
): AuditTrailService {
  if (!_auditService) {
    _auditService = new AuditTrailService(
      getAuditStore(),
      sessionId,
      correlationId,
      workspaceId
    );
  }
  return _auditService;
}

// ============================================================================
// Exports
// ============================================================================

export default AuditTrailService;
