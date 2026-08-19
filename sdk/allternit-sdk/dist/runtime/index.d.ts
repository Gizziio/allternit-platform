/**
 * Allternit Runtime SDK
 *
 * Thin client for the Allternit runtime API. Talks to the self-hosted platform
 * API by default; in local-dev mode it can talk directly to a gizzi-code
 * runtime over HTTP(S).
 */
export type RuntimeStatus = "online" | "offline" | "busy";
export type RuntimeTransport = "local" | "websocket" | "uds";
export interface DiscoveredCli {
    name: string;
    path: string;
    version: string;
    icon: string;
}
export interface RegisteredRuntime {
    id: string;
    name: string;
    host: string;
    transport: RuntimeTransport;
    status: RuntimeStatus;
    lastHeartbeatAt?: number;
    registeredAt: number;
    workspaceId?: string;
    metadata?: {
        cwd?: string;
        env?: Record<string, string>;
        websocketUrl?: string;
        udsSocket?: string;
        token?: string;
    };
    agentClis: DiscoveredCli[];
}
export interface AgentTask {
    taskId: string;
    prompt: string;
    cwd?: string;
    env?: Record<string, string>;
    systemPrompt?: string;
    attachments?: Array<{
        filename: string;
        mimeType: string;
        content: string | Uint8Array;
    }>;
}
export interface TaskHandle {
    taskId: string;
    runtimeId: string;
    cliName: string;
}
export type AgentEvent = {
    type: "status";
    status: "queued" | "running" | "completed" | "failed" | "cancelled";
} | {
    type: "text_delta";
    delta: string;
} | {
    type: "tool_call";
    id: string;
    name: string;
    arguments: unknown;
} | {
    type: "tool_result";
    id: string;
    content: string;
    isError?: boolean;
} | {
    type: "error";
    error: unknown;
} | {
    type: "finish";
    finishReason: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
};
export interface ExecutionLog {
    taskId: string;
    runtimeId: string;
    cliName: string;
    status: "queued" | "running" | "completed" | "failed" | "cancelled";
    startedAt?: number;
    finishedAt?: number;
    events: AgentEvent[];
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
    };
    exitCode?: number;
    errorMessage?: string;
}
export interface RuntimeClientOptions {
    /** Base URL of the platform API or gizzi-code runtime. */
    baseUrl: string;
    /** Optional async token provider for authenticated requests. */
    getToken?: () => Promise<string | null | undefined>;
    /** Optional static auth token. */
    token?: string;
    /**
     * When true, baseUrl is treated as a direct gizzi-code runtime rather than
     * the platform API. Paths are prefixed with /v1 instead of /api/v1.
     */
    direct?: boolean;
}
export declare class RuntimeClient {
    private readonly baseUrl;
    private readonly getToken?;
    private readonly direct;
    constructor(options: RuntimeClientOptions);
    private prefix;
    private authHeaders;
    private request;
    listRuntimes(): Promise<{
        runtimes: RegisteredRuntime[];
    }>;
    getRuntime(id: string): Promise<{
        runtime: RegisteredRuntime;
    }>;
    deleteRuntime(id: string): Promise<{
        ok: boolean;
    }>;
    heartbeat(id: string): Promise<{
        ok: boolean;
    }>;
    listLogs(id: string, limit?: number): Promise<{
        logs: ExecutionLog[];
    }>;
    assignTask(runtimeId: string, cliName: string, task: Omit<AgentTask, "taskId">): Promise<{
        handle: TaskHandle;
    }>;
    abortTask(runtimeId: string, taskId: string): Promise<{
        ok: boolean;
    }>;
    inspectTask(runtimeId: string, taskId: string): Promise<{
        log: ExecutionLog;
    }>;
    streamTask(runtimeId: string, taskId: string): AsyncIterable<AgentEvent>;
}
export declare class RuntimeApiError extends Error {
    readonly status: number;
    readonly body: string;
    constructor(message: string, status: number, body: string);
}
