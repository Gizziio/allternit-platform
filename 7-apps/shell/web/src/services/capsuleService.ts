/**
 * Capsule Service
 * 
 * API client for MCP Apps / Interactive Capsules
 * Manages capsule lifecycle and event streaming
 */

import type {
  InteractiveCapsule,
  CreateCapsuleRequest,
  CapsuleEvent,
  ToolUISurface,
} from '@a2r/mcp-apps-adapter';

const API_BASE = '/api/mcp-apps';

export interface CapsuleListResponse {
  capsules: InteractiveCapsule[];
}

export interface CapsuleCreateResponse {
  id: string;
  capsule_type: string;
  state: string;
  tool_id: string;
  agent_id?: string;
  session_id?: string;
  surface: ToolUISurface;
  created_at: string;
  updated_at: string;
  expires_at?: string;
  error?: string;
}

export interface CreateCapsuleInput {
  capsuleType: string;
  toolId: string;
  surface: ToolUISurface;
  agentId?: string;
  sessionId?: string;
  ttlSeconds?: number;
}

export interface PostEventInput {
  eventType: string;
  payload: unknown;
  source?: string;
}

class CapsuleService {
  /**
   * List all active capsules
   */
  async listCapsules(): Promise<InteractiveCapsule[]> {
    const response = await fetch(`${API_BASE}/capsules`);
    
    if (!response.ok) {
      throw new Error(`Failed to list capsules: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Create a new capsule
   */
  async createCapsule(input: CreateCapsuleInput): Promise<CapsuleCreateResponse> {
    const request: CreateCapsuleRequest = {
      type: input.capsuleType,
      toolId: input.toolId,
      surface: input.surface,
      agentId: input.agentId,
      sessionId: input.sessionId,
      ttlSeconds: input.ttlSeconds || 1800,
    };

    const response = await fetch(`${API_BASE}/capsules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create capsule: ${error}`);
    }

    return response.json();
  }

  /**
   * Get a capsule by ID
   */
  async getCapsule(capsuleId: string): Promise<CapsuleCreateResponse> {
    const response = await fetch(`${API_BASE}/capsules/${capsuleId}`);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Capsule not found: ${capsuleId}`);
      }
      throw new Error(`Failed to get capsule: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Delete a capsule
   */
  async deleteCapsule(capsuleId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/capsules/${capsuleId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Capsule not found: ${capsuleId}`);
      }
      throw new Error(`Failed to delete capsule: ${response.status}`);
    }
  }

  /**
   * Post an event to a capsule
   */
  async postEvent(capsuleId: string, input: PostEventInput): Promise<void> {
    const response = await fetch(`${API_BASE}/capsules/${capsuleId}/event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: input.eventType,
        payload: input.payload,
        source: input.source || 'ui',
      }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Capsule not found: ${capsuleId}`);
      }
      throw new Error(`Failed to post event: ${response.status}`);
    }
  }

  /**
   * Subscribe to capsule events via SSE
   */
  subscribeToEvents(capsuleId: string, onEvent: (event: CapsuleEvent) => void): () => void {
    const eventSource = new EventSource(`${API_BASE}/capsules/${capsuleId}/stream`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as CapsuleEvent;
        onEvent(data);
      } catch (err) {
        console.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  }

  /**
   * Create a simple test capsule
   */
  async createTestCapsule(toolId: string, agentId?: string): Promise<CapsuleCreateResponse> {
    return this.createCapsule({
      capsuleType: 'test',
      toolId,
      agentId,
      surface: {
        html: `
          <div class="test-capsule">
            <h3>Test Capsule</h3>
            <p>Tool: ${toolId}</p>
            <button id="ping-btn">Send Ping</button>
            <div id="output"></div>
          </div>
        `,
        css: `
          .test-capsule {
            padding: 16px;
            font-family: system-ui, sans-serif;
          }
          h3 { margin: 0 0 8px; }
          button {
            padding: 8px 16px;
            background: #007acc;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          #output {
            margin-top: 12px;
            padding: 8px;
            background: #f5f5f5;
            border-radius: 4px;
            min-height: 60px;
          }
        `,
        js: `
          document.getElementById('ping-btn').onclick = () => {
            a2r.emitEvent('ping', { timestamp: Date.now() });
            document.getElementById('output').textContent = 'Ping sent!';
          };
          
          // Subscribe to state changes
          a2r.subscribe((state) => {
            console.log('State updated:', state);
          });
        `,
        permissions: [
          { permission_type: 'tool:invoke', resource: toolId },
          { permission_type: 'event:emit', resource: '*' },
        ],
      },
    });
  }
}

export const capsuleService = new CapsuleService();
export default capsuleService;
