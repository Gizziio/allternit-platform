/**
 * Infrastructure WebSocket - Real-time updates for infrastructure resources
 */

import type { Deployment, Instance } from './cloud';
import type { Environment } from './environments';
import type { VPSConnection } from './vps';

export type InfrastructureEventType = 
  | 'deployment_update'
  | 'instance_update'
  | 'environment_status'
  | 'vps_status'
  | 'log_output'
  | 'health_check';

export interface InfrastructureEvent {
  type: InfrastructureEventType;
  data: Deployment | Instance | Environment | VPSConnection | LogOutputData | HealthCheckData;
  timestamp: string;
}

export interface LogOutputData {
  resource_id: string;
  resource_type: string;
  output: string;
}

export interface HealthCheckData {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: Record<string, {
    status: 'healthy' | 'unhealthy';
    latency?: number;
    message?: string;
  }>;
}

type EventHandler = (event: InfrastructureEvent) => void;

/**
 * WebSocket client for infrastructure real-time updates
 */
export class InfrastructureWebSocket {
  private ws: WebSocket | null = null;
  private handlers: EventHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string;

  constructor(url?: string) {
    // Use relative URL for same-origin or construct from current location
    this.url = url || 
      (typeof window !== 'undefined' 
        ? `wss://${window.location.host}/api/v1/infrastructure/ws`
        : 'wss://localhost/api/v1/infrastructure/ws');
  }

  connect(): void {
    // TODO: Implement actual WebSocket connection
    console.log('[InfrastructureWebSocket] Connecting to:', this.url);
    
    // Stub connection - simulate successful connection
    this.reconnectAttempts = 0;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      console.log('[InfrastructureWebSocket] Connected (stub)');
    }, 100);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log('[InfrastructureWebSocket] Disconnected');
  }

  onEvent(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  offEvent(handler: EventHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index > -1) {
      this.handlers.splice(index, 1);
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data) as InfrastructureEvent;
      this.handlers.forEach(handler => handler(data));
    } catch (err) {
      console.error('[InfrastructureWebSocket] Failed to parse message:', err);
    }
  }

  private handleError(error: Event): void {
    console.error('[InfrastructureWebSocket] Error:', error);
  }

  private handleClose(): void {
    this.ws = null;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`[InfrastructureWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[InfrastructureWebSocket] Cannot send, connection not open');
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
