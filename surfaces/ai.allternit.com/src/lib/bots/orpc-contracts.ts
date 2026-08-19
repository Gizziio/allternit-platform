/**
 * oRPC Typed Contracts
 *
 * Shared API contract between web, desktop, and mobile surfaces.
 * Defines Zod schemas for all bot platform entities and the full
 * REST/RPC contract for type-safe client generation.
 *
 * @module orpc-contracts
 */

import { z } from 'zod';
import {
  GoalSchema,
  PlanSchema,
  TaskGraphSchema,
  TaskSchema,
  AttemptSchema,
  ValidationResultSchema,
  LoopPolicySchema,
  BudgetPolicySchema,
  BudgetUsageSchema,
  MilestoneSchema,
  ValidationCriterionSchema,
  TaskArtifactSchema,
  GoalStatusSchema,
  TaskStatusSchema,
  AttemptStatusSchema,
  ValidationVerdictSchema,
  PrioritySchema,
  LoopStrategySchema,
  DelegationSchema,
  type Goal,
  type Plan,
  type TaskGraph,
  type Task,
  type Attempt,
  type ValidationResult,
  type LoopPolicy,
  type BudgetPolicy,
  type BudgetUsage,
  type Milestone,
  type ValidationCriterion,
  type TaskArtifact,
  type GoalStatus,
  type TaskStatus,
  type AttemptStatus,
  type ValidationVerdict,
  type Priority,
  type LoopStrategy,
  type Delegation,
} from './goal-task-contracts';

// ============================================================================
// Bot Schemas
// ============================================================================

export const AvatarTypeSchema = z.enum(['geometric', 'image', 'pet']);

export const AvatarSchema = z.object({
  type: AvatarTypeSchema,
  data: z.any(),
});

export const BotCategorySchema = z.enum([
  'research',
  'code',
  'writing',
  'data',
  'sales',
  'design',
  'ops',
  'custom',
]);

export const BotLifecycleSchema = z.enum(['draft', 'active', 'archived', 'deprecated']);

export const BotProfileSchema = z.object({
  displayName: z.string().min(1),
  handle: z.string().optional(),
  version: z.string().optional(),
  tagline: z.string().optional(),
  welcomeMessage: z.string().optional(),
  starterPrompts: z.array(z.string()).optional(),
  accentColor: z.string().optional(),
  groupChatEnabled: z.boolean().optional(),
  defaultPresetId: z.string().optional(),
  botCategory: BotCategorySchema.optional(),
  lifecycle: BotLifecycleSchema.optional(),
});

export const BotOperationalStatusSchema = z.enum([
  'idle',
  'working',
  'waiting_input',
  'waiting_approval',
  'blocked',
  'offline',
  'degraded',
  'failed',
  'completed',
]);

export const BotOperationalStateSchema = z.object({
  status: BotOperationalStatusSchema,
  activeSessionId: z.string().optional(),
  activeRunId: z.string().optional(),
  activeGoalId: z.string().optional(),
  activeTaskId: z.string().optional(),
  activeWihId: z.string().optional(),
  activityLabel: z.string().optional(),
  pendingApprovalsCount: z.number().int().nonnegative().default(0),
  unreadMessagesCount: z.number().int().nonnegative().default(0),
  computerState: z.enum(['none', 'provisioning', 'running', 'takeover', 'sleeping', 'terminated']).default('none'),
  nextRoutineRunAt: z.string().optional(),
  lastEventSequence: z.number().int().nonnegative().default(0),
  updatedAt: z.string(),
});

export const BotSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['orchestrator', 'sub-agent', 'worker', 'specialist', 'reviewer']).default('specialist'),
  model: z.string().default('default'),
  provider: z.enum(['openai', 'anthropic', 'google', 'local', 'custom']).default('custom'),
  avatar: AvatarSchema.optional(),
  isBot: z.literal(true).default(true),
  botProfile: BotProfileSchema,
  operationalState: BotOperationalStateSchema.optional(),
  parentBotId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateBotSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(4000).default(''),
  botProfile: BotProfileSchema,
  avatar: AvatarSchema.optional(),
  model: z.string().optional(),
  provider: z.enum(['openai', 'anthropic', 'google', 'local', 'custom']).optional(),
  parentBotId: z.string().optional(),
});

export const UpdateBotSchema = CreateBotSchema.partial();

