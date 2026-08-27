/**
 * Bot Operational State Projection Helpers
 *
 * Derives the canonical `BotOperationalState` from the goal-loop controller
 * state. This bridges Wave 2 runtime state into the server-owned operational
 * projection stored in `bot-operational-state.store.ts`.
 *
 * @module bot-operational-projection
 */

import { type BotOperationalState } from './orpc-contracts';
import { type GoalLoopState } from './goal-loop-controller';

/**
 * Map a goal-loop controller state to a partial BotOperationalState delta.
 * The caller (bot-operational-state.store.ts) merges this with the existing
 * projection and applies server-sourced fields such as `lastEventSequence`.
 */
export function projectOperationalStateFromGoalLoop(
  loopState: GoalLoopState,
): Partial<BotOperationalState> {
  const { goal, plan, tasks, status: loopStatus } = loopState;

  // Map loop controller status to BotOperationalStatus
  let status: BotOperationalState['status'];
  switch (loopStatus) {
    case 'running':
      status = 'working';
      break;
    case 'waiting_input':
      status = 'waiting_input';
      break;
    case 'waiting_approval':
      status = 'waiting_approval';
      break;
    case 'blocked':
      status = 'blocked';
      break;
    case 'completed':
      status = 'completed';
      break;
    case 'failed':
      status = 'failed';
      break;
    case 'cancelled':
      status = 'failed';
      break;
    case 'idle':
    default:
      status = 'idle';
      break;
  }

  // Find the active task (running or validating) for activity labeling
  const activeTask = Object.values(tasks).find(
    (t) => t.status === 'running' || t.status === 'validating',
  );

  // Pending approvals: tasks waiting for approval
  const pendingApprovalsCount = Object.values(tasks).filter(
    (t) => t.status === 'waiting_for_approval',
  ).length;

  // Count tasks needing user input
  const tasksWaitingInput = Object.values(tasks).filter(
    (t) => t.status === 'waiting_for_input',
  ).length;

  // If any task is waiting for input, operational status should reflect that
  // unless waiting_for_approval or blocked takes precedence.
  if (tasksWaitingInput > 0 && status === 'working') {
    status = 'waiting_input';
  }

  // Pending approvals dominate working and waiting_input per status precedence.
  if (pendingApprovalsCount > 0 && (status === 'working' || status === 'waiting_input')) {
    status = 'waiting_approval';
  }

  return {
    status,
    activeGoalId: goal.id,
    activeTaskId: activeTask?.id,
    activityLabel: activeTask ? activeTask.title : goal.objective,
    pendingApprovalsCount,
    updatedAt: new Date().toISOString(),
  };
}
