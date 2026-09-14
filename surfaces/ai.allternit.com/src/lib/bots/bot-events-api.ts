"use client";

/**
 * Bot Events API Client
 *
 * Typed client for the server-owned bot event ledger (Wave 3 reconciliation):
 *
 *   POST /api/v1/bots/:id/events             — append an event (idempotent)
 *   GET  /api/v1/bots/:id/events             — cursor-paginated event query
 *   GET  /api/v1/bots/:id/operational-state  — authoritative projection
 *
 * The server is the append authority; the browser-local store in
 * `bot-event-store.ts` remains as an offline replica. Responses are
 * zod-parsed so malformed payloads fail loudly at the boundary.
 *
 * @module bot-events-api
 */

import { z } from 'zod';
import { api } from '@/integration/api-client';
import { BotOperationalStateSchema, type BotOperationalState } from './orpc-contracts';
import { ActivityActorSchema, type ActivityActor } from './wih-session-contracts';

// ============================================================================
// Schemas
// ============================================================================

/** One row of the server event ledger (camelCase wire shape). */
export const BotEventRowSchema = z.object({
  id: z.string(),
  /** Per-bot monotonic sequence assigned by the server. */
  sequence: z.number().int().nonnegative(),
  botId: z.string(),
  sessionId: z.string().optional(),
  goalId: z.string().optional(),
  wihId: z.string().optional(),
  taskId: z.string().optional(),
  runId: z.string().optional(),
  eventType: z.string(),
  actor: ActivityActorSchema,
  payload: z.record(z.unknown()),
  occurredAt: z.string(),
});

export type BotEventRow = z.infer<typeof BotEventRowSchema>;

const AppendBotEventResponseSchema = z.object({
  event: BotEventRowSchema,
});

export const BotEventPageSchema = z.object({
  events: z.array(BotEventRowSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type BotEventPage = z.infer<typeof BotEventPageSchema>;

// ============================================================================
// Request shapes
// ============================================================================

export interface AppendBotEventInput {
  eventType: string;
  actor: ActivityActor;
  payload: Record<string, unknown>;
  occurredAt?: string;
  sessionId?: string;
  goalId?: string;
  wihId?: string;
  taskId?: string;
  runId?: string;
  /** Deterministic dedup key; the server returns 200 with the original row on replay. */
  idempotencyKey?: string;
}

export interface BotEventsQuery {
  /** Exclusive sequence cursor — returns rows with sequence > afterSequence. */
  afterSequence?: number;
  limit?: number;
  eventTypes?: string[];
}

// ============================================================================
// Endpoints
// ============================================================================

export async function appendBotEvent(botId: string, input: AppendBotEventInput): Promise<BotEventRow> {
  // The request body is snake_case per the server contract.
  const res = await api.post<unknown>(`/api/v1/bots/${encodeURIComponent(botId)}/events`, {
    event_type: input.eventType,
    actor: input.actor,
    payload: input.payload,
    occurred_at: input.occurredAt,
    session_id: input.sessionId,
    goal_id: input.goalId,
    wih_id: input.wihId,
    task_id: input.taskId,
    run_id: input.runId,
    idempotency_key: input.idempotencyKey,
  });
  return AppendBotEventResponseSchema.parse(res).event;
}

export async function queryBotEvents(botId: string, query: BotEventsQuery = {}): Promise<BotEventPage> {
  const params = new URLSearchParams();
  if (query.afterSequence !== undefined) params.set('after_sequence', String(query.afterSequence));
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  if (query.eventTypes && query.eventTypes.length > 0) params.set('event_types', query.eventTypes.join(','));
  const qs = params.toString();
  const res = await api.get<unknown>(
    `/api/v1/bots/${encodeURIComponent(botId)}/events${qs ? `?${qs}` : ''}`,
  );
  return BotEventPageSchema.parse(res);
}

export async function getBotOperationalState(botId: string): Promise<BotOperationalState> {
  const res = await api.get<unknown>(`/api/v1/bots/${encodeURIComponent(botId)}/operational-state`);
  return BotOperationalStateSchema.parse(res);
}

// ============================================================================
// Injectable facade
// ============================================================================

/**
 * Narrow interface over the endpoints above so consumers (activity API,
 * recorder, projection store) can be tested with mocks instead of fetch.
 */
export interface BotEventsApi {
  appendBotEvent(botId: string, input: AppendBotEventInput): Promise<BotEventRow>;
  queryBotEvents(botId: string, query?: BotEventsQuery): Promise<BotEventPage>;
  getBotOperationalState(botId: string): Promise<BotOperationalState>;
}

/** Singleton facade backed by the real HTTP endpoints. */
export const botEventsApi: BotEventsApi = {
  appendBotEvent,
  queryBotEvents,
  getBotOperationalState,
};
