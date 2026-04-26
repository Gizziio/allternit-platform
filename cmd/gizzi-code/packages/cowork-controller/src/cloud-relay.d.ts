/**
 * Cloud Relay Client
 *
 * Connects outbound to cloud relay server for remote control from anywhere.
 * This enables Claude Code-style remote access without inbound ports.
 *
 * Architecture:
 * Gizzi-Code TUI → WebSocket (outbound) → Cloud Relay → Mobile/Browser
 *
 * No inbound ports required - firewall friendly.
 */
import { EventEmitter } from 'events';
export interface CloudRelayOptions {
    /** Cloud relay server URL (wss://) */
    relayUrl: string;
    /** Session/run ID */
    sessionId: string;
    /** Authentication token */
    authToken?: string;
    /** Reconnect interval in ms */
    reconnectInterval?: number;
    /** Enable debug logging */
    debug?: boolean;
}
export interface RelayMessage {
    type: 'session_event' | 'command' | 'approval_request' | 'approval_response' | 'status';
    payload: any;
    timestamp: number;
    sessionId: string;
}
export declare class CloudRelayClient extends EventEmitter {
    private ws;
    private options;
    private reconnectTimer;
    private connected;
    private messageQueue;
    constructor(options: CloudRelayOptions);
    /**
     * Connect to cloud relay
     */
    connect(): Promise<void>;
    /**
     * Disconnect from cloud relay
     */
    disconnect(): void;
    /**
     * Send session event to relay
     */
    sendEvent(event: Omit<RelayMessage, 'timestamp' | 'sessionId'>): boolean;
    /**
     * Send terminal output to relay
     */
    sendOutput(output: string, metadata?: Record<string, any>): void;
    /**
     * Send approval request to relay
     */
    sendApprovalRequest(request: {
        id: string;
        type: string;
        title: string;
        description?: string;
        data?: any;
    }): void;
    /**
     * Send approval response to relay
     */
    sendApprovalResponse(approvalId: string, approved: boolean, reason?: string): void;
    /**
     * Check if connected to relay
     */
    isConnected(): boolean;
    /**
     * Get connection status
     */
    getStatus(): {
        connected: boolean;
        sessionId: string;
        relayUrl: string;
        queuedMessages: number;
    };
    private handleMessage;
    private scheduleReconnect;
    private flushMessageQueue;
}
/**
 * Create a cloud relay client
 */
export declare function createCloudRelayClient(options: CloudRelayOptions): CloudRelayClient;
export declare const DEFAULT_CLOUD_RELAY_URL = "wss://cowork.allternit.com";
export default CloudRelayClient;
//# sourceMappingURL=cloud-relay.d.ts.map