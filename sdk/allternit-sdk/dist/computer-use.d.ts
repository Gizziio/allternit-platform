/**
 * @allternit/sdk/computer-use - Computer Use Engine Client
 */
export declare const COMPUTER_USE_CONTRACT_VERSION: "1.0.0-alpha.1";
export type ComputerExecutionMode = "background_strict" | "foreground_allowed" | "sandboxed";
export type ComputerOutcomeStatus = "worked" | "didnt" | "unknown" | "blocked" | "cancelled";
export interface CanonicalComputerCapabilityManifest {
    provider_id: string;
    provider_version: string;
    contract_version: typeof COMPUTER_USE_CONTRACT_VERSION;
    invariant_version: string;
    invariants: string[];
    operating_systems: Array<"macos" | "windows" | "linux" | "android">;
    actions: string[];
    observation_channels: string[];
    execution_modes: ComputerExecutionMode[];
    strict_background: boolean;
    semantic_input: boolean;
    raw_input: boolean;
    streaming: boolean;
    clipboard: boolean;
    shell: boolean;
    files: boolean;
    audio: boolean;
    mobile: boolean;
    max_concurrency: number;
    limitations: string[];
}
export interface CanonicalProviderDiagnostic {
    available: boolean;
    reason?: string;
    message?: string;
    executable?: string;
    version?: string;
    telemetry_enabled?: boolean;
    telemetry_managed_by_allternit?: boolean;
}
export interface CanonicalProviderCatalog {
    providers: CanonicalComputerCapabilityManifest[];
    diagnostics: Record<string, CanonicalProviderDiagnostic>;
}
export interface CanonicalComputerElement {
    ref: string;
    role: string;
    name: string;
    value: string;
    description: string;
    bounds?: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
    states: string[];
    actions: string[];
    children: CanonicalComputerElement[];
    provider_metadata: Record<string, unknown>;
}
export interface CanonicalComputerObservation {
    state_id: string;
    session_id: string;
    environment_id: string;
    resource_id: string;
    epoch: number;
    captured_at: string;
    provider_id: string;
    provider_version: string;
    roots: Array<Record<string, unknown>>;
    elements: CanonicalComputerElement[];
    image?: {
        artifact_id: string;
        media_type: string;
        width: number;
        height: number;
        sha256: string;
        coordinate_space: string;
    } | null;
    truncated: boolean;
    metadata: Record<string, unknown>;
}
export interface CanonicalComputerRootDiscovery {
    session_id: string;
    environment_id: string;
    providers: Record<string, Array<Record<string, unknown>>>;
}
export interface CanonicalComputerTransaction {
    transaction_id: string;
    session_id: string;
    environment_id: string;
    resource_id: string;
    base_state_id: string;
    mode: ComputerExecutionMode;
    steps: Array<{
        action: string;
        target?: {
            ref?: string | null;
            x?: number | null;
            y?: number | null;
            root_id?: string | null;
        } | null;
        arguments: Record<string, unknown>;
    }>;
    postcondition?: {
        kind: "text" | "role" | "value" | "visible" | "focused";
        value: string;
        gone: boolean;
        timeout_ms: number;
    } | null;
    approval_id?: string | null;
}
export interface CanonicalComputerOutcome {
    transaction_id: string;
    status: ComputerOutcomeStatus;
    step_outcomes: Array<Record<string, unknown>>;
    stopped_at: number | null;
    successor_state_id: string | null;
    receipt_id?: string | null;
    receipt?: Record<string, unknown>;
    metadata: Record<string, unknown>;
}
export interface CanonicalComputerApprovalGrant {
    approval_id: string;
    action_hash: string;
    approved_by: string;
    issued_at: number;
    expires_at: number;
}
export interface CanonicalComputerEnvironment {
    environment_id: string;
    owner_id: string;
    provider_id: string;
    os: "macos" | "windows" | "linux" | "android";
    isolation: "host" | "container" | "vm";
    state: "requested" | "provisioning" | "running" | "stopping" | "stopped" | "failed" | "destroyed";
    image_digest?: string | null;
    created_at: string;
    updated_at: string;
    expires_at?: string | null;
    metadata: Record<string, unknown>;
}
export interface CanonicalEnvironmentProviderManifest {
    provider_id: string;
    operating_systems: string[];
    isolations: string[];
    available: boolean;
    reason?: string | null;
    capabilities: string[];
}
export interface CanonicalEnvironmentLease {
    lease_id: string;
    environment_id: string;
    holder_id: string;
    kind: "agent" | "human_takeover";
    issued_at: string;
    expires_at: string;
}
export interface ComputerUseRequest {
    mode: 'intent' | 'direct' | 'assist';
    task: string;
    session_id?: string;
    run_id?: string;
    target_scope?: 'browser' | 'desktop' | 'hybrid' | 'auto';
    options?: Record<string, unknown>;
    context?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}
