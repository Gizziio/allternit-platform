/**
 * Goal Loop Persistence
 *
 * Bridges the goal-loop controller to the durable bot event store. A recorder
 * subscribes to controller events and appends them; it also emits periodic
 * snapshots so the loop can be resumed after a page reload or process restart.
 * The reducer rebuilds the latest `GoalLoopState` from the stored event history.
 *
 * @module goal-loop-persistence
 */

import { createModuleLogger } from '@/lib/logger';
import {
  GoalSchema,
  PlanSchema,
  TaskGraphSchema,
  TaskSchema,
  AttemptSchema,
  ValidationResultSchema,
  LoopPolicySchema,
  type Goal,
  type Plan,
  type Task,
  type Attempt,
  type ValidationResult,
  type LoopPolicy,
} from './goal-task-contracts';
import {
  GoalLoopController,
  type GoalLoopState,
  type GoalLoopEvent,
  type TaskRunner,
  GoalLoopStateSchema,
} from './goal-loop-controller';
import {
  type BotEventStore,
  type StoredGoalEvent,
  type StoredEventType,
  createMemoryBotEventStore,
} from './bot-event-store';

const logger = createModuleLogger('GoalLoopPersistence');

// ============================================================================
// Recorder
// ============================================================================

export interface GoalLoopRecorderOptions {
  botId: string;
  goalId: string;
  eventStore: BotEventStore;
  /** Emit a `loop.snapshot` event after every transition for easy recovery. */
  snapshotEveryEvent?: boolean;
}

/**
 * Subscribes to a GoalLoopController and durably records its events. Each stored
 * event carries a monotonic sequence within the bot:goal aggregate.
 */
export class GoalLoopRecorder {
  private eventStore: BotEventStore;
  private botId: string;
  private goalId: string;
  private nextSequence: number;
  private snapshotEveryEvent: boolean;
  private unsubscribe?: () => void;

  constructor(options: GoalLoopRecorderOptions) {
    this.botId = options.botId;
    this.goalId = options.goalId;
    this.eventStore = options.eventStore;
    this.snapshotEveryEvent = options.snapshotEveryEvent ?? true;
    this.nextSequence = this.computeNextSequence();
  }

  private computeNextSequence(): number {
    const events = this.eventStore.readEvents(this.botId, this.goalId);
    if (events.length === 0) return 1;
    return (events[events.length - 1]?.sequence ?? 0) + 1;
  }

  /** Start recording events from the controller. */
  attach(controller: GoalLoopController): void {
    this.unsubscribe = controller.onEvent((event) => {
      this.record(event);
      if (this.snapshotEveryEvent) {
        this.recordSnapshot(controller.getState());
      }
    });
  }

  /** Stop recording. */
  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private record(event: GoalLoopEvent): void {
    const stored: StoredGoalEvent = {
      sequence: this.nextSequence++,
      botId: this.botId,
      goalId: this.goalId,
      type: event.type as StoredEventType,
      payload: event.payload,
      occurredAt: event.occurredAt,
    };
    this.eventStore.append(stored);
  }

  private recordSnapshot(state: GoalLoopState): void {
    const stored: StoredGoalEvent = {
      sequence: this.nextSequence++,
      botId: this.botId,
      goalId: this.goalId,
      type: 'loop.snapshot',
      payload: state,
      occurredAt: new Date().toISOString(),
    };
    this.eventStore.append(stored);
  }

  /** Clear the recorded history for this goal. */
  clear(): void {
    this.eventStore.clear(this.botId, this.goalId);
    this.nextSequence = 1;
  }
}

// ============================================================================
// Reducer / resume
// ============================================================================

function emptyState(botId: string, goal: Goal, loopPolicy: LoopPolicy): GoalLoopState {
  return {
    botId,
    goal,
    plan: null,
    tasks: {},
    attempts: {},
    validations: {},
    loopPolicy,
    iteration: 0,
    status: 'idle',
  };
}

