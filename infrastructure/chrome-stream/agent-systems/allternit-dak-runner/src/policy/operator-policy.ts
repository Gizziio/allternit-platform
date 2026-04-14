/**
 * Operator Policy Enforcement Layer
 * 
 * Enforces privacy and security policies for operator tasks.
 * Integrates with the 2-governance/policy-engine for centralized policy management.
 * 
 * Features:
 * - Task sensitivity classification
 * - Tool-level policy checks
 * - Approval gates for high-risk actions
 * - Model routing enforcement (local vs external)
 * - PII/student data detection
 */

import { EventEmitter } from 'events';

/**
 * Policy decision types
 */
export type PolicyDecision = 'ALLOW' | 'BLOCK' | 'REQUIRE_APPROVAL' | 'TRANSFORM';

/**
 * Risk level for policy evaluation
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

/**
 * Data classification levels
 */
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

/**
 * Model routing targets
 */
export type ModelRouting = 'local' | 'private_cloud' | 'external';

/**
 * Policy context for evaluation
 */
export interface PolicyContext {
  // User context
  userId: string;
  userRole: string;
  tenantId?: string;
  
  // Task context
  intent: string;
  targetSystem: string;
  targetContext: Record<string, unknown>;
  
  // Execution context
  requestedTools: string[];
  backend: string;
  executionMode: 'plan_only' | 'plan_then_execute' | 'execute_direct';
  
  // Data context
  containsPII?: boolean;
  containsStudentData?: boolean;
  dataClassification?: DataClassification;
}

/**
 * Policy rule definition
 */
export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  
  // Conditions
  conditions: {
    field: string;
    operator: 'equals' | 'contains' | 'in' | 'gt' | 'lt' | 'regex';
    value: unknown;
  }[];
  
  // Decision
  decision: PolicyDecision;
  riskLevel?: RiskLevel;
  allowedTools?: string[];
  forbiddenTools?: string[];
  requireApproval?: boolean;
  modelRouting?: ModelRouting;
  
  // Metadata
  priority: number; // Higher = evaluated first
  enabled: boolean;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  allowed: boolean;
  decision: PolicyDecision;
  riskLevel: RiskLevel;
  rules: Array<{
    ruleId: string;
    ruleName: string;
    decision: PolicyDecision;
    reason?: string;
  }>;
  requireApproval: boolean;
  modelRouting: ModelRouting;
  allowedTools: string[];
  forbiddenTools: string[];
  warnings: string[];
  errors: string[];
}

/**
 * Default policy rules for education/School context
 */
export const DEFAULT_SCHOOL_POLICY_RULES: PolicyRule[] = [
  // Block external model routing for student data
  {
    id: 'student-data-external-block',
    name: 'Block External Models for Student Data',
    description: 'Prevent sending student data to external AI models',
    conditions: [
      { field: 'containsStudentData', operator: 'equals', value: true },
      { field: 'dataClassification', operator: 'in', value: ['confidential', 'restricted'] },
    ],
    decision: 'BLOCK',
    riskLevel: 'critical',
    modelRouting: 'local',
    priority: 100,
    enabled: true,
  },
  
  // Require approval for high-risk tools
  {
    id: 'high-risk-approval',
    name: 'Require Approval for High-Risk Tools',
    description: 'Human approval required for destructive operations',
    conditions: [
      { field: 'requestedTools', operator: 'contains', value: 'desktop.click' },
      { field: 'requestedTools', operator: 'contains', value: 'desktop.type' },
    ],
    decision: 'REQUIRE_APPROVAL',
    riskLevel: 'high',
    requireApproval: true,
    priority: 90,
    enabled: true,
  },
  
  // Allow read-only Canvas operations
  {
    id: 'canvas-read-allow',
    name: 'Allow Canvas Read Operations',
    description: 'Read-only Canvas API calls are low risk',
    conditions: [
      { field: 'targetSystem', operator: 'equals', value: 'Canvas' },
      { field: 'requestedTools', operator: 'in', value: [['canvas.list_courses', 'canvas.list_modules', 'canvas.search_course']] },
    ],
    decision: 'ALLOW',
    riskLevel: 'low',
    priority: 80,
    enabled: true,
  },
  
  // Require approval for Canvas write operations
  {
    id: 'canvas-write-approval',
    name: 'Require Approval for Canvas Write Operations',
    description: 'Canvas modifications require explicit approval',
    conditions: [
      { field: 'targetSystem', operator: 'equals', value: 'Canvas' },
      { field: 'requestedTools', operator: 'in', value: [['canvas.create_module', 'canvas.create_page', 'canvas.create_assignment']] },
    ],
    decision: 'REQUIRE_APPROVAL',
    riskLevel: 'medium',
    requireApproval: true,
    priority: 80,
    enabled: true,
  },
  
  // Block PII to external models
  {
    id: 'pii-external-block',
    name: 'Block PII to External Models',
    description: 'Prevent sending personally identifiable information externally',
    conditions: [
      { field: 'containsPII', operator: 'equals', value: true },
    ],
    decision: 'BLOCK',
    riskLevel: 'critical',
    modelRouting: 'local',
    priority: 100,
    enabled: true,
  },
  
  // Allow browser automation for Canvas
  {
    id: 'canvas-browser-allow',
    name: 'Allow Canvas Browser Automation',
    description: 'Browser automation for Canvas is approved',
    conditions: [
      { field: 'targetSystem', operator: 'equals', value: 'Canvas' },
      { field: 'backend', operator: 'equals', value: 'browser_automation' },
    ],
    decision: 'ALLOW',
    riskLevel: 'medium',
    priority: 70,
    enabled: true,
  },
];

