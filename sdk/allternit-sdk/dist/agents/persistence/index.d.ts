import type { AgentRunStatus } from '../types.js';
export interface RunRecord {
    id: string;
    status: AgentRunStatus;
    messages: string;
    metadata: string;
    updated_at: number;
}
export interface IAgentStorageBackend {
    saveRun(record: RunRecord): void;
    getRun(id: string): RunRecord | null;
    listRuns(): RunRecord[];
}
export declare class AgentStorage {
    private backend;
    constructor(options?: {
        path?: string;
        backend?: IAgentStorageBackend;
    });
    private static createBackend;
    saveRun(id: string, status: AgentRunStatus, messages: unknown[], metadata?: any): void;
    getRun(id: string): RunRecord | null;
    listRuns(): RunRecord[];
}
