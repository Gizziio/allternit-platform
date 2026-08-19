/**
 * Bot Activity API
 *
 * Local-first cursor-paginated query interface over the durable goal/task event
 * store. Supports filtering by bot, session, goal, WIH, and task, with
 * duplicate-tolerant resume semantics for offline replicas.
 *
 * @module bot-activity-api
 */

import { createModuleLogger } from '@/lib/logger';
import { type BotEventStore, botEventStore, type StoredGoalEvent } from './bot-event-store';
import { type ActivityEvent, ActivityEventSchema, type ActivityActor } from './wih-session-contracts';

const logger = createModuleLogger('BotActivityAPI');

// ============================================================================
// Query types
// ============================================================================

export interface ActivityQuery {
  botId: string;
  sessionId?: string;
  goalId?: string;
  wihId?: string;
  taskId?: string;
  eventTypes?: string[];
  /** Inclusive start sequence (cursor resume). */
  afterSequence?: number;
  /** Maximum events to return. */
  limit?: number;
}

export interface ActivityPage {
  events: ActivityEvent[];
  nextCursor?: string;
  hasMore: boolean;
}

// ============================================================================
// Conversion
// ============================================================================

function storedToActivityEvent(stored: StoredGoalEvent, actor: ActivityActor = { type: 'bot', id: stored.botId }): ActivityEvent {
  return ActivityEventSchema.parse({
    id: `evt_${stored.botId}_${stored.goalId}_${stored.sequence}`,
    sequence: stored.sequence,
    botId: stored.botId,
    goalId: stored.goalId,
    eventType: stored.type,
    actor,
    payload: stored.payload as Record<string, unknown>,
    occurredAt: stored.occurredAt,
  });
}

// ============================================================================
// API
// ============================================================================

export class BotActivityAPI {
  constructor(private eventStore: BotEventStore = botEventStore) {}

  /**
   * Query activity events with cursor pagination. The returned `nextCursor`
   * is the sequence number of the last returned event; clients resume with
   * `afterSequence: parseInt(nextCursor) + 1`.
   */
  query(query: ActivityQuery): ActivityPage {
    const { botId, sessionId, goalId, wihId, taskId, eventTypes, afterSequence, limit = 50 } = query;

    let events = this.eventStore.readAllEvents(botId);

    if (goalId) {
      events = events.filter((e) => e.goalId === goalId);
    }

    if (eventTypes && eventTypes.length > 0) {
      events = events.filter((e) => eventTypes.includes(e.type));
    }

    // sessionId/wihId/taskId are not stored on every event; filter by payload
    // correlation where available.
    if (sessionId) {
      events = events.filter(
        (e) =>
          (e.payload as Record<string, unknown>)?.sessionId === sessionId ||
          this.payloadHasId(e.payload, 'sessionId', sessionId),
      );
    }

    if (wihId) {
      events = events.filter((e) => this.payloadHasId(e.payload, 'wihId', wihId));
    }

    if (taskId) {
      events = events.filter(
        (e) =>
          e.type.startsWith('task.') ||
          e.type.startsWith('attempt.') ||
          e.type.startsWith('validation.'),
      );
      events = events.filter((e) => this.payloadHasId(e.payload, 'id', taskId) || this.payloadHasId(e.payload, 'taskId', taskId));
    }

    // Sort ascending by sequence, then timestamp.
    events = events.sort((a, b) => a.sequence - b.sequence || a.occurredAt.localeCompare(b.occurredAt));

    // Resume cursor.
    let startIndex = 0;
    if (afterSequence !== undefined) {
      startIndex = events.findIndex((e) => e.sequence > afterSequence);
      if (startIndex < 0) startIndex = events.length;
    }

    const page = events.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < events.length;
    const nextCursor = page.length > 0 ? String(page[page.length - 1]?.sequence) : undefined;

    return {
      events: page.map((e) => storedToActivityEvent(e)),
      nextCursor,
      hasMore,
    };
  }

  /**
   * Full-text search over event payloads. Returns matching events sorted by
   * sequence. This is a client-side scan; server-backed search will replace it
   * in Wave 3 server reconciliation.
   */
  search(botId: string, query: string): ActivityEvent[] {
    const lower = query.toLowerCase();
    const events = this.eventStore.readAllEvents(botId);
    return events
      .filter((e) => JSON.stringify(e.payload).toLowerCase().includes(lower))
      .sort((a, b) => a.sequence - b.sequence || a.occurredAt.localeCompare(b.occurredAt))
      .map((e) => storedToActivityEvent(e));
  }

  /**
   * Rebuild the latest GoalLoopState for a goal from stored events. Convenience
   * wrapper around the persistence reducer.
   */
  async replayGoal(goalId: string, botId: string): Promise<import('./goal-loop-controller').GoalLoopState | null> {
    const { rebuildGoalLoopState } = await import('./goal-loop-persistence');
    const events = this.eventStore.readEvents(botId, goalId);
    return rebuildGoalLoopState(events);
  }

  private payloadHasId(payload: unknown, key: string, id: string): boolean {
    if (payload === null || typeof payload !== 'object') return false;
    const record = payload as Record<string, unknown>;
    if (record[key] === id) return true;
    // Nested payload (e.g., { plan, receipt }).
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object' && (value as Record<string, unknown>)[key] === id) {
        return true;
      }
    }
    return false;
  }
}

/** Singleton API instance backed by the browser event store. */
export const botActivityAPI = new BotActivityAPI();
