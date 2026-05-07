import { EventEmitter } from 'events';
import type { StreamRequest, Message } from '../harness/types.js';
import type { AgentRunStatus, ReplyOutcome } from './types.js';
import type { AllternitAgent } from './controller.js';
import { RunState } from '../harness/run-state.js';
export declare class AgentRun extends EventEmitter {
    readonly id: string;
    private readonly agent;
    status: AgentRunStatus;
    messages: RuntimeMessage[];
    runState: RunState;
    private currentRequest;
    private pendingReplyHandler?;
    constructor(id: string, agent: AllternitAgent, initialRequest: StreamRequest);
    /**
     * Store the pending reply handler so it can be invoked later via submitReply().
     */
    setPendingReplyHandler(handler: (outcome: ReplyOutcome) => Promise<void>): void;
    /**
     * Submit a reply outcome to resume a paused run.
     * @throws Error if no pending reply is awaiting submission.
     */
    submitReply(outcome: ReplyOutcome): Promise<void>;
    execute(): Promise<void>;
    private serializeMessagesForHarness;
    private handleToolCalls;
    private addToolResult;
    private updateStatus;
    hydrate(status: AgentRunStatus, messages: RuntimeMessage[], toolSnapshot?: any): void;
}
type RuntimeContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'tool_use';
    id: string;
    name: string;
    input: unknown;
} | {
    type: 'tool_result';
    tool_use_id: string;
    content: string;
    is_error?: boolean;
};
type RuntimeMessage = Omit<Message, 'content'> & {
    content: string | RuntimeContentBlock[];
};
export {};
