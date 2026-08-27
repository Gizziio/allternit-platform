/**
 * Programmatic Tool Execution
 *
 * Enables code running inside the sandboxed executor to invoke
 * registered Allternit tools via a structured bridge protocol.
 *
 * Protocol: sandboxed code emits `__ALLTERNIT_TOOL_CALL__<json>\n` on stdout.
 * The bridge intercepts those lines, executes the tool via the registry,
 * and returns the result via a sidecar JSON file that the sandboxed code
 * can read.
 */
import type { ToolRegistry } from './registry.js';
import type { CodeExecutionRunner } from './code-execution.js';
interface BridgeToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}
export interface ProgrammaticExecutionOptions {
    registry: ToolRegistry;
    /** Maximum tool calls a single sandbox run may make. Default: 20 */
    maxToolCalls?: number;
    /** Timeout per tool call in seconds. Default: 30 */
    toolCallTimeoutSeconds?: number;
}
/**
 * Parses bridge tool calls from stdout lines and returns the cleaned output
 * plus the extracted calls.
 */
export declare function parseBridgeOutput(stdout: string): {
    cleanedStdout: string;
    calls: BridgeToolCall[];
};
/**
 * Generates the helper code injected into the sandbox so user code can
 * invoke tools via `allternit_tool(name, args)`.
 */
export declare function bridgeHelperCode(language: string, bridgeDir: string): string;
/**
 * Creates a programmatic execution wrapper around a code execution runner.
 *
 * The wrapper injects a bridge helper into the sandbox, intercepts tool call
 * requests from stdout, executes them via the registry, and writes results
 * back so the sandboxed code can continue.
 */
export declare class ProgrammaticToolExecutor {
    private readonly registry;
    private readonly maxToolCalls;
    private readonly toolCallTimeoutSeconds;
    constructor(options: ProgrammaticExecutionOptions);
    /**
     * Returns the list of tool descriptors available in the sandbox,
     * suitable for embedding in generated code or documentation.
     */
    toolManifest(): Array<{
        name: string;
        description: string;
        parameters: unknown;
    }>;
    /**
     * Wraps a base runner with programmatic tool execution support.
     * Injects bridge helper code, processes bridge calls in a loop,
     * and returns the final result.
     */
    wrapRunner(baseRunner: CodeExecutionRunner): CodeExecutionRunner;
    private executeWithBridge;
}
export {};
