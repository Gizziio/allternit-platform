/**
 * Plan Executor — Executes a confirmed plan's steps sequentially,
 * resolving $RESULT_N references between steps.
 */
import { ToolExecutor, ToolRequest, ToolResponse } from './tool-executor.js';
import crypto from 'crypto';

export interface PlanStep {
  id: string;
  tool: string;
  args: Record<string, any>;
}

export interface Plan {
  skill: string;
  confirmed: boolean;
  steps: PlanStep[];
}

export interface StepResult {
  step_id: string;
  tool: string;
  args: Record<string, any>;
  response: ToolResponse;
  result_hash: string;
  status: 'success' | 'failed';
}

export interface PlanReceipt {
  run_id: string;
  skill: string;
  timestamp: string;
  plan_hash: string;
  confirmed: boolean;
  tool_calls: StepResult[];
  status: 'completed' | 'partial' | 'rejected';
}

/**
 * Resolve $RESULT_N references in step arguments.
 * $RESULT_1 → metadata from step with id "step-1"
 * $RESULT_1.id → metadata.id from step-1
 */
function resolveReferences(args: Record<string, any>, results: Map<string, any>): Record<string, any> {
  const resolved: Record<string, any> = {};

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.startsWith('$RESULT_')) {
      const match = value.match(/^\$RESULT_(\d+)(?:\.(.+))?$/);
      if (match) {
        const stepId = `step-${match[1]}`;
        const field = match[2];
        const stepData = results.get(stepId);
        if (stepData) {
          resolved[key] = field ? stepData[field] : (stepData.id || stepData);
        } else {
          resolved[key] = value; // leave unresolved if step hasn't run
        }
      } else {
        resolved[key] = value;
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveReferences(value, results);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

export class PlanExecutor {
  private toolExecutor: ToolExecutor;
  private maxRetries: number;

  constructor(toolExecutor: ToolExecutor, maxRetries = 2) {
    this.toolExecutor = toolExecutor;
    this.maxRetries = maxRetries;
  }

  /**
   * Validate a plan without executing it. Returns the plan hash.
   */
  validatePlan(plan: Plan): { valid: boolean; hash: string; errors: string[] } {
    const errors: string[] = [];

    if (!plan.skill) errors.push('Missing skill name');
    if (!plan.steps || plan.steps.length === 0) errors.push('Plan has no steps');

    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    for (const step of plan.steps || []) {
      if (stepIds.has(step.id)) errors.push(`Duplicate step ID: ${step.id}`);
      stepIds.add(step.id);
      if (!step.tool) errors.push(`Step ${step.id} missing tool`);
    }

    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(plan.steps, Object.keys(plan.steps[0] || {}).sort()))
      .digest('hex')
      .substring(0, 16);

    return { valid: errors.length === 0, hash, errors };
  }

  /**
   * Execute a confirmed plan. Returns a receipt.
   */
  async execute(plan: Plan, context?: any): Promise<PlanReceipt> {
    const runId = crypto.randomUUID();
    const { hash: planHash } = this.validatePlan(plan);

    if (!plan.confirmed) {
      return {
        run_id: runId,
        skill: plan.skill,
        timestamp: new Date().toISOString(),
        plan_hash: planHash,
        confirmed: false,
        tool_calls: [],
        status: 'rejected'
      };
    }

    const results = new Map<string, any>();
    const toolCalls: StepResult[] = [];

    for (const step of plan.steps) {
      const resolvedArgs = resolveReferences(step.args, results);
      let response: ToolResponse | null = null;
      let attempts = 0;

      while (attempts < this.maxRetries) {
        attempts++;
        const request: ToolRequest = {
          tool: step.tool,
          arguments: resolvedArgs,
          context
        };

        response = await this.toolExecutor.execute(request);

        if (response.success) break;

        if (attempts < this.maxRetries) {
          console.warn(`[PlanExecutor] Step ${step.id} failed (attempt ${attempts}/${this.maxRetries}), retrying...`);
        }
      }

      const resultHash = crypto.createHash('sha256')
        .update(response!.output || '')
        .digest('hex')
        .substring(0, 16);

      const stepResult: StepResult = {
        step_id: step.id,
        tool: step.tool,
        args: resolvedArgs,
        response: response!,
        result_hash: resultHash,
        status: response!.success ? 'success' : 'failed'
      };

      toolCalls.push(stepResult);

      if (response!.success && response!.metadata) {
        results.set(step.id, response!.metadata);
      }

      // Stop condition: if step fails after all retries, emit partial receipt
      if (!response!.success) {
        console.error(`[PlanExecutor] Step ${step.id} failed after ${this.maxRetries} attempts. Emitting partial receipt.`);
        return {
          run_id: runId,
          skill: plan.skill,
          timestamp: new Date().toISOString(),
          plan_hash: planHash,
          confirmed: true,
          tool_calls: toolCalls,
          status: 'partial'
        };
      }
    }

    return {
      run_id: runId,
      skill: plan.skill,
      timestamp: new Date().toISOString(),
      plan_hash: planHash,
      confirmed: true,
      tool_calls: toolCalls,
      status: 'completed'
    };
  }
}
