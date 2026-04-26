/**
 * Allternit Gateway - stdio Transport
 * 
 * JSON-RPC 2.0 over stdin/stdout for local subprocess-launched usage.
 * MCP-compatible transport.
 * 
 * Protocol:
 * - Requests: JSON-RPC 2.0 via stdin (newline-delimited)
 * - Responses: JSON-RPC 2.0 via stdout (newline-delimited)
 * - Notifications: Server-pushed events via stdout (no id field)
 * 
 * @module @allternit/gateway-stdio
 */

import { createInterface } from 'readline';
import {
  GatewayCore,
  GatewayConfig,
  DEFAULT_CONFIG,
  GatewayEvent,
  EventType,
} from '../../runtime/index.js';

// =============================================================================
// JSON-RPC Types
// =============================================================================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id?: string | number;
}

interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// =============================================================================
// Error Codes
// =============================================================================

const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  BACKEND_UNAVAILABLE: -32000,
  RATE_LIMITED: -32001,
  UNAUTHORIZED: -32002,
  FORBIDDEN: -32003,
  TIMEOUT: -32004,
} as const;

// =============================================================================
// stdio Transport
// =============================================================================

export class StdioTransport {
  private core: GatewayCore;
  private rl: ReturnType<typeof createInterface> | null = null;
  private running = false;
  private eventUnsubscribe: (() => void) | null = null;

  constructor(config: GatewayConfig) {
    this.core = new GatewayCore(config);
  }

  /**
   * Start the stdio transport
   */
  async start(): Promise<void> {
    console.error('[StdioTransport] Starting...');

    // Initialize core
    await this.core.initialize();

    // Subscribe to gateway events
    this.eventUnsubscribe = this.core.eventBus.subscribeAll((event) => {
      this.sendNotification(this.eventToMethod(event.type), event.data);
    });

    // Set up stdin reader
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.running = true;

    // Process stdin lines
    this.rl.on('line', (line) => {
      this.handleLine(line).catch((err) => {
        console.error('[StdioTransport] Error handling line:', err);
      });
    });

    this.rl.on('close', () => {
      console.error('[StdioTransport] stdin closed, shutting down...');
      this.stop();
    });

    console.error('[StdioTransport] Ready');
  }

  /**
   * Stop the stdio transport
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.running = false;

    // Unsubscribe from events
    if (this.eventUnsubscribe) {
      this.eventUnsubscribe();
      this.eventUnsubscribe = null;
    }

    // Close readline
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    // Shutdown core
    await this.core.shutdown();

    console.error('[StdioTransport] Stopped');
  }

  /**
   * Map event types to notification methods
   */
  private eventToMethod(eventType: EventType): string {
    const mapping: Record<EventType, string> = {
      'session.created': 'session/created',
      'session.resumed': 'session/resumed',
      'session.paused': 'session/paused',
      'session.completed': 'session/completed',
      'session.error': 'session/error',
      'chat.started': 'chat/started',
      'chat.delta': 'chat/delta',
      'chat.completed': 'chat/completed',
      'tool.call.started': 'tool/call_started',
      'tool.call.completed': 'tool/call_completed',
      'tool.call.error': 'tool/call_error',
      'artifact.created': 'artifact/created',
      'health.check': 'health/check',
      'error': 'error',
    };
    return mapping[eventType] || eventType;
  }

  /**
   * Handle a line from stdin
   */
  private async handleLine(line: string): Promise<void> {
    if (!line.trim()) return;

    let request: JsonRpcRequest;

    try {
      request = JSON.parse(line);
    } catch (err) {
      this.sendError(null, ERROR_CODES.PARSE_ERROR, 'Parse error');
      return;
    }

    // Validate JSON-RPC structure
    if (request.jsonrpc !== '2.0') {
      this.sendError(request.id, ERROR_CODES.INVALID_REQUEST, 'Invalid JSON-RPC version');
      return;
    }

    if (!request.method || typeof request.method !== 'string') {
      this.sendError(request.id, ERROR_CODES.INVALID_REQUEST, 'Method is required');
      return;
    }

    // Route to handler
    try {
      await this.handleRequest(request);
    } catch (err) {
      this.sendError(
        request.id,
        ERROR_CODES.INTERNAL_ERROR,
        (err as Error).message
      );
    }
  }

