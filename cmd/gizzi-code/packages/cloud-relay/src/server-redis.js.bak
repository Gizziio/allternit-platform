/**
 * Cloud Relay Server - Redis Edition
 *
 * Production-ready relay with horizontal scaling support.
 * Uses Redis for message queuing and cross-instance communication.
 *
 * Features:
 * - HTTP Polling for desktop/mobile
 * - SSE for real-time streaming
 * - Redis pub/sub for horizontal scaling
 * - Stateless design (any server can handle any request)
 */
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';
const app = express();
app.use(cors());
app.use(express.json());
// Redis client
let redis;
// In-memory cache (fallback if Redis unavailable)
const localCache = {
    sessions: new Map(),
    messages: new Map(),
};
const REDIS_KEY_PREFIX = 'cowork:relay';
const MESSAGE_TTL = 60 * 60 * 24; // 24 hours
const SESSION_TTL = 60 * 60; // 1 hour
/**
 * Initialize Redis connection
 */
async function initializeRedis() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
        redis = createClient({ url: redisUrl });
        await redis.connect();
        console.log('[Redis] Connected successfully');
        // Subscribe to broadcast channel
        const subscriber = redis.duplicate();
        await subscriber.connect();
        await subscriber.subscribe(`${REDIS_KEY_PREFIX}:broadcast`, (message) => {
            handleRedisBroadcast(message);
        });
    }
    catch (error) {
        console.warn('[Redis] Connection failed, using in-memory cache', error);
        // Continue with in-memory cache
    }
}
/**
 * Get session from Redis or local cache
 */
async function getSession(sessionId) {
    if (redis?.isReady) {
        const data = await redis.get(`${REDIS_KEY_PREFIX}:session:${sessionId}`);
        if (data) {
            const session = JSON.parse(data);
            session.mobileIds = new Set(session.mobileIds);
            return session;
        }
    }
    return localCache.sessions.get(sessionId) || null;
}
/**
 * Save session to Redis or local cache
 */
async function saveSession(session) {
    const data = JSON.stringify({
        ...session,
        mobileIds: Array.from(session.mobileIds),
    });
    if (redis?.isReady) {
        await redis.setEx(`${REDIS_KEY_PREFIX}:session:${session.id}`, SESSION_TTL, data);
    }
    else {
        localCache.sessions.set(session.id, session);
    }
}
/**
 * Add message to queue
 */
async function addMessage(sessionId, message) {
    const key = `${REDIS_KEY_PREFIX}:messages:${sessionId}`;
    if (redis?.isReady) {
        // Use Redis list for message queue
        await redis.lPush(key, JSON.stringify(message));
        await redis.expire(key, MESSAGE_TTL);
        // Trim to last 1000 messages
        await redis.lTrim(key, 0, 999);
        // Publish to broadcast channel for other instances
        await redis.publish(`${REDIS_KEY_PREFIX}:broadcast`, JSON.stringify({
            sessionId,
            message,
        }));
    }
    else {
        // Local cache
        if (!localCache.messages.has(sessionId)) {
            localCache.messages.set(sessionId, []);
        }
        const messages = localCache.messages.get(sessionId);
        messages.unshift(message);
        if (messages.length > 1000) {
            messages.pop();
        }
    }
}
/**
 * Get messages from queue
 */
async function getMessages(sessionId, since) {
    const key = `${REDIS_KEY_PREFIX}:messages:${sessionId}`;
    if (redis?.isReady) {
        const data = await redis.lRange(key, 0, -1);
        return data
            .map(m => JSON.parse(m))
            .filter(m => m.timestamp > since);
    }
    const messages = localCache.messages.get(sessionId) || [];
    return messages.filter(m => m.timestamp > since);
}
/**
 * Handle broadcast from other instances
 */
