/**
 * Cowork Controller - Redis Edition
 *
 * Production-ready with horizontal scaling support.
 * Uses Redis for cross-instance session sharing and pub/sub.
 *
 * Features:
 * - Multi-session management with Redis persistence
 * - WebSocket event broadcasting with Redis pub/sub
 * - Horizontal scaling (multiple instances behind load balancer)
 * - Session affinity not required
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
    redisUrl?: string;
}
export declare class CoworkControllerRedis extends EventEmitter {
    private httpServer;
    private wsServer;
    private sessions;
    private options;
    private started;
    private redis?;
    private redisSubscriber?;
    constructor(options?: CoworkControllerOptions);
    /**
     * Initialize Redis connection
     */
    initializeRedis(): Promise<void>;
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
    broadcast(sessionId: string, event: TerminalEvent): Promise<void>;
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
    private handleRedisBroadcast;
    private handleHttpRequest;
    private handleApiRequest;
    private handleCreateSession;
}
/**
 * Create a new Cowork Controller with Redis
 */
export declare function createCoworkControllerRedis(options?: CoworkControllerOptions): CoworkControllerRedis;
export default CoworkControllerRedis;
//# sourceMappingURL=controller-redis.d.ts.map