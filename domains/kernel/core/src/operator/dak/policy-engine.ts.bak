/**
 * Policy Engine
 * 
 * Evaluates tool calls against policies and produces decisions:
 * - ALLOW: Proceed with execution
 * - BLOCK: Deny execution
 * - TRANSFORM: Execute with modified arguments
 * - REQUIRE_APPROVAL: Halt for explicit approval
 */

// Type stub — PolicyConstraints not yet implemented
type PolicyConstraints = Record<string, unknown>;

export type PolicyDecisionType = 'ALLOW' | 'BLOCK' | 'TRANSFORM' | 'REQUIRE_APPROVAL';

export interface PolicyDecision {
  type: PolicyDecisionType;
  reason?: string;
  transformedArgs?: Record<string, unknown>;
}

export interface PolicyEvaluationRequest {
  tool: string;
  args: Record<string, unknown>;
  role: string;
  context: PolicyConstraints;
}

export interface PolicyRule {
  name: string;
  priority: number;
  condition: (request: PolicyEvaluationRequest) => boolean;
  action: 'ALLOW' | 'BLOCK' | 'TRANSFORM' | 'REQUIRE_APPROVAL';
  transform?: (request: PolicyEvaluationRequest) => Record<string, unknown>;
  reason?: string;
}

export class PolicyEngine {
  private rules: PolicyRule[] = [];
  private defaultAction: PolicyDecisionType = 'REQUIRE_APPROVAL';

  constructor() {
    this.registerDefaultRules();
  }

  /**
   * Register a policy rule
   */
  registerRule(rule: PolicyRule): void {
    // Insert by priority (higher first)
    const index = this.rules.findIndex(r => r.priority < rule.priority);
    if (index === -1) {
      this.rules.push(rule);
    } else {
      this.rules.splice(index, 0, rule);
    }
  }

  /**
   * Evaluate a tool call against all registered rules
   */
  async evaluate(request: PolicyEvaluationRequest): Promise<PolicyDecision> {
    console.log(`[PolicyEngine] Evaluating: tool=${request.tool}, role=${request.role}`);
    // Check rules in priority order
    for (const rule of this.rules) {
      if (rule.condition(request)) {
        console.log(`[PolicyEngine] Matched rule: ${rule.name} -> ${rule.action}`);
        const decision: PolicyDecision = {
          type: rule.action,
          reason: rule.reason || `Matched rule: ${rule.name}`,
        };

        if (rule.action === 'TRANSFORM' && rule.transform) {
          decision.transformedArgs = rule.transform(request);
        }

        return decision;
      }
    }

    // No rules matched - use default
    return {
      type: this.defaultAction,
      reason: 'No policy rules matched; default action applied',
    };
  }

  /**
   * Set the default action when no rules match
   */
  setDefaultAction(action: PolicyDecisionType): void {
    this.defaultAction = action;
  }

  /**
   * Get all registered rules
   */
  getRules(): PolicyRule[] {
    return [...this.rules];
  }

  /**
   * Register default policy rules
   */
  private registerDefaultRules(): void {
    // Rule: Block dangerous bash commands
    this.registerRule({
      name: 'block-dangerous-bash',
      priority: 100,
      condition: (req) => {
        if (req.tool !== 'Bash') return false;
        const command = (req.args.command as string) || '';
        const dangerous = [
          'rm -rf /',
          '> /dev/null',
          'mkfs',
          'dd if=/dev/zero',
          ':(){:|:&};:',
        ];
        return dangerous.some(d => command.includes(d));
      },
      action: 'BLOCK',
      reason: 'Dangerous bash command detected',
    });

    // Rule: Require approval for destructive file operations
    this.registerRule({
      name: 'require-approval-delete',
      priority: 90,
      condition: (req) => {
        if (req.tool !== 'Bash') return false;
        const command = (req.args.command as string) || '';
        return command.includes('rm -rf') || command.includes('rm -f');
      },
      action: 'REQUIRE_APPROVAL',
      reason: 'Destructive file operation requires explicit approval',
    });

    // Rule: Block writes to protected paths
    this.registerRule({
      name: 'block-protected-paths',
      priority: 95,
      condition: (req) => {
        const path = req.args.path as string | undefined;
        if (!path) return false;
        
        const protectedPaths = [
          '.allternit/ledger',
          '.allternit/leases',
          '.allternit/wih',
          '.allternit/graphs',
          '.allternit/spec',
        ];
        
        return protectedPaths.some(p => path.includes(p));
      },
      action: 'BLOCK',
      reason: 'Write to protected system path attempted',
    });

    // Rule: Validator role is read-only
    this.registerRule({
      name: 'validator-readonly',
      priority: 85,
      condition: (req) => {
        if (req.role !== 'validator') return false;
        const writeTools = ['Write', 'Edit', 'Bash'];
        return writeTools.includes(req.tool);
      },
      action: 'BLOCK',
      reason: 'Validator role cannot modify files',
    });

    // Rule: Reviewer role is read-only
    this.registerRule({
      name: 'reviewer-readonly',
      priority: 85,
      condition: (req) => {
        if (req.role !== 'reviewer') return false;
        const writeTools = ['Write', 'Edit', 'Bash'];
        return writeTools.includes(req.tool);
      },
      action: 'BLOCK',
      reason: 'Reviewer role cannot modify files',
    });

    // Rule: Security role can only read and analyze
    this.registerRule({
      name: 'security-readonly',
      priority: 85,
      condition: (req) => {
        if (req.role !== 'security') return false;
        const forbiddenTools = ['Write', 'Edit'];
        return forbiddenTools.includes(req.tool);
      },
      action: 'BLOCK',
      reason: 'Security role cannot modify files',
    });

    // Rule: Transform network policy violations
    this.registerRule({
      name: 'network-policy-restrict',
      priority: 80,
      condition: (req) => {
        if (req.context.network_policy !== 'none') return false;
        const networkTools = ['Fetch', 'WebSearch', 'WebFetch'];
        return networkTools.includes(req.tool);
      },
      action: 'BLOCK',
      reason: 'Network access blocked by policy',
    });

    // Rule: Allow read operations
    this.registerRule({
      name: 'allow-reads',
      priority: 10,
      condition: (req) => {
        const readTools = ['Read', 'Glob', 'Grep', 'Search'];
        return readTools.includes(req.tool);
      },
      action: 'ALLOW',
      reason: 'Read operations are allowed',
    });

    // Rule: Allow in plan-only mode
    this.registerRule({
      name: 'plan-only-mode',
      priority: 5,
      condition: (req) => {
        // This would check execution mode from broader context
        // For now, allow common planning tools
        const planTools = ['Read', 'Glob', 'Grep', 'Search'];
        return planTools.includes(req.tool);
      },
      action: 'ALLOW',
      reason: 'Plan-only mode allows read operations',
    });

    // Rule: Allow operator role to use interaction tools
    this.registerRule({
      name: 'operator-interaction',
      priority: 1000,
      condition: (req) => {
        return req.role === 'operator';
      },
      action: 'ALLOW',
      reason: 'Operator role is permitted all actions in this session',
    });
  }
}

// Factory function
export function createPolicyEngine(): PolicyEngine {
  return new PolicyEngine();
}