  /**
   * Handle a JSON-RPC request
   */
  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    const { method, params = {}, id } = request;

    // Health check
    if (method === 'health/check') {
      const result = this.core.getStatus();
      this.sendResponse(id, result);
      return;
    }

    // Discovery
    if (method === 'discovery/get') {
      const result = this.core.getDiscovery();
      this.sendResponse(id, result);
      return;
    }

    // Session create
    if (method === 'session/create') {
      const { profile_id, capsules = [], timeout } = params;
      
      if (!profile_id || typeof profile_id !== 'string') {
        this.sendError(id, ERROR_CODES.INVALID_PARAMS, 'profile_id is required');
        return;
      }
      
      const session = await this.core.createSession(profile_id, capsules, timeout);
      this.sendResponse(id, {
        id: session.id,
        profile_id: session.profile_id,
        status: session.status,
        created_at: session.created_at,
        expires_at: session.expires_at,
        capsules: session.capsules,
      });
      return;
    }

    // Session get
    if (method === 'session/get') {
      const { session_id } = params;
      
      if (!session_id || typeof session_id !== 'string') {
        this.sendError(id, ERROR_CODES.INVALID_PARAMS, 'session_id is required');
        return;
      }
      
      const session = await this.core.getSession(session_id as string);
      if (!session) {
        this.sendError(id, ERROR_CODES.INVALID_PARAMS, 'Session not found');
        return;
      }
      this.sendResponse(id, session);
      return;
    }

    // Session list
    if (method === 'session/list') {
      const { status } = params;
      const sessions = await this.core.listSessions(status as string);
      this.sendResponse(id, { sessions });
      return;
    }

    // Session update
    if (method === 'session/update') {
      const { session_id, ...data } = params;
      
      if (!session_id || typeof session_id !== 'string') {
        this.sendError(id, ERROR_CODES.INVALID_PARAMS, 'session_id is required');
        return;
      }
      
      const session = await this.core.updateSession(session_id as string, data);
      if (!session) {
        this.sendError(id, ERROR_CODES.INVALID_PARAMS, 'Session not found');
        return;
      }
      this.sendResponse(id, session);
      return;
    }

    // Session delete
    if (method === 'session/delete') {
      const { session_id } = params;
      
      if (!session_id || typeof session_id !== 'string') {
        this.sendError(id, ERROR_CODES.INVALID_PARAMS, 'session_id is required');
        return;
      }
      
      const deleted = await this.core.deleteSession(session_id as string);
      this.sendResponse(id, { deleted });
      return;
    }

    // Method not found
    this.sendError(id, ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
  }

  /**
   * Send a JSON-RPC response
   */
  private sendResponse(id: string | number | undefined, result: unknown): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      result,
      id,
    };
    this.send(response);
  }

  /**
   * Send a JSON-RPC error
   */
  private sendError(
    id: string | number | undefined,
    code: number,
    message: string,
    data?: unknown
  ): void {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      error: { code, message, data },
      id,
    };
    this.send(response);
  }

  /**
   * Send a JSON-RPC notification
   */
  private sendNotification(method: string, params?: unknown): void {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.send(notification);
  }

  /**
   * Send a JSON-RPC message to stdout
   */
  private send(message: JsonRpcResponse | JsonRpcNotification): void {
    const line = JSON.stringify(message);
    process.stdout.write(line + '\n');
  }
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  const transport = new StdioTransport(DEFAULT_CONFIG);

  // Handle shutdown signals
  process.on('SIGINT', async () => {
    console.error('[StdioTransport] Received SIGINT');
    await transport.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('[StdioTransport] Received SIGTERM');
    await transport.stop();
    process.exit(0);
  });

  // Start transport
  await transport.start();
}

// Run if executed directly
if (process.argv[1]?.endsWith('stdio.ts') || process.argv[1]?.endsWith('stdio.js')) {
  main().catch((err) => {
    console.error('[StdioTransport] Fatal error:', err);
    process.exit(1);
  });
}

export { DEFAULT_CONFIG };
