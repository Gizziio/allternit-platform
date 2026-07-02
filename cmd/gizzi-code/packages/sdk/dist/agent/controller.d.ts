import { AllternitHarness } from '../harness/index.js';
import { AllternitClient } from '../../dist/gen/allternit-client.js';
import { AgentRun } from './run.js';
import type { StreamRequest } from '../harness/types.js';
import type { AgentOptions } from './types.js';
export declare class AllternitAgent {
    private harness;
    private client;
    private storage;
    private options;
    private environment;
    private brain?;
    private filesystem?;
    private computer?;
    constructor(harness: AllternitHarness, client: AllternitClient, options?: AgentOptions);
    getHarness(): AllternitHarness;
    /**
     * Start a new Run
     */
    run(request: StreamRequest): AgentRun;
    private enrichRequestWithCapabilities;
    /**
     * Resume an existing Run from storage
     */
    resume(runId: string, initialRequest: StreamRequest): Promise<AgentRun>;
    saveRunState(run: AgentRun): void;
    checkToolPermission(toolName: string): boolean;
    /**
     * Execute tool by routing to the appropriate capability
     */
    executeTool(name: string, args: any): Promise<string>;
}
//# sourceMappingURL=controller.d.ts.map