/**
 * Memory Kernel V2 Client
 *
 * Provides a lightweight client to interact with the backend native Memory Kernel V2 endpoints:
 * - recall: query relevant facts, entities, and observations
 * - retainTurn: record conversational turns and extract facts
 * - recordObservation: log tool runs, checkpoints, files, decisions
 * - listObservations, listFacts, listEntities: fetch structured memory items
 */

export interface MemoryRecallResult {
  id: string;
  item_type: 'fact' | 'entity' | 'observation';
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface MemoryObservation {
  id: string;
  user_id: string;
  agent_id?: string;
  session_id?: string;
  kind: string;
  content: string;
  timestamp: string;
  source?: string;
}

export interface MemoryFact {
  id: string;
  user_id: string;
  agent_id?: string;
  fact: string;
  confidence: number;
  valid_from: string;
  valid_until?: string;
  source_observation_id?: string;
}

export interface MemoryEntity {
  id: string;
  user_id: string;
  agent_id?: string;
  entity_id: string;
  name: string;
  type: string;
  summary?: string;
  last_updated: string;
}

export class MemoryClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Recall ranked memory items (facts, entities, recent observations) relevant to a query.
   */
  async recall(
    query: string,
    options?: { agentId?: string; sessionId?: string; limit?: number }
  ): Promise<MemoryRecallResult[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/memory/v2/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          agent_id: options?.agentId,
          session_id: options?.sessionId,
          limit: options?.limit ?? 8,
        }),
      });

      if (!res.ok) {
        return [];
      }

      const data = await res.json();
      return Array.isArray(data.results) ? data.results : [];
    } catch {
      // Degrade gracefully if backend is offline or unconfigured
      return [];
    }
  }

  /**
   * Retain an agent or user turn (records observation and extracts facts).
   */
  async retainTurn(
    role: 'user' | 'assistant' | 'system',
    content: string,
    options?: { agentId?: string; sessionId?: string }
  ): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/memory/v2/retain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          agent_id: options?.agentId,
          session_id: options?.sessionId,
        }),
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      return data.observation_id || null;
    } catch {
      return null;
    }
  }

  /**
   * Record a discrete observation (tool call, checkpoint, file event, or decision).
   */
  async recordObservation(
    kind: 'turn' | 'file' | 'tool' | 'decision' | 'checkpoint',
    content: string,
    options?: { agentId?: string; sessionId?: string; source?: string }
  ): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/memory/v2/observation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          content,
          agent_id: options?.agentId,
          session_id: options?.sessionId,
          source: options?.source,
        }),
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      return data.id || null;
    } catch {
      return null;
    }
  }

  /**
   * List observations for an agent.
   */
  async listObservations(agentId?: string, limit = 50): Promise<MemoryObservation[]> {
    try {
      const params = new URLSearchParams();
      if (agentId) params.append('agent_id', agentId);
      params.append('limit', String(limit));

      const res = await fetch(`${this.baseUrl}/api/v1/memory/v2/observations?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.observations) ? data.observations : [];
    } catch {
      return [];
    }
  }

  /**
   * List facts for an agent.
   */
  async listFacts(agentId?: string, limit = 50): Promise<MemoryFact[]> {
    try {
      const params = new URLSearchParams();
      if (agentId) params.append('agent_id', agentId);
      params.append('limit', String(limit));

      const res = await fetch(`${this.baseUrl}/api/v1/memory/v2/facts?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.facts) ? data.facts : [];
    } catch {
      return [];
    }
  }

  /**
   * List entities for an agent.
   */
  async listEntities(agentId?: string, limit = 50): Promise<MemoryEntity[]> {
    try {
      const params = new URLSearchParams();
      if (agentId) params.append('agent_id', agentId);
      params.append('limit', String(limit));

      const res = await fetch(`${this.baseUrl}/api/v1/memory/v2/entities?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.entities) ? data.entities : [];
    } catch {
      return [];
    }
  }
}

export const memoryClient = new MemoryClient();
