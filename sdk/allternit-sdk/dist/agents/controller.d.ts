import { EventEmitter } from 'events';
import { AllternitHarness } from '../harness/index.js';
import { AgentRun } from './run.js';
import type { StreamRequest } from '../harness/types.js';
import type { AgentOptions, ReplyOutcome } from './types.js';
import type { ToolDefinition, DeferredToolDefinition } from '../tools/types.js';
export declare class AllternitAgent extends EventEmitter {
    private harness;
    private storage;
    private options;
    private environment;
    private globalToolRegistry;
    private globalToolBelt;
    private activeRuns;
    private brain?;
    private filesystem?;
    private computer?;
    private hitl?;
    constructor(harness: AllternitHarness, options?: AgentOptions);
    getHarness(): AllternitHarness;
    /**
     * Register a tool globally at startup
     */
    registerTool(tool: ToolDefinition): void;
    registerDeferredTool(tool: DeferredToolDefinition): void;
    /**
     * Start a new Run
     */
    run(request: StreamRequest): AgentRun;
    private enrichRequestWithCapabilities;
    /**
     * Resume an existing Run from storage
     */
    resume(runId: string, initialRequest: StreamRequest): Promise<AgentRun>;
    /**
     * Submit a reply to a pending HITL request on an active run.
     * Requires the agent instance to still be in memory (same process).
     */
    submitReply(runId: string, outcome: ReplyOutcome): Promise<void>;
    /**
     * Get an active run by ID. Returns undefined if the run has completed or failed.
     */
    getActiveRun(runId: string): AgentRun | undefined;
    saveRunState(run: AgentRun): void;
    checkToolPermission(toolName: string): boolean;
    executeTool(name: string, args: any): Promise<string>;
}
