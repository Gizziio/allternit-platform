import type { Message, AgentRunStatus } from '../types.js';
export interface RunRecord {
    id: string;
    status: AgentRunStatus;
    messages: string;
    metadata: string;
    updated_at: number;
}
export declare class AgentStorage {
    private db;
    constructor(path?: string);
    private init;
    saveRun(id: string, status: AgentRunStatus, messages: Message[], metadata?: any): void;
    getRun(id: string): RunRecord | null;
    listRuns(): RunRecord[];
}
//# sourceMappingURL=index.d.ts.map