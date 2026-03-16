/**
 * A2R Gateway - HTTP Transport with UI v0 Binding
 * 
 * Streamable HTTP endpoints for web/enterprise deployments.
 * Includes UI v0 compatibility layer as pure translation.
 * 
 * CRITICAL CONSTRAINTS:
 * - NO eventBus.publish() calls in this file
 * - NO synthetic event emission
 * - ALL execution flows through kernel adapter
 * - Binding layer is PURE TRANSLATION only
 * 
 * @module @a2rchitech/gateway-http
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { v4 as uuidv4 } from 'uuid';
import {
  GatewayCore,
  GatewayConfig,
  DEFAULT_CONFIG,
  GatewayEvent,
  EventType,
  UIv0Events,
} from '../../runtime/index.js';
import { KernelAdapter, createKernelAdapter } from '../../adapters/kernel/index.js';
import { buildSSEEnvelope, UI_CONTRACT_ID } from '../../bindings/ui_contract_legacy/contracts.js';
import { TamboEngine } from '../../src/kernel/tambo_engine.js';
import { registerTamboRoutes } from '../../src/routes/tambo_routes.js';

// =============================================================================
// Types
// =============================================================================

interface HttpTransportOptions {
  port: number;
  host: string;
  corsOrigins: string[];
}

// UI v0 Request/Response Types
interface CreateSessionBody {
  name?: string;
  profile_id?: string;
  directory?: string;
  metadata?: Record<string, unknown>;
}

interface PromptBody {
  text: string;
  attachments?: unknown[];
}

interface PTYConfig {
  session_id?: string;
  directory?: string;
  cwd?: string;
}

// =============================================================================
// HTTP Transport with UI v0 Binding (PURE TRANSLATION)
// =============================================================================

export class HttpTransport {
  private core: GatewayCore;
  private kernel: KernelAdapter;
  private tambo: TamboEngine;
  private fastify: ReturnType<typeof Fastify>;
  private options: HttpTransportOptions;
  private sseSubscribers: Map<string, { reply: any; heartbeat: ReturnType<typeof setInterval> }> = new Map();

  constructor(config: GatewayConfig, options: HttpTransportOptions) {
    this.core = new GatewayCore(config);
    this.kernel = createKernelAdapter(
      {
        services: config.services,
        timeouts: config.timeouts,
      },
      this.core.eventBus
    );
    this.tambo = new TamboEngine();
    this.options = options;

    this.fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
      },
      requestTimeout: config.timeouts.request,
      bodyLimit: 10 * 1024 * 1024,
    });
  }

  /**
   * Start the HTTP transport
   */
  async start(): Promise<void> {
    console.log('[HttpTransport] Starting...');

    // Initialize core, kernel, and tambo engine
    await this.core.initialize();
    await this.kernel.initialize();
    await this.tambo.initialize();

    // Register plugins
    await this.fastify.register(cors, {
      origin: this.options.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['*'],
      exposedHeaders: ['X-Request-ID', 'X-Gateway-Version'],
    });

    await this.fastify.register(websocket);

    // Register routes
    this.registerUIv0Routes();
    this.registerCoreRoutes();
    this.registerPtyRoutes();
    
    // Register Tambo routes (determinism modes) with /v1/tambo prefix
    this.fastify.register(
      async (fastify) => registerTamboRoutes(fastify, this.tambo),
      { prefix: '/v1/tambo' }
    );

    // Add request ID header
    this.fastify.addHook('onRequest', async (request, reply) => {
      const requestId = request.headers['x-request-id'] || uuidv4();
      reply.header('X-Request-ID', requestId);
      reply.header('X-Gateway-Version', '1.0.0');
    });

    // Start server
    await this.fastify.listen({
      port: this.options.port,
      host: this.options.host,
    });

    console.log(`[HttpTransport] Listening on ${this.options.host}:${this.options.port}`);
  }

  /**
   * Stop the HTTP transport
   */
  async stop(): Promise<void> {
    console.log('[HttpTransport] Stopping...');

    // Close all SSE connections
    for (const [sessionId, subscriber] of this.sseSubscribers.entries()) {
      clearInterval(subscriber.heartbeat);
      try {
        const exitEnvelope = {
          directory: '*',
          payload: {
            type: 'server.exited',
            properties: { reason: 'gateway_shutdown' },
          },
        };
        subscriber.reply.raw.write(`data: ${JSON.stringify(exitEnvelope)}\n\n`);
        subscriber.reply.raw.end();
      } catch {
        // Ignore errors
      }
    }
    this.sseSubscribers.clear();

    // Cleanup kernel (PTY instances, etc.)
    this.kernel.cleanup();

    // Shutdown core
    await this.core.shutdown();

    // Close fastify
    await this.fastify.close();

    console.log('[HttpTransport] Stopped');
  }

  // =============================================================================
  // UI v0 Binding Layer Routes (PURE TRANSLATION ONLY)
  // =============================================================================

  private registerUIv0Routes(): void {
    // GET /global/health - Boot-critical health check
    this.fastify.get('/global/health', async (request, reply) => {
      const status = this.core.getStatus();
      return {
        status: status.status === 'healthy' ? 'ok' : 'error',
        version: status.version,
        timestamp: status.timestamp,
        services: status.backends,
      };
    });

    // GET /global/event - SSE event stream (boot-critical)
    // WIRE FORMAT: data: {"directory":"<dir>","payload":{"type":"<eventType>","properties":{...}}}
    this.fastify.get('/global/event', { websocket: false }, async (request, reply) => {
      const directory = (request.query as { directory?: string }).directory || '*';
      const sessionId = uuidv4();

      // Set SSE headers
      reply.header('Content-Type', 'text/event-stream');
      reply.header('Cache-Control', 'no-cache');
      reply.header('Connection', 'keep-alive');
      reply.header('X-Accel-Buffering', 'no');

      // Send SERVER_CONNECTED using contract envelope builder
      reply.raw.write(`data: ${buildSSEEnvelope(directory, 'server.connected', {
        directory,
        timestamp: new Date().toISOString(),
      })}\n\n`);

      // Subscribe to canonical event bus with directory scoping
      const unsubscribe = this.core.eventBus.subscribeDirectory(directory, (event: GatewayEvent) => {
        try {
          // Translate canonical event → UI v0 envelope using contract mapper
          const eventDir = (event.data as any).directory || directory;
          const eventType = this._mapEventTypeToUIv0(event.type);
          reply.raw.write(`data: ${buildSSEEnvelope(eventDir, eventType, event.data)}\n\n`);
        } catch {
          // Client disconnected
          unsubscribe();
          this.sseSubscribers.delete(sessionId);
        }
      });

      // Set up heartbeat (every 10 seconds) using contract envelope builder
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`data: ${buildSSEEnvelope(directory, 'server.heartbeat', {
            directory,
            timestamp: new Date().toISOString(),
          })}\n\n`);
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
          this.sseSubscribers.delete(sessionId);
        }
      }, 10000);

      this.sseSubscribers.set(sessionId, { reply, heartbeat });

      // Clean up on close
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        this.sseSubscribers.delete(sessionId);
      });
    });

    // GET /path - Project path info
    this.fastify.get('/path', async (request, reply) => {
      const directory = (request.query as { directory?: string }).directory || process.cwd();
      return {
        path: directory,
        exists: true,
        is_directory: true,
      };
    });

    // GET /project - Project metadata
    this.fastify.get('/project', async (request, reply) => {
      const directory = (request.query as { directory?: string }).directory || process.cwd();
      return {
        directory,
        name: directory.split('/').pop() || 'project',
        initialized: true,
      };
    });

    // GET /provider - Provider configuration
    this.fastify.get('/provider', async (request, reply) => {
      return {
        providers: [
          { id: 'openai', name: 'OpenAI', enabled: true },
          { id: 'anthropic', name: 'Anthropic', enabled: true },
        ],
        default_provider: 'openai',
      };
    });

    // GET /permission - List permissions
    this.fastify.get('/permission', async (request, reply) => {
      return {
        permissions: [],
        pending: [],
      };
    });

    // POST /permission/:id/resolve - Resolve permission
    this.fastify.post('/permission/:id/resolve', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { granted } = request.body as { granted: boolean };
      const directory = (request.query as { directory?: string }).directory || '*';

      // Kernel resolves permission and emits event
      await this.kernel.resolvePermission(id, granted, directory);

      return { permission_id: id, granted };
    });

    // GET /question - List questions
    this.fastify.get('/question', async (request, reply) => {
      return {
        questions: [],
        pending: [],
      };
    });

    // POST /question/:id/resolve - Resolve question
    this.fastify.post('/question/:id/resolve', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { answer } = request.body as { answer: unknown };
      const directory = (request.query as { directory?: string }).directory || '*';

      // Kernel resolves question and emits event
      await this.kernel.resolveQuestion(id, answer, directory);

      return { question_id: id, answered: true };
    });

    // POST /question/:id/reject - Reject question
    this.fastify.post('/question/:id/reject', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };
      const directory = (request.query as { directory?: string }).directory || '*';

      // Kernel rejects question and emits event
      await this.kernel.rejectQuestion(id, reason, directory);

      return { question_id: id, rejected: true };
    });

    // GET /session/status - Session status endpoint
    this.fastify.get('/session/status', async (request, reply) => {
      const directory = (request.query as { directory?: string }).directory || '*';
      const sessions = await this.core.listSessions(directory);
      
      return {
        active_sessions: sessions.filter(s => s.status === 'active').length,
        running_sessions: sessions.filter(s => s.status === 'running').length,
        total_sessions: sessions.length,
      };
    });

    // POST /session - Create session
    this.fastify.post('/session', async (request, reply) => {
      const { name, profile_id, directory, metadata } = request.body as CreateSessionBody;
      
      const session = await this.core.createSession(
        profile_id || 'default',
        [],
        undefined,
        directory
      );

      // Map to UI v0 response schema
      return {
        id: session.id,
        name: name || session.id,
        directory: session.directory,
        created_at: session.created_at,
        status: session.status,
        metadata: session.metadata,
      };
    });

    // GET /session/:id - Get session
    this.fastify.get('/session/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const directory = (request.query as { directory?: string }).directory;
      
      const session = await this.core.getSession(id, directory);
      
      if (!session) {
        reply.status(404);
        return { error: 'Session not found' };
      }

      return {
        id: session.id,
        name: session.id,
        directory: session.directory,
        created_at: session.created_at,
        updated_at: session.updated_at,
        status: session.status,
        metadata: session.metadata,
      };
    });

    // GET /session/:id/message - Get messages for session
    this.fastify.get('/session/:id/message', async (request, reply) => {
      const { id } = request.params as { id: string };
      const directory = (request.query as { directory?: string }).directory;
      
      // Verify session exists
      const session = await this.core.getSession(id, directory);
      if (!session) {
        reply.status(404);
        return { error: 'Session not found' };
      }

      // In full implementation, would fetch messages from kernel
      return {
        messages: [],
        total: 0,
      };
    });

    // POST /session/:id/prompt_async - Async prompt with streaming
    // CRITICAL: This route does NOT emit events. Kernel adapter does.
    this.fastify.post('/session/:id/prompt_async', async (request, reply) => {
      const { id: session_id } = request.params as { id: string };
      const { text, attachments } = request.body as PromptBody;
      const directory = (request.query as { directory?: string }).directory;

      // Validate session
      const session = await this.core.getSession(session_id, directory);
      if (!session) {
        reply.status(404);
        return { error: 'Session not found' };
      }

      // Validate input
      if (!text || typeof text !== 'string') {
        reply.status(400);
        return { error: 'text is required' };
      }

      // Update session status to running (kernel emits status_changed)
      await this.core.updateSession(session_id, { status: 'running' }, directory);
      this.kernel.updateSessionStatus(session_id, 'active', 'running', directory);

      // Invoke kernel adapter - KERNEL EMITS ALL EVENTS
      // Route returns 204 immediately, events stream via SSE
      const result = await this.kernel.executePrompt({
        session_id,
        directory,
        text,
        attachments,
      });

      // Update session status back to idle (kernel emits status_changed)
      await this.core.updateSession(session_id, { status: 'idle' }, directory);
      this.kernel.updateSessionStatus(session_id, 'running', 'idle', directory);

      // Return 204 immediately as per spec
      reply.status(204);
      return;
    });

    // POST /session/:id/abort - Abort session execution
    this.fastify.post('/session/:id/abort', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { reason } = request.body as { reason?: string };
      const directory = (request.query as { directory?: string }).directory;

      const session = await this.core.getSession(id, directory);
      if (!session) {
        reply.status(404);
        return { error: 'Session not found' };
      }

      // Update session status (kernel emits status_changed)
      await this.core.updateSession(id, { status: 'idle' }, directory);
      this.kernel.updateSessionStatus(id, session.status, 'idle', directory);

      return { success: true, message: 'Session aborted' };
    });

    // DELETE /session/:id - Delete session
    this.fastify.delete('/session/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const directory = (request.query as { directory?: string }).directory;
      
      const deleted = await this.core.deleteSession(id, directory);
      
      if (!deleted) {
        reply.status(404);
        return { error: 'Session not found' };
      }

      return { deleted: true };
    });
  }

  // =============================================================================
  // Core v1 Routes (preserved)
  // =============================================================================

  private registerCoreRoutes(): void {
    // Health check
    this.fastify.get('/health', async (request, reply) => {
      return this.core.getStatus();
    });

    // Service discovery
    this.fastify.get('/v1/discovery', async (request, reply) => {
      return this.core.getDiscovery();
    });

    // Create session (v1)
    this.fastify.post('/v1/sessions', async (request, reply) => {
      const { profile_id, capsules, timeout } = request.body as any;

      if (!profile_id) {
        reply.status(400);
        return {
          error: {
            code: 'INVALID_REQUEST',
            message: 'profile_id is required',
          },
        };
      }

      const session = await this.core.createSession(profile_id, capsules, timeout);
      return {
        id: session.id,
        profile_id: session.profile_id,
        status: session.status,
        created_at: session.created_at,
        expires_at: session.expires_at,
        capsules: session.capsules,
      };
    });

    // List sessions (v1)
    this.fastify.get('/v1/sessions', async (request, reply) => {
      const { status } = request.query as { status?: string };
      const sessions = await this.core.listSessions();
      return { sessions };
    });

    // Get session (v1)
    this.fastify.get('/v1/sessions/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = await this.core.getSession(id);
      
      if (!session) {
        reply.status(404);
        return {
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
        };
      }
      
      return session;
    });

    // Update session (v1)
    this.fastify.patch('/v1/sessions/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = request.body as any;
      
      const session = await this.core.updateSession(id, data);
      
      if (!session) {
        reply.status(404);
        return {
          error: {
            code: 'NOT_FOUND',
            message: 'Session not found',
          },
        };
      }
      
      return session;
    });

    // Delete session (v1)
    this.fastify.delete('/v1/sessions/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const deleted = await this.core.deleteSession(id);
      return { deleted };
    });

    // Chat completions (v1)
    this.fastify.post('/v1/chat/completions', async (request, reply) => {
      const { messages, stream = true, model = 'default' } = request.body as any;

      if (!messages || !Array.isArray(messages)) {
        reply.status(400);
        return {
          error: {
            code: 'INVALID_REQUEST',
            message: 'Messages array is required',
          },
        };
      }

      try {
        const response = await this.core.routingEngine.proxyRequest({
          method: 'POST',
          path: 'v1/chat/completions',
          body: { messages, stream, model },
        });

        if (stream) {
          reply.header('Content-Type', 'text/event-stream');
          reply.header('Cache-Control', 'no-cache');
          reply.header('Connection', 'keep-alive');
          reply.header('X-Accel-Buffering', 'no');
          reply.status(response.status);
          reply.send(response.body);
        } else {
          reply.status(response.status);
          reply.send(JSON.parse(response.body));
        }
      } catch (err) {
        reply.status(503);
        return {
          error: {
            code: 'BACKEND_UNAVAILABLE',
            message: `Chat completion failed: ${(err as Error).message}`,
          },
        };
      }
    });
  }

  // =============================================================================
  // PTY Routes (PTY state managed by kernel adapter)
  // =============================================================================

  private registerPtyRoutes(): void {
    // POST /pty - Create PTY (kernel creates, not binding)
    this.fastify.post('/pty', async (request, reply) => {
      const { session_id, directory, cwd } = request.body as PTYConfig;
      
      const pty = this.kernel.createPTY({ session_id, directory, cwd });

      return {
        id: pty.id,
        pid: pty.pid,
        created_at: pty.created_at,
      };
    });

    // PUT /pty/:id - Send input to PTY (kernel manages state)
    this.fastify.put('/pty/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const { input } = request.body as { input: string };
      const directory = (request.query as { directory?: string }).directory;
      
      const success = this.kernel.sendPTYInput(id, input, directory);
      
      if (!success) {
        reply.status(404);
        return { error: 'PTY not found' };
      }

      return { success: true };
    });

    // DELETE /pty/:id - Kill PTY (kernel emits PTY_EXITED)
    this.fastify.delete('/pty/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const directory = (request.query as { directory?: string }).directory;
      
      const killed = this.kernel.killPTY(id, directory);
      
      if (!killed) {
        reply.status(404);
        return { error: 'PTY not found' };
      }

      return { exited: true, exit_code: 0 };
    });

    // GET /pty/:id/connect - WebSocket connection for PTY
    this.fastify.get('/pty/:id/connect', { websocket: true }, async (connection, request) => {
      const { id } = request.params as { id: string };
      const directory = (request.query as { directory?: string }).directory;
      
      const pty = this.kernel.getPTY(id, directory);
      if (!pty) {
        connection.socket.close(4004, 'PTY not found');
        return;
      }

      // Replay backlog on connect
      for (const output of pty.backlog) {
        connection.socket.send(output);
      }

      // Send cursor position as binary frame (0x00 + JSON)
      const cursorData = Buffer.concat([
        Buffer.from([0x00]),
        Buffer.from(JSON.stringify({ cursor: pty.backlog.length })),
      ]);
      connection.socket.send(cursorData);

      // Handle incoming data
      connection.socket.on('message', (message) => {
        const input = message.toString();
        this.kernel.sendPTYInput(id, input, directory);
      });

      connection.socket.on('close', () => {
        // Socket closed, but PTY continues
      });
    });
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  /**
   * Map canonical event types to UI v0 event type names
   */
  private _mapEventTypeToUIv0(eventType: EventType): string {
    const mapping: Record<EventType, string> = {
      'server.connected': 'SERVER_CONNECTED',
      'server.heartbeat': 'SERVER_HEARTBEAT',
      'session.created': 'SESSION_CREATED',
      'session.updated': 'SESSION_UPDATED',
      'session.deleted': 'SESSION_DELETED',
      'session.status_changed': 'SESSION_STATUS_CHANGED',
      'message.created': 'MESSAGE_CREATED',
      'message.updated': 'MESSAGE_UPDATED',
      'message.removed': 'MESSAGE_REMOVED',
      'part.created': 'PART_CREATED',
      'part.updated': 'PART_UPDATED',
      'part.delta': 'PART_DELTA',
      'part.removed': 'PART_REMOVED',
      'tool.state_changed': 'TOOL_STATE_CHANGED',
      'permission.requested': 'PERMISSION_REQUESTED',
      'permission.resolved': 'PERMISSION_RESOLVED',
      'question.requested': 'QUESTION_REQUESTED',
      'question.resolved': 'QUESTION_RESOLVED',
      'question.rejected': 'QUESTION_REJECTED',
      'todo.updated': 'TODO_UPDATED',
      'lsp.updated': 'LSP_UPDATED',
      'vcs.updated': 'VCS_UPDATED',
      'file_watch.updated': 'FILE_WATCH_UPDATED',
      'pty.output': 'PTY_OUTPUT',
      'pty.exited': 'PTY_EXITED',
      'worktree.ready': 'WORKTREE_READY',
      'worktree.failed': 'WORKTREE_FAILED',
      'health.check': 'HEALTH_CHECK',
      'error': 'ERROR',
    };
    return mapping[eventType] || eventType;
  }
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_HTTP_OPTIONS: HttpTransportOptions = {
  port: parseInt(process.env.A2R_HTTP_PORT || '3210', 10),
  host: process.env.A2R_HTTP_HOST || '0.0.0.0',
  corsOrigins: (process.env.A2R_CORS_ORIGINS || 'http://localhost:*,http://127.0.0.1:*').split(','),
};

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  const transport = new HttpTransport(DEFAULT_CONFIG, DEFAULT_HTTP_OPTIONS);

  // Handle shutdown signals
  process.on('SIGINT', async () => {
    console.log('[HttpTransport] Received SIGINT');
    await transport.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[HttpTransport] Received SIGTERM');
    await transport.stop();
    process.exit(0);
  });

  // Start transport
  await transport.start();
}

// Run if executed directly
if (process.argv[1]?.endsWith('http.ts') || process.argv[1]?.endsWith('http.js')) {
  main().catch((err) => {
    console.error('[HttpTransport] Fatal error:', err);
    process.exit(1);
  });
}

export { DEFAULT_CONFIG, DEFAULT_HTTP_OPTIONS };
