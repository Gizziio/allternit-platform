#!/usr/bin/env node
/**
 * A2R Cloud Backend Server
 * 
 * WebSocket server that handles:
 * - Browser extension connections (BROWSER.* tool execution)
 * - Thin Client connections (chat interface)
 * - Agent session management
 * - Real-time bidirectional communication
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';
import { v4 as uuidv4 } from 'uuid';

// Configuration
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Client types
type ClientType = 'browser-extension' | 'thin-client' | 'agent';

interface Client {
  id: string;
  ws: WebSocket;
  type: ClientType;
  sessionId: string;
  userId?: string;
  authenticated: boolean;
  connectedAt: Date;
  lastPing: Date;
}

interface Message {
  id: string;
  type: string;
  payload?: unknown;
  timestamp: number;
}

// In-memory storage (replace with Redis in production)
const clients = new Map<string, Client>();
const sessions = new Map<string, Set<string>>(); // sessionId -> clientIds

/**
 * Cloud Backend Server
 */
class CloudBackend {
  private wss: WebSocketServer;
  private httpServer: ReturnType<typeof createServer>;

  constructor() {
    this.httpServer = createServer((req, res) => {
      // CORS headers for browser connections
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Type, X-Client-Version',
      };

      // Handle preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }

      // Apply CORS to all responses
      Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });

