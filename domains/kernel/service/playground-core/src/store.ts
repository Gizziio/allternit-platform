/**
 * Playground Store
 *
 * In-memory store for playground state management.
 */

import type { Playground, PlaygroundEvent, CreatePlaygroundRequest, UpdatePlaygroundRequest } from './types';

export class PlaygroundStore {
  private playgrounds: Map<string, Playground>;
  private eventListeners: Map<string, Array<(event: PlaygroundEvent) => void>>;

  constructor() {
    this.playgrounds = new Map();
    this.eventListeners = new Map();
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  async create(request: CreatePlaygroundRequest): Promise<Playground> {
    const now = new Date().toISOString();
    const playground: Playground = {
      id: this.generateId(),
      title: request.title,
      templateType: request.templateType,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
      inputs: request.inputs || {},
      events: [],
    };

    this.playgrounds.set(playground.id, playground);
    await this.emitEvent(playground.id, {
      id: this.generateId(),
      playgroundId: playground.id,
      type: 'PLAYGROUND_OPENED',
      timestamp: now,
    });

    return playground;
  }

  async get(id: string): Promise<Playground | null> {
    return this.playgrounds.get(id) || null;
  }

  async list(): Promise<Playground[]> {
    return Array.from(this.playgrounds.values());
  }

  async update(id: string, request: UpdatePlaygroundRequest): Promise<Playground | null> {
    const playground = await this.get(id);
    if (!playground) return null;

    const updated: Playground = {
      ...playground,
      ...request,
      updatedAt: new Date().toISOString(),
    };

    this.playgrounds.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.playgrounds.delete(id);
  }

  // ============================================================================
  // Event System
  // ============================================================================

  async emitEvent(playgroundId: string, event: PlaygroundEvent): Promise<void> {
    // Add event to playground
    const playground = await this.get(playgroundId);
    if (playground) {
      playground.events.push(event);
      playground.updatedAt = new Date().toISOString();
      this.playgrounds.set(playgroundId, playground);
    }

    // Notify listeners
    const listeners = this.eventListeners.get(playgroundId) || [];
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Playground event listener error:', error);
      }
    }
  }

  subscribe(playgroundId: string, callback: (event: PlaygroundEvent) => void): () => void {
    const listeners = this.eventListeners.get(playgroundId) || [];
    listeners.push(callback);
    this.eventListeners.set(playgroundId, listeners);

    return () => {
      const updatedListeners = this.eventListeners.get(playgroundId) || [];
      const index = updatedListeners.indexOf(callback);
      if (index > -1) {
        updatedListeners.splice(index, 1);
        this.eventListeners.set(playgroundId, updatedListeners);
      }
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private generateId(): string {
    return `pg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async clear(): Promise<void> {
    this.playgrounds.clear();
    this.eventListeners.clear();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const playgroundStore = new PlaygroundStore();
