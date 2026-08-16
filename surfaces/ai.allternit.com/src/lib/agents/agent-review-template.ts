/**
 * Nexus Nightly Review Template
 *
 * A ready-to-use HEARTBEAT task that consolidates team state every night.
 * Add this task to a bot's HEARTBEAT.md (or automation routine) and the
 * executor will run the review engine.
 *
 * @module agent-review-template
 */

import type { HeartbeatTask } from './agent-heartbeat-executor';

export const NEXUS_NIGHTLY_REVIEW_TASK: HeartbeatTask = {
  id: 'nexus_nightly_review',
  frequency: 'daily',
  action: 'Run Nexus Nightly Review: consolidate bot checkpoints into TEAM_ALIGNMENT.md',
  description:
    'Collects checkpoints from active/blocked bots, compares with previous TEAM_ALIGNMENT.md, overwrites only that file, and flags conflicts for owner review.',
  notify: 'on_failure',
  autoApprove: false,
};

export const NEXUS_NIGHTLY_REVIEW_CRON = '20 3 * * *';
export const NEXUS_NIGHTLY_REVIEW_TIMEZONE = 'Europe/London';

export function createNexusNightlyReviewTask(overrides?: Partial<HeartbeatTask>): HeartbeatTask {
  return {
    ...NEXUS_NIGHTLY_REVIEW_TASK,
    ...overrides,
  };
}
