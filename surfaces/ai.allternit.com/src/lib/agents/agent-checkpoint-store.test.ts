import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentCheckpointStore } from './agent-checkpoint-store';
import type { AgentCheckpoint } from './agent-checkpoint';

function makeCheckpoint(overrides: Partial<AgentCheckpoint> = {}): AgentCheckpoint {
  return {
    agentId: 'bot-a',
    agentRole: 'Builder',
    taskId: 'task-1',
    status: 'active',
    result: 'Working',
    nextStep: 'Finish',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('agent-checkpoint-store', () => {
  beforeEach(() => {
    useAgentCheckpointStore.getState().reset();
  });

  it('stores and updates checkpoints', () => {
    useAgentCheckpointStore.getState().setCheckpoint(makeCheckpoint());
    expect(useAgentCheckpointStore.getState().checkpoints).toHaveLength(1);

    useAgentCheckpointStore.getState().setCheckpoint(makeCheckpoint({ result: 'Updated' }));
    expect(useAgentCheckpointStore.getState().checkpoints).toHaveLength(1);
    expect(useAgentCheckpointStore.getState().checkpoints[0].result).toBe('Updated');
  });

  it('returns checkpoints for an agent', () => {
    useAgentCheckpointStore.getState().setCheckpoint(makeCheckpoint());
    useAgentCheckpointStore.getState().setCheckpoint(makeCheckpoint({ agentId: 'bot-b', taskId: 'task-2' }));

    expect(useAgentCheckpointStore.getState().getCheckpointsForAgent('bot-a')).toHaveLength(1);
    expect(useAgentCheckpointStore.getState().getCheckpointsForAgent('bot-b')).toHaveLength(1);
  });

  it('builds a collection of active or blocked checkpoints', () => {
    useAgentCheckpointStore.getState().setCheckpoint(makeCheckpoint());
    useAgentCheckpointStore.getState().setCheckpoint(makeCheckpoint({ taskId: 'task-2', status: 'blocked' }));
    useAgentCheckpointStore.getState().setCheckpoint(makeCheckpoint({ taskId: 'task-3', status: 'completed' }));

    const collection = useAgentCheckpointStore.getState().buildCollection();
    expect(collection.checkpoints).toHaveLength(2);
    expect(collection.participatingAgentIds).toEqual(['bot-a']);
  });
});
