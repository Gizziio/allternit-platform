/**
 * allternit Super-Agent OS - Allternit Rails HTTP Client
 */

import type { DagState, BusMessage, LedgerEvent } from './rails-bridge.types';

export interface AllternitRailsClientOptions {
  baseUrl?: string;
  workspaceId: string;
  onError?: (error: Error) => void;
}

export class AllternitRailsClient {
  private baseUrl: string;
  private workspaceId: string;
  private onError?: (error: Error) => void;

  constructor(options: AllternitRailsClientOptions) {
    this.baseUrl = options.baseUrl || 'http://127.0.0.1:3021';
    this.workspaceId = options.workspaceId;
    this.onError = options.onError;
  }

  updateConfig(options: AllternitRailsClientOptions) {
    if (options.baseUrl) this.baseUrl = options.baseUrl;
    this.workspaceId = options.workspaceId;
    this.onError = options.onError;
  }

  // -------------------------------------------------------------------------
  // Sessions (tmux integration)
  // -------------------------------------------------------------------------

  async createTerminalSession(name: string, metadata?: Record<string, unknown>): Promise<{
    id: string;
    name: string;
    status: string;
  }> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        working_dir: process.cwd(),
        env: {},
        metadata: {
          workspace_id: this.workspaceId,
          ...metadata,
        },
      }),
    });

    if (!response.ok) {
      const error = new Error(`Failed to create session: ${response.statusText}`);
      this.onError?.(error);
      throw error;
    }

    return response.json();
  }

  async getSession(sessionId: string): Promise<{
    id: string;
    name: string;
    status: string;
    windows: number;
    panes: number;
  }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return response.json();
  }

  async createPane(
    sessionId: string,
    name: string,
    command?: string,
    metadata?: Record<string, unknown>
  ): Promise<{ id: string; session_id: string; title: string }> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/panes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        command,
        metadata: {
          workspace_id: this.workspaceId,
          ...metadata,
        },
      }),
    });

    if (!response.ok) {
      const error = new Error(`Failed to create pane: ${response.statusText}`);
      this.onError?.(error);
      throw error;
    }

    return response.json();
  }

  async killPane(paneId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to kill pane: ${response.statusText}`);
    }
  }

  async capturePane(paneId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}/capture`);
    
    if (!response.ok) {
      throw new Error(`Failed to capture pane output`);
    }

    const result = await response.json();
    return result.output || '';
  }

  async sendKeysToPane(paneId: string, keys: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send keys to pane`);
    }
  }

  // -------------------------------------------------------------------------
 // DAG / Work Surface
  // -------------------------------------------------------------------------

  async listDags(): Promise<DagState[]> {
    const response = await fetch(`${this.baseUrl}/workspace/${this.workspaceId}/dags`);
    
    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  async getDag(dagId: string): Promise<DagState | null> {
    const response = await fetch(`${this.baseUrl}/workspace/${this.workspaceId}/dags/${dagId}`);
    
    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  // -------------------------------------------------------------------------
  // Bus Messages
  // -------------------------------------------------------------------------

  async sendBusMessage(message: Omit<BusMessage, 'id' | 'status' | 'created_at'>): Promise<number> {
    const response = await fetch(`${this.baseUrl}/workspace/${this.workspaceId}/bus/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Failed to send bus message: ${response.statusText}`);
    }

    const result = await response.json();
    return result.message_id;
  }

  async pollPendingMessages(recipient?: string, limit = 10): Promise<BusMessage[]> {
    const params = new URLSearchParams();
    if (recipient) params.append('recipient', recipient);
    params.append('limit', limit.toString());

    const response = await fetch(
      `${this.baseUrl}/workspace/${this.workspaceId}/bus/poll?${params}`
    );

    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  // -------------------------------------------------------------------------
  // Ledger
  // -------------------------------------------------------------------------

  async getLedgerEvents(since?: string): Promise<LedgerEvent[]> {
    const params = new URLSearchParams();
    if (since) params.append('since', since);

    const response = await fetch(
      `${this.baseUrl}/workspace/${this.workspaceId}/ledger?${params}`
    );

    if (!response.ok) {
      return [];
    }

    return response.json();
  }

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
