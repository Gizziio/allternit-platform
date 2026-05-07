import type { ToolDefinition } from '../tools/types.js';
type ReplyEventEmitter = {
    emit(event: string, payload: unknown): boolean;
};
export declare class HITLCapability {
    private eventEmitter;
    constructor(eventEmitter: ReplyEventEmitter);
    getTool(): ToolDefinition;
}
export {};