// ============================================================================
// Canonical Event Envelope Schema
// ============================================================================

export const EventSensitivitySchema = z.enum(['public', 'internal', 'confidential', 'secret']);

export const CanonicalEventEnvelopeSchema = z.object({
  id: z.string(),
  sequence: z.number().int().nonnegative(),
  tenantId: z.string(),
  workspaceId: z.string(),
  botId: z.string(),
  sessionId: z.string().optional(),
  goalId: z.string().optional(),
  taskId: z.string().optional(),
  wihId: z.string().optional(),
  runId: z.string().optional(),
  causationId: z.string().optional(),
  correlationId: z.string().optional(),
  eventType: z.string(),
  actor: z.object({
    type: z.enum(['user', 'bot', 'system', 'subagent']),
    id: z.string(),
  }),
  sensitivity: EventSensitivitySchema.default('internal'),
  visibility: z.enum(['all', 'operator', 'admin', 'audit_only']).default('all'),
  idempotencyKey: z.string().optional(),
  payload: z.record(z.unknown()),
  occurredAt: z.string(),
  recordedAt: z.string(),
});

// ============================================================================
// Routine Schemas
// ============================================================================

export const RoutineSchema = z.object({
  id: z.string(),
  botId: z.string(),
  name: z.string(),
  cron: z.string(),
  timezone: z.string().optional(),
  active: z.boolean(),
  nextRunAt: z.string().optional(),
});

export const CreateRoutineSchema = z.object({
  name: z.string().min(1).max(120),
  cron: z.string().min(1),
  timezone: z.string().optional(),
  active: z.boolean().default(true),
});

export const UpdateRoutineSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  cron: z.string().min(1).optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
});

// ============================================================================
// Run Schemas
// ============================================================================

export const RunStateSchema = z.enum([
  'queued',
  'leased',
  'running',
  'waiting_input',
  'waiting_takeover',
  'completed',
  'failed',
  'cancelled',
]);

export const RunSchema = z.object({
  id: z.string(),
  botId: z.string(),
  state: RunStateSchema,
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
  attemptCount: z.number().default(0),
});

// ============================================================================
// Goal, Plan, Task, Attempt, Validation Contracts (Wave 2)
// ============================================================================

export {
  GoalSchema,
  PlanSchema,
  TaskGraphSchema,
  TaskSchema,
  AttemptSchema,
  ValidationResultSchema,
  LoopPolicySchema,
  BudgetPolicySchema,
  BudgetUsageSchema,
  MilestoneSchema,
  ValidationCriterionSchema,
  TaskArtifactSchema,
  GoalStatusSchema,
  TaskStatusSchema,
  AttemptStatusSchema,
  ValidationVerdictSchema,
  PrioritySchema,
  LoopStrategySchema,
  DelegationSchema,
};

export type {
  Goal,
  Plan,
  TaskGraph,
  Task,
  Attempt,
  ValidationResult,
  LoopPolicy,
  BudgetPolicy,
  BudgetUsage,
  Milestone,
  ValidationCriterion,
  TaskArtifact,
  GoalStatus,
  TaskStatus,
  AttemptStatus,
  ValidationVerdict,
  Priority,
  LoopStrategy,
  Delegation,
};

// ============================================================================
// Pagination
// ============================================================================

export const PaginationParamsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().optional(),
    total: z.number().optional(),
  });

// ============================================================================
// Error Schema
// ============================================================================

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

// ============================================================================
// API Contract Definition
// ============================================================================

/**
 * Declarative contract mapping endpoint groups to their input/output schemas.
 * Each entry describes: method, path, input schema, and output schema.
 *
 * This is consumed by the oRPC client generator and documentation tools.
 */
