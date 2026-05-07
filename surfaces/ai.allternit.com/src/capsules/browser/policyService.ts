/**
 * Policy Enforcement Service
 * 
 * Implements LAW-TOOL-002: Capability-Based Policy Binding
 * 
 * Policy enforcement bound to tool capability class:
 * - Read: Schema validation
 * - Write: Schema + path validation
 * - Execute: Full policy check
 * - Destructive: Security review
 * - External: Allowlist check
 * 
 * Aligned with:
 * - /Users/macbook/Desktop/spec/BrowserAgent/PolicyTiers.md
 * - SYSTEM_LAW.md LAW-TOOL-002
 */

import { v4 as uuidv4 } from 'uuid';
import { getAuditTrailService } from './auditTrailService';
import { getRedisClient } from '@/lib/redis/client';

// ============================================================================
// Types
// ============================================================================

export type ToolCapability = 'read' | 'write' | 'execute' | 'destructive' | 'external';

export type RiskTier = 0 | 1 | 2 | 3 | 4;

export type PolicyDecision = 'allow' | 'deny' | 'require_confirm';

export interface PolicyCheckRequest {
  toolId: string;
  capability: ToolCapability;
  riskTier: RiskTier;
  target?: {
    host?: string;
    path?: string;
    selector?: string;
  };
  sessionId: string;
  wihId?: string;
}

export interface PolicyCheckResult {
  decision: PolicyDecision;
  reason?: string;
  ruleId?: string;
  requiresConfirmation?: boolean;
  confirmationLevel?: 'primary' | 'secondary';
}

export interface HostAllowlistEntry {
  id: string;
  host: string;
  paths?: string[];
  riskTierLimit?: RiskTier;
  addedAt: string;
  addedBy: string;
}

export interface PolicyConfig {
  defaultRiskTierLimit: RiskTier;
  requireConfirmationForTier3: boolean;
  requireConfirmationForTier4: boolean;
  secondaryConfirmationForTier4: boolean;
}

// ============================================================================
// Policy Store Interface
// ============================================================================

export interface PolicyStore {
  // Host allowlist
  getAllowlist(): Promise<HostAllowlistEntry[]>;
  addToAllowlist(entry: Omit<HostAllowlistEntry, 'id' | 'addedAt'>): Promise<HostAllowlistEntry>;
  removeFromAllowlist(id: string): Promise<void>;
  
  // Configuration
  getConfig(): Promise<PolicyConfig>;
  updateConfig(config: Partial<PolicyConfig>): Promise<void>;
}

// ============================================================================
// In-Memory Store (for development)
// TODO: Replace with persistent storage for production
// ============================================================================

export class InMemoryPolicyStore implements PolicyStore {
  private allowlist: Map<string, HostAllowlistEntry> = new Map();
  private config: PolicyConfig = {
    defaultRiskTierLimit: 2,
    requireConfirmationForTier3: true,
    requireConfirmationForTier4: true,
    secondaryConfirmationForTier4: true,
  };

  async getAllowlist(): Promise<HostAllowlistEntry[]> {
    return Array.from(this.allowlist.values());
  }

  async addToAllowlist(entry: Omit<HostAllowlistEntry, 'id' | 'addedAt'>): Promise<HostAllowlistEntry> {
    const newEntry: HostAllowlistEntry = {
      ...entry,
      id: 'allow_' + uuidv4().slice(0, 8),
      addedAt: new Date().toISOString(),
    };
    this.allowlist.set(newEntry.id, newEntry);
    return newEntry;
  }

  async removeFromAllowlist(id: string): Promise<void> {
    this.allowlist.delete(id);
  }

  async getConfig(): Promise<PolicyConfig> {
    return { ...this.config };
  }

  async updateConfig(config: Partial<PolicyConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
  }
}

// ============================================================================
// Policy Engine
// ============================================================================

export class PolicyEngine {
  private store: PolicyStore;

  constructor(store: PolicyStore) {
    this.store = store;
  }