function handleRedisBroadcast(message) {
    try {
        const { sessionId, message: msg } = JSON.parse(message);
        // Update local SSE connections if we have clients for this session
        const sseClients = sseConnections.get(sessionId);
        if (sseClients) {
            for (const res of sseClients) {
                res.write(`event: ${msg.type}\ndata: ${JSON.stringify(msg)}\n\n`);
            }
        }
    }
    catch {
        // Ignore parse errors
    }
}
// SSE connections map (in-memory, per-instance)
const sseConnections = new Map();
// Middleware: Validate session
async function validateSession(req, res, next) {
    const sessionId = req.params.sessionId;
    const session = await getSession(sessionId);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }
    // Update activity
    session.lastActivity = Date.now();
    await saveSession(session);
    req.session = session;
    next();
}
// POST /api/v1/relay/:sessionId/register
app.post('/api/v1/relay/:sessionId/register', async (req, res) => {
    const sessionId = req.params.sessionId;
    const { clientType } = req.body;
    let session = await getSession(sessionId);
    if (!session) {
        session = {
            id: sessionId,
            desktopConnected: false,
            mobileIds: new Set(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + SESSION_TTL * 1000,
        };
        console.log(`[Register] New session: ${sessionId}`);
    }
    if (clientType === 'desktop') {
        session.desktopConnected = true;
    }
    else if (clientType === 'mobile') {
        const mobileId = uuidv4();
        session.mobileIds.add(mobileId);
        console.log(`[Register] Mobile connected: ${mobileId} to session: ${sessionId}`);
    }
    await saveSession(session);
    res.json({
        success: true,
        sessionId,
        expiresAt: new Date(session.expiresAt).toISOString(),
    });
});
// POST /api/v1/relay/:sessionId/messages
app.post('/api/v1/relay/:sessionId/messages', validateSession, async (req, res) => {
    const message = req.body;
    const fullMessage = {
        ...message,
        id: uuidv4(),
    };
    await addMessage(req.params.sessionId, fullMessage);
    console.log(`[Message] ${message.type} from ${message.sender} to session: ${req.params.sessionId}`);
    res.json({
        success: true,
        messageId: fullMessage.id,
    });
});
// POST /api/v1/relay/:sessionId/poll
app.post('/api/v1/relay/:sessionId/poll', validateSession, async (req, res) => {
    const { lastPollTime, clientType } = req.body;
    const sessionId = req.params.sessionId;
    const messages = await getMessages(sessionId, lastPollTime || 0);
    // Filter messages intended for this client
    const filteredMessages = messages.filter(msg => {
        return (clientType === 'mobile' && msg.sender === 'desktop') ||
            (clientType === 'desktop' && msg.sender === 'mobile');
    });
    const MAX_MESSAGES = 50;
    const result = filteredMessages.slice(0, MAX_MESSAGES);
    const hasMore = filteredMessages.length > MAX_MESSAGES;
    res.json({
        messages: result,
        hasMore,
        serverTime: Date.now(),
    });
});
// GET /api/v1/relay/:sessionId/stream (SSE)
app.get('/api/v1/relay/:sessionId/stream', validateSession, async (req, res) => {
    const sessionId = req.params.sessionId;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    console.log(`[SSE] Client connected to session: ${sessionId}`);
    // Add to SSE connections
    if (!sseConnections.has(sessionId)) {
        sseConnections.set(sessionId, new Set());
    }
    sseConnections.get(sessionId).add(res);
    // Send initial connection event
    res.write(`event: connected\ndata: ${JSON.stringify({ sessionId })}\n\n`);
    // Handle disconnect
    req.on('close', () => {
        const connections = sseConnections.get(sessionId);
        if (connections) {
            connections.delete(res);
            if (connections.size === 0) {
                sseConnections.delete(sessionId);
            }
        }
        console.log(`[SSE] Client disconnected from session: ${sessionId}`);
    });
});
// GET /api/v1/relay/:sessionId/status
app.get('/api/v1/relay/:sessionId/status', validateSession, async (req, res) => {
    const session = req.session;
    res.json({
        sessionId: session.id,
        status: session.desktopConnected ? 'active' : 'inactive',
        desktopConnected: session.desktopConnected,
        mobileCount: session.mobileIds.size,
        lastActivity: session.lastActivity,
        expiresAt: new Date(session.expiresAt).toISOString(),
    });
});
// POST /api/v1/relay/:sessionId/heartbeat
app.post('/api/v1/relay/:sessionId/heartbeat', validateSession, async (req, res) => {
    const session = req.session;
    session.expiresAt = Date.now() + SESSION_TTL * 1000;
    await saveSession(session);
    res.json({
        success: true,
        sessionActive: true,
        expiresAt: new Date(session.expiresAt).toISOString(),
    });
});
// DELETE /api/v1/relay/:sessionId
app.delete('/api/v1/relay/:sessionId', validateSession, async (req, res) => {
    const sessionId = req.params.sessionId;
    if (redis?.isReady) {
        await redis.del(`${REDIS_KEY_PREFIX}:session:${sessionId}`);
        await redis.del(`${REDIS_KEY_PREFIX}:messages:${sessionId}`);
    }
    localCache.sessions.delete(sessionId);
    localCache.messages.delete(sessionId);
    console.log(`[Delete] Session: ${sessionId}`);
    res.json({ success: true });
});
// Health check
app.get('/health', async (req, res) => {
    const redisStatus = redis?.isReady ? 'connected' : 'disconnected';
    res.json({
        status: 'ok',
        redis: redisStatus,
        sessions: localCache.sessions.size,
        uptime: process.uptime(),
    });
});
// Cleanup expired sessions periodically
setInterval(async () => {
    const now = Date.now();
    // Clean local cache
    for (const [id, session] of localCache.sessions) {
        if (session.expiresAt < now) {
            localCache.sessions.delete(id);
            localCache.messages.delete(id);
            console.log(`[Cleanup] Expired session: ${id}`);
        }
    }
}, 60000);
// Start server
const PORT = process.env.PORT || 8080;
async function start() {
    await initializeRedis();
    app.listen(PORT, () => {
        console.log(`[Cloud Relay] Redis Edition running on port ${PORT}`);
        console.log(`[Cloud Relay] Health check: http://localhost:${PORT}/health`);
        console.log(`[Cloud Relay] Redis: ${redis?.isReady ? 'connected' : 'using in-memory cache'}`);
    });
}
start().catch(console.error);
export default app;
