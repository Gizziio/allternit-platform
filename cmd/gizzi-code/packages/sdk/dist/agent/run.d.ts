import { EventEmitter } from 'events';
import type { StreamRequest, Message } from '../harness/types.js';
import type { AgentRunStatus } from './types.js';
import type { AllternitAgent } from './controller.js';
import { RunState } from '../ai-runtime/harness/run-state.js';
export declare class AgentRun extends EventEmitter {
    readonly id: string;
    private readonly agent;
    status: AgentRunStatus;
    messages: Message[];
    runState: RunState;
    private currentRequest;
    constructor(id: string, agent: AllternitAgent, initialRequest: StreamRequest);
    execute(): Promise<void>;
    private handleToolCalls;
    private addToolResult;
    private updateStatus;
    hydrate(status: AgentRunStatus, messages: Message[], toolSnapshot?: any): void;
}
//# sourceMappingURL=run.d.ts.map