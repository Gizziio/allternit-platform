/**
 * Agent Checkpoint Primitive
 *
 * A checkpoint is a structured status report emitted by a bot/agent. It is the
 * raw material consumed by the nightly review to produce TEAM_ALIGNMENT.md.
 *
 * @module agent-checkpoint
 */

export type CheckpointStatus = 'active' | 'blocked' | 'completed' | 'stale';

export interface AgentCheckpoint {
  /** Bot / agent id that produced the checkpoint */
  agentId: string;
  /** Human-readable bot role/name */
  agentRole: string;
  /** Task id this checkpoint refers to */
  taskId: string;
  /** Current status of the task */
  status: CheckpointStatus;
  /** Latest result + evidence (links, files, verification steps) */
  result: string;
  /** Next concrete step */
  nextStep: string;
  /** Blocker, if status is blocked or stale */
  blocker?: string;
  /** ISO timestamp of the last update */
  updatedAt: string;
}

export interface CheckpointCollection {
  /** Checkpoints gathered in this review cycle */
  checkpoints: AgentCheckpoint[];
  /** Agents that were active or working in the review window */
  participatingAgentIds: string[];
  /** ISO timestamp when the collection was assembled */
  collectedAt: string;
}

export function makeCheckpointId(agentId: string, taskId: string): string {
  return `checkpoint:${agentId}:${taskId}`;
}

export function isCheckpointStale(checkpoint: AgentCheckpoint, staleThresholdMs = 48 * 60 * 60 * 1000): boolean {
  const updated = new Date(checkpoint.updatedAt).getTime();
  return Date.now() - updated > staleThresholdMs;
}

export function formatCheckpoint(checkpoint: AgentCheckpoint): string {
  const lines = [
    `## ${checkpoint.agentRole} (${checkpoint.agentId})`,
    '',
    `- **Task ID:** ${checkpoint.taskId}`,
    `- **Status:** ${checkpoint.status}`,
    `- **Updated at:** ${checkpoint.updatedAt}`,
    `- **Latest result:** ${checkpoint.result}`,
    `- **Next step:** ${checkpoint.nextStep}`,
  ];

  if (checkpoint.blocker) {
    lines.push(`- **Blocker:** ${checkpoint.blocker}`);
  }

  return lines.join('\n');
}
