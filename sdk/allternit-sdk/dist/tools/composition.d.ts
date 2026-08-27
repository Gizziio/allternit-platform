/**
 * Tool Composition DSL
 *
 * Provides a declarative, composable DSL for defining tool execution
 * workflows. Supports sequence, parallel, condition, and loop primitives
 * that resolve against the active ToolRegistry.
 */
import type { ToolRegistry } from './registry.js';
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
export type CompositionStep = SequenceStep | ParallelStep | ConditionStep | LoopStep | ToolCallStep;
export declare function sequence(...steps: CompositionStep[]): SequenceStep;
export declare function parallel(...branches: CompositionStep[]): ParallelStep;
export declare function parallelWithConcurrency(concurrency: number, ...branches: CompositionStep[]): ParallelStep;
export declare function condition(when: string, then: CompositionStep, elseStep?: CompositionStep): ConditionStep;
export declare function loop(over: string, as: string, body: CompositionStep, maxIterations?: number): LoopStep;
export declare function toolCall(name: string, args: Record<string, unknown>, storeAs?: string): ToolCallStep;
export type CompositionContext = Record<string, unknown>;
export interface CompositionExecutionResult {
    success: boolean;
    context: CompositionContext;
    errors: Array<{
        step: string;
        error: string;
    }>;
}
/**
 * Evaluates a composition workflow against a tool registry.
 *
 * The shared context accumulates tool results as the workflow progresses.
 * Template expressions (`{{key}}`) in arguments are resolved against this
 * context before each tool call.
 */
export declare function executeComposition(registry: ToolRegistry, root: CompositionStep, initialContext?: CompositionContext): Promise<CompositionExecutionResult>;
