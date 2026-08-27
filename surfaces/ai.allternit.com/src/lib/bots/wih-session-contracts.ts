/**
 * Wave 3 — WIH and Bot Session Contracts
 *
 * Defines Work-In-Hand (WIH) and bounded bot session contracts, plus the local
 * activity event shape used for durable bot history. These bridge the goal-loop
 * runtime into persistent, resumable work partitions.
 *
 * @module wih-session-contracts
 */

import { z } from 'zod';
import {
  BudgetPolicySchema,
  BudgetUsageSchema,
  ValidationCriterionSchema,
  TaskArtifactSchema,
  type BudgetPolicy,
  type BudgetUsage,
  type ValidationCriterion,
  type TaskArtifact,
} from './goal-task-contracts';

// ============================================================================
// WIH Contract (W3-001 – W3-007)
// ============================================================================

export const WIHStatusSchema = z.enum([
  'draft',
  'active',
  'blocked',
  'waiting_input',
  'waiting_approval',
  'completed',
  'failed',
  'cancelled',
]);

export type WIHStatus = z.infer<typeof WIHStatusSchema>;

export const WIHParticipantSchema = z.object({
  type: z.enum(['user', 'bot', 'subagent']),
  id: z.string(),
  displayName: z.string().optional(),
});

export type WIHParticipant = z.infer<typeof WIHParticipantSchema>;

export const WIHSchema = z.object({
  id: z.string(),
  botId: z.string(),
  projectId: z.string().optional(),
  sessionId: z.string(),
  goalId: z.string(),
  taskGraphId: z.string(),

  // Current focus
  currentTaskId: z.string().optional(),
  status: WIHStatusSchema.default('draft'),

  // Configuration
  title: z.string().min(1),
  tools: z.array(z.string()).default([]),
  writeScope: z.array(z.string()).default([]),
  validationCriteria: z.array(ValidationCriterionSchema).default([]),

  // State
  artifacts: z.array(TaskArtifactSchema).default([]),
  participants: z.array(WIHParticipantSchema).default([]),
  budget: BudgetPolicySchema.optional(),
  budgetUsage: BudgetUsageSchema.default({}),

  // Continuation
  resumeCursor: z.string().optional(),

  // Metadata
  version: z.number().int().nonnegative().default(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type WIH = z.infer<typeof WIHSchema>;

// ============================================================================
// Bot Session Contract (W3-020 – W3-027)
// ============================================================================

export const BotSessionStatusSchema = z.enum([
  'active',
  'paused',
  'closed',
  'archived',
]);

export type BotSessionStatus = z.infer<typeof BotSessionStatusSchema>;

export const ContextBudgetSchema = z.object({
  maxTokens: z.number().int().nonnegative().optional(),
  maxMessages: z.number().int().nonnegative().optional(),
  maxTurns: z.number().int().nonnegative().optional(),
});

export type ContextBudget = z.infer<typeof ContextBudgetSchema>;

export const SessionSummarySchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  content: z.string(),
  decisions: z.array(z.string()).default([]),
  openLoops: z.array(z.string()).default([]),
  artifacts: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
  memoryCandidates: z.array(z.string()).default([]),
  sourceEventRange: z.object({ fromSequence: z.number(), toSequence: z.number() }),
  tokenCount: z.number().int().nonnegative().optional(),
  modelId: z.string().optional(),
  createdAt: z.string(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const BotSessionSchema = z.object({
  id: z.string(),
  botId: z.string(),
  projectId: z.string().optional(),

  status: BotSessionStatusSchema.default('active'),
  title: z.string().min(1),

  // Work partitions
  goalIds: z.array(z.string()).default([]),
  wihIds: z.array(z.string()).default([]),
  currentWihId: z.string().optional(),

  // Context
  summary: SessionSummarySchema.optional(),
  contextBudget: ContextBudgetSchema.optional(),

  // Activity
  lastActivityAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().optional(),
});

export type BotSession = z.infer<typeof BotSessionSchema>;

// ============================================================================
// Local Activity Event (W3-020 – W3-027)
// ============================================================================

export const ActivityActorSchema = z.object({
  type: z.enum(['user', 'bot', 'system', 'subagent']),
  id: z.string(),
});

export type ActivityActor = z.infer<typeof ActivityActorSchema>;

export const ActivityEventSchema = z.object({
  id: z.string(),
  sequence: z.number().int().nonnegative(),
  tenantId: z.string().optional(),
  workspaceId: z.string().optional(),
  botId: z.string(),
  sessionId: z.string().optional(),
  goalId: z.string().optional(),
  wihId: z.string().optional(),
  taskId: z.string().optional(),
  eventType: z.string(),
  actor: ActivityActorSchema,
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().optional(),
  occurredAt: z.string(),
});

export type ActivityEvent = z.infer<typeof ActivityEventSchema>;

// ============================================================================
// Helpers
// ============================================================================

export function createWIHFromGoal(
  wihId: string,
  sessionId: string,
  goalId: string,
  taskGraphId: string,
  title: string,
  botId: string,
  projectId?: string,
  overrides: Partial<WIH> = {},
): WIH {
  const now = new Date().toISOString();
  return WIHSchema.parse({
    id: wihId,
    botId,
    projectId,
    sessionId,
    goalId,
    taskGraphId,
    title,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}

export function createBotSession(
  sessionId: string,
  botId: string,
  title: string,
  projectId?: string,
  overrides: Partial<BotSession> = {},
): BotSession {
  const now = new Date().toISOString();
  return BotSessionSchema.parse({
    id: sessionId,
    botId,
    projectId,
    status: 'active',
    title,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
}