  /**
   * Check if action is allowed by policy
   * Implements LAW-TOOL-002 capability-based policy binding
   */
  async checkPolicy(request: PolicyCheckRequest): Promise<PolicyCheckResult> {
    const config = await this.store.getConfig();
    const allowlist = await this.store.getAllowlist();
    const audit = getAuditTrailService();

    // Check risk tier limit
    if (request.riskTier > config.defaultRiskTierLimit) {
      const result = {
        decision: 'deny' as const,
        reason: `Risk tier ${request.riskTier} exceeds limit ${config.defaultRiskTierLimit}`,
        ruleId: 'RISK_TIER_LIMIT',
      };
      
      // Log audit event
      await audit.recordPolicyDecision({
        decision: 'deny',
        rule_id: result.ruleId,
        reason: result.reason,
        risk_tier: request.riskTier,
        capability: request.capability,
      });
      
      return result;
    }

    // Check host allowlist for external capabilities
    if (request.capability === 'external' || request.capability === 'read') {
      if (request.target?.host) {
        const isAllowed = allowlist.some(entry => {
          if (!request.target?.host || entry.host !== request.target.host) return false;
          if (entry.paths && request.target?.path) {
            return entry.paths.some(path => request.target?.path?.startsWith(path) ?? false);
          }
          return true;
        });

        if (!isAllowed) {
          const result = {
            decision: 'deny' as const,
            reason: `Host ${request.target.host} not in allowlist`,
            ruleId: 'HOST_ALLOWLIST',
          };
          
          // Log audit event
          await audit.recordPolicyDecision({
            decision: 'deny',
            rule_id: result.ruleId,
            reason: result.reason,
            risk_tier: request.riskTier,
            capability: request.capability,
          });
          
          return result;
        }
      }
    }

    // Check confirmation requirements based on capability and risk tier
    const requiresConfirmation = this.requiresConfirmation(request, config);

    if (requiresConfirmation) {
      const result = {
        decision: 'require_confirm' as const,
        reason: `Confirmation required for ${request.capability} at tier ${request.riskTier}`,
        ruleId: 'CONFIRMATION_REQUIRED',
        requiresConfirmation: true,
        confirmationLevel: request.riskTier === 4 && config.secondaryConfirmationForTier4
          ? 'secondary'
          : 'primary' as 'primary' | 'secondary',
      };
      
      // Log audit event
      await audit.recordPolicyDecision({
        decision: 'require_confirm',
        rule_id: result.ruleId,
        reason: result.reason,
        risk_tier: request.riskTier,
        capability: request.capability,
      });
      
      return result;
    }

    // Log allow decision
    await audit.recordPolicyDecision({
      decision: 'allow',
      risk_tier: request.riskTier,
      capability: request.capability,
    });

    // All checks passed
    return {
      decision: 'allow',
      reason: 'Policy check passed',
    };
  }

  /**
   * Determine if confirmation is required
   */
  private requiresConfirmation(
    request: PolicyCheckRequest,
    config: PolicyConfig
  ): boolean {
    // Tier 4 always requires confirmation
    if (request.riskTier === 4) {
      return config.requireConfirmationForTier4;
    }

    // Tier 3 requires confirmation based on config
    if (request.riskTier === 3) {
      return config.requireConfirmationForTier3;
    }

    // Destructive capabilities always require confirmation
    if (request.capability === 'destructive') {
      return true;
    }

    // Execute capability at tier 2+ requires confirmation
    if (request.capability === 'execute' && request.riskTier >= 2) {
      return true;
    }

    return false;
  }

  /**
   * Get capability from action type
   */
  getCapabilityFromAction(actionType: string): ToolCapability {
    const readActions = ['Navigate', 'Wait', 'Assert', 'Extract', 'Screenshot'];
    const writeActions = ['Type', 'Select'];
    const executeActions = ['Click', 'Scroll'];
    const destructiveActions: string[] = [];  // Define based on your domain
    const externalActions = ['Download'];

    if (readActions.includes(actionType)) return 'read';
    if (writeActions.includes(actionType)) return 'write';
    if (executeActions.includes(actionType)) return 'execute';
    if (destructiveActions.includes(actionType)) return 'destructive';
    if (externalActions.includes(actionType)) return 'external';

    // Default to execute
    return 'execute';
  }

  /**
   * Get risk tier from action type and target
   */
  getRiskTierFromAction(actionType: string, target?: { host?: string; path?: string }): RiskTier {
    // Tier 0: Read-only actions
    if (['Assert', 'Screenshot'].includes(actionType)) {
      return 0;
    }

    // Tier 1: Navigation
    if (['Navigate', 'Wait', 'Scroll'].includes(actionType)) {
      return 1;
    }

    // Tier 2: Form fill without commit
    if (['Type', 'Select', 'Extract'].includes(actionType)) {
      return 2;
    }

    // Tier 3: Commit actions
    if (['Click'].includes(actionType)) {
      // Check if path suggests commit action
      if (target?.path) {
        const commitPaths = ['/submit', '/confirm', '/purchase', '/delete', '/update'];
        if (commitPaths.some(path => target.path!.includes(path))) {
          return 3;
        }
      }
      return 2;  // Default click is tier 2
    }

    // Tier 4: Irreversible actions
    if (['Download'].includes(actionType)) {
      return 4;
    }

    // Default
    return 1;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _policyStore: PolicyStore | null = null;
let _policyEngine: PolicyEngine | null = null;

export function getPolicyStore(): PolicyStore {
  if (!_policyStore) {
    const redis = getRedisClient();
    if (redis) {
      const { RedisPolicyStore } = require('./redisStores') as typeof import('./redisStores');
      _policyStore = new RedisPolicyStore(redis as any);
    } else {
      _policyStore = new InMemoryPolicyStore();
    }
  }
  return _policyStore;
}

export function getPolicyEngine(): PolicyEngine {
  if (!_policyEngine) {
    _policyEngine = new PolicyEngine(getPolicyStore());
  }
  return _policyEngine;
}

