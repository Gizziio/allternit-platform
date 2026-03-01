/**
 * Chrome DevTools Protocol Client
 * Ported from OpenClaw dist/browser/cdp.js
 */

import WebSocket from 'ws';

export interface CDPResponse {
  id: number;
  result?: any;
  error?: { code: number; message: string };
}

export interface CDPEvent {
  method: string;
  params?: any;
}

export class CDPClient {
  private ws: WebSocket;
  private messageId = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private eventHandlers = new Map<string, ((params: any) => void)[]>();

  constructor(ws: WebSocket) {
    this.ws = ws;
    this.ws.on('message', (data) => this.handleMessage(data.toString()));
    this.ws.on('error', (err) => this.handleError(err));
    this.ws.on('close', () => this.handleClose());
  }

  static async connect(wsUrl: string): Promise<CDPClient> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.on('open', () => resolve(new CDPClient(ws)));
      ws.on('error', reject);
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as CDPResponse | CDPEvent;
      
      if ('id' in message && message.id !== undefined) {
        // Response to a command
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          if (message.error) {
            pending.reject(new Error(`${message.error.message} (${message.error.code})`));
          } else {
            pending.resolve(message.result);
          }
        }
      } else if ('method' in message) {
        // Event
        const handlers = this.eventHandlers.get(message.method);
        if (handlers) {
          handlers.forEach(h => h(message.params));
        }
      }
    } catch (err) {
      console.error('Failed to parse CDP message:', err);
    }
  }

  private handleError(err: Error): void {
    // Reject all pending commands
    this.pending.forEach(({ reject }) => reject(err));
    this.pending.clear();
  }

  private handleClose(): void {
    // Reject all pending commands
    const error = new Error('CDP connection closed');
    this.pending.forEach(({ reject }) => reject(error));
    this.pending.clear();
  }

  send(method: string, params?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.messageId;
      this.pending.set(id, { resolve, reject });
      
      const message = JSON.stringify({ id, method, params });
      
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(message);
      } else {
        reject(new Error('WebSocket not connected'));
      }
    });
  }

  on(event: string, handler: (params: any) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  off(event: string, handler: (params: any) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) handlers.splice(index, 1);
  }

  close(): void {
    this.ws.close();
  }
}

// ============================================================================
// CDP Helpers
// ============================================================================

export async function getVersion(cdpUrl: string): Promise<any> {
  const response = await fetch(`${cdpUrl}/json/version`);
  return response.json();
}

export async function getTargets(cdpUrl: string): Promise<any[]> {
  const response = await fetch(`${cdpUrl}/json/list`);
  return response.json();
}

export async function createTarget(cdpUrl: string, url: string): Promise<{ targetId: string }> {
  const response = await fetch(`${cdpUrl}/json/new?${encodeURIComponent(url)}`);
  return response.json();
}

export async function closeTarget(cdpUrl: string, targetId: string): Promise<void> {
  await fetch(`${cdpUrl}/json/close/${targetId}`);
}

export async function activateTarget(cdpUrl: string, targetId: string): Promise<void> {
  await fetch(`${cdpUrl}/json/activate/${targetId}`);
}
