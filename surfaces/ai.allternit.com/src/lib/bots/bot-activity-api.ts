/**
 * Bot Activity API
 *
 * Cursor-paginated query interface over the server-owned bot event ledger
 * (`GET /api/v1/bots/:id/events`). Server rows are mapped to ActivityEvent via
 * the pure `botEventRowToActivityEvent` so tests can exercise mapping without
 * fetch.
 *
 * `search()` remains local: the server has no search endpoint yet, so it scans
 * the offline replica in `bot-event-store.ts`. Server-backed search replaces
 * it in a later Wave 3 step.
 *
 * @module bot-activity-api
 */

import { type BotEventStore, botEventStore, type StoredGoalEvent, type StoredEventType } from './bot-event-store';
import {
  botEventsApi,
  type BotEventsApi,
  type BotEventRow,
} from './bot-events-api';
import { type ActivityEvent, ActivityEventSchema, type ActivityActor } from './wih-session-contracts';

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
  /** Exclusive start sequence (cursor resume). */
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

/** Map a server ledger row to a client ActivityEvent. Pure; no I/O. */
export function botEventRowToActivityEvent(row: BotEventRow): ActivityEvent {
  return ActivityEventSchema.parse({
    id: row.id,
    sequence: row.sequence,
    botId: row.botId,
    sessionId: row.sessionId,
    goalId: row.goalId,
    wihId: row.wihId,
    taskId: row.taskId,
    eventType: row.eventType,
    actor: row.actor,
    payload: row.payload,
    occurredAt: row.occurredAt,
  });
}

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
  constructor(
    private eventsApi: BotEventsApi = botEventsApi,
    private eventStore: BotEventStore = botEventStore,
  ) {}

  /**
   * Query activity events from the server ledger with cursor pagination. The
   * returned `nextCursor` is the sequence number of the last returned event;
   * clients resume with `afterSequence: parseInt(nextCursor)`.
   *
   * The server filters by `eventTypes`/`afterSequence`/`limit`; goal/session/
   * WIH/task filters are applied to the returned page client-side (they are
   * first-class columns on the row but not yet server-side query params), so
   * a filtered page may contain fewer than `limit` events while `hasMore` is
   * still true.
   */
  async query(query: ActivityQuery): Promise<ActivityPage> {
    const { botId, sessionId, goalId, wihId, taskId, eventTypes, afterSequence, limit = 50 } = query;

    const page = await this.eventsApi.queryBotEvents(botId, { afterSequence, limit, eventTypes });

    let rows = page.events;
    if (goalId) rows = rows.filter((r) => r.goalId === goalId);
    if (sessionId) rows = rows.filter((r) => r.sessionId === sessionId);
    if (wihId) rows = rows.filter((r) => r.wihId === wihId);
    if (taskId) rows = rows.filter((r) => r.taskId === taskId);

    return {
      events: rows.map(botEventRowToActivityEvent),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    };
  }

  /**
   * Full-text search over event payloads. Returns matching events sorted by
   * sequence. This is a client-side scan of the local offline replica; the
   * server ledger has no search endpoint yet.
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
   * Rebuild the latest GoalLoopState for a goal from the server event ledger.
   * Pages through the bot's full history, collecting the goal's events, then
   * runs the persistence reducer.
   */
  async replayGoal(goalId: string, botId: string): Promise<import('./goal-loop-controller').GoalLoopState | null> {
    const { rebuildGoalLoopState } = await import('./goal-loop-persistence');

    const stored: StoredGoalEvent[] = [];
    let afterSequence: number | undefined;
    for (;;) {
      const page = await this.eventsApi.queryBotEvents(botId, { afterSequence, limit: 200 });
      for (const row of page.events) {
        if (row.goalId !== goalId) continue;
        stored.push({
          sequence: row.sequence,
          botId: row.botId,
          goalId: row.goalId,
          type: row.eventType as StoredEventType,
          payload: row.payload,
          occurredAt: row.occurredAt,
        });
      }
      if (!page.hasMore || page.events.length === 0) break;
      const cursor = page.nextCursor !== undefined
        ? Number(page.nextCursor)
        : page.events[page.events.length - 1]?.sequence;
      if (cursor === undefined || Number.isNaN(cursor)) break;
      afterSequence = cursor;
    }

    return rebuildGoalLoopState(stored);
  }
}

/** Singleton API instance backed by the server ledger and the local replica. */
export const botActivityAPI = new BotActivityAPI();
