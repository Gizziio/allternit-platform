/**
 * Cloud Relay Client - Polling Architecture
 *
 * HTTP-based cloud relay for enterprise scalability.
 * No WebSockets, works through any firewall/proxy.
 *
 * Pattern:
 * Desktop: POST /poll → "any messages for me?"
 * Desktop: POST /send → "here's my output"
 * Mobile:  POST /send → "here's my command"
 * Mobile:  GET  /stream (SSE) → receives terminal output
 */
export interface PollingRelayOptions {
    /** Cloud relay base URL (https://) */
    relayUrl: string;
    /** Session/run ID */
    sessionId: string;
    /** Authentication token */
    authToken?: string;
    /** Poll interval in ms (default: 500) */
    pollInterval?: number;
    /** Max retry attempts */
    maxRetries?: number;
}
export interface RelayMessage {
    type: 'output' | 'command' | 'approval_request' | 'approval_response' | 'status' | 'ping';
    payload: any;
    timestamp: number;
    sender: 'desktop' | 'mobile';
    messageId: string;
}
export interface PollResponse {
    messages: RelayMessage[];
    hasMore: boolean;
    nextCursor?: string;
}
export interface SendResponse {
    success: boolean;
    messageId: string;
    error?: string;
}
/**
 * Polling-based Cloud Relay Client
 *
 * Uses HTTP POST for sending, HTTP GET/POST for receiving.
 * No persistent connections = firewall friendly.
 */
export declare class PollingCloudRelayClient {
    private options;
    private pollTimer;
    private isRunning;
    private lastPollTime;
    private messageQueue;
    private pendingMessages;
    private onMessageCallback;
    private onErrorCallback;
    private retryCount;
    constructor(options: PollingRelayOptions);
    /**
     * Start the polling loop
     */
    start(): Promise<void>;
    /**
     * Stop the polling loop
     */
    stop(): void;
    /**
     * Send a message to the relay
     */
    sendMessage(message: Omit<RelayMessage, 'timestamp' | 'messageId'>): Promise<SendResponse>;
    /**
     * Send terminal output to relay
     */
    sendOutput(output: string, metadata?: Record<string, any>): Promise<void>;
    /**
     * Send approval request to relay
     */
    sendApprovalRequest(request: {
        id: string;
        type: string;
        title: string;
        description?: string;
    }): Promise<void>;
    /**
     * Send approval response to relay
     */
    sendApprovalResponse(approvalId: string, approved: boolean, reason?: string): Promise<void>;
    /**
     * Set callback for received messages
     */
    onMessage(callback: (message: RelayMessage) => void): void;
    /**
     * Set callback for errors
     */
    onError(callback: (error: Error) => void): void;
    /**
     * Check if client is running
     */
    isActive(): boolean;
    /**
     * Get connection status
     */
    getStatus(): {
        running: boolean;
        lastPollTime: number;
        queuedMessages: number;
        retryCount: number;
    };
    private registerSession;
    private poll;
    private flushQueue;
    private schedulePoll;
    private generateMessageId;
}
/**
 * Create a polling cloud relay client
 */
export declare function createPollingCloudRelayClient(options: PollingRelayOptions): PollingCloudRelayClient;
export declare const DEFAULT_POLLING_RELAY_URL = "https://cowork.allternit.com";
export default PollingCloudRelayClient;
//# sourceMappingURL=cloud-relay-polling.d.ts.map