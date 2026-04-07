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
import { createServer, Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import { createClient } from 'redis';
import { mirrorSync, MirrorSync } from './mirror-sync';
const DEFAULT_OPTIONS = {
    port: 3010,
    host: '0.0.0.0',
    path: '/cowork',
    maxSessions: 100,
    maxHistory: 1000,
    enableAuth: false,
    redisUrl: 'redis://localhost:6379',
};
const REDIS_KEY_PREFIX = 'cowork:controller';
const SESSION_TTL = 60 * 60 * 2; // 2 hours
// ============================================================================
// Cowork Controller with Redis
// ============================================================================
export class CoworkControllerRedis extends EventEmitter {
    httpServer;
    wsServer;
    sessions = new Map();
    options;
    started = false;
    redis;
    redisSubscriber;
    constructor(options = {}) {
        super();
        this.options = { ...DEFAULT_OPTIONS, ...options };
        // Create HTTP server with CORS
        this.httpServer = createServer(this.handleHttpRequest.bind(this));
        // Create WebSocket server
        this.wsServer = new WebSocketServer({ noServer: true });
        // Handle HTTP upgrade for WebSocket
        this.httpServer.on('upgrade', (req, socket, head) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            if (url.pathname.startsWith(this.options.path)) {
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
     * Initialize Redis connection
     */
    async initializeRedis() {
        try {
            // Main Redis client
            this.redis = createClient({ url: this.options.redisUrl });
            await this.redis.connect();
            // Subscriber client (for pub/sub)
            this.redisSubscriber = this.redis.duplicate();
            await this.redisSubscriber.connect();
            // Subscribe to broadcast channel
            await this.redisSubscriber.subscribe(`${REDIS_KEY_PREFIX}:broadcast`, (message) => this.handleRedisBroadcast(message));
            console.log('🔴 Redis connected');
        }
        catch (error) {
            console.warn('⚠️  Redis connection failed, using in-memory only', error);
        }
    }
    /**
     * Start the Cowork Controller
     */
    async start() {
        if (this.started) {
            throw new Error('Cowork Controller already started');
        }
        // Initialize Redis
        await this.initializeRedis();
        return new Promise((resolve, reject) => {
            this.httpServer.once('error', reject);
            this.httpServer.listen(this.options.port, this.options.host, () => {
                this.httpServer.off('error', reject);
                const address = this.httpServer.address();
                const port = typeof address === 'string' ? 0 : address?.port || 0;
                this.started = true;
                this.emit('started', { port, host: this.options.host });
                console.log(`🔮 Cowork Controller (Redis Edition) started on port ${port}`);
                console.log(`   WebSocket: ws://${this.options.host}:${port}${this.options.path}`);
                console.log(`   HTTP API: http://${this.options.host}:${port}/api`);
                console.log(`   Redis: ${this.redis?.isReady ? 'connected' : 'not available'}`);
                resolve();
            });
        });
    }
    /**
     * Stop the Cowork Controller
     */
    async stop() {
        if (!this.started) {
            return;
        }
        return new Promise((resolve) => {
            // Close all client connections
            for (const session of this.sessions.values()) {
                for (const client of session.clients.values()) {
                    client.close(1000, 'Server shutting down');
                }
                session.clients.clear();
            }
            this.sessions.clear();
            // Close Redis connections
            this.redisSubscriber?.unsubscribe();
            this.redisSubscriber?.quit();
            this.redis?.quit();
            this.wsServer.close(() => {
                this.httpServer.close(() => {
                    this.started = false;
                    this.emit('stopped');
                    resolve();
                });
            });
        });
    }
    /**
     * Create a new session
     */
    async createSession(runId) {
        if (this.sessions.size >= this.options.maxSessions) {
            throw new Error(`Maximum sessions (${this.options.maxSessions}) reached`);
        }
        const sessionId = uuidv4();
        const accessToken = uuidv4();
        const session = {
            id: sessionId,
            runId,
            createdAt: new Date(),
            clients: new Map(),
            eventHistory: [],
            maxHistory: this.options.maxHistory,
            accessToken,
        };
        this.sessions.set(sessionId, session);
        // Store in Redis for cross-instance visibility
        if (this.redis?.isReady) {
            await this.redis.setEx(`${REDIS_KEY_PREFIX}:session:${sessionId}`, SESSION_TTL, JSON.stringify({
                id: sessionId,
                runId,
                createdAt: session.createdAt,
                accessToken,
            }));
        }
        // Create mirror session for remote control
        const mirrorSession = await mirrorSync.onSessionStart(sessionId, runId);
        if (mirrorSession) {
            console.log(`📱 Mirror session created: ${mirrorSession.id} (code: ${mirrorSession.pairing_code})`);
        }
        this.emit('sessionCreated', { sessionId, runId, accessToken });
        console.log(`📝 Session created: ${sessionId} (run: ${runId})`);
        return session;
    }
    /**
     * Get a session by ID
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    /**
     * Get a session by run ID
     */
    getSessionByRunId(runId) {
        for (const session of this.sessions.values()) {
            if (session.runId === runId) {
                return session;
            }
        }
        return undefined;
    }
    /**
     * Delete a session
     */
    async deleteSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session not found: ${sessionId}`);
        }
        // Close all client connections
        for (const client of session.clients.values()) {
            client.close(1000, 'Session ended');
        }
        session.clients.clear();
        this.sessions.delete(sessionId);
        // Delete from Redis
        if (this.redis?.isReady) {
            await this.redis.del(`${REDIS_KEY_PREFIX}:session:${sessionId}`);
            await this.redis.del(`${REDIS_KEY_PREFIX}:history:${sessionId}`);
        }
        this.emit('sessionDeleted', { sessionId });
        console.log(`🗑️  Session deleted: ${sessionId}`);
    }
    /**
     * Broadcast an event to all clients in a session
     */
    async broadcast(sessionId, event) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }
        const fullEvent = {
            ...event,
            timestamp: event.timestamp || Date.now(),
            runId: session.runId,
        };
        // Add to history
        session.eventHistory.push(fullEvent);
        if (session.eventHistory.length > session.maxHistory) {
            session.eventHistory.shift();
        }
        // Store in Redis for cross-instance replay
        if (this.redis?.isReady) {
            await this.redis.lPush(`${REDIS_KEY_PREFIX}:history:${sessionId}`, JSON.stringify(fullEvent));
            await this.redis.lTrim(`${REDIS_KEY_PREFIX}:history:${sessionId}`, 0, session.maxHistory - 1);
            // Publish to other instances
            await this.redis.publish(`${REDIS_KEY_PREFIX}:broadcast`, JSON.stringify({ sessionId, event: fullEvent }));
        }
        // Broadcast to local clients
        const message = JSON.stringify(fullEvent);
        for (const client of session.clients.values()) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        }
        this.emit('broadcast', { sessionId, event: fullEvent, clientCount: session.clients.size });
    }
    /**
     * Get session info
     */
    getSessionInfo(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return undefined;
        }
        return {
            id: session.id,
            runId: session.runId,
            createdAt: session.createdAt,
            clientCount: session.clients.size,
            historyLength: session.eventHistory.length,
            wsUrl: `ws://${this.options.host}:${this.options.port}${this.options.path}/${session.id}`,
        };
    }
    /**
     * List all sessions
     */
    listSessions() {
        return Array.from(this.sessions.values()).map(session => ({
            id: session.id,
            runId: session.runId,
            createdAt: session.createdAt,
            clientCount: session.clients.size,
        }));
    }
    // Private methods
    setupWebSocketHandlers() {
        this.wsServer.on('connection', (ws, req) => {
            const url = new URL(req.url || '', `http://${req.headers.host}`);
            const pathParts = url.pathname.split('/');
            const sessionId = pathParts[pathParts.length - 1];
            const token = url.searchParams.get('token');
            this.handleNewConnection(ws, sessionId, token || undefined);
        });
        this.wsServer.on('error', (error) => {
            this.emit('error', error);
        });
    }
    handleNewConnection(ws, sessionId, token) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            ws.close(4004, 'Session not found');
            return;
        }
        // Security: Validate token if session has one
        if (session.accessToken && token !== session.accessToken) {
            ws.close(4003, 'Invalid access token');
            return;
        }
        const clientId = uuidv4();
        session.clients.set(clientId, ws);
        this.emit('clientConnected', { sessionId, clientId, clientCount: session.clients.size });
        console.log(`📥 Client connected to session ${sessionId} (${session.clients.size} total)`);
        // Send welcome message with session info
        const welcomeEvent = {
            type: 'connected',
            message: 'Connected to Cowork Controller',
            timestamp: Date.now(),
            runId: session.runId,
            clientId,
        };
        ws.send(JSON.stringify(welcomeEvent));
        // Send event history replay (last 50 events)
        for (const event of session.eventHistory.slice(-50)) {
            ws.send(JSON.stringify(event));
        }
        ws.on('close', () => {
            session.clients.delete(clientId);
            this.emit('clientDisconnected', { sessionId, clientId, clientCount: session.clients.size });
            console.log(`📤 Client disconnected from session ${sessionId} (${session.clients.size} remaining)`);
            // Broadcast disconnect event
            this.broadcast(sessionId, {
                type: 'disconnected',
                message: 'Client disconnected',
                clientId,
                timestamp: Date.now(),
            });
        });
        ws.on('error', (error) => {
            this.emit('clientError', { sessionId, clientId, error });
            session.clients.delete(clientId);
        });
        ws.on('message', (data) => {
            try {
                const event = JSON.parse(data.toString());
                this.emit('clientMessage', { sessionId, clientId, event });
            }
            catch (error) {
                console.error('Failed to parse client message:', error);
            }
        });
    }
    handleRedisBroadcast(message) {
        try {
            const { sessionId, event } = JSON.parse(message);
            const session = this.sessions.get(sessionId);
            if (session) {
                // Forward to local clients
                const msg = JSON.stringify(event);
                for (const client of session.clients.values()) {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(msg);
                    }
                }
            }
        }
        catch {
            // Ignore parse errors
        }
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
        // API routes
        if (url.pathname.startsWith('/api/')) {
            this.handleApiRequest(req, res, url);
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
                redis: this.redis?.isReady ? 'connected' : 'disconnected',
            }));
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
            // DELETE /api/sessions/:id - Delete session
            if (sessionMatch && req.method === 'DELETE') {
                const sessionId = sessionMatch[1];
                this.deleteSession(sessionId)
                    .then(() => {
                    res.writeHead(200);
                    res.end(JSON.stringify({ success: true }));
                })
                    .catch((error) => {
                    res.writeHead(404);
                    res.end(JSON.stringify({ error: error.message }));
                });
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
            req.on('data', chunk => data += chunk);
            req.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch {
                    resolve({});
                }
            });
        });
        const { runId } = body;
        if (!runId) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'runId is required' }));
            return;
        }
        try {
            const session = await this.createSession(runId);
            const wsUrl = `ws://${this.options.host}:${this.options.port}${this.options.path}/${session.id}?token=${session.accessToken}`;
            const httpUrl = `http://${this.options.host}:${this.options.port}/mirror/${session.id}?token=${session.accessToken}`;
            res.writeHead(201);
            res.end(JSON.stringify({
                id: session.id,
                runId: session.runId,
                createdAt: session.createdAt,
                accessToken: session.accessToken,
                wsUrl,
                httpUrl,
            }));
        }
        catch (error) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        }
    }
}
/**
 * Create a new Cowork Controller with Redis
 */
export function createCoworkControllerRedis(options) {
    return new CoworkControllerRedis(options);
}
export default CoworkControllerRedis;