export interface ComputerUseResponse {
    run_id: string;
    session_id: string;
    status: string;
    mode: string;
    target_scope: string;
    summary?: string;
    result?: Record<string, unknown> | null;
    error?: string | null;
}
export interface WatchOptions {
    runId: string;
    signal?: AbortSignal;
}
export interface WatchRunOptions {
    intervalMs?: number;
    signal?: AbortSignal;
}
export interface WaitForRunOptions {
    intervalMs?: number;
    signal?: AbortSignal;
}
export interface ApprovalOptions {
    approver_id?: string;
    comment?: string;
    [key: string]: unknown;
}
export interface CancelOptions {
    approver_id?: string;
    comment?: string;
    [key: string]: unknown;
}
export interface ResumeOptions {
    approver_id?: string;
    comment?: string;
    [key: string]: unknown;
}
export interface RequestOptions {
    baseUrl?: string;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
}
export interface CompatibilityComputerActionRequest {
    [key: string]: unknown;
    action: string;
    session_id: string;
    run_id?: string;
    parameters?: Record<string, unknown>;
    coordinate?: [number, number];
    text?: string;
    key?: string;
}
export declare class AllternitComputerUseClient {
    readonly baseUrl: string;
    readonly fetch: typeof fetch;
    readonly headers: Record<string, string>;
    constructor(config?: RequestOptions);
    execute(request: ComputerUseRequest): Promise<ComputerUseResponse>;
    executeStream(request: ComputerUseRequest): Promise<Response>;
    /** Compatibility-only atomic action transport for products migrating to canonical transactions. */
    executeCompatibilityAction(request: CompatibilityComputerActionRequest): Promise<Record<string, unknown>>;
    /** Compatibility-only physical browser session creation; logical ownership remains canonical. */
    createCompatibilitySession(): Promise<{
        session_id: string;
    }>;
    listCanonicalProviders(): Promise<CanonicalComputerCapabilityManifest[]>;
    getCanonicalProviderCatalog(): Promise<CanonicalProviderCatalog>;
    observeCanonical(request: {
        provider_id?: string;
        session_id: string;
        environment_id?: string;
        resource_id?: string;
    }): Promise<CanonicalComputerObservation>;
    findCanonicalRoots(request: {
        session_id: string;
        environment_id?: string;
        provider_id?: string;
    }): Promise<CanonicalComputerRootDiscovery>;
    executeCanonicalTransaction(transaction: CanonicalComputerTransaction, providerId?: string): Promise<CanonicalComputerOutcome>;
    approveCanonicalTransaction(transaction: CanonicalComputerTransaction, approvedBy: string, ttlSeconds?: number): Promise<CanonicalComputerApprovalGrant>;
    getCanonicalEvents(sessionId: string, afterSequence?: number): Promise<unknown>;
    listCanonicalEnvironmentProviders(): Promise<CanonicalEnvironmentProviderManifest[]>;
    createCanonicalEnvironment(request: {
        owner_id: string;
        provider_id: string;
        os: string;
        isolation: string;
        image_digest?: string;
        ttl_seconds?: number;
        metadata?: Record<string, unknown>;
    }): Promise<CanonicalComputerEnvironment>;
    approveCanonicalEnvironmentOperation(request: {
        environment_id: string;
        holder_id: string;
        operation: string;
        payload: Record<string, unknown>;
        approved_by: string;
        ttl_seconds?: number;
    }): Promise<{
        approval_id: string;
        operation_hash: string;
        approved_by: string;
        expires_at: number;
    }>;
    provisionCanonicalEnvironment(environmentId: string, control: {
        lease_id: string;
        holder_id: string;
        approval_id: string;
    }): Promise<CanonicalComputerEnvironment>;
    stopCanonicalEnvironment(environmentId: string, control: {
        lease_id: string;
        holder_id: string;
        approval_id: string;
    }): Promise<CanonicalComputerEnvironment>;
    acquireCanonicalEnvironmentLease(environmentId: string, holderId: string, kind: "agent" | "human_takeover", ttlSeconds?: number): Promise<CanonicalEnvironmentLease>;
    getCanonicalTrajectory(sessionId: string): Promise<Record<string, unknown>>;
    private canonicalPost;
    releaseCanonicalEnvironmentLease(leaseId: string, holderId: string): Promise<Record<string, unknown>>;
    executeCanonicalEnvironmentCommand(environmentId: string, request: {
        command: string[];
        env?: Record<string, string>;
        secret_refs?: Record<string, string>;
        lease_id: string;
        holder_id: string;
        approval_id: string;
    }): Promise<Record<string, unknown>>;
    readCanonicalEnvironmentFile(environmentId: string, request: {
        path: string;
        lease_id: string;
        holder_id: string;
    }): Promise<Record<string, unknown>>;
    writeCanonicalEnvironmentFile(environmentId: string, request: {
        path: string;
        content: string;
        lease_id: string;
        holder_id: string;
        approval_id: string;
    }): Promise<Record<string, unknown>>;
    canonicalEnvironmentClipboard(environmentId: string, request: {
        lease_id: string;
        holder_id: string;
        text?: string;
        approval_id?: string;
    }): Promise<Record<string, unknown>>;
    executeCanonicalMobileAction(environmentId: string, request: {
        action: string;
        arguments?: Record<string, unknown>;
        lease_id: string;
        holder_id: string;
        approval_id: string;
    }): Promise<Record<string, unknown>>;
    watch(options: WatchOptions): Promise<Response>;
    getReceipts(runId: string): Promise<unknown>;
    getSnapshot(runId: string): Promise<unknown>;
    approveRun(runId: string, options?: ApprovalOptions): Promise<unknown>;
    denyRun(runId: string, options?: ApprovalOptions): Promise<unknown>;
    cancelRun(runId: string, options?: CancelOptions): Promise<unknown>;
    captureRunScreenshot(runId: string): Promise<{
        screenshot_b64?: string;
    }>;
    pauseRun(runId: string, options?: CancelOptions): Promise<unknown>;
    resumeRun(runId: string, options?: ResumeOptions): Promise<unknown>;
    watchRun(runId: string, options?: WatchRunOptions): AsyncGenerator<any, void, unknown>;
    waitForRun(runId: string, options?: WaitForRunOptions): Promise<{
        status?: string;
    }>;
}
export declare function createComputerUseClient(config?: RequestOptions): AllternitComputerUseClient;
export declare function resolveComputerUseBaseUrl(url?: string): string;
export type EngineEventBatch = unknown;
export type EngineEventRecord = unknown;
export type EngineExecutionRequestInput = ComputerUseRequest;
export type EngineReceiptsResponse = unknown;
export type EngineRunSnapshot = unknown;
