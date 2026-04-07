/**
 * Direct Stream Server - SSE Edition
 *
 * Simple HTTP/SSE streaming for Gizzi-Code terminal sessions.
 * Enterprise-friendly: works through any firewall/proxy.
 *
 * Replaces WebSocket with Server-Sent Events for unidirectional streaming.
 *
 * @example
 * ```typescript
 * const server = new DirectStreamServer();
 * const url = await server.start('run-123');
 * console.log(`Stream URL: ${url}`);
 *
 * // Broadcast terminal events
 * server.broadcast({ type: 'output', data: 'Hello from terminal' });
 * ```
 */
import { EventEmitter } from 'events';
export interface TerminalEvent {
    type: 'output' | 'input' | 'prompt' | 'status' | 'error' | 'connected';
    data?: string;
    timestamp: number;
    runId?: string;
    message?: string;
}
export interface StreamServerOptions {
    port?: number;
    host?: string;
    path?: string;
}
export declare class DirectStreamServer extends EventEmitter {
    private options;
    private httpServer;
    private clients;
    private runId;
    private port;
    private started;
    private heartbeatInterval?;
    constructor(options?: StreamServerOptions);
    /**
     * Start the streaming server
     * @param runId - The run/session ID to stream
     * @returns The mirror URL
     */
    start(runId: string): Promise<string>;
    /**
     * Stop the streaming server
     */
    stop(): Promise<void>;
    /**
     * Broadcast a terminal event to all connected clients
     */
    broadcast(event: TerminalEvent): void;
    /**
     * Get the number of connected clients
     */
    getClientCount(): number;
    /**
     * Get the server port
     */
    getPort(): number;
    /**
     * Check if the server is running
     */
    isRunning(): boolean;
    private handleHttpRequest;
    private handleSSEConnection;
    private removeClient;
    private sendHeartbeat;
}
/**
 * Create a new direct stream server
 */
export declare function createDirectStreamServer(options?: StreamServerOptions): DirectStreamServer;
export default DirectStreamServer;
//# sourceMappingURL=index.d.ts.map