function applyEvent(state: GoalLoopState, event: StoredGoalEvent): void {
  try {
    switch (event.type) {
      case 'loop.snapshot': {
        const snapshot = GoalLoopStateSchema.parse(event.payload);
        Object.assign(state, snapshot);
        break;
      }

      case 'goal.created':
      case 'goal.activated':
      case 'goal.updated':
      case 'goal.blocked':
      case 'goal.validating':
      case 'goal.completed':
      case 'goal.failed':
      case 'goal.cancelled': {
        state.goal = GoalSchema.parse(event.payload);
        break;
      }

      case 'plan.created':
      case 'plan.accepted': {
        const payload = event.payload as { plan?: unknown } | Plan;
        const planRaw = 'plan' in payload ? payload.plan : payload;
        state.plan = PlanSchema.parse(planRaw);
        break;
      }

      case 'plan.user_edited': {
        const payload = event.payload as { plan?: unknown };
        if (payload.plan) {
          state.plan = PlanSchema.parse(payload.plan);
        }
        break;
      }

      case 'plan.task_graph_updated': {
        const payload = event.payload as { taskGraph?: unknown; plan?: Plan };
        if (state.plan && payload.taskGraph) {
          state.plan = { ...state.plan, taskGraph: TaskGraphSchema.parse(payload.taskGraph) };
        }
        break;
      }

      case 'task.created':
      case 'task.ready':
      case 'task.running':
      case 'task.waiting_for_input':
      case 'task.waiting_for_approval':
      case 'task.validating':
      case 'task.completed':
      case 'task.failed':
      case 'task.cancelled': {
        const task = TaskSchema.parse(event.payload);
        state.tasks[task.id] = task;
        break;
      }

      case 'attempt.started':
      case 'attempt.checkpointed':
      case 'attempt.retried':
      case 'attempt.timed_out':
      case 'attempt.cancelled':
      case 'attempt.completed':
      case 'attempt.failed': {
        const attempt = AttemptSchema.parse(event.payload);
        const list = state.attempts[attempt.taskId] ?? [];
        const idx = list.findIndex((a) => a.id === attempt.id);
        if (idx >= 0) {
          list[idx] = attempt;
        } else {
          list.push(attempt);
        }
        state.attempts[attempt.taskId] = list;
        break;
      }

      case 'validation.started':
      case 'validation.result_recorded':
      case 'validation.completed': {
        const result = ValidationResultSchema.parse(event.payload);
        const list = state.validations[result.taskId] ?? [];
        const idx = list.findIndex((r) => r.id === result.id);
        if (idx >= 0) {
          list[idx] = result;
        } else {
          list.push(result);
        }
        state.validations[result.taskId] = list;
        break;
      }

      case 'delegation.requested':
      case 'delegation.approved':
      case 'delegation.rejected':
      case 'delegation.completed': {
        // Delegations do not yet affect GoalLoopState; recorded for audit.
        break;
      }

      default: {
        // Exhaustiveness check; unknown event types are ignored.
        const _exhaustive: never = event.type;
        logger.warn({ type: _exhaustive }, 'Unhandled event type during replay');
      }
    }
  } catch (err) {
    logger.warn({ err, type: event.type, seq: event.sequence }, 'Failed to apply event during replay');
  }
}

/**
 * Rebuild the latest GoalLoopState from a goal's stored event history.
 * The latest `loop.snapshot` event provides a base; subsequent transition
 * events are applied on top.
 */
export function rebuildGoalLoopState(events: StoredGoalEvent[]): GoalLoopState | null {
  if (events.length === 0) return null;

  // Sort by sequence, then timestamp for safety.
  const sorted = [...events].sort(
    (a, b) => a.sequence - b.sequence || a.occurredAt.localeCompare(b.occurredAt),
  );

  // Find the latest snapshot; if none, derive an empty state from the first
  // goal event and replay everything from the beginning.
  let snapshotIndex = -1;
  let state: GoalLoopState | null = null;

  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i]?.type === 'loop.snapshot') {
      state = GoalLoopStateSchema.parse(sorted[i]?.payload);
      snapshotIndex = i;
      break;
    }
  }

  if (!state) {
    const firstGoal = sorted.find((e) => e.type.startsWith('goal.'));
    if (!firstGoal) return null;
    const goal = GoalSchema.parse(firstGoal.payload);
    // Loop policy may appear later in a snapshot; default until then.
    state = emptyState(firstGoal.botId, goal, LoopPolicySchema.parse({ strategy: 'plan_execute_review' }));
    snapshotIndex = -1;
  }

  for (let i = snapshotIndex + 1; i < sorted.length; i++) {
    const event = sorted[i];
    if (!event) continue;
    applyEvent(state, event);
  }

  return state;
}

/**
 * Resume a controller for a bot:goal aggregate from the event store.
 * Returns null if no event history exists.
 */
export function resumeGoalLoopController(
  botId: string,
  goalId: string,
  taskRunner: TaskRunner,
  eventStore: BotEventStore = createMemoryBotEventStore(),
): GoalLoopController | null {
  const events = eventStore.readEvents(botId, goalId);
  const state = rebuildGoalLoopState(events);
  if (!state) return null;
  return GoalLoopController.resume(taskRunner, state);
}
