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
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { EventEmitter } from 'events';
const DEFAULT_OPTIONS = {
    port: 0, // 0 = random available port
    host: '127.0.0.1',
    path: '/stream',
};
export class DirectStreamServer extends EventEmitter {
    options;
    httpServer;
    clients = new Map();
    runId = null;
    port = 0;
    started = false;
    heartbeatInterval;
    constructor(options = {}) {
        super();
        this.options = options;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        // Create HTTP server
        this.httpServer = createServer(this.handleHttpRequest.bind(this));
    }
    /**
     * Start the streaming server
     * @param runId - The run/session ID to stream
     * @returns The mirror URL
     */
    async start(runId) {
        if (this.started) {
            throw new Error('Server already started');
        }
        return new Promise((resolve, reject) => {
            // Listen on port (host is optional for TCP)
            this.httpServer.once('error', reject);
            this.httpServer.listen({ port: this.options.port, host: this.options.host }, () => {
                this.httpServer.off('error', reject);
                const address = this.httpServer.address();
                if (typeof address === 'string') {
                    this.port = 0; // Unix socket
                    resolve(address);
                }
                else if (address) {
                    this.port = address.port;
                    this.runId = runId;
                    this.started = true;
                    // Start heartbeat to keep connections alive
                    this.heartbeatInterval = setInterval(() => {
                        this.sendHeartbeat();
                    }, 30000);
                    const url = `http://${this.options.host}:${this.port}${this.options.path}/${runId}`;
                    this.emit('started', { url, port: this.port });
                    resolve(url);
                }
                else {
                    reject(new Error('Failed to get server address'));
                }
            });
        });
    }
    /**
     * Stop the streaming server
     */
    async stop() {
        if (!this.started) {
            return;
        }
        return new Promise((resolve) => {
            // Clear heartbeat
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }
            // Close all client connections
            for (const client of this.clients.values()) {
                try {
                    client.response.end();
                }
                catch {
                    // Ignore errors during cleanup
                }
            }
            this.clients.clear();
            this.httpServer.close(() => {
                this.started = false;
                this.runId = null;
                this.emit('stopped');
                resolve();
            });
        });
    }
    /**
     * Broadcast a terminal event to all connected clients
     */
    broadcast(event) {
        if (!this.started) {
            return;
        }
        const message = {
            runId: this.runId || undefined,
            ...event,
            timestamp: event.timestamp || Date.now(),
        };
        const data = JSON.stringify(message);
        for (const client of this.clients.values()) {
            try {
                // SSE format
                client.response.write(`event: ${event.type}\n`);
                client.response.write(`data: ${data}\n\n`);
                client.lastPing = Date.now();
            }
            catch (error) {
                // Client disconnected
                this.removeClient(client.id);
            }
        }
    }
    /**
     * Get the number of connected clients
     */
    getClientCount() {
        return this.clients.size;
    }
    /**
     * Get the server port
     */
    getPort() {
        return this.port;
    }
    /**
     * Check if the server is running
     */
    isRunning() {
        return this.started;
    }
    // Private methods
    handleHttpRequest(req, res) {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        // CORS headers for all responses
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        // SSE stream endpoint
        if (url.pathname.startsWith(`${this.options.path}/`)) {
            const pathParts = url.pathname.split('/');
            const eventRunId = pathParts[pathParts.length - 1];
            // Verify runId matches
            if (eventRunId !== this.runId) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid run ID' }));
                return;
            }
            this.handleSSEConnection(req, res);
            return;
        }
        // Health check endpoint
        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                running: this.started,
                runId: this.runId,
                clients: this.clients.size,
                port: this.port,
            }));
            return;
        }
        // Info endpoint
        if (url.pathname.startsWith('/info')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                runId: this.runId,
                streamUrl: `http://${this.options.host}:${this.port}${this.options.path}/${this.runId}`,
                httpUrl: `http://${this.options.host}:${this.port}`,
                clients: this.clients.size,
                protocol: 'sse',
            }));
            return;
        }
        // 404 for everything else
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
    handleSSEConnection(req, res) {
        const clientId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        // Store client
        const client = {
            id: clientId,
            response: res,
            connectedAt: Date.now(),
            lastPing: Date.now(),
        };
        this.clients.set(clientId, client);
        this.emit('clientConnected', { count: this.clients.size, clientId });
        // Send welcome message
        const welcomeEvent = {
            type: 'connected',
            runId: this.runId || undefined,
            timestamp: Date.now(),
            message: 'Connected to Gizzi-Code stream',
        };
        res.write(`event: connected\n`);
        res.write(`data: ${JSON.stringify(welcomeEvent)}\n\n`);
        // Handle client disconnect
        req.on('close', () => {
            this.removeClient(clientId);
        });
        req.on('error', () => {
            this.removeClient(clientId);
        });
    }
    removeClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        try {
            client.response.end();
        }
        catch {
            // Ignore errors
        }
        this.clients.delete(clientId);
        this.emit('clientDisconnected', { count: this.clients.size, clientId });
    }
    sendHeartbeat() {
        const pingEvent = {
            type: 'status',
            timestamp: Date.now(),
            message: 'ping',
        };
        for (const client of this.clients.values()) {
            try {
                client.response.write(`event: ping\n`);
                client.response.write(`data: ${JSON.stringify(pingEvent)}\n\n`);
                client.lastPing = Date.now();
            }
            catch {
                this.removeClient(client.id);
            }
        }
    }
}
/**
 * Create a new direct stream server
 */
export function createDirectStreamServer(options) {
    return new DirectStreamServer(options);
}
export default DirectStreamServer;
