/**
 * ACP (Agent Capability Protocol) Registry
 * 
 * Central registry for managing agent and provider entries using official ACP types.
 */

import type { ACPRegistryEntry, AllternitACPSession } from './types.js';

export interface RegistryQuery {
  capability?: string;
  provider?: string;
  model?: string;
  authType?: string;
}

export class ACPRegistry {
  private entries: Map<string, ACPRegistryEntry> = new Map();
  private modelsById: Map<string, ACPRegistryEntry['models'][0]> = new Map();
  private sessions: Map<string, AllternitACPSession> = new Map();

  /**
   * Register a new agent/provider entry
   */
  register(entry: ACPRegistryEntry): void {
    // Check for duplicate ID
    if (this.entries.has(entry.id)) {
      throw new Error(`Registry entry with ID "${entry.id}" already exists`);
    }

    this.entries.set(entry.id, entry);

    // Index models for quick lookup
    for (const model of entry.models) {
      this.modelsById.set(`${entry.id}:${model.id}`, model);
    }
  }

  /**
   * Unregister an entry
   */
  unregister(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    // Remove model indices
    for (const model of entry.models) {
      this.modelsById.delete(`${id}:${model.id}`);
    }

    return this.entries.delete(id);
  }

  /**
   * Get entry by ID
   */
  get(id: string): ACPRegistryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * List all registered entries
   */
  list(): ACPRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Query entries by criteria
   */
  query(query: RegistryQuery): ACPRegistryEntry[] {
    return this.list().filter((entry) => {
      if (query.capability && !entry.capabilities.includes(query.capability)) {
        return false;
      }
      if (query.provider && entry.id !== query.provider) {
        return false;
      }
      if (query.model && !entry.models.some((m) => m.id === query.model)) {
        return false;
      }
      if (query.authType && entry.auth.type !== query.authType) {
        return false;
      }
      return true;
    });
  }

  /**
   * Find entries by capability
   */
  findByCapability(capability: string): ACPRegistryEntry[] {
    return this.list().filter((e) => e.capabilities.includes(capability));
  }

  /**
   * Find entry by model ID
   */
  findByModel(modelId: string): ACPRegistryEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.models.some((m) => m.id === modelId)) {
        return entry;
      }
    }
    return undefined;
  }

  /**
   * Get model info
   */
  getModel(providerId: string, modelId: string): ACPRegistryEntry['models'][0] | undefined {
    return this.modelsById.get(`${providerId}:${modelId}`);
  }

  /**
   * List all models across all entries
   */
  listAllModels(): Array<{ provider: string; model: ACPRegistryEntry['models'][0] }> {
    const result: Array<{ provider: string; model: ACPRegistryEntry['models'][0] }> = [];
    for (const entry of this.entries.values()) {
      for (const model of entry.models) {
        result.push({ provider: entry.id, model });
      }
    }
    return result;
  }

  /**
   * Check if entry exists
   */
  has(id: string): boolean {
    return this.entries.has(id);
  }

  /**
   * Get count of registered entries
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries.clear();
    this.modelsById.clear();
  }

  /**
   * Update an existing entry
   */
  update(id: string, updates: Partial<ACPRegistryEntry>): ACPRegistryEntry {
    const existing = this.entries.get(id);
    if (!existing) {
      throw new Error(`Registry entry with ID "${id}" not found`);
    }

    // Remove old model indices
    for (const model of existing.models) {
      this.modelsById.delete(`${id}:${model.id}`);
    }

    const updated = { ...existing, ...updates, id };
    this.entries.set(id, updated);

    // Add new model indices
    for (const model of updated.models) {
      this.modelsById.set(`${id}:${model.id}`, model);
    }

    return updated;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Store a session
   */
  setSession(session: AllternitACPSession): void {
    this.sessions.set(session.id, session);
  }

  /**
   * Get a session
   */
  getSession(id: string): AllternitACPSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * List all sessions
   */
  listSessions(): AllternitACPSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Delete a session
   */
  deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }
}

// Singleton instance for global use
export const acpRegistry = new ACPRegistry();

// Export class as default for custom instances
export default ACPRegistry;
