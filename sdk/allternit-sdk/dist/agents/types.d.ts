export type AgentProfileCapability = 'execute_code' | 'file_search' | 'context' | 'mcp_tools' | 'deferred_tools' | 'artifacts' | 'actions' | 'chain' | 'web_search' | 'computer_use' | 'filesystem';
export declare const AGENT_PROFILE_CAPABILITIES: AgentProfileCapability[];
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
export interface RemoteAgentModel {
    id: string;
    name: string;
    description: string;
    provider: string;
    profile: AgentProfile;
}
export interface RemoteAgentModelList {
    object: "list";
    data: RemoteAgentModel[];
}
export interface DeferredToolDescriptor {
    id: string;
    label: string;
    serverId?: string;
    description?: string;
}
export interface DeferredToolList {
    object: "list";
    data: DeferredToolDescriptor[];
    model: string;
}
export interface SearchDeferredToolsRequest {
    model: string;
    query: string;
}
export interface ActivateDeferredToolsRequest {
    model: string;
    sessionId: string;
    toolIds: string[];
}
export interface ActivateDeferredToolsResponse {
    sessionId: string;
    model: string;
    activatedToolIds: string[];
}
export interface AgentChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}
export interface AgentChatCompletionRequest {
    model: string;
    messages: AgentChatMessage[];
    sessionId?: string;
    conversationId?: string;
}
export interface AgentChatCompletionResponse {
    id: string;
    model: string;
    content: string;
    sessionId: string;
    conversationId: string;
}
export interface AgentResponsesRequest {
    model: string;
    prompt: string;
    sessionId?: string;
    conversationId?: string;
}
export interface AgentResponsesResponse {
    responseId: string;
    conversationId: string;
    outputText: string;
    artifacts: AgentArtifact[];
    createdAt: number;
    model?: string;
    agentProfile?: AgentProfile;
}
export interface AgentArtifact {
    id: string;
    mimeType: string;
    title?: string;
    content: string;
}
export interface ArtifactChunk {
    type: "artifact";
    artifact: AgentArtifact;
}
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
    computerUseBaseUrl?: string;
}
