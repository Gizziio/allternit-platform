/**
 * Cowork Controller
 *
 * Central session management for Allternit remote control.
 * Manages multiple terminal session mirrors with multi-client support.
 *
 * Features:
 * - Multi-session management
 * - WebSocket event broadcasting
 * - HTTP API for session control
 * - Client authentication (Phase 2)
 * - Session persistence (Phase 2)
 *
 * @example
 * ```typescript
 * const controller = new CoworkController({ port: 3010 });
 * await controller.start();
 *
 * // Create a session
 * const session = await controller.createSession('run-123');
 *
 * // Broadcast event to all clients
 * session.broadcast({ type: 'output', data: 'Hello' });
 * ```
 */
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
export interface TerminalEvent {
    type: 'output' | 'input' | 'prompt' | 'status' | 'error' | 'connected' | 'disconnected';
    data?: string;
    timestamp: number;
    runId?: string;
    message?: string;
    clientId?: string;
}
export interface Session {
    id: string;
    runId: string;
    createdAt: Date;
    clients: Map<string, WebSocket>;
    eventHistory: TerminalEvent[];
    maxHistory: number;
    accessToken?: string;
}
export interface CoworkControllerOptions {
    port?: number;
    host?: string;
    path?: string;
    maxSessions?: number;
    maxHistory?: number;
    enableAuth?: boolean;
}
export declare class CoworkController extends EventEmitter {
    private httpServer;
    private wsServer;
    private sessions;
    private options;
    private started;
    constructor(options?: CoworkControllerOptions);
    /**
     * Start the Cowork Controller
     */
    start(): Promise<void>;
    /**
     * Stop the Cowork Controller
     */
    stop(): Promise<void>;
    /**
     * Create a new session
     */
    createSession(runId: string): Promise<Session>;
    /**
     * Get a session by ID
     */
    getSession(sessionId: string): Session | undefined;
    /**
     * Get a session by run ID
     */
    getSessionByRunId(runId: string): Session | undefined;
    /**
     * Delete a session
     */
    deleteSession(sessionId: string): Promise<void>;
    /**
     * Broadcast an event to all clients in a session
     */
    broadcast(sessionId: string, event: TerminalEvent): void;
    /**
     * Get session info
     */
    getSessionInfo(sessionId: string): {
        id: string;
        runId: string;
        createdAt: Date;
        clientCount: number;
        historyLength: number;
        wsUrl: string;
    } | undefined;
    /**
     * List all sessions
     */
    listSessions(): Array<{
        id: string;
        runId: string;
        createdAt: Date;
        clientCount: number;
    }>;
    private setupWebSocketHandlers;
    private handleNewConnection;
    private handleHttpRequest;
    private handleApiRequest;
    private handleCreateSession;
}
/**
 * Create a new Cowork Controller
 */
export declare function createCoworkController(options?: CoworkControllerOptions): CoworkController;
export default CoworkController;
export * from './service-manager';
export * from './cloud-relay';
export { PollingCloudRelayClient } from './cloud-relay-polling';
export type { PollingRelayOptions, PollResponse, SendResponse, } from './cloud-relay-polling';
//# sourceMappingURL=index.d.ts.map