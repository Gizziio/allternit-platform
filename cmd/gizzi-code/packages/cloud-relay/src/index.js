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
import { createServer, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import jwt from 'jsonwebtoken';
const DEFAULT_OPTIONS = {
    port: parseInt(process.env.RELAY_PORT || '8443', 10),
    host: process.env.RELAY_HOST || '0.0.0.0',
    jwtSecret: process.env.RELAY_JWT_SECRET || 'change-me-in-production',
    maxSessions: 1000,
    sessionTtlMinutes: 120,
};
// ============================================================================
// Cloud Relay Service
// ============================================================================
export class CloudRelayService extends EventEmitter {
    httpServer;
    wsServer;
    sessions = new Map();
    options;
    started = false;
    constructor(options = {}) {
        super();
        this.options = { ...DEFAULT_OPTIONS, ...options };
        // Create HTTP server with CORS
        this.httpServer = createServer(this.handleHttpRequest.bind(this));
        // Create WebSocket server
        this.wsServer = new WebSocketServer({
            server: this.httpServer,
            noServer: true,
        });
        // Handle HTTP upgrade for WebSocket
        this.httpServer.on('upgrade', (req, socket, head) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            // Accept both /relay/* and /cowork/* paths
            if (url.pathname.startsWith('/relay') || url.pathname.startsWith('/cowork')) {
                this.wsServer.handleUpgrade(req, socket, head, (ws) => {
                    this.wsServer.emit('connection', ws, req);
                });
            }
            else {
                socket.destroy();
            }
        });
        this.setupWebSocketHandlers();
    }
    /**
     * Start the Cloud Relay Service
     */
    async start() {
        if (this.started) {
            throw new Error('Cloud Relay Service already started');
        }
        return new Promise((resolve, reject) => {
            this.httpServer.once('error', reject);
            this.httpServer.listen(this.options.port, this.options.host, () => {
                this.httpServer.off('error', reject);
                const address = this.httpServer.address();
                const port = typeof address === 'string' ? 0 : address?.port || 0;
                this.started = true;
                this.emit('started', { port, host: this.options.host });
                console.log('🔃 Cloud Relay Service started');
                console.log(`   Port: ${port}`);
                console.log(`   Host: ${this.options.host}`);
                console.log(`   Max sessions: ${this.options.maxSessions}`);
                console.log(`   Session TTL: ${this.options.sessionTtlMinutes} minutes`);
                console.log('');
                console.log('   Connection URLs:');
                console.log(`   - Local: ws://localhost:${port}/relay`);
                console.log(`   - Public: wss://${this.options.host}:${port}/relay`);
                console.log('');
                console.log('   Press Ctrl+C to stop');
                resolve();
            });
        });
    }
    /**
     * Stop the Cloud Relay Service
     */
    async stop() {
        if (!this.started) {
            return;
        }
        return new Promise((resolve) => {
            // Close all connections
            for (const session of this.sessions.values()) {
                session.localConnection?.close(1000, 'Service shutting down');
                for (const client of session.remoteClients.values()) {
                    client.close(1000, 'Service shutting down');
                }
            }
            this.sessions.clear();
            this.wsServer.close(() => {
                this.httpServer.close(() => {
                    this.started = false;
                    this.emit('stopped');
                    console.log('✅ Cloud Relay Service stopped');
                    resolve();
                });
            });
        });
    }
    /**
     * Register a new relay session (called by local Gizzi-Code)
     */
    async registerSession(localSessionId, accessToken) {
        if (this.sessions.size >= this.options.maxSessions) {
            throw new Error(`Maximum sessions (${this.options.maxSessions}) reached`);
        }
        const sessionId = uuidv4();
        const session = {
            id: sessionId,
            localSessionId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + this.options.sessionTtlMinutes * 60 * 1000),
            localConnection: null,
            remoteClients: new Map(),
            accessToken: accessToken || uuidv4(),
        };
        this.sessions.set(sessionId, session);
        this.emit('sessionRegistered', { sessionId, localSessionId });
        console.log(`📝 Session registered: ${sessionId} (local: ${localSessionId})`);
        return session;
    }
    /**
     * Connect local Gizzi-Code to relay session
     */
    connectLocal(sessionId, ws) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            ws.close(4004, 'Session not found');
            return;
        }
        session.localConnection = ws;
        this.emit('localConnected', { sessionId });
        console.log(`🔗 Local connected to session ${sessionId}`);
        // Send session info to local
        ws.send(JSON.stringify({
            type: 'local-connected',
            sessionId,
            publicUrl: this.getPublicUrl(sessionId),
            clientCount: session.remoteClients.size,
        }));
        ws.on('close', () => {
            session.localConnection = null;
            this.emit('localDisconnected', { sessionId });
            console.log(`🔌 Local disconnected from session ${sessionId}`);
        });
        ws.on('message', (data) => {
            // Broadcast to all remote clients
            const message = data.toString();
            for (const client of session.remoteClients.values()) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            }
        });
    }
    /**
     * Connect remote client to relay session
     */
    connectRemote(sessionId, ws, token) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            ws.close(4004, 'Session not found');
            return;
        }
        // Security: Validate token
        if (session.accessToken && token !== session.accessToken) {
            ws.close(4003, 'Invalid access token');
            return;
        }
        const clientId = uuidv4();
        session.remoteClients.set(clientId, ws);
        this.emit('remoteConnected', { sessionId, clientId });
        console.log(`📥 Remote client connected to session ${sessionId} (${session.remoteClients.size} total)`);
        // Send welcome message
        ws.send(JSON.stringify({
            type: 'remote-connected',
            sessionId,
            clientId,
            message: 'Connected to Cloud Relay',
        }));
        ws.on('close', () => {
            session.remoteClients.delete(clientId);
            this.emit('remoteDisconnected', { sessionId, clientId });
            console.log(`📤 Remote client disconnected from session ${sessionId}`);
        });
        ws.on('message', (data) => {
            // Forward to local connection
            if (session.localConnection && session.localConnection.readyState === WebSocket.OPEN) {
                session.localConnection.send(data);
            }
        });
    }
    /**
     * Get public URL for a session
     */
    getPublicUrl(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return '';
        const protocol = this.options.port === 443 ? 'wss:' : 'ws:';
        const host = this.options.host === '0.0.0.0' ? 'localhost' : this.options.host;
        return `${protocol}//${host}:${this.options.port}/relay/${sessionId}?token=${session.accessToken}`;
    }
    /**
     * Get session info
     */
    getSessionInfo(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return undefined;
        return {
            id: session.id,
            localSessionId: session.localSessionId,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            localConnected: session.localConnection !== null,
            remoteClientCount: session.remoteClients.size,
            publicUrl: this.getPublicUrl(sessionId),
        };
    }
    /**
     * List all sessions
     */
    listSessions() {
        return Array.from(this.sessions.values()).map(session => ({
            id: session.id,
            localSessionId: session.localSessionId,
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
            localConnected: session.localConnection !== null,
            remoteClientCount: session.remoteClients.size,
        }));
    }
    // Private methods
    setupWebSocketHandlers() {
        this.wsServer.on('connection', (ws, req) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const pathParts = url.pathname.split('/');
            const sessionId = pathParts[pathParts.length - 1];
            const token = url.searchParams.get('token');
            // Determine connection type based on path
            if (url.pathname.startsWith('/relay/local') || url.searchParams.get('type') === 'local') {
                this.connectLocal(sessionId, ws);
            }
            else {
                this.connectRemote(sessionId, ws, token || undefined);
            }
        });
        this.wsServer.on('error', (error) => {
            this.emit('error', error);
        });
    }
    handleHttpRequest(req, res) {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        // CORS headers
        cors()(req, res, () => { });
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        // Health check
        if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                started: this.started,
                sessions: this.sessions.size,
                port: this.options.port,
            }));
            return;
        }
        // API routes
        if (url.pathname.startsWith('/api/')) {
            this.handleApiRequest(req, res, url);
            return;
        }
        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
    handleApiRequest(req, res, url) {
        res.setHeader('Content-Type', 'application/json');
        try {
            // POST /api/sessions - Create session
            if (url.pathname === '/api/sessions' && req.method === 'POST') {
                this.handleCreateSession(req, res);
                return;
            }
            // GET /api/sessions - List sessions
            if (url.pathname === '/api/sessions' && req.method === 'GET') {
                res.writeHead(200);
                res.end(JSON.stringify(this.listSessions()));
                return;
            }
            // GET /api/sessions/:id - Get session info
            const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
            if (sessionMatch && req.method === 'GET') {
                const sessionId = sessionMatch[1];
                const info = this.getSessionInfo(sessionId);
                if (!info) {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: 'Session not found' }));
                    return;
                }
                res.writeHead(200);
                res.end(JSON.stringify(info));
                return;
            }
            // 404
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Not found' }));
        }
        catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({
                error: 'Bad request',
                message: error instanceof Error ? error.message : String(error)
            }));
        }
    }
    async handleCreateSession(req, res) {
        const body = await new Promise((resolve) => {
            let data = '';
            req.on('data', (chunk) => data += chunk);
            req.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    resolve({});
                }
            });
        });
        const { localSessionId, accessToken } = body;
        if (!localSessionId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'localSessionId is required' }));
            return;
        }
        try {
            const session = await this.registerSession(localSessionId, accessToken);
            res.writeHead(201);
            res.end(JSON.stringify({
                id: session.id,
                localSessionId: session.localSessionId,
                publicUrl: this.getPublicUrl(session.id),
                accessToken: session.accessToken,
                expiresAt: session.expiresAt,
            }));
        }
        catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
    }
}
/**
 * Create a new Cloud Relay Service
 */
export function createCloudRelayService(options) {
    return new CloudRelayService(options);
}
export default CloudRelayService;
