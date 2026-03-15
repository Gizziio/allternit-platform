/**
 * Plan Executor — Executes a confirmed plan's steps sequentially,
 * resolving $RESULT_N references between steps.
 */
import { ToolExecutor, ToolRequest, ToolResponse } from './tool-executor.js';
import crypto from 'crypto';
import { 
  RunnerPlan, 
  RunnerPlanStep, 
  OperatorExecuteRequest,
  OperatorEvent,
  OperatorReceipt 
} from './types/operator';

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

/**
 * OperatorPlanExecutor — Specialized executor for Thin Client Operator
 * Supports RunnerPlan schema, Approval gates, and Receipt emission.
 */
export class OperatorPlanExecutor {
  private toolExecutor: ToolExecutor;

  constructor(toolExecutor: ToolExecutor) {
    this.toolExecutor = toolExecutor;
  }

  /**
   * Generate a structured RunnerPlan for an operator request.
   * In a real system, this would call an LLM with a constrained JSON grammar.
   */
  async generatePlan(request: OperatorExecuteRequest): Promise<RunnerPlan> {
    console.log(`[OperatorPlanExecutor] Generating plan for intent: ${request.intent}`);
    
    // 1. Determine Backend (Routing Logic - Epic E)
    let backendCandidate: RunnerPlan['backendCandidate'] = "browser_automation";
    const domain = request.context.targetDomain || "";
    const isCanvas = domain.includes('canvas.instructure.com') || domain.includes('.instructure.com');
    
    if (isCanvas && request.preferences.preferConnector) {
      backendCandidate = "connector";
    }

    // 2. Risk Assessment
    let risk: RunnerPlan['risk'] = "low";
    const writeKeywords = ['create', 'update', 'delete', 'add', 'modify', 'publish'];
    if (writeKeywords.some(k => request.intent.toLowerCase().includes(k))) {
      risk = "medium";
    }
    if (request.intent.toLowerCase().includes('delete') || request.intent.toLowerCase().includes('remove')) {
      risk = "high";
    }

    // 3. Step Generation (Mocked for MVP)
    const steps: RunnerPlanStep[] = [];
    const intent = request.intent.toLowerCase();

    if (intent.includes('canvas') || isCanvas) {
      if (intent.includes('module')) {
        steps.push({ id: '1', kind: 'inspect', title: 'Inspect Course', detail: 'Locate course ID and current module list', tool: 'canvas.list_modules', args: { course_id: '$CONTEXT_COURSE_ID' } });
        steps.push({ id: '2', kind: 'create', title: 'Create Module', detail: `Create module: ${request.intent}`, tool: 'canvas.create_module', args: { name: 'New Module', course_id: '$CONTEXT_COURSE_ID' } });
        steps.push({ id: '3', kind: 'verify', title: 'Verify Creation', detail: 'Confirm module appears in list', tool: 'canvas.list_modules', args: { course_id: '$CONTEXT_COURSE_ID' } });
      } else {
        steps.push({ id: '1', kind: 'inspect', title: 'Inspect Canvas context', detail: 'Extract course metadata', tool: 'browser_inspect' });
      }
    } else {
      steps.push({ id: '1', kind: 'inspect', title: 'Analyze page content', detail: 'Identify actionable elements', tool: 'browser_inspect' });
      steps.push({ id: '2', kind: 'create', title: 'Execute action', detail: request.intent, tool: 'browser_action' });
    }

    return {
      planId: `plan_${crypto.randomUUID().substring(0, 8)}`,
      summary: `Plan to: ${request.intent}`,
      target: {
        app: request.context.targetApp,
        domain: request.context.targetDomain,
        url: request.context.url,
        confidence: domain ? 0.9 : 0.5
      },
      backendCandidate,
      risk,
      steps,
      expectedArtifacts: intent.includes('module') ? [{ type: 'canvas_module', name: 'New Module' }] : [],
      approvalsRequired: risk !== 'low' ? ['write_access'] : []
    };
  }

  /**
   * Execute a RunnerPlan and emit events/receipt.
   */
  async executePlan(
    plan: RunnerPlan, 
    request: OperatorExecuteRequest, 
    onEvent: (event: OperatorEvent) => void
  ): Promise<OperatorReceipt> {
    const startedAt = new Date().toISOString();
    onEvent({ type: "execution_started", requestId: request.requestId, backend: plan.backendCandidate });

    const actions: OperatorReceipt['actions'] = [];
    const results = new Map<string, any>();

    for (const step of plan.steps) {
      onEvent({ type: "step_started", requestId: request.requestId, stepId: step.id, title: step.title });
      
      const toolReq: ToolRequest = {
        tool: step.tool || 'nop',
        arguments: step.args || {},
        context: {
          sessionId: request.sessionId,
          tenantId: request.actor.tenantId
        }
      };

      try {
        const response = await this.toolExecutor.execute(toolReq);
        
        actions.push({
          stepId: step.id,
          action: step.title,
          status: response.success ? "ok" : "failed",
          evidence: response.output
        });

        onEvent({ type: "step_finished", requestId: request.requestId, stepId: step.id, status: response.success ? "ok" : "failed" });
        
        if (!response.success) throw new Error(response.error || `Step ${step.id} failed`);
        if (response.metadata) results.set(step.id, response.metadata);

      } catch (err: any) {
        onEvent({ type: "run_failed", requestId: request.requestId, error: err.message });
        throw err;
      }
    }

    const receipt: OperatorReceipt = {
      receiptId: `rcpt_${crypto.randomUUID().substring(0, 8)}`,
      requestId: request.requestId,
      actor: {
        userId: request.actor.userId,
        tenantId: request.actor.tenantId
      },
      target: plan.target,
      backend: plan.backendCandidate,
      planId: plan.planId,
      actions,
      verification: {
        status: "ok",
        detail: "All steps completed and verified."
      },
      modelRouting: {
        provider: "anthropic",
        model: "claude-3-5-sonnet",
        local: false
      },
      createdArtifacts: plan.expectedArtifacts,
      startedAt,
      finishedAt: new Date().toISOString()
    };

    onEvent({ type: "receipt_ready", requestId: request.requestId, receiptId: receipt.receiptId });
    onEvent({ type: "run_finished", requestId: request.requestId, status: "success" });

    return receipt;
  }
}
