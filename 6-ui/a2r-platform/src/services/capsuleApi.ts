/**
 * Capsule API Service
 * 
 * Direct HTTP client for MCP Apps API endpoints.
 * Used by Redux thunks and components.
 */

import type { Capsule, CapsuleEvent, CreateCapsuleRequest } from '../store/slices/mcpAppsSlice';

const API_BASE = '/api/v1/mcp-apps';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export const capsuleApi = {
  // ============================================================================
  // Capsule CRUD
  // ============================================================================

  async listCapsules(): Promise<Capsule[]> {
    const response = await fetch(`${API_BASE}/capsules`);
    if (!response.ok) {
      throw new Error(`Failed to list capsules: ${response.status}`);
    }
    return response.json();
  },

  async getCapsule(id: string): Promise<Capsule> {
    const response = await fetch(`${API_BASE}/capsules/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to get capsule: ${response.status}`);
    }
    return response.json();
  },

  async createCapsule(request: CreateCapsuleRequest): Promise<Capsule> {
    const response = await fetch(`${API_BASE}/capsules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Failed to create capsule: ${response.status}`);
    }
    return response.json();
  },

  async deleteCapsule(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/capsules/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete capsule: ${response.status}`);
    }
  },

  // ============================================================================
  // State Management
  // ============================================================================

  async updateCapsuleState(
    id: string,
    state: 'pending' | 'active' | 'error' | 'closed',
    error?: string
  ): Promise<Capsule> {
    const response = await fetch(`${API_BASE}/capsules/${id}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, error }),
    });
    if (!response.ok) {
      throw new Error(`Failed to update capsule state: ${response.status}`);
    }
    return response.json();
  },

  // ============================================================================
  // Events
  // ============================================================================

  async sendEvent(
    id: string,
    eventType: string,
    payload?: unknown,
    source = 'ui'
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/capsules/${id}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType, payload, source }),
    });
    if (!response.ok) {
      throw new Error(`Failed to send event: ${response.status}`);
    }
  },

  createEventStream(id: string): EventSource {
    return new EventSource(`${API_BASE}/capsules/${id}/stream`);
  },

  // ============================================================================
  // Tool Invocation
  // ============================================================================

  async invokeTool(id: string, tool: string, params: unknown): Promise<unknown> {
    const response = await fetch(`${API_BASE}/capsules/${id}/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, params }),
    });
    if (!response.ok) {
      throw new Error(`Failed to invoke tool: ${response.status}`);
    }
    return response.json();
  },
};

export default capsuleApi;
