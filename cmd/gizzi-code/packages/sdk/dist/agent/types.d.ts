export type { Message } from '../harness/types.js';
export type AgentRunStatus = 'queued' | 'thinking' | 'executing_tools' | 'requires_reply' | 'completed' | 'failed' | 'cancelled';
export type ReplyOutcome = {
    type: 'permission';
    approved: boolean;
    reason?: string;
} | {
    type: 'question';
    answers: string[];
};
export interface ReplyRequest {
    id: string;
    type: 'permission' | 'question';
    payload: {
        title?: string;
        description?: string;
        options?: Array<{
            label: string;
            description: string;
        }>;
        multiple?: boolean;
    };
    submit: (outcome: ReplyOutcome) => Promise<void>;
}
export interface AgentOptions {
    environment?: 'local' | 'lima' | 'cloud';
    capabilities?: string[];
    persistencePath?: string;
}
export type AgentProfileCapability =
  | 'execute_code'
  | 'file_search'
  | 'context'
  | 'mcp_tools'
  | 'deferred_tools'
  | 'artifacts'
  | 'actions'
  | 'chain'
  | 'web_search'
  | 'computer_use'
  | 'filesystem';
export interface AgentModelConfig {
    provider: string;
    model: string;
    temperature?: number;
    maxContextTokens?: number;
    maxOutputTokens?: number;
    maxSteps?: number;
}
export interface AgentToolPolicy {
    builtInToolIds: string[];
    mcpServerIds: string[];
    allowedMcpToolIds: string[];
    deferredToolIds: string[];
}
export interface AgentArtifactPolicy {
    enabled: boolean;
    customPromptMode?: boolean;
}
export interface AgentProfile {
    agentId: string;
    version: string;
    avatarUrl?: string;
    instructions?: string;
    modelConfig: AgentModelConfig;
    capabilities: Partial<Record<AgentProfileCapability, boolean>>;
    toolPolicy: AgentToolPolicy;
    files?: {
        contextFileIds: string[];
        searchFileIds: string[];
        codeInterpreterFileIds: string[];
    };
    artifactPolicy?: AgentArtifactPolicy;
}
