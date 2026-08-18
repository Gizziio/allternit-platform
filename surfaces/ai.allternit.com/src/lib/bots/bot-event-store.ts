/**
 * Bot Event Store
 *
 * Durable, append-only storage for canonical goal/task events emitted by the
 * goal-loop controller. Events are keyed by bot + goal aggregate and persisted
 * to browser localStorage so a goal loop can survive a page reload or process
 * restart and rebuild its state from the event history.
 *
 * This is a local-first stepping stone toward the server-owned event ledger
 * described in the architecture; Wave 3 will reconcile it with backend append
 * authority and multi-device sync.
 *
 * @module bot-event-store
 */

import { createModuleLogger } from '@/lib/logger';
import {
  type GoalEventType,
  type PlanEventType,
  type TaskEventType,
  type AttemptEventType,
  type ValidationEventType,
  type DelegationEventType,
} from './goal-task-contracts';

const logger = createModuleLogger('BotEventStore');

const STORAGE_KEY = 'allternit-bot-events-v1';

/** Loop-level snapshot event; not part of the public domain taxonomy yet. */
export type LoopSnapshotEventType = 'loop.snapshot';

export type StoredEventType =
  | GoalEventType
  | PlanEventType
  | TaskEventType
  | AttemptEventType
  | ValidationEventType
  | DelegationEventType
  | LoopSnapshotEventType;

export interface StoredGoalEvent {
  /** Monotonic sequence within the bot:goal aggregate. */
  sequence: number;
  botId: string;
  goalId: string;
  type: StoredEventType;
  payload: unknown;
  occurredAt: string;
}

export interface BotEventStore {
  /** Append one event durably. */
  append(event: StoredGoalEvent): void;

  /** Read all events for a single goal aggregate. */
  readEvents(botId: string, goalId: string): StoredGoalEvent[];

  /** Read all events for a bot across all goals. */
  readAllEvents(botId: string): StoredGoalEvent[];

  /** Remove all events for a goal aggregate. */
  clear(botId: string, goalId: string): void;

  /** Remove all stored events. */
  clearAll(): void;
}

// ============================================================================
// Storage backend
// ============================================================================

interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryBackend implements StorageBackend {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

function resolveBackend(): StorageBackend {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return new MemoryBackend();
}

// ============================================================================
// Store implementation
// ============================================================================

function aggregateKey(botId: string, goalId: string): string {
  return `${botId}:${goalId}`;
}

class LocalBotEventStore implements BotEventStore {
  private backend: StorageBackend;

  constructor(backend?: StorageBackend) {
    this.backend = backend ?? resolveBackend();
  }

  private readRaw(): Record<string, StoredGoalEvent[]> {
    try {
      const raw = this.backend.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, StoredGoalEvent[]>;
      return parsed ?? {};
    } catch (err) {
      logger.error({ err }, 'Failed to read bot event store; starting empty');
      return {};
    }
  }

  private writeRaw(data: Record<string, StoredGoalEvent[]>): void {
    try {
      this.backend.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      logger.error({ err }, 'Failed to write bot event store');
    }
  }

  append(event: StoredGoalEvent): void {
    const data = this.readRaw();
    const key = aggregateKey(event.botId, event.goalId);
    const existing = data[key] ?? [];
    data[key] = [...existing, event];
    this.writeRaw(data);
    logger.debug(
      { botId: event.botId, goalId: event.goalId, seq: event.sequence, type: event.type },
      'Event appended',
    );
  }

  readEvents(botId: string, goalId: string): StoredGoalEvent[] {
    const data = this.readRaw();
    return data[aggregateKey(botId, goalId)] ?? [];
  }

  readAllEvents(botId: string): StoredGoalEvent[] {
    const data = this.readRaw();
    const out: StoredGoalEvent[] = [];
    for (const [key, events] of Object.entries(data)) {
      if (key.startsWith(`${botId}:`)) {
        out.push(...events);
      }
    }
    return out.sort((a, b) => a.sequence - b.sequence || a.occurredAt.localeCompare(b.occurredAt));
  }

  clear(botId: string, goalId: string): void {
    const data = this.readRaw();
    delete data[aggregateKey(botId, goalId)];
    this.writeRaw(data);
    logger.debug({ botId, goalId }, 'Event log cleared');
  }

  clearAll(): void {
    this.backend.removeItem(STORAGE_KEY);
    logger.debug('All event logs cleared');
  }
}

/** Singleton browser-backed store. */
export const botEventStore: BotEventStore = new LocalBotEventStore();

/** Create an isolated in-memory store for tests. */
export function createMemoryBotEventStore(): BotEventStore {
  return new LocalBotEventStore(new MemoryBackend());
}
