/**
 * Tool Enforcement Layer
 * 
 * Validates tool calls against:
 * - ToolRegistry schema
 * - WIH allowed/forbidden tool sets
 * - PolicyEngine decisions
 * - Path guards and protected paths
 */

import { ToolRegistry } from './registry';
import { PolicyEngine, PolicyDecision } from '../policy_engine/engine';
import { 
  ToolCall, 
  ToolResult, 
  PolicyConstraints,
  GateDecision,
  WihId,
  RunId,
} from '../types';

export interface EnforcementContext {
  runId: RunId;
  wihId: WihId;
  role: string;
  policyConstraints: PolicyConstraints;
  leasePaths?: string[];
}

export interface EnforcementResult {
  decision: GateDecision;
  reason?: string;
  transformedArgs?: Record<string, unknown>;
}

export class ToolEnforcement {
  private registry: ToolRegistry;
  private policyEngine: PolicyEngine;

  constructor(registry: ToolRegistry, policyEngine: PolicyEngine) {
    this.registry = registry;
    this.policyEngine = policyEngine;
  }

  /**
   * Enforce tool call against all constraints
   * Returns ALLOW, BLOCK, TRANSFORM, or REQUIRE_APPROVAL
   */
  async enforce(
    toolCall: ToolCall,
    context: EnforcementContext
  ): Promise<EnforcementResult> {
    const { role, policyConstraints, leasePaths } = context;

    // Step 1: Check if tool exists in registry
    if (!this.registry.hasTool(toolCall.tool)) {
      return {
        decision: 'BLOCK',
        reason: `Tool ${toolCall.tool} not found in registry`,
      };
    }

    // Step 2: Check WIH allowed_tools
    if (policyConstraints.allowed_tools.length > 0) {
      const isAllowed = policyConstraints.allowed_tools.some(allowed => {
        // Exact match
        if (allowed === toolCall.tool) return true;
        // Regex match
        const regex = new RegExp(allowed);
        return regex.test(toolCall.tool);
      });

      if (!isAllowed) {
        return {
          decision: 'BLOCK',
          reason: `Tool ${toolCall.tool} not in WIH allowed_tools`,
        };
      }
    }

    // Step 3: Check forbidden_tools
    const isForbidden = policyConstraints.forbidden_tools.some(forbidden => {
      if (forbidden === toolCall.tool) return true;
      const regex = new RegExp(forbidden);
      return regex.test(toolCall.tool);
    });

    if (isForbidden) {
      return {
        decision: 'BLOCK',
        reason: `Tool ${toolCall.tool} is explicitly forbidden`,
      };
    }

    // Step 4: Validate schema
    const validation = this.registry.validateArgs(toolCall.tool, toolCall.args);
    if (!validation.valid) {
      return {
        decision: 'BLOCK',
        reason: `Schema validation failed: ${validation.errors.join(', ')}`,
      };
    }

    // Step 5: Check if tool modifies filesystem and validate paths
    if (this.registry.modifiesFilesystem(toolCall.tool)) {
      const pathCheck = this.validatePaths(toolCall, policyConstraints, leasePaths);
      if (!pathCheck.valid) {
        return {
          decision: 'BLOCK',
          reason: pathCheck.reason,
        };
      }
    }

    // Step 6: Check if tool is dangerous
    if (this.registry.isDangerous(toolCall.tool)) {
      // Dangerous tools always require policy engine evaluation
      const policyDecision = await this.policyEngine.evaluate({
        tool: toolCall.tool,
        args: toolCall.args,
        role,
        context: policyConstraints,
      });

      return this.translatePolicyDecision(policyDecision);
    }

    // Step 7: Standard policy evaluation
    const policyDecision = await this.policyEngine.evaluate({
      tool: toolCall.tool,
      args: toolCall.args,
      role,
      context: policyConstraints,
    });

    return this.translatePolicyDecision(policyDecision);
  }

  /**
   * Validate paths for filesystem-modifying tools
   */
  private validatePaths(
    toolCall: ToolCall,
    constraints: PolicyConstraints,
    leasePaths?: string[]
  ): { valid: boolean; reason?: string } {
    // Extract path from args
    const path = toolCall.args.path as string | undefined;
    if (!path) {
      return { valid: true }; // No path to validate
    }

    // Check forbidden globs
    for (const forbidden of constraints.write_scope.forbidden_globs) {
      if (this.matchGlob(path, forbidden)) {
        return {
          valid: false,
          reason: `Path ${path} matches forbidden glob: ${forbidden}`,
        };
      }
    }

    // Check allowed globs
    let inAllowedScope = false;
    for (const allowed of constraints.write_scope.allowed_globs) {
      if (this.matchGlob(path, allowed)) {
        inAllowedScope = true;
        break;
      }
    }

    if (!inAllowedScope) {
      return {
        valid: false,
        reason: `Path ${path} not in allowed write scope`,
      };
    }

    // Check lease paths (if in lease_scoped mode)
    if (constraints.write_scope.mode === 'lease_scoped' && leasePaths) {
      const inLease = leasePaths.some(leasePath => 
        path.startsWith(leasePath) || this.matchGlob(path, leasePath)
      );
      if (!inLease) {
        return {
          valid: false,
          reason: `Path ${path} not covered by active lease`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Translate policy engine decision to gate decision
   */
  private translatePolicyDecision(policyDecision: PolicyDecision): EnforcementResult {
    switch (policyDecision.type) {
      case 'ALLOW':
        return { decision: 'ALLOW' };
      
      case 'BLOCK':
        return { 
          decision: 'BLOCK',
          reason: policyDecision.reason,
        };
      
      case 'TRANSFORM':
        return {
          decision: 'TRANSFORM',
          transformedArgs: policyDecision.transformedArgs,
          reason: policyDecision.reason,
        };
      
      case 'REQUIRE_APPROVAL':
        return {
          decision: 'REQUIRE_APPROVAL',
          reason: policyDecision.reason,
        };
      
      default:
        return {
          decision: 'BLOCK',
          reason: 'Unknown policy decision type',
        };
    }
  }

  /**
   * Simple glob matching (supports * and **)
   */
  private matchGlob(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }
}

// Factory
export function createToolEnforcement(
  registry: ToolRegistry,
  policyEngine: PolicyEngine
): ToolEnforcement {
  return new ToolEnforcement(registry, policyEngine);
}
