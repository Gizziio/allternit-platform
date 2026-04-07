/**
 * ACP (Agent Client Protocol) Types
 *
 * Re-exports from @agentclientprotocol/sdk for convenience.
 * These are the official ACP types used for agent-client communication.
 */
export type { Agent, AgentCapabilities, AgentInfo, AgentNotification, AgentRequest, AgentResponse, AgentSideConnection, Client, ClientCapabilities, ClientInfo, ClientNotification, ClientRequest, ClientResponse, Session, SessionId, SessionInfo, SessionCapabilities, SessionNotification, SessionStatus, Content, TextContent, ImageContent, AudioContent, ResourceContents, TextResourceContents, BlobResourceContents, EmbeddedResource, Tool, ToolCall, ToolCallContent, ToolCallId, ToolCallLocation, ToolCallStatus, ToolCallUpdate, ToolKind, InitializeRequest, InitializeResponse, AuthenticateRequest, AuthenticateResponse, NewSessionRequest, NewSessionResponse, LoadSessionRequest, LoadSessionResponse, ListSessionsRequest, ListSessionsResponse, ForkSessionRequest, ForkSessionResponse, ResumeSessionRequest, ResumeSessionResponse, PromptRequest, PromptResponse, SetSessionModelRequest, SetSessionModelResponse, SetSessionModeRequest, SetSessionModeResponse, PermissionOption, RequestPermissionRequest, RequestPermissionResponse, RequestPermissionOutcome, FileSystemCapability, ReadTextFileRequest, ReadTextFileResponse, WriteTextFileRequest, WriteTextFileResponse, CreateTerminalRequest, CreateTerminalResponse, TerminalOutputRequest, TerminalOutputResponse, TerminalExitStatus, ReleaseTerminalRequest, ReleaseTerminalResponse, WaitForTerminalExitRequest, WaitForTerminalExitResponse, KillTerminalCommandRequest, KillTerminalCommandResponse, TerminalHandle, Annotations, AuthMethod, AvailableCommand, AvailableCommandsUpdate, CancelNotification, CancelRequestNotification, Diff, ErrorResponse, ExtNotification, ExtRequest, ExtResponse, McpCapabilities, McpServer, Mode, ModeOption, PlanEntry, PromptCapabilities, RequestId, Resource, Role, StopReason, TextEdit, UnstructuredCommandInput, Usage, } from '@agentclientprotocol/sdk';
/**
 * Extended ACP session with Allternit-specific fields
 */
export interface AllternitACPSession {
    id: string;
    agentId: string;
    status: 'initializing' | 'active' | 'paused' | 'completed' | 'error';
    model: {
        provider: string;
        model: string;
    };
    config?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
        systemPrompt?: string;
    };
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
/**
 * ACP Registry entry for agent/provider registration
 */
export interface ACPRegistryEntry {
    id: string;
    name: string;
    version: string;
    description: string;
    capabilities: string[];
    auth: {
        type: 'none' | 'api_key' | 'oauth' | 'bearer' | 'aws' | 'azure';
        required: boolean;
    };
    models: Array<{
        id: string;
        name: string;
        contextWindow: number;
        maxTokens: number;
        capabilities: string[];
    }>;
    endpoints?: {
        chat?: string;
        stream?: string;
        health?: string;
    };
}
/**
 * Validation result for ACP entities
 */
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    error?: string;
    issues?: string[];
}
//# sourceMappingURL=types.d.ts.map