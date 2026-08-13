/**
 * Tool Composition DSL
 *
 * Provides a declarative, composable DSL for defining tool execution
 * workflows. Supports sequence, parallel, condition, and loop primitives
 * that resolve against the active ToolRegistry.
 */

import type { ToolRegistry } from './registry.js';
import type { ToolDefinition } from './types.js';

// ─── Primitive types ─────────────────────────────────────────────────────────

export interface SequenceStep {
  type: 'sequence';
  steps: CompositionStep[];
}

export interface ParallelStep {
  type: 'parallel';
  branches: CompositionStep[];
  /** Maximum number of branches that may run concurrently. Default: all. */
  concurrency?: number;
}

export interface ConditionStep {
  type: 'condition';
  /** Expression evaluated against the shared context to decide which branch. */
  when: string;
  then: CompositionStep;
  else?: CompositionStep;
}

export interface LoopStep {
  type: 'loop';
  /** Expression that resolves to an array from context — each element runs the body. */
  over: string;
  /** The name under which the current element is available in context. */
  as: string;
  body: CompositionStep;
  /** Safety cap on iterations. Default: 50. */
  maxIterations?: number;
}

export interface ToolCallStep {
  type: 'tool_call';
  name: string;
  /** Arguments: literal values or `{{expr}}` template references into context. */
  arguments: Record<string, unknown>;
  /** Context key where the result is stored. Default: `<toolName>_result`. */
  storeAs?: string;
}

export type CompositionStep =
  | SequenceStep
  | ParallelStep
  | ConditionStep
  | LoopStep
  | ToolCallStep;

// ─── Builder API ─────────────────────────────────────────────────────────────

export function sequence(...steps: CompositionStep[]): SequenceStep {
  return { type: 'sequence', steps };
}

export function parallel(...branches: CompositionStep[]): ParallelStep {
  return { type: 'parallel', branches };
}

export function parallelWithConcurrency(
  concurrency: number,
  ...branches: CompositionStep[]
): ParallelStep {
  return { type: 'parallel', branches, concurrency };
}

export function condition(
  when: string,
  then: CompositionStep,
  elseStep?: CompositionStep,
): ConditionStep {
  return { type: 'condition', when, then, else: elseStep };
}

export function loop(
  over: string,
  as: string,
  body: CompositionStep,
  maxIterations?: number,
): LoopStep {
  return { type: 'loop', over, as, body, maxIterations };
}

export function toolCall(
  name: string,
  args: Record<string, unknown>,
  storeAs?: string,
): ToolCallStep {
  return { type: 'tool_call', name, arguments: args, storeAs };
}

// ─── Context ─────────────────────────────────────────────────────────────────

export type CompositionContext = Record<string, unknown>;

// ─── Evaluator ───────────────────────────────────────────────────────────────

/**
 * Resolves a simple dotted expression (e.g. `user.name`) or bracket-indexed
 * path against a flat context object.  Supports `{{expr}}` templates in
 * string values.
 */
function resolveExpression(expr: string, ctx: CompositionContext): unknown {
  // Strip optional surrounding braces
  const cleaned = expr.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
  const parts = cleaned.split('.');
  let current: unknown = ctx;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      current = (current as Record<string, unknown>)[match[1]];
      if (Array.isArray(current)) {
        current = current[parseInt(match[2], 10)];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

/**
 * Resolves `{{expr}}` placeholders inside string values of an arguments object.
 */
function resolveArguments(
  args: Record<string, unknown>,
  ctx: CompositionContext,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string') {
      const templateRe = /\{\{([^}]+)\}\}/g;
      let match: RegExpExecArray | null;
      let hasTemplate = false;
      let result: string = value;
      while ((match = templateRe.exec(value)) !== null) {
        hasTemplate = true;
        const resolved = resolveExpression(match[1], ctx);
        result = result.replace(match[0], resolved == null ? '' : String(resolved));
      }
      // If the entire value was a single template and resolved to a non-string,
      // return the raw value to preserve types (numbers, booleans, objects).
      if (hasTemplate) {
        const fullMatch = value.match(/^\{\{([^}]+)\}\}$/);
        if (fullMatch) {
          const raw = resolveExpression(fullMatch[1], ctx);
          resolved[key] = raw ?? result;
        } else {
          resolved[key] = result;
        }
      } else {
        resolved[key] = value;
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      resolved[key] = resolveArguments(value as Record<string, unknown>, ctx);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

function isTruthy(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// ─── Executor ────────────────────────────────────────────────────────────────

export interface CompositionExecutionResult {
  success: boolean;
  context: CompositionContext;
  errors: Array<{ step: string; error: string }>;
}

/**
 * Evaluates a composition workflow against a tool registry.
 *
 * The shared context accumulates tool results as the workflow progresses.
 * Template expressions (`{{key}}`) in arguments are resolved against this
 * context before each tool call.
 */
export async function executeComposition(
  registry: ToolRegistry,
  root: CompositionStep,
  initialContext: CompositionContext = {},
): Promise<CompositionExecutionResult> {
  const ctx: CompositionContext = { ...initialContext };
  const errors: Array<{ step: string; error: string }> = [];

  async function runStep(step: CompositionStep): Promise<void> {
    switch (step.type) {
      case 'sequence':
        for (const child of step.steps) {
          await runStep(child);
        }
        break;

      case 'parallel': {
        const concurrency = step.concurrency ?? step.branches.length;
        const queue = [...step.branches];
        const workers: Promise<void>[] = [];
        const next = async (): Promise<void> => {
          while (queue.length > 0) {
            const branch = queue.shift();
            if (branch) await runStep(branch);
          }
        };
        for (let i = 0; i < concurrency; i++) {
          workers.push(next());
        }
        await Promise.all(workers);
        break;
      }

      case 'condition': {
        const condValue = resolveExpression(step.when, ctx);
        if (isTruthy(condValue)) {
          await runStep(step.then);
        } else if (step.else) {
          await runStep(step.else);
        }
        break;
      }

      case 'loop': {
        const iterable = resolveExpression(step.over, ctx);
        if (!Array.isArray(iterable)) {
          errors.push({ step: `loop over ${step.over}`, error: 'expression did not resolve to an array' });
          return;
        }
        const max = step.maxIterations ?? 50;
        const items = iterable.slice(0, max);
        for (let i = 0; i < items.length; i++) {
          ctx[step.as] = items[i];
          ctx[`${step.as}_index`] = i;
          await runStep(step.body);
        }
        break;
      }

      case 'tool_call': {
        const tool = registry.getTool(step.name);
        if (!tool) {
          errors.push({ step: step.name, error: `tool "${step.name}" not found in registry` });
          return;
        }
        if (!tool.execute) {
          errors.push({ step: step.name, error: `tool "${step.name}" has no execute handler` });
          return;
        }
        const resolvedArgs = resolveArguments(step.arguments, ctx);
        try {
          if (tool.preExecute) {
            const gate = await tool.preExecute(resolvedArgs, ctx);
            if (!gate.proceed) {
              errors.push({ step: step.name, error: gate.reason ?? 'blocked by preExecute' });
              return;
            }
          }
          const result = await tool.execute(resolvedArgs, ctx);
          const storeKey = step.storeAs ?? `${step.name}_result`;
          ctx[storeKey] = result;
          if (tool.postExecute) {
            await tool.postExecute(resolvedArgs, result, ctx);
          }
        } catch (err) {
          errors.push({
            step: step.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        break;
      }
    }
  }

  await runStep(root);

  return {
    success: errors.length === 0,
    context: ctx,
    errors,
  };
}