      // Health check endpoint
      if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          service: 'A2R Cloud Backend',
          connections: clients.size,
          sessions: sessions.size,
          uptime: process.uptime(),
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }));
        return;
      }

      // Default response
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      path: '/ws/extension',
    });

    this.setupWebSocketHandlers();
  }

  /**
   * Start the server
   */
  start(): void {
    this.httpServer.listen(PORT, HOST, () => {
      console.log(`[Cloud] A2R Cloud Backend running on ${HOST}:${PORT}`);
      console.log(`[Cloud] WebSocket endpoint: ws://${HOST}:${PORT}/ws/extension`);
    });

    // Cleanup interval
    setInterval(() => this.cleanupStaleConnections(), 30000);
  }

  /**
   * Stop the server
   */
  stop(): void {
    console.log('[Cloud] Shutting down...');
    
    // Close all client connections
    clients.forEach((client) => {
      client.ws.close(1000, 'Server shutting down');
    });
    clients.clear();
    sessions.clear();

    this.wss.close();
    this.httpServer.close();
  }

  // ============================================================================
  // WebSocket Handlers
  // ============================================================================

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws, req) => {
      const clientId = uuidv4();
      const sessionId = uuidv4();
      
      console.log(`[Cloud] New connection: ${clientId} from ${req.socket.remoteAddress}`);

      // Create client record
      const client: Client = {
        id: clientId,
        ws,
        type: 'browser-extension', // Will be updated after auth
        sessionId,
        authenticated: false,
        connectedAt: new Date(),
        lastPing: new Date(),
      };

      clients.set(clientId, client);

      // Add to session
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, new Set());
      }
      sessions.get(sessionId)!.add(clientId);

      // Send welcome
      this.sendToClient(client, {
        id: uuidv4(),
        type: 'connected',
        payload: {
          clientId,
          sessionId,
          message: 'Welcome to A2R Cloud Backend',
        },
        timestamp: Date.now(),
      });

      // Setup message handler
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as Message;
          this.handleMessage(client, message);
        } catch (error) {
          console.error(`[Cloud] Invalid message from ${clientId}:`, error);
          this.sendToClient(client, {
            id: uuidv4(),
            type: 'error',
            payload: { message: 'Invalid message format' },
            timestamp: Date.now(),
          });
        }
      });

      // Setup close handler
      ws.on('close', (code, reason) => {
        console.log(`[Cloud] Client ${clientId} disconnected: ${code} ${reason}`);
        this.removeClient(clientId);
      });

      // Setup error handler
      ws.on('error', (error) => {
        console.error(`[Cloud] WebSocket error for ${clientId}:`, error);
        this.removeClient(clientId);
      });

      // Setup ping/pong for keepalive
      ws.on('pong', () => {
        client.lastPing = new Date();
      });
    });
  }

  private handleMessage(client: Client, message: Message): void {
    console.log(`[Cloud] ${client.id} -> ${message.type}`);

    // Always update lastPing for any message
    client.lastPing = new Date();

    switch (message.type) {
      case 'auth':
        this.handleAuth(client, message);
        break;

      case 'ping':
        this.sendToClient(client, {
          id: uuidv4(),
          type: 'pong',
          timestamp: Date.now(),
        });
        break;

      case 'action:complete':
        // Forward action completion to all clients in session
        this.broadcastToSession(client.sessionId, message, client.id);
        break;

      case 'tab:activated':
      case 'tab:updated':
        // Forward tab events to all clients in session
        this.broadcastToSession(client.sessionId, message, client.id);
        break;

      case 'execute':
        // Execute browser action request
        this.handleExecuteRequest(client, message);
        break;

      case 'getTabs':
        // Request tabs from browser extension
        this.handleGetTabsRequest(client, message);
        break;

      case 'chat':
        // Chat message from thin client
        this.handleChatMessage(client, message);
        break;

      default:
        console.log(`[Cloud] Unknown message type: ${message.type}`);
        this.sendToClient(client, {
          id: uuidv4(),
          type: 'error',
          payload: { message: `Unknown message type: ${message.type}` },
          timestamp: Date.now(),
        });
    }
  }

  // ============================================================================
  // Message Handlers
  // ============================================================================

  private handleAuth(client: Client, message: Message): void {
    const payload = message.payload as { token?: string; clientType?: ClientType; version?: string };
    
    console.log(`[Cloud] Auth request from ${client.id}:`, payload.clientType);

    // TODO: Validate token against auth service
    // For now, accept any token
    const isValid = payload.token && payload.token.length > 0;

    if (isValid) {
      client.authenticated = true;
      client.type = payload.clientType || 'browser-extension';
      
      // Extract userId from token (in real implementation, decode JWT)
      client.userId = `user_${payload.token?.slice(0, 8)}`;

      this.sendToClient(client, {
        id: uuidv4(),
        type: 'auth:response',
        payload: {
          success: true,
          sessionId: client.sessionId,
          clientId: client.id,
        },
        timestamp: Date.now(),
      });

      console.log(`[Cloud] Client ${client.id} authenticated as ${client.type}`);
    } else {
      this.sendToClient(client, {
        id: uuidv4(),
        type: 'auth:response',
        payload: {
          success: false,
          error: 'Invalid authentication token',
        },
        timestamp: Date.now(),
      });

      // Close connection after a delay
      setTimeout(() => {
        client.ws.close(1008, 'Authentication failed');
      }, 1000);
    }
  }

  private handleExecuteRequest(client: Client, message: Message): void {
    if (!client.authenticated) {
      this.sendToClient(client, {
        id: message.id,
        type: 'execute:error',
        payload: { message: 'Not authenticated' },
        timestamp: Date.now(),
      });
      return;
    }

    // Find browser extension in same session
    const sessionClients = this.getSessionClients(client.sessionId);
    const browserExtension = sessionClients.find(c => c.type === 'browser-extension' && c.id !== client.id);

    if (browserExtension) {
      // Forward to browser extension
      this.sendToClient(browserExtension, {
        ...message,
        payload: {
          ...message.payload as object,
          requesterId: client.id,
        },
      });
    } else {
      // No browser extension connected
      this.sendToClient(client, {
        id: message.id,
        type: 'execute:error',
        payload: { message: 'No browser extension connected in this session' },
        timestamp: Date.now(),
      });
    }
  }

  private handleGetTabsRequest(client: Client, message: Message): void {
    const sessionClients = this.getSessionClients(client.sessionId);
    const browserExtension = sessionClients.find(c => c.type === 'browser-extension');

    if (browserExtension) {
      this.sendToClient(browserExtension, {
        ...message,
        payload: {
          requesterId: client.id,
        },
      });
    } else {
      this.sendToClient(client, {
        id: message.id,
        type: 'tabs',
        payload: [],
        timestamp: Date.now(),
      });
    }
  }

  private handleChatMessage(client: Client, message: Message): void {
    // Echo back for now (in real implementation, forward to AI service)
    this.sendToClient(client, {
      id: uuidv4(),
      type: 'chat:response',
      payload: {
        message: 'Received: ' + (message.payload as { message?: string })?.message,
        sender: 'agent',
      },
      timestamp: Date.now(),
    });
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private sendToClient(client: Client, message: Message): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  private broadcastToSession(sessionId: string, message: Message, excludeClientId?: string): void {
    const sessionClientIds = sessions.get(sessionId);
    if (!sessionClientIds) return;

    sessionClientIds.forEach((clientId) => {
      if (excludeClientId && clientId === excludeClientId) return;
      
      const client = clients.get(clientId);
      if (client) {
        this.sendToClient(client, message);
      }
    });
  }

  private getSessionClients(sessionId: string): Client[] {
    const sessionClientIds = sessions.get(sessionId);
    if (!sessionClientIds) return [];

    return Array.from(sessionClientIds)
      .map((id) => clients.get(id))
      .filter((c): c is Client => c !== undefined);
  }

  private removeClient(clientId: string): void {
    const client = clients.get(clientId);
    if (client) {
      // Remove from session
      const sessionClientIds = sessions.get(client.sessionId);
      if (sessionClientIds) {
        sessionClientIds.delete(clientId);
        if (sessionClientIds.size === 0) {
          sessions.delete(client.sessionId);
        }
      }

      // Remove from clients
      clients.delete(clientId);
    }
  }

  private cleanupStaleConnections(): void {
    const now = new Date();
    const staleTimeout = 60000; // 60 seconds

    clients.forEach((client, clientId) => {
      const timeSinceLastPing = now.getTime() - client.lastPing.getTime();
      
      if (timeSinceLastPing > staleTimeout) {
        console.log(`[Cloud] Removing stale client: ${clientId}`);
        client.ws.close(1001, 'Connection timeout');
        this.removeClient(clientId);
      } else {
        // Send ping
        client.ws.ping();
      }
    });

    console.log(`[Cloud] Stats: ${clients.size} clients, ${sessions.size} sessions`);
  }
}

// ============================================================================
// Startup
// ============================================================================

const server = new CloudBackend();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Cloud] SIGINT received');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Cloud] SIGTERM received');
  server.stop();
  process.exit(0);
});

// Start the server
server.start();
