/**
 * Browser Safety & Quarantine
 * 
 * Security layer for browser automation providing:
 * - Host allowlist/blocklist enforcement
 * - Action approval workflows
 * - Data isolation policies
 * - Audit logging
 */

import type {
  SafetyPolicy,
  QuarantineSession,
  NetworkPolicy,
  DataRetentionPolicy,
  AuditEvent,
  ActionType,
} from '../types/index.js';

// ============================================================================
// Default Policies
// ============================================================================

export const DEFAULT_SAFETY_POLICY: SafetyPolicy = {
  allowedHosts: ['*'], // Allow all by default, can be restricted
  blockedHosts: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '*.local',
    '169.254.*', // Link-local
    '10.*', // Private
    '172.16.*', // Private
    '192.168.*', // Private
  ],
  allowedSchemes: ['http:', 'https:'],
  maxNavigationDepth: 10,
  requireApprovalFor: [
    'click',
    'type',
    'select',
    'clear',
  ],
  dataSensitivity: 'medium',
};

export const STRICT_SAFETY_POLICY: SafetyPolicy = {
  allowedHosts: [], // Empty = require explicit allowlist
  blockedHosts: ['*'], // Block all by default
  allowedSchemes: ['https:'], // Only HTTPS
  maxNavigationDepth: 5,
  requireApprovalFor: [
    'click',
    'type',
    'select',
    'clear',
    'navigate',
    'scroll',
    'hover',
  ],
  dataSensitivity: 'high',
};

// ============================================================================
// Safety Checker
// ============================================================================

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval: boolean;
  auditEvent: AuditEvent;
}

/**
 * Check if a URL is safe to navigate
 */
export function checkNavigationSafety(
  url: string,
  policy: SafetyPolicy,
  currentDepth: number = 0
): SafetyCheckResult {
  const timestamp = new Date();
  
  try {
    const parsed = new URL(url);
    
    // Check scheme
    if (!policy.allowedSchemes.includes(parsed.protocol)) {
      return {
        allowed: false,
        reason: `Scheme not allowed: ${parsed.protocol}`,
        requiresApproval: false,
        auditEvent: {
          timestamp,
          action: 'navigation',
          target: url,
          result: 'blocked',
          reason: 'disallowed_scheme',
        },
      };
    }
    
    // Check navigation depth
    if (currentDepth >= policy.maxNavigationDepth) {
      return {
        allowed: false,
        reason: `Max navigation depth exceeded: ${currentDepth}`,
        requiresApproval: false,
        auditEvent: {
          timestamp,
          action: 'navigation',
          target: url,
          result: 'blocked',
          reason: 'max_depth_exceeded',
        },
      };
    }
    
    // Check blocked hosts
    const hostname = parsed.hostname.toLowerCase();
    for (const blocked of policy.blockedHosts) {
      if (matchHostPattern(hostname, blocked)) {
        return {
          allowed: false,
          reason: `Host blocked: ${hostname}`,
          requiresApproval: false,
          auditEvent: {
            timestamp,
            action: 'navigation',
            target: url,
            result: 'blocked',
            reason: 'blocked_host',
          },
        };
      }
    }
    
    // Check allowed hosts (if not wildcard)
    if (!policy.allowedHosts.includes('*')) {
      let allowed = false;
      for (const allowedHost of policy.allowedHosts) {
        if (matchHostPattern(hostname, allowedHost)) {
          allowed = true;
          break;
        }
      }
      if (!allowed) {
        return {
          allowed: false,
          reason: `Host not in allowlist: ${hostname}`,
          requiresApproval: true,
          auditEvent: {
            timestamp,
            action: 'navigation',
            target: url,
            result: 'warned',
            reason: 'not_in_allowlist',
          },
        };
      }
    }
    
    // Allowed
    return {
      allowed: true,
      requiresApproval: false,
      auditEvent: {
        timestamp,
        action: 'navigation',
        target: url,
        result: 'allowed',
      },
    };
  } catch (error) {
    return {
      allowed: false,
      reason: 'Invalid URL',
      requiresApproval: false,
      auditEvent: {
        timestamp,
        action: 'navigation',
        target: url,
        result: 'blocked',
        reason: 'invalid_url',
      },
    };
  }
}

/**
 * Check if an action requires approval
 */
export function checkActionSafety(
  action: ActionType,
  selector: string | undefined,
  policy: SafetyPolicy
): SafetyCheckResult {
  const timestamp = new Date();
  const requiresApproval = policy.requireApprovalFor.includes(action);
  
  return {
    allowed: true,
    requiresApproval,
    auditEvent: {
      timestamp,
      action: `action:${action}`,
      target: selector,
      result: requiresApproval ? 'warned' : 'allowed',
      reason: requiresApproval ? 'requires_approval' : undefined,
    },
  };
}