export const apiContract = {
  // ── Bots ────────────────────────────────────────────────────────────────
  bots: {
    list: {
      method: 'GET' as const,
      path: '/api/bots',
      input: PaginationParamsSchema,
      output: PaginatedResponseSchema(BotSchema),
      description: 'List all bots with pagination',
    },
    get: {
      method: 'GET' as const,
      path: '/api/bots/:id',
      input: z.object({ id: z.string() }),
      output: BotSchema,
      description: 'Get a bot by ID',
    },
    create: {
      method: 'POST' as const,
      path: '/api/bots',
      input: CreateBotSchema,
      output: BotSchema,
      description: 'Create a new bot',
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/bots/:id',
      input: z.object({ id: z.string(), body: UpdateBotSchema }),
      output: BotSchema,
      description: 'Update an existing bot',
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/bots/:id',
      input: z.object({ id: z.string() }),
      output: z.object({ deleted: z.boolean() }),
      description: 'Delete a bot',
    },
    spawn: {
      method: 'POST' as const,
      path: '/api/bots/:parentId/spawn',
      input: z.object({ parentId: z.string(), body: CreateBotSchema }),
      output: BotSchema,
      description: 'Spawn a child bot from a parent',
    },
    getOperationalState: {
      method: 'GET' as const,
      path: '/api/bots/:id/operational-state',
      input: z.object({ id: z.string() }),
      output: BotOperationalStateSchema,
      description: 'Get the server-owned operational state projection for a bot',
    },
    rebuildProjection: {
      method: 'POST' as const,
      path: '/api/bots/:id/operational-state/rebuild',
      input: z.object({ id: z.string() }),
      output: BotOperationalStateSchema,
      description: 'Force-rebuild the operational state projection from the event history',
    },
  },

  // ── Routines ────────────────────────────────────────────────────────────

  routines: {
    list: {
      method: 'GET' as const,
      path: '/api/bots/:botId/routines',
      input: z.object({ botId: z.string() }),
      output: z.array(RoutineSchema),
      description: 'List all routines for a bot',
    },
    create: {
      method: 'POST' as const,
      path: '/api/bots/:botId/routines',
      input: z.object({ botId: z.string(), body: CreateRoutineSchema }),
      output: RoutineSchema,
      description: 'Create a routine for a bot',
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/bots/:botId/routines/:routineId',
      input: z.object({ botId: z.string(), routineId: z.string(), body: UpdateRoutineSchema }),
      output: RoutineSchema,
      description: 'Update a routine',
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/bots/:botId/routines/:routineId',
      input: z.object({ botId: z.string(), routineId: z.string() }),
      output: z.object({ deleted: z.boolean() }),
      description: 'Delete a routine',
    },
    trigger: {
      method: 'POST' as const,
      path: '/api/bots/:botId/routines/:routineId/trigger',
      input: z.object({ botId: z.string(), routineId: z.string() }),
      output: RunSchema,
      description: 'Manually trigger a routine',
    },
  },

  // ── Runs ────────────────────────────────────────────────────────────────
  runs: {
    list: {
      method: 'GET' as const,
      path: '/api/bots/:botId/runs',
      input: z.object({ botId: z.string(), ...PaginationParamsSchema.shape }),
      output: PaginatedResponseSchema(RunSchema),
      description: 'List runs for a bot',
    },
    get: {
      method: 'GET' as const,
      path: '/api/runs/:id',
      input: z.object({ id: z.string() }),
      output: RunSchema,
      description: 'Get a run by ID',
    },
    cancel: {
      method: 'POST' as const,
      path: '/api/runs/:id/cancel',
      input: z.object({ id: z.string() }),
      output: RunSchema,
      description: 'Cancel a running job',
    },
    retry: {
      method: 'POST' as const,
      path: '/api/runs/:id/retry',
      input: z.object({ id: z.string() }),
      output: RunSchema,
      description: 'Retry a failed run',
    },
  },

  // ── Goals ─────────────────────────────────────────────────────────────────
  goals: {
    list: {
      method: 'GET' as const,
      path: '/api/bots/:botId/goals',
      input: z.object({ botId: z.string(), ...PaginationParamsSchema.shape }),
      output: PaginatedResponseSchema(GoalSchema),
      description: 'List goals for a bot',
    },
    get: {
      method: 'GET' as const,
      path: '/api/bots/:botId/goals/:goalId',
      input: z.object({ botId: z.string(), goalId: z.string() }),
      output: GoalSchema,
      description: 'Get a goal by ID',
    },
    create: {
      method: 'POST' as const,
      path: '/api/bots/:botId/goals',
      input: z.object({
        botId: z.string(),
        body: z.object({
          objective: z.string().min(1),
          description: z.string().optional(),
          definitionOfDone: z.string().optional(),
          constraints: z.array(z.string()).optional(),
          milestones: z.array(MilestoneSchema).optional(),
          validationCriteria: z.array(ValidationCriterionSchema).optional(),
          priority: PrioritySchema.optional(),
          deadline: z.string().optional(),
          budget: BudgetPolicySchema.optional(),
        }),
      }),
      output: GoalSchema,
      description: 'Create a goal for a bot',
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/bots/:botId/goals/:goalId',
      input: z.object({ botId: z.string(), goalId: z.string(), body: GoalSchema.partial() }),
      output: GoalSchema,
      description: 'Update a goal',
    },
    cancel: {
      method: 'POST' as const,
      path: '/api/bots/:botId/goals/:goalId/cancel',
      input: z.object({ botId: z.string(), goalId: z.string() }),
      output: GoalSchema,
      description: 'Cancel a goal',
    },
  },

  // ── Plans ─────────────────────────────────────────────────────────────────
  plans: {
    get: {
      method: 'GET' as const,
      path: '/api/bots/:botId/goals/:goalId/plan',
      input: z.object({ botId: z.string(), goalId: z.string() }),
      output: PlanSchema,
      description: 'Get the accepted plan for a goal',
    },
    create: {
      method: 'POST' as const,
      path: '/api/bots/:botId/goals/:goalId/plan',
      input: z.object({
        botId: z.string(),
        goalId: z.string(),
        body: z.object({
          summary: z.string().min(1),
          taskGraph: TaskGraphSchema,
          rationale: z.string().optional(),
        }),
      }),
      output: PlanSchema,
      description: 'Create or replace a plan for a goal',
    },
    accept: {
      method: 'POST' as const,
      path: '/api/bots/:botId/goals/:goalId/plan/accept',
      input: z.object({ botId: z.string(), goalId: z.string(), acceptedBy: z.string() }),
      output: PlanSchema,
      description: 'Accept the current plan',
    },
    edit: {
      method: 'POST' as const,
      path: '/api/bots/:botId/goals/:goalId/plan/edit',
      input: z.object({
        botId: z.string(),
        goalId: z.string(),
        body: z.object({
          taskGraph: TaskGraphSchema,
          changeSummary: z.string(),
          editedBy: z.string(),
        }),
      }),
      output: PlanSchema,
      description: 'User-edit the accepted plan',
    },
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────
  tasks: {
    list: {
      method: 'GET' as const,
      path: '/api/bots/:botId/goals/:goalId/tasks',
      input: z.object({ botId: z.string(), goalId: z.string(), ...PaginationParamsSchema.shape }),
      output: PaginatedResponseSchema(TaskSchema),
      description: 'List tasks for a goal',
    },
    get: {
      method: 'GET' as const,
      path: '/api/bots/:botId/goals/:goalId/tasks/:taskId',
      input: z.object({ botId: z.string(), goalId: z.string(), taskId: z.string() }),
      output: TaskSchema,
      description: 'Get a task by ID',
    },
    update: {
      method: 'PATCH' as const,
      path: '/api/bots/:botId/goals/:goalId/tasks/:taskId',
      input: z.object({
        botId: z.string(),
        goalId: z.string(),
        taskId: z.string(),
        body: TaskSchema.partial(),
      }),
      output: TaskSchema,
      description: 'Update a task',
    },
    validate: {
      method: 'POST' as const,
      path: '/api/bots/:botId/goals/:goalId/tasks/:taskId/validate',
      input: z.object({
        botId: z.string(),
        goalId: z.string(),
        taskId: z.string(),
        body: z.object({ results: z.array(ValidationResultSchema) }),
      }),
      output: TaskSchema,
      description: 'Submit validation results for a task',
    },
  },

  // ── Attempts ──────────────────────────────────────────────────────────────
  attempts: {
    list: {
      method: 'GET' as const,
      path: '/api/bots/:botId/goals/:goalId/tasks/:taskId/attempts',
      input: z.object({ botId: z.string(), goalId: z.string(), taskId: z.string() }),
      output: z.array(AttemptSchema),
      description: 'List attempts for a task',
    },
    create: {
      method: 'POST' as const,
      path: '/api/bots/:botId/goals/:goalId/tasks/:taskId/attempts',
      input: z.object({ botId: z.string(), goalId: z.string(), taskId: z.string() }),
      output: AttemptSchema,
      description: 'Start a new attempt for a task',
    },
    get: {
      method: 'GET' as const,
      path: '/api/bots/:botId/goals/:goalId/tasks/:taskId/attempts/:attemptId',
      input: z.object({ botId: z.string(), goalId: z.string(), taskId: z.string(), attemptId: z.string() }),
      output: AttemptSchema,
      description: 'Get an attempt by ID',
    },
    cancel: {
      method: 'POST' as const,
      path: '/api/bots/:botId/goals/:goalId/tasks/:taskId/attempts/:attemptId/cancel',
      input: z.object({
        botId: z.string(),
        goalId: z.string(),
        taskId: z.string(),
        attemptId: z.string(),
        cancelledBy: z.string(),
      }),
      output: AttemptSchema,
      description: 'Cancel an attempt',
    },
  },

  // ── Validations ───────────────────────────────────────────────────────────
  validations: {
    list: {
      method: 'GET' as const,
      path: '/api/bots/:botId/goals/:goalId/tasks/:taskId/validations',
      input: z.object({ botId: z.string(), goalId: z.string(), taskId: z.string() }),
      output: z.array(ValidationResultSchema),
      description: 'List validation results for a task',
    },
  },

  // ── Delegations ───────────────────────────────────────────────────────────
  delegations: {
    list: {
      method: 'GET' as const,
      path: '/api/bots/:botId/delegations',
      input: z.object({ botId: z.string(), ...PaginationParamsSchema.shape }),
      output: PaginatedResponseSchema(DelegationSchema),
      description: 'List delegations for a bot',
    },
    create: {
      method: 'POST' as const,
      path: '/api/bots/:botId/delegations',
      input: z.object({
        botId: z.string(),
        body: DelegationSchema.omit({ id: true, createdAt: true }),
      }),
      output: DelegationSchema,
      description: 'Create a delegation request',
    },
    approve: {
      method: 'POST' as const,
      path: '/api/bots/:botId/delegations/:delegationId/approve',
      input: z.object({
        botId: z.string(),
        delegationId: z.string(),
        approvedBy: z.string(),
      }),
      output: DelegationSchema,
      description: 'Approve a delegation request',
    },
  },
} as const;

// ============================================================================
// Type Inference
// ============================================================================

export type AvatarType = z.infer<typeof AvatarTypeSchema>;
export type Avatar = z.infer<typeof AvatarSchema>;
export type BotCategory = z.infer<typeof BotCategorySchema>;
export type BotLifecycle = z.infer<typeof BotLifecycleSchema>;
export type BotProfile = z.infer<typeof BotProfileSchema>;
export type BotOperationalStatus = z.infer<typeof BotOperationalStatusSchema>;
export type BotOperationalState = z.infer<typeof BotOperationalStateSchema>;
export type CanonicalEventEnvelope = z.infer<typeof CanonicalEventEnvelopeSchema>;
export type Bot = z.infer<typeof BotSchema>;
export type CreateBotInput = z.infer<typeof CreateBotSchema>;
export type UpdateBotInput = z.infer<typeof UpdateBotSchema>;
export type Routine = z.infer<typeof RoutineSchema>;
export type CreateRoutineInput = z.infer<typeof CreateRoutineSchema>;
export type UpdateRoutineInput = z.infer<typeof UpdateRoutineSchema>;
export type RunState = z.infer<typeof RunStateSchema>;
export type Run = z.infer<typeof RunSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

// ============================================================================
// Contract Introspection Helpers
// ============================================================================

export type ContractGroup = keyof typeof apiContract;
export type ContractEndpoint<G extends ContractGroup> = keyof (typeof apiContract)[G];

export interface EndpointMeta {
  group: string;
  name: string;
  method: string;
  path: string;
  description: string;
}

/** Flatten the contract into a list of endpoint metadata entries */
export function listEndpoints(): EndpointMeta[] {
  const entries: EndpointMeta[] = [];
  for (const [group, endpoints] of Object.entries(apiContract)) {
    for (const [name, endpoint] of Object.entries(endpoints as Record<string, any>)) {
      entries.push({
        group,
        name,
        method: endpoint.method,
        path: endpoint.path,
        description: endpoint.description ?? '',
      });
    }
  }
  return entries;
}

/** Get endpoint meta for a specific group + name */
export function getEndpoint(group: ContractGroup, name: string): EndpointMeta | null {
  const endpoint = (apiContract as any)[group]?.[name];
  if (!endpoint) return null;
  return {
    group,
    name,
    method: endpoint.method,
    path: endpoint.path,
    description: endpoint.description ?? '',
  };
}
