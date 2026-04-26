/**
 * Allternit Law Layer
 * 
 * Governance and policy engine for allternit.
 * Provides policy-based routing, Beads integration, and receipt generation.
 * 
 * @example
 * ```typescript
 * import { AllternitKernelImpl } from '@allternit/governor';
 * import { LawLayer, PolicyTemplates } from '@allternit/lawlayer';
 * 
 * const kernel = new AllternitKernelImpl(storage);
 * const lawLayer = new LawLayer({ kernel });
 * 
 * // Register policies
 * lawLayer.policies.registerPolicy(
 *   PolicyTemplates.denyTools(['deploy', 'delete_file'])
 * );
 * 
 * // Evaluate a tool use
 * const decision = lawLayer.policies.evaluate({
 *   context: { toolName: 'deploy', ... }
 * });
 * ```
 */

// Types
export type {
  // Policy types
  PolicyScope,
  PolicyRule,
  PolicyCondition,
  PolicyAction,
  Policy,
  LawLayerConfig,
  PolicyDecision,
  PolicyEvaluationRequest,
  PolicyFilter,
  PolicyEngine,
  
  // Beads types
  BeadsIssue,
  BeadsAdapterConfig,
  BeadsFilter,
  BeadsAdapter,
  
  // Receipt types
  ReceiptGeneratorConfig,
  AttestationGenerator,
  AttestationData,
  ReceiptGenerationContext,
  TestResults,
  ReceiptGenerator,
  
  // Error types
  LawLayerError,
  PolicyEvaluationError,
  BeadsAdapterError,
  ReceiptGenerationError,
} from './types.js';

// Policy Engine
export {
  LawPolicyEngine,
  PolicyTemplates,
} from './engine/policy-engine.js';

// Adapters
export {
  BeadsAdapter,
  createBeadsAdapter,
} from './adapters/index.js';

// Receipt Generator
export {
  LawReceiptGenerator,
  createReceiptGenerator,
  BuiltinAttestationGenerators,
} from './receipt-generator.js';

// ============================================================================
// Main Law Layer Class
// ============================================================================

import type { AllternitKernel } from '@allternit/governor';
import type { LawLayerConfig, PolicyDecision, PolicyEvaluationRequest } from './types.js';
import { LawPolicyEngine } from './engine/policy-engine.js';
import { BeadsAdapter } from './adapters/beads-adapter.js';
import { LawReceiptGenerator } from './receipt-generator.js';

/**
 * Main Law Layer class
 * 
 * Provides unified access to all Law Layer features:
 * - Policy engine for governance
 * - Beads adapter for issue tracking
 * - Receipt generator for completion proofs
 */
export class LawLayer {
  public readonly policies: LawPolicyEngine;
  public readonly beads: BeadsAdapter;
  public readonly receipts: LawReceiptGenerator;
  public readonly kernel: AllternitKernel;
  public readonly config: LawLayerConfig;

  constructor(config: LawLayerConfig) {
    this.config = config;
    this.kernel = config.kernel;
    
    // Initialize components
    this.policies = new LawPolicyEngine(config);
    this.beads = new BeadsAdapter(this.kernel);
    this.receipts = new LawReceiptGenerator({
      kernel: this.kernel,
      autoGenerate: true,
      includeGitCommit: true,
      includeTestResults: true,
    });
  }

  /**
   * Get Law Layer version
   */
  get version(): string {
    return '1.0.0';
  }

  /**
   * Evaluate a request through the policy engine
   */
  evaluate(request: PolicyEvaluationRequest): PolicyDecision {
    return this.policies.evaluate(request);
  }

  /**
   * Check if operation is allowed
   */
  isAllowed(request: PolicyEvaluationRequest): boolean {
    const decision = this.evaluate(request);
    return decision.decision === 'allow';
  }

  /**
   * Get Law Layer status
   */
  getStatus(): {
    version: string;
    policies: number;
    enabledPolicies: number;
  } {
    const allPolicies = this.policies.listPolicies();
    return {
      version: this.version,
      policies: allPolicies.length,
      enabledPolicies: allPolicies.filter(p => p.enabled).length,
    };
  }

  /**
   * Dispose of the Law Layer
   */
  async dispose(): Promise<void> {
    // Clean up any resources
  }
}

/**
 * Create Law Layer instance
 */
export function createLawLayer(config: LawLayerConfig): LawLayer {
  return new LawLayer(config);
}

/**
 * Quick policy check function
 * 
 * Usage:
 * ```typescript
 * import { checkPolicy, PolicyTemplates } from '@allternit/lawlayer';
 * 
 * const allowed = await checkPolicy(kernel, {
 *   toolName: 'deploy',
 *   sessionId: 'sess-1',
 *   agentId: 'agent-1',
 *   workspaceRoot: '/project',
 * });
 * ```
 */
export function checkPolicy(
  kernel: AllternitKernel,
  context: PolicyEvaluationRequest['context']
): PolicyDecision {
  const layer = new LawLayer({ kernel });
  return layer.evaluate({ context });
}

/**
 * Built-in policy presets
 */
export const PolicyPresets = {
  /**
   * Development environment policies
   */
  development: () => [
    PolicyTemplates.requireWih(),
    PolicyTemplates.denyTools(['deploy', 'delete_file']),
  ],

  /**
   * Production environment policies (more restrictive)
   */
  production: () => [
    PolicyTemplates.requireWih(),
    PolicyTemplates.denyTools(['deploy', 'delete_file', 'exec', 'bash']),
    PolicyTemplates.readOnlyFiles(),
  ],

  /**
   * Audit mode policies (read-only)
   */
  audit: () => [
    PolicyTemplates.requireWih(),
    PolicyTemplates.readOnlyFiles(),
    PolicyTemplates.allowTools(['read_file', 'list_files', 'search_files']),
  ],
};
