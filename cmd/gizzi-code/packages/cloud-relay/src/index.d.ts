/**
 * Allternit Cloud Relay Service
 *
 * Enables remote access to Allternit sessions from anywhere.
 * Works like Claude Code Remote Control - local sessions accessible via cloud relay.
 *
 * Architecture:
 * ```
 * ┌──────────────┐     outbound      ┌─────────────┐      HTTPS      ┌──────────────┐
 * │ Gizzi-Code   │ ────────────────► │ Cloud Relay │ ◄────────────── │ Mobile       │
 * │ (local)      │  (no inbound)     │ (hosted)    │                 │ Browser      │
 * └──────────────┘                   └─────────────┘                 └──────────────┘
 * ```
 *
 * Features:
 * - Outbound-only connections (no inbound ports required)
 * - Session token authentication
 * - End-to-end encryption ready
 * - Multi-client support
 * - Automatic reconnection
 *
 * Usage:
 * ```bash
 * # Start relay service
 * bun run start
 *
 * # Or with custom config
 * RELAY_PORT=8443 RELAY_HOST=relay.allternit.com bun run start
 * ```
 */
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
export interface RelaySession {
    id: string;
    localSessionId: string;
    createdAt: Date;
    expiresAt: Date;
    localConnection: WebSocket | null;
    remoteClients: Map<string, WebSocket>;
    accessToken: string;
}
export interface CloudRelayOptions {
    port?: number;
    host?: string;
    jwtSecret?: string;
    maxSessions?: number;
    sessionTtlMinutes?: number;
}
export declare class CloudRelayService extends EventEmitter {
    private httpServer;
    private wsServer;
    private sessions;
    private options;
    private started;
    constructor(options?: CloudRelayOptions);
    /**
     * Start the Cloud Relay Service
     */
    start(): Promise<void>;
    /**
     * Stop the Cloud Relay Service
     */
    stop(): Promise<void>;
    /**
     * Register a new relay session (called by local Gizzi-Code)
     */
    registerSession(localSessionId: string, accessToken?: string): Promise<RelaySession>;
    /**
     * Connect local Gizzi-Code to relay session
     */
    connectLocal(sessionId: string, ws: WebSocket): void;
    /**
     * Connect remote client to relay session
     */
    connectRemote(sessionId: string, ws: WebSocket, token?: string): void;
    /**
     * Get public URL for a session
     */
    getPublicUrl(sessionId: string): string;
    /**
     * Get session info
     */
    getSessionInfo(sessionId: string): {
        id: string;
        localSessionId: string;
        createdAt: Date;
        expiresAt: Date;
        localConnected: boolean;
        remoteClientCount: number;
        publicUrl: string;
    } | undefined;
    /**
     * List all sessions
     */
    listSessions(): Array<{
        id: string;
        localSessionId: string;
        createdAt: Date;
        expiresAt: Date;
        localConnected: boolean;
        remoteClientCount: number;
    }>;
    private setupWebSocketHandlers;
    private handleHttpRequest;
    private handleApiRequest;
    private handleCreateSession;
}
/**
 * Create a new Cloud Relay Service
 */
export declare function createCloudRelayService(options?: CloudRelayOptions): CloudRelayService;
export default CloudRelayService;
//# sourceMappingURL=index.d.ts.map