// ============================================================================
// Quarantine Manager
// ============================================================================

export class QuarantineManager {
  private sessions: Map<string, QuarantineSession> = new Map();
  private policies: Map<string, SafetyPolicy> = new Map();
  
  createSession(
    sessionId: string,
    isolationLevel: QuarantineSession['isolationLevel'] = 'incognito',
    customPolicy?: Partial<SafetyPolicy>
  ): QuarantineSession {
    const policy: SafetyPolicy = {
      ...DEFAULT_SAFETY_POLICY,
      ...customPolicy,
    };
    
    const session: QuarantineSession = {
      id: sessionId,
      isolationLevel,
      networkPolicy: {
        allowOutbound: true,
        allowedDomains: [],
        blockedDomains: [],
        requireProxy: false,
      },
      dataRetention: {
        screenshotRetention: 24, // 24 hours
        dataRetention: 168, // 7 days
        autoPurge: true,
      },
      auditLog: [],
    };
    
    this.sessions.set(sessionId, session);
    this.policies.set(sessionId, policy);
    
    return session;
  }
  
  getSession(sessionId: string): QuarantineSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  getPolicy(sessionId: string): SafetyPolicy | undefined {
    return this.policies.get(sessionId);
  }
  
  updatePolicy(sessionId: string, updates: Partial<SafetyPolicy>): boolean {
    const existing = this.policies.get(sessionId);
    if (!existing) return false;
    
    this.policies.set(sessionId, {
      ...existing,
      ...updates,
    });
    return true;
  }
  
  addAuditEvent(sessionId: string, event: AuditEvent): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.auditLog.push(event);
    return true;
  }
  
  getAuditLog(sessionId: string): AuditEvent[] {
    const session = this.sessions.get(sessionId);
    return session?.auditLog || [];
  }
  
  closeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.policies.delete(sessionId);
  }
  
  // Auto-purge old data
  purgeOldData(maxAge: number = 168): number {
    // hours
    const now = new Date();
    let purgedCount = 0;
    
    for (const [sessionId, session] of this.sessions) {
      const age =
        (now.getTime() - session.auditLog[0]?.timestamp.getTime()) /
        (1000 * 60 * 60);
      
      if (age > maxAge && session.dataRetention.autoPurge) {
        this.closeSession(sessionId);
        purgedCount++;
      }
    }
    
    return purgedCount;
  }
}

// Global quarantine manager instance
export const quarantineManager = new QuarantineManager();

// ============================================================================
// Host Pattern Matching
// ============================================================================

function matchHostPattern(hostname: string, pattern: string): boolean {
  // Exact match
  if (hostname === pattern.toLowerCase()) {
    return true;
  }
  
  // Wildcard match (*.example.com)
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2).toLowerCase();
    return hostname.endsWith(suffix);
  }
  
  // IP range match (e.g., 192.168.*)
  if (pattern.includes('*')) {
    const regex = new RegExp(
      '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$'
    );
    return regex.test(hostname);
  }
  
  return false;
}

// ============================================================================
// Approval Workflow
// ============================================================================

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  action: ActionType;
  target?: string;
  params?: Record<string, unknown>;
  timestamp: Date;
  expiresAt: Date;
}

export interface ApprovalResponse {
  approved: boolean;
  reason?: string;
  approvedBy?: string;
  approvedAt?: Date;
}

export class ApprovalQueue {
  private pending: Map<string, ApprovalRequest> = new Map();
  private responses: Map<string, ApprovalResponse> = new Map();
  
  requestApproval(request: ApprovalRequest): void {
    this.pending.set(request.id, request);
  }
  
  respondToApproval(requestId: string, response: ApprovalResponse): boolean {
    if (!this.pending.has(requestId)) return false;
    
    this.responses.set(requestId, response);
    this.pending.delete(requestId);
    return true;
  }
  
  getPendingApprovals(sessionId?: string): ApprovalRequest[] {
    const all = Array.from(this.pending.values());
    if (sessionId) {
      return all.filter((r) => r.sessionId === sessionId);
    }
    return all;
  }
  
  getResponse(requestId: string): ApprovalResponse | undefined {
    return this.responses.get(requestId);
  }
  
  // Clean up expired requests
  cleanupExpired(): number {
    const now = new Date();
    let cleaned = 0;
    
    for (const [id, request] of this.pending) {
      if (now > request.expiresAt) {
        this.pending.delete(id);
        cleaned++;
      }
    }
    
    return cleaned;
  }
}

export const approvalQueue = new ApprovalQueue();

// ============================================================================
// Export
// ============================================================================

export default {
  DEFAULT_SAFETY_POLICY,
  STRICT_SAFETY_POLICY,
  checkNavigationSafety,
  checkActionSafety,
  quarantineManager,
  approvalQueue,
};
