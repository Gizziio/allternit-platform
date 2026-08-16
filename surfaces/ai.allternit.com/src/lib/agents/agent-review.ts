/**
 * Agent Review Engine — Nexus Nightly Review
 *
 * Consolidates bot checkpoints into a rolling TEAM_ALIGNMENT.md with conflict
 * detection and strict safety guardrails. This module is intentionally
 * stateless: it receives checkpoints, the previous alignment file, and returns
 * the next alignment file + notifications.
 *
 * Safety rule: the review engine NEVER mutates bot identity, memory, skills,
 * credentials, financial records, or another bot's files. It only writes the
 * TEAM_ALIGNMENT.md file and emits notifications.
 *
 * @module agent-review
 */

import type { AgentCheckpoint, CheckpointCollection } from './agent-checkpoint';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('AgentReview');

export interface TeamAlignment {
  generatedAt: string;
  sections: {
    aligned: AgentCheckpoint[];
    active: AgentCheckpoint[];
    blocked: AgentCheckpoint[];
    conflicts: AlignmentConflict[];
    stale: AgentCheckpoint[];
    pendingChanges: PendingChange[];
  };
}

export interface AlignmentConflict {
  taskId: string;
  reason:
    | 'different_owners'
    | 'different_status'
    | 'different_conclusions'
    | 'missing_evidence'
    | 'conflicting_facts'
    | 'sensitive_domain';
  description: string;
  sides: Array<{
    agentId: string;
    agentRole: string;
    result: string;
    status: string;
    evidence: string;
  }>;
}

export interface PendingChange {
  proposedBy: string;
  targetBotId: string;
  targetFile: string;
  description: string;
  evidence: string;
}

export interface ReviewResult {
  alignment: TeamAlignment;
  notifications: ReviewNotification[];
  wroteFile: boolean;
}

export interface ReviewNotification {
  severity: 'info' | 'warning' | 'alert';
  subject: string;
  body: string;
  checkpoint?: AgentCheckpoint;
  conflict?: AlignmentConflict;
  pendingChange?: PendingChange;
}

const PROHIBITED_ACTIONS = [
  'payment',
  'invoice',
  'refund',
  'credential',
  'password',
  'api key',
  'deploy',
  'git push',
  'production',
  'client message',
  'social media',
  'publish',
];

/**
 * Build a new TEAM_ALIGNMENT.md from checkpoints and the previous alignment.
 *
 * @param collection Checkpoints collected from active/blocked bots
 * @param previous Previous alignment (optional)
 */
export function buildTeamAlignment(
  collection: CheckpointCollection,
  previous?: TeamAlignment,
): ReviewResult {
  const { checkpoints } = collection;
  const notifications: ReviewNotification[] = [];

  const aligned: AgentCheckpoint[] = [];
  const active: AgentCheckpoint[] = [];
  const blocked: AgentCheckpoint[] = [];
  const stale: AgentCheckpoint[] = [];
  const conflicts: AlignmentConflict[] = [];
  const pendingChanges: PendingChange[] = [];

  // Group checkpoints by task id to detect conflicts
  const byTask = new Map<string, AgentCheckpoint[]>();
  for (const cp of checkpoints) {
    const list = byTask.get(cp.taskId) || [];
    list.push(cp);
    byTask.set(cp.taskId, list);
  }

  for (const [taskId, taskCheckpoints] of byTask.entries()) {
    const conflict = detectConflict(taskId, taskCheckpoints, previous);
    if (conflict) {
      conflicts.push(conflict);
      notifications.push({
        severity: 'alert',
        subject: `Conflict: ${taskId}`,
        body: conflict.description,
        conflict,
      });
      continue;
    }

    // No conflict — classify the single checkpoint
    const cp = taskCheckpoints[0];
    if (isSensitiveDomain(cp.result) || isSensitiveDomain(cp.nextStep)) {
      conflicts.push({
        taskId,
        reason: 'sensitive_domain',
        description: `Task ${taskId} involves a sensitive domain (money, permissions, clients, credentials, or confirmed decisions). Requires owner review.`,
        sides: [
          {
            agentId: cp.agentId,
            agentRole: cp.agentRole,
            result: cp.result,
            status: cp.status,
            evidence: cp.result,
          },
        ],
      });
      notifications.push({
        severity: 'alert',
        subject: `Sensitive task requires review: ${taskId}`,
        body: `Task ${taskId} touches a sensitive domain and must be reviewed by the owner.`,
      });
      continue;
    }

    if (cp.status === 'blocked') {
      blocked.push(cp);
      notifications.push({
        severity: 'warning',
        subject: `Blocked: ${cp.agentRole} — ${taskId}`,
        body: cp.blocker || 'No blocker description provided.',
        checkpoint: cp,
      });
    } else if (cp.status === 'stale' || isCheckpointStale(cp)) {
      stale.push(cp);
      notifications.push({
        severity: 'warning',
        subject: `Stale: ${cp.agentRole} — ${taskId}`,
        body: 'No progress for more than 48 hours.',
        checkpoint: cp,
      });
    } else if (cp.status === 'completed') {
      aligned.push(cp);
    } else {
      active.push(cp);
    }
  }

  const alignment: TeamAlignment = {
    generatedAt: new Date().toISOString(),
    sections: { aligned, active, blocked, conflicts, stale, pendingChanges },
  };

  // Only write a file if there is something to report
  const wroteFile =
    active.length > 0 || blocked.length > 0 || conflicts.length > 0 || stale.length > 0;

  if (!wroteFile) {
    logger.info('No active or blocked tasks; skipping TEAM_ALIGNMENT.md write');
  }

  return { alignment, notifications, wroteFile };
}

