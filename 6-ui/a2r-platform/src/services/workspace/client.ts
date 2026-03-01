/**
 * Workspace Service Client
 * 
 * Provides TypeScript client for the workspace service API.
 */

export interface Session {
  id: string;
  name: string;
  status: string;
  windows: number;
  panes: number;
  attached: boolean;
}

export interface Pane {
  id: string;
  session_id: string;
  window_index: number;
  pane_index: number;
  title: string;
  current_command?: string;
}

export interface CreateSessionRequest {
  name: string;
  working_dir?: string;
  env?: Record<string, string>;
  metadata?: SessionMetadata;
}

export interface SessionMetadata {
  dag_id?: string;
  wih_id?: string;
  owner?: string;
  labels?: string[];
}

export interface CreatePaneRequest {
  name: string;
  command?: string;
  metadata?: PaneMetadata;
}

export interface PaneMetadata {
  agent_id?: string;
  wih_id?: string;
  pane_type?: string;
}

const WORKSPACE_SERVICE_URL = process.env.NEXT_PUBLIC_WORKSPACE_SERVICE_URL || 'http://127.0.0.1:3021';

class WorkspaceClient {
  public readonly baseUrl: string;

  constructor(baseUrl: string = WORKSPACE_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  // Sessions
  async listSessions(): Promise<Session[]> {
    const response = await fetch(`${this.baseUrl}/sessions`);
    if (!response.ok) throw new Error('Failed to list sessions');
    return response.json();
  }

  async getSession(id: string): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`);
    if (!response.ok) throw new Error('Session not found');
    return response.json();
  }

  async createSession(request: CreateSessionRequest): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('Failed to create session');
    return response.json();
  }

  async deleteSession(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete session');
  }

  // Panes
  async listPanes(sessionId: string): Promise<Pane[]> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/panes`);
    if (!response.ok) throw new Error('Failed to list panes');
    return response.json();
  }

  async createPane(sessionId: string, request: CreatePaneRequest): Promise<Pane> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/panes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error('Failed to create pane');
    return response.json();
  }

  async getPane(paneId: string): Promise<Pane> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}`);
    if (!response.ok) throw new Error('Pane not found');
    return response.json();
  }

  async deletePane(paneId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete pane');
  }

  async capturePane(paneId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}/capture`);
    if (!response.ok) throw new Error('Failed to capture pane');
    const data = await response.json();
    return data.output;
  }

  async sendKeys(paneId: string, keys: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/panes/${paneId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys }),
    });
    if (!response.ok) throw new Error('Failed to send keys');
  }

  // WebSocket for log streaming
  createLogStream(paneId: string): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws');
    return new WebSocket(`${wsUrl}/panes/${paneId}/logs`);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const workspaceClient = new WorkspaceClient();
export default workspaceClient;