/**
 * Policy Engine class
 */
export class PolicyEngine extends EventEmitter {
  private rules: PolicyRule[];
  private defaultModelRouting: ModelRouting = 'private_cloud';

  constructor(rules: PolicyRule[] = DEFAULT_SCHOOL_POLICY_RULES) {
    super();
    this.rules = rules.filter(r => r.enabled);
    // Sort by priority (higher first)
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate a policy context
   */
  evaluate(context: PolicyContext): PolicyEvaluationResult {
    this.emit('policy:evaluate', context);

    const result: PolicyEvaluationResult = {
      allowed: true,
      decision: 'ALLOW',
      riskLevel: 'low',
      rules: [],
      requireApproval: false,
      modelRouting: this.defaultModelRouting,
      allowedTools: [],
      forbiddenTools: [],
      warnings: [],
      errors: [],
    };

    // Evaluate each rule
    for (const rule of this.rules) {
      if (!this.matchesConditions(context, rule.conditions)) {
        continue;
      }

      // Rule matched
      result.rules.push({
        ruleId: rule.id,
        ruleName: rule.name,
        decision: rule.decision,
        reason: rule.description,
      });

      // Apply rule decision
      switch (rule.decision) {
        case 'BLOCK':
          result.allowed = false;
          result.decision = 'BLOCK';
          if (rule.riskLevel) {
            result.riskLevel = rule.riskLevel;
          }
          break;

        case 'REQUIRE_APPROVAL':
          result.requireApproval = true;
          if (rule.riskLevel && result.riskLevel !== 'critical') {
            result.riskLevel = rule.riskLevel;
          }
          break;

        case 'ALLOW':
          if (rule.allowedTools) {
            result.allowedTools.push(...rule.allowedTools);
          }
          if (rule.riskLevel && result.riskLevel === 'low') {
            result.riskLevel = rule.riskLevel;
          }
          break;

        case 'TRANSFORM':
          // Transform logic would go here
          break;
      }

      // Apply model routing
      if (rule.modelRouting) {
        result.modelRouting = rule.modelRouting;
      }

      // Apply tool restrictions
      if (rule.forbiddenTools) {
        result.forbiddenTools.push(...rule.forbiddenTools);
      }

      // If blocked, stop evaluation
      if (!result.allowed) {
        result.errors.push(`Blocked by policy: ${rule.name}`);
        break;
      }
    }

    // Add warnings for high-risk operations
    if (result.riskLevel === 'high' || result.riskLevel === 'critical') {
      result.warnings.push(`High-risk operation (${result.riskLevel})`);
    }

    // Add warnings for PII/student data
    if (context.containsPII) {
      result.warnings.push('Task contains personally identifiable information');
    }
    if (context.containsStudentData) {
      result.warnings.push('Task contains student data - privacy restrictions apply');
    }

    this.emit('policy:evaluated', result);
    return result;
  }

  /**
   * Check if conditions match context
   */
  private matchesConditions(context: PolicyContext, conditions: PolicyRule['conditions']): boolean {
    for (const condition of conditions) {
      const value = this.getFieldValue(context, condition.field);
      
      if (!this.matchesCondition(value, condition)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get field value from context
   */
  private getFieldValue(context: PolicyContext, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = context;
    
    for (const part of parts) {
      if (typeof value !== 'object' || value === null) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }
    
    return value;
  }

  /**
   * Check if a single condition matches
   */
  private matchesCondition(value: unknown, condition: PolicyRule['conditions'][0]): boolean {
    switch (condition.operator) {
      case 'equals':
        return value === condition.value;
      
      case 'contains':
        if (Array.isArray(value)) {
          return value.includes(condition.value as string);
        }
        if (typeof value === 'string') {
          return value.includes(condition.value as string);
        }
        return false;
      
      case 'in':
        if (Array.isArray(condition.value)) {
          return (condition.value as unknown[]).includes(value);
        }
        return false;
      
      case 'gt':
        return typeof value === 'number' && value > (condition.value as number);
      
      case 'lt':
        return typeof value === 'number' && value < (condition.value as number);
      
      case 'regex':
        if (typeof value !== 'string') return false;
        try {
          const regex = new RegExp(condition.value as string);
          return regex.test(value);
        } catch {
          return false;
        }
      
      default:
        return false;
    }
  }

  /**
   * Add a new policy rule
   */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
    this.emit('policy:rule-added', rule);
  }

  /**
   * Remove a policy rule
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
    this.emit('policy:rule-removed', ruleId);
  }

  /**
   * Get all rules
   */
  getRules(): PolicyRule[] {
    return [...this.rules];
  }

  /**
   * Detect PII in text (simplified - in production use proper NLP)
   */
  detectPII(text: string): boolean {
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{10,}\b/, // Phone numbers (simplified)
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{16}\b/, // Credit card (simplified)
    ];
    
    return piiPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Detect student data indicators
   */
  detectStudentData(context: Record<string, unknown>): boolean {
    const studentIndicators = [
      'student',
      'grade',
      'enrollment',
      'transcript',
      'gpa',
      'attendance',
      'discipline',
      'iep', // Individualized Education Program
      '504', // 504 plan
    ];
    
    const text = JSON.stringify(context).toLowerCase();
    return studentIndicators.some(indicator => text.includes(indicator));
  }

  /**
   * Classify data sensitivity
   */
  classifyData(context: PolicyContext): DataClassification {
    if (context.containsPII || context.containsStudentData) {
      return 'restricted';
    }
    
    if (context.targetSystem === 'Canvas' || context.tenantId) {
      return 'confidential';
    }
    
    if (context.userRole === 'admin' || context.userRole === 'teacher') {
      return 'internal';
    }
    
    return 'public';
  }
}

/**
 * Policy enforcement middleware for operator requests
 */
export class OperatorPolicyMiddleware {
  private engine: PolicyEngine;

  constructor(engine: PolicyEngine) {
    this.engine = engine;
  }

  /**
   * Enforce policy on operator request
   */
  async enforce(
    context: PolicyContext
  ): Promise<{
    allowed: boolean;
    result: PolicyEvaluationResult;
    enrichedContext: PolicyContext;
  }> {
    // Enrich context with detected sensitivity
    const enrichedContext = {
      ...context,
      containsPII: context.containsPII ?? this.engine.detectPII(context.intent),
      containsStudentData: context.containsStudentData ?? 
        this.engine.detectStudentData(context.targetContext),
      dataClassification: context.dataClassification ?? 
        this.engine.classifyData(context),
    };

    // Evaluate policy
    const result = this.engine.evaluate(enrichedContext);

    return {
      allowed: result.allowed || result.requireApproval,
      result,
      enrichedContext,
    };
  }
}

/**
 * Factory function to create policy engine
 */
export function createPolicyEngine(rules?: PolicyRule[]): PolicyEngine {
  return new PolicyEngine(rules);
}

/**
 * Factory function to create operator policy middleware
 */
export function createOperatorPolicyMiddleware(engine?: PolicyEngine): OperatorPolicyMiddleware {
  const policyEngine = engine ?? createPolicyEngine();
  return new OperatorPolicyMiddleware(policyEngine);
}
