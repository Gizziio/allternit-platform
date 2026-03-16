/**
 * WebSocket Real-time Updates
 * 
 * Provides real-time verification progress and notifications.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { IncomingMessage } from "http";
import { Log } from "@/shared/util/log";
import type { VerificationProgress, OrchestratedVerificationResult } from "../types";

// Type declarations for WebSocket types
interface WebSocketClient {
  readyState: number;
  on(event: "message" | "close" | "error", callback: (data: any) => void): void;
  send(data: string): void;
  close(): void;
}

interface WebSocketServerInstance {
  on(event: "connection", callback: (ws: WebSocketClient, req: IncomingMessage) => void): void;
  close(): void;
}

type WebSocketServerClass = new (options: { port: number }) => WebSocketServerInstance;

// Dynamic import to avoid type issues
let WebSocketServerClass: WebSocketServerClass;
const WebSocketReadyState = { OPEN: 1 };

try {
  const ws = require("ws");
  WebSocketServerClass = ws.WebSocketServer;
} catch {
  // Fallback for when ws is not installed
  WebSocketServerClass = class MockWebSocketServer {
    constructor() {
      throw new Error("ws module not installed");
    }
    on(): void {}
    close(): void {}
  } as unknown as WebSocketServerClass;
}

const log = Log.create({ service: "verification.websocket" });

// ============================================================================
// Types
// ============================================================================

export interface WebSocketMessage {
  type: "progress" | "complete" | "error" | "alert" | "subscribed";
  data: unknown;
  timestamp: string;
  sessionId?: string;
}

export interface ProgressUpdate extends VerificationProgress {
  sessionId: string;
}

export interface VerificationComplete {
  sessionId: string;
  result: OrchestratedVerificationResult;
}

export interface VerificationAlert {
  level: "info" | "warning" | "error";
  message: string;
  sessionId?: string;
  verificationId?: string;
}

// ============================================================================
// WebSocket Manager
// ============================================================================

export class VerificationWebSocketManager {
  private wss?: WebSocketServerInstance;
  private clients: Map<string, WebSocketClient> = new Map();
  private sessionSubscriptions: Map<string, Set<string>> = new Map();
  private log = Log.create({ service: "verification.websocket" });
  
  /**
   * Initialize WebSocket server
   */
  initialize(port: number = 8080): void {
    this.wss = new WebSocketServerClass({ port });
    
    this.wss.on("connection", (ws: WebSocketClient, req: IncomingMessage) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      
      this.log.info("WebSocket client connected", { clientId });
      
      // Send welcome message
      this.send(ws, {
        type: "subscribed",
        data: { clientId, message: "Connected to verification updates" },
        timestamp: new Date().toISOString(),
      });
      
      // Handle messages
      ws.on("message", (data: Buffer | string) => {
        this.handleMessage(clientId, ws, data.toString());
      });
      
      // Handle close
      ws.on("close", () => {
        this.handleDisconnect(clientId);
      });
      
      // Handle errors
      ws.on("error", (error: Error) => {
        this.log.error("WebSocket error", { clientId, error });
      });
    });
    
    this.log.info("WebSocket server initialized", { port });
  }
  
  /**
   * Subscribe client to session updates
   */
  subscribeToSession(clientId: string, sessionId: string): void {
    if (!this.sessionSubscriptions.has(sessionId)) {
      this.sessionSubscriptions.set(sessionId, new Set());
    }
    this.sessionSubscriptions.get(sessionId)!.add(clientId);
    
    this.log.debug("Client subscribed to session", { clientId, sessionId });
  }
  
  /**
   * Unsubscribe client from session updates
   */
  unsubscribeFromSession(clientId: string, sessionId: string): void {
    const subscribers = this.sessionSubscriptions.get(sessionId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.sessionSubscriptions.delete(sessionId);
      }
    }
    
    this.log.debug("Client unsubscribed from session", { clientId, sessionId });
  }
  
  /**
   * Broadcast progress update
   */
  broadcastProgress(sessionId: string, progress: VerificationProgress): void {
    const message: WebSocketMessage = {
      type: "progress",
      data: { ...progress, sessionId },
      timestamp: new Date().toISOString(),
      sessionId,
    };
    
    this.broadcastToSession(sessionId, message);
  }
  
  /**
   * Broadcast completion
   */
  broadcastComplete(sessionId: string, result: OrchestratedVerificationResult): void {
    const message: WebSocketMessage = {
      type: "complete",
      data: { sessionId, result },
      timestamp: new Date().toISOString(),
      sessionId,
    };
    
    this.broadcastToSession(sessionId, message);
  }
  
  /**
   * Broadcast error
   */
  broadcastError(sessionId: string, error: Error): void {
    const message: WebSocketMessage = {
      type: "error",
      data: { sessionId, error: error.message },
      timestamp: new Date().toISOString(),
      sessionId,
    };
    
    this.broadcastToSession(sessionId, message);
  }
  
  /**
   * Send alert to specific client or all clients
   */
  sendAlert(alert: VerificationAlert, clientId?: string): void {
    const message: WebSocketMessage = {
      type: "alert",
      data: alert,
      timestamp: new Date().toISOString(),
      sessionId: alert.sessionId,
    };
    
    if (clientId) {
      const client = this.clients.get(clientId);
      if (client) {
        this.send(client, message);
      }
    } else {
      this.broadcast(message);
    }
  }
  
  /**
   * Close all connections and stop server
   */
  close(): void {
    this.wss?.close();
    this.clients.clear();
    this.sessionSubscriptions.clear();
    
    this.log.info("WebSocket server closed");
  }
  
  // ========================================================================
  // Private Methods
  // ========================================================================
  
  private handleMessage(clientId: string, ws: WebSocketClient, data: string): void {
    try {
      const message = JSON.parse(data);
      
      switch (message.action) {
        case "subscribe":
          if (message.sessionId) {
            this.subscribeToSession(clientId, message.sessionId);
            this.send(ws, {
              type: "subscribed",
              data: { sessionId: message.sessionId, message: "Subscribed successfully" },
              timestamp: new Date().toISOString(),
            });
          }
          break;
          
        case "unsubscribe":
          if (message.sessionId) {
            this.unsubscribeFromSession(clientId, message.sessionId);
          }
          break;
          
        case "ping":
          this.send(ws, {
            type: "subscribed",
            data: { message: "pong" },
            timestamp: new Date().toISOString(),
          });
          break;
          
        default:
          this.log.warn("Unknown WebSocket action", { action: message.action });
      }
    } catch (error) {
      this.log.error("Failed to handle WebSocket message", { error });
    }
  }
  
  private handleDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    
    // Remove from all subscriptions
    for (const [sessionId, subscribers] of this.sessionSubscriptions) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.sessionSubscriptions.delete(sessionId);
      }
    }
    
    this.log.info("WebSocket client disconnected", { clientId });
  }
  
  private broadcastToSession(sessionId: string, message: WebSocketMessage): void {
    const subscribers = this.sessionSubscriptions.get(sessionId);
    if (!subscribers) return;
    
    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (client && client.readyState === WebSocketReadyState.OPEN) {
        this.send(client, message);
      }
    }
  }
  
  private broadcast(message: WebSocketMessage): void {
    for (const [, client] of this.clients) {
      if (client.readyState === WebSocketReadyState.OPEN) {
        this.send(client, message);
      }
    }
  }
  
  private send(ws: WebSocketClient, message: WebSocketMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      this.log.error("Failed to send WebSocket message", { error });
    }
  }
  
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let wsManager: VerificationWebSocketManager | null = null;

export function getWebSocketManager(): VerificationWebSocketManager {
  if (!wsManager) {
    wsManager = new VerificationWebSocketManager();
  }
  return wsManager;
}

export function initializeWebSocketServer(port?: number): void {
  getWebSocketManager().initialize(port);
}

export function closeWebSocketServer(): void {
  wsManager?.close();
  wsManager = null;
}
