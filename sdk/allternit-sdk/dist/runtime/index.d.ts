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
export interface FabricLease {
    id: string;
    capabilityId: string;
    grantee: string;
    issuedAt: string;
    expiresAt?: string;
    status: "active" | "expired" | "revoked";
    signature?: string;
    policy?: Record<string, unknown>;
}
export interface FabricSessionClientOptions {
    /** Base URL of the platform API or a direct gizzi-code runtime. */
    baseUrl: string;
    /** Runtime ID when talking through the platform relay. Omit for direct mode. */
    runtimeId?: string;
    /** Async Clerk/session token provider for authenticated platform requests. */
    getToken?: () => Promise<string | null | undefined>;
    /** Static auth token. */
    token?: string;
    /**
     * When true, baseUrl is treated as a direct gizzi-code runtime. Paths are
     * prefixed with /v1 instead of /api/v1 and no runtime relay proxy is used.
     */
    direct?: boolean;
}
export declare class FabricSessionClient {
    private readonly baseUrl;
    private readonly runtimeId?;
    private readonly getToken?;
    private readonly direct;
    constructor(options: FabricSessionClientOptions);
    private apiPath;
    private authHeaders;
    private request;
    private json;
    lease(capabilityId: string, ttlSeconds?: number): Promise<FabricLease>;
    invoke(capability: string, inputs: Record<string, unknown>, lease?: FabricLease): Promise<unknown>;
    listSessions(): Promise<RemoteSessionWithStatus[]>;
    getSession(sessionID: string): Promise<RemoteSessionDetail>;
    sendMessage(sessionID: string, input: {
        text: string;
        attachments?: Array<{
            mime: string;
            url: string;
            filename?: string;
        }>;
    }): Promise<unknown>;
    abortSession(sessionID: string): Promise<unknown>;
    createSession(input?: {
        title?: string;
        agentID?: string;
        surface?: string;
        permission?: unknown;
    }): Promise<RemoteSession>;
    listPendingPermissions(): Promise<RemotePermissionRequest[]>;
    replyPermission(requestID: string, reply: "once" | "always" | "reject", message?: string): Promise<boolean>;
    listPendingQuestions(): Promise<RemoteQuestionRequest[]>;
    replyQuestion(requestID: string, answers: string[][]): Promise<boolean>;
    rejectQuestion(requestID: string): Promise<boolean>;
    streamEvents(sessionID: string): AsyncIterable<FabricSessionEvent>;
}
export interface WebPushClientOptions {
    /** Base URL of the push worker or platform API. */
    baseUrl: string;
    /** Runtime ID when talking through the platform relay. */
    runtimeId?: string;
    /** Async token provider for authenticated platform requests. */
    getToken?: () => Promise<string | null | undefined>;
    /** Static auth token. */
    token?: string;
}
export declare class WebPushClient {
    private readonly baseUrl;
    private readonly pushBaseUrl;
    private readonly runtimeId?;
    private readonly getToken?;
    constructor(options: WebPushClientOptions);
    private authHeaders;
    getVapidPublicKey(): Promise<string>;
    subscribePush(subscription: PushSubscriptionJSON): Promise<{
        ok: boolean;
    }>;
    unsubscribePush(endpoint: string): Promise<{
        ok: boolean;
    }>;
    private assertRuntimeId;
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
export interface RemoteSession {
    id: string;
    slug: string;
    projectID: string;
    directory: string;
    parentID?: string;
    title: string;
    version: string;
    time: {
        created: number;
        updated: number;
        compacting?: number;
        archived?: number;
    };
    permission?: unknown;
    agentID?: string;
    surface?: "chat" | "cowork" | "code" | "browser" | "design";
    harness?: unknown;
    summary?: {
        additions: number;
        deletions: number;
        files: number;
        diffs?: unknown[];
    };
    share?: {
        url: string;
    };
    revert?: unknown;
}
export interface RemoteSessionStatus {
    type: "idle" | "busy" | "retry";
    attempt?: number;
    message?: string;
    next?: number;
}
export interface RemoteSessionWithStatus {
    session: RemoteSession;
    status: RemoteSessionStatus;
}
export interface RemoteMessage {
    info: {
        id: string;
        sessionID: string;
        role: "user" | "assistant";
        parentID?: string;
        time: {
            created: number;
        };
        [key: string]: unknown;
    };
    parts: Array<Record<string, unknown>>;
}
export interface RemoteSessionDetail {
    session: RemoteSession;
    status: RemoteSessionStatus;
    messages: RemoteMessage[];
}
/** Capability-native alias for {@link RemoteSession}. */
export type FabricSession = RemoteSession;
/** Capability-native alias for {@link RemoteSessionStatus}. */
export type FabricSessionStatus = RemoteSessionStatus;
/** Capability-native alias for {@link RemoteSessionWithStatus}. */
export type FabricSessionWithStatus = RemoteSessionWithStatus;
/** Capability-native alias for {@link RemoteMessage}. */
export type FabricMessage = RemoteMessage;
/** Capability-native alias for {@link RemoteSessionDetail}. */
export type FabricSessionDetail = RemoteSessionDetail;
export interface PushSubscriptionJSON {
    endpoint: string;
    expirationTime?: number | null;
    keys?: {
        p256dh?: string;
        auth?: string;
    };
}
export interface RemoteControlClientOptions {
    /** Base URL of the platform API or a direct gizzi-code runtime. */
    baseUrl: string;
    /** Runtime ID when talking through the platform relay. Omit for direct mode. */
    runtimeId?: string;
    /** Async Clerk/session token provider for authenticated platform requests. */
    getToken?: () => Promise<string | null | undefined>;
    /** Static auth token. */
    token?: string;
    /**
     * When true, baseUrl is treated as a direct gizzi-code runtime. Paths are
     * prefixed with /v1 instead of /api/v1 and no runtime relay proxy is used.
     */
    direct?: boolean;
    /**
     * Optional base URL of the Cloudflare push worker. When provided the client
     * can register Web Push subscriptions for proactive remote-control
     * notifications.
     */
    pushBaseUrl?: string;
}
export type RemoteControlEvent = {
    type: "remote.connected";
    properties: {
        sessionID: string;
        status: RemoteSessionStatus;
    };
} | {
    type: "remote.heartbeat";
    properties: {
        sessionID: string;
    };
} | {
    type: "session.updated";
    properties: {
        info: RemoteSession;
    };
} | {
    type: "message.updated";
    properties: {
        info: RemoteMessage["info"];
    };
} | {
    type: "message.part.updated";
    properties: {
        part: Record<string, unknown>;
    };
} | {
    type: "session.status";
    properties: {
        sessionID: string;
        status: RemoteSessionStatus;
    };
} | {
    type: "permission.asked";
    properties: RemotePermissionRequest;
} | {
    type: "question.asked";
    properties: RemoteQuestionRequest;
} | {
    type: string;
    properties: Record<string, unknown>;
};
export interface RemotePermissionRequest {
    id: string;
    sessionID: string;
    permission: string;
    patterns: string[];
    metadata: Record<string, unknown>;
    always: string[];
    tool?: {
        messageID: string;
        callID: string;
    };
}
export interface RemoteQuestionRequest {
    id: string;
    sessionID: string;
    questions: Array<{
        question: string;
        header: string;
        options: Array<{
            label: string;
            description: string;
        }>;
        multiple?: boolean;
        custom?: boolean;
    }>;
    tool?: {
        messageID: string;
        callID: string;
    };
}
/** Capability-native alias for {@link RemoteControlEvent}. */
export type FabricSessionEvent = RemoteControlEvent;
/** Capability-native alias for {@link RemotePermissionRequest}. */
export type FabricPermissionRequest = RemotePermissionRequest;
/** Capability-native alias for {@link RemoteQuestionRequest}. */
export type FabricQuestionRequest = RemoteQuestionRequest;
export declare class RemoteControlClient {
    private readonly baseUrl;
    private readonly pushBaseUrl?;
    private readonly runtimeId?;
    private readonly getToken?;
    private readonly direct;
    constructor(options: RemoteControlClientOptions);
    private authHeaders;
    private runtimePath;
    private request;
    private v1Raw;
    private json;
    private v1Json;
    listSessions(): Promise<RemoteSessionWithStatus[]>;
    getSession(sessionID: string): Promise<RemoteSessionDetail>;
    sendMessage(sessionID: string, input: {
        text: string;
        attachments?: Array<{
            mime: string;
            url: string;
            filename?: string;
        }>;
    }): Promise<{
        accepted: boolean;
        sessionID: string;
    }>;
    abortSession(sessionID: string): Promise<boolean>;
    createSession(input?: {
        title?: string;
        agentID?: string;
        surface?: string;
        permission?: unknown;
    }): Promise<RemoteSession>;
    listPendingPermissions(): Promise<RemotePermissionRequest[]>;
    replyPermission(requestID: string, reply: "once" | "always" | "reject", message?: string): Promise<boolean>;
    listPendingQuestions(): Promise<RemoteQuestionRequest[]>;
    replyQuestion(requestID: string, answers: string[][]): Promise<boolean>;
    rejectQuestion(requestID: string): Promise<boolean>;
    getVapidPublicKey(): Promise<string>;
    subscribePush(subscription: PushSubscriptionJSON): Promise<{
        ok: boolean;
    }>;
    unsubscribePush(endpoint: string): Promise<{
        ok: boolean;
    }>;
    private assertRuntimeId;
    streamEvents(sessionID: string): AsyncIterable<RemoteControlEvent>;
}
export declare class RuntimeApiError extends Error {
    readonly status: number;
    readonly body: string;
    constructor(message: string, status: number, body: string);
}