function detectConflict(
  taskId: string,
  checkpoints: AgentCheckpoint[],
  previous?: TeamAlignment,
): AlignmentConflict | undefined {
  if (checkpoints.length > 1) {
    const owners = new Set(checkpoints.map((c) => c.agentId));
    const statuses = new Set(checkpoints.map((c) => c.status));
    const conclusions = new Set(checkpoints.map((c) => c.result));

    if (owners.size > 1) {
      return {
        taskId,
        reason: 'different_owners',
        description: `Task ${taskId} has different owners across bots.`,
        sides: checkpoints.map((c) => ({
          agentId: c.agentId,
          agentRole: c.agentRole,
          result: c.result,
          status: c.status,
          evidence: c.result,
        })),
      };
    }

    if (statuses.size > 1) {
      return {
        taskId,
        reason: 'different_status',
        description: `Task ${taskId} has conflicting statuses across bots.`,
        sides: checkpoints.map((c) => ({
          agentId: c.agentId,
          agentRole: c.agentRole,
          result: c.result,
          status: c.status,
          evidence: c.result,
        })),
      };
    }

    if (conclusions.size > 1) {
      return {
        taskId,
        reason: 'different_conclusions',
        description: `Task ${taskId} has different conclusions across bots.`,
        sides: checkpoints.map((c) => ({
          agentId: c.agentId,
          agentRole: c.agentRole,
          result: c.result,
          status: c.status,
          evidence: c.result,
        })),
      };
    }
  }

  const cp = checkpoints[0];
  if (cp.status === 'completed' && !hasEvidence(cp.result)) {
    return {
      taskId,
      reason: 'missing_evidence',
      description: `Task ${taskId} is marked completed without verification evidence.`,
      sides: [
        {
          agentId: cp.agentId,
          agentRole: cp.agentRole,
          result: cp.result,
          status: cp.status,
          evidence: cp.result,
        },
      ],
    };
  }

  // Compare with previous alignment for fact drift
  const previousCp = previous
    ? Object.values(previous.sections)
        .flat()
        .find((item): item is AgentCheckpoint => 'taskId' in item && item.taskId === taskId)
    : undefined;

  if (previousCp && previousCp.status !== 'completed' && cp.status === 'completed') {
    if (!hasEvidence(cp.result)) {
      return {
        taskId,
        reason: 'missing_evidence',
        description: `Task ${taskId} moved to completed without evidence.`,
        sides: [
          {
            agentId: cp.agentId,
            agentRole: cp.agentRole,
            result: cp.result,
            status: cp.status,
            evidence: cp.result,
          },
        ],
      };
    }
  }

  return undefined;
}

function hasEvidence(result: string): boolean {
  if (!result || result.trim().length === 0) return false;
  // Evidence is a link, file path, commit hash, or explicit verification statement
  return (
    /https?:\/\//.test(result) ||
    /`[^`]+`/.test(result) ||
    /commit\s+[a-f0-9]{7,}/i.test(result) ||
    /verified|confirmed|tested|passed|evidence/i.test(result)
  );
}

function isSensitiveDomain(text: string): boolean {
  const lower = text.toLowerCase();
  return PROHIBITED_ACTIONS.some((phrase) => lower.includes(phrase));
}

function isCheckpointStale(checkpoint: AgentCheckpoint): boolean {
  const updated = new Date(checkpoint.updatedAt).getTime();
  return Date.now() - updated > 48 * 60 * 60 * 1000;
}

/**
 * Render TEAM_ALIGNMENT.md to Markdown.
 */
export function renderTeamAlignmentMarkdown(alignment: TeamAlignment): string {
  const { aligned, active, blocked, conflicts, stale, pendingChanges } = alignment.sections;

  const sections: string[] = [
    '# TEAM_ALIGNMENT.md',
    '',
    `Generated at: ${alignment.generatedAt}`,
    '',
    '## Aligned',
    aligned.length > 0 ? aligned.map(renderCheckpointList).join('\n') : '_No aligned tasks._',
    '',
    '## Active',
    active.length > 0 ? active.map(renderCheckpointList).join('\n') : '_No active tasks._',
    '',
    '## Blocked',
    blocked.length > 0 ? blocked.map(renderCheckpointList).join('\n') : '_No blocked tasks._',
    '',
    '## Conflicts',
    conflicts.length > 0
      ? conflicts
          .map(
            (c) =>
              `- **${c.taskId}** (${c.reason}): ${c.description}\n${c.sides
                .map((s) => `  - ${s.agentRole}: ${s.status} — ${s.evidence}`)
                .join('\n')}`,
          )
          .join('\n')
      : '_No conflicts._',
    '',
    '## Stale',
    stale.length > 0 ? stale.map(renderCheckpointList).join('\n') : '_No stale tasks._',
    '',
    '## Pending changes',
    pendingChanges.length > 0
      ? pendingChanges
          .map(
            (p) =>
              `- **${p.proposedBy}** proposes change to \`${p.targetFile}\` on ${p.targetBotId}: ${p.description}`,
          )
          .join('\n')
      : '_No pending changes._',
  ];

  return sections.join('\n') + '\n';
}

function renderCheckpointList(cp: AgentCheckpoint): string {
  return `- **${cp.agentRole}** — ${cp.taskId} (${cp.status}): ${cp.result}`;
}
