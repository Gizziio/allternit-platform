import { describe, it, expect } from 'vitest';
import { buildTeamAlignment, renderTeamAlignmentMarkdown } from './agent-review';
import type { AgentCheckpoint, CheckpointCollection } from './agent-checkpoint';

function makeCheckpoint(overrides: Partial<AgentCheckpoint> = {}): AgentCheckpoint {
  return {
    agentId: 'bot-a',
    agentRole: 'Builder',
    taskId: 'task-1',
    status: 'active',
    result: 'Implemented login flow. Verified at https://ci.example.com/123',
    nextStep: 'Add OAuth provider',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('agent-review', () => {
  it('skips writing when no active or blocked checkpoints exist', () => {
    const collection: CheckpointCollection = {
      checkpoints: [],
      participatingAgentIds: [],
      collectedAt: new Date().toISOString(),
    };

    const result = buildTeamAlignment(collection);
    expect(result.wroteFile).toBe(false);
    expect(result.notifications).toHaveLength(0);
  });

  it('classifies active checkpoints', () => {
    const collection: CheckpointCollection = {
      checkpoints: [makeCheckpoint()],
      participatingAgentIds: ['bot-a'],
      collectedAt: new Date().toISOString(),
    };

    const result = buildTeamAlignment(collection);
    expect(result.alignment.sections.active).toHaveLength(1);
    expect(result.wroteFile).toBe(true);
  });

  it('flags blocked checkpoints and emits notifications', () => {
    const collection: CheckpointCollection = {
      checkpoints: [
        makeCheckpoint({
          status: 'blocked',
          blocker: 'Missing API credentials',
        }),
      ],
      participatingAgentIds: ['bot-a'],
      collectedAt: new Date().toISOString(),
    };

    const result = buildTeamAlignment(collection);
    expect(result.alignment.sections.blocked).toHaveLength(1);
    expect(result.notifications.some((n) => n.severity === 'warning')).toBe(true);
  });

  it('detects conflicting owners for the same task', () => {
    const collection: CheckpointCollection = {
      checkpoints: [
        makeCheckpoint({ agentId: 'bot-a', agentRole: 'Builder' }),
        makeCheckpoint({ agentId: 'bot-b', agentRole: 'Validator' }),
      ],
      participatingAgentIds: ['bot-a', 'bot-b'],
      collectedAt: new Date().toISOString(),
    };

    const result = buildTeamAlignment(collection);
    expect(result.alignment.sections.conflicts).toHaveLength(1);
    expect(result.alignment.sections.conflicts[0].reason).toBe('different_owners');
    expect(result.notifications.some((n) => n.severity === 'alert')).toBe(true);
  });

  it('flags completion without evidence', () => {
    const collection: CheckpointCollection = {
      checkpoints: [
        makeCheckpoint({
          status: 'completed',
          result: 'Done',
        }),
      ],
      participatingAgentIds: ['bot-a'],
      collectedAt: new Date().toISOString(),
    };

    const result = buildTeamAlignment(collection);
    expect(result.alignment.sections.conflicts).toHaveLength(1);
    expect(result.alignment.sections.conflicts[0].reason).toBe('missing_evidence');
  });

  it('flags sensitive domains for owner review', () => {
    const collection: CheckpointCollection = {
      checkpoints: [
        makeCheckpoint({
          result: 'Processed client payment of $500',
          nextStep: 'Send invoice',
        }),
      ],
      participatingAgentIds: ['bot-a'],
      collectedAt: new Date().toISOString(),
    };

    const result = buildTeamAlignment(collection);
    expect(result.alignment.sections.conflicts).toHaveLength(1);
    expect(result.alignment.sections.conflicts[0].reason).toBe('sensitive_domain');
  });

  it('renders TEAM_ALIGNMENT.md markdown', () => {
    const collection: CheckpointCollection = {
      checkpoints: [makeCheckpoint()],
      participatingAgentIds: ['bot-a'],
      collectedAt: new Date().toISOString(),
    };

    const { alignment } = buildTeamAlignment(collection);
    const markdown = renderTeamAlignmentMarkdown(alignment);
    expect(markdown).toContain('# TEAM_ALIGNMENT.md');
    expect(markdown).toContain('## Active');
    expect(markdown).toContain('Builder');
  });
});
