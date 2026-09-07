import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/integration/api-client';
import {
  provisionAgentRuntime,
  terminateAgentRuntime,
  type AgentRuntimeProvisionResponse,
} from './agent-cloud-api';

vi.mock('@/integration/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApi = vi.mocked(api);

function makeProvisionResponse(
  overrides: Partial<AgentRuntimeProvisionResponse> = {},
): AgentRuntimeProvisionResponse {
  return {
    agent_id: 'agent-1',
    resource_id: 'resource-1',
    provider_kind: 'fake',
    provider_resource_id: 'fake-123',
    region: 'us-east',
    instance_type: 'small',
    ipv4: '10.0.0.1',
    endpoint: null,
    status: 'active',
    runtime_status: 'active',
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('agent-cloud-api', () => {
  it('provisionAgentRuntime posts to the runtime provision endpoint', async () => {
    mockApi.post.mockResolvedValue(makeProvisionResponse());

    const result = await provisionAgentRuntime('agent-1', { class: 's' });

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/agents/agent-1/runtime/provision',
      { class: 's' },
    );
    expect(result.agent_id).toBe('agent-1');
    expect(result.runtime_status).toBe('active');
  });

  it('provisionAgentRuntime encodes the agent id', async () => {
    mockApi.post.mockResolvedValue(makeProvisionResponse());

    await provisionAgentRuntime('agent/with spaces', {});

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/agents/agent%2Fwith%20spaces/runtime/provision',
      {},
    );
  });

  it('terminateAgentRuntime posts to the runtime terminate endpoint', async () => {
    mockApi.post.mockResolvedValue({ agent_id: 'agent-1', status: 'terminated' });

    const result = await terminateAgentRuntime('agent-1');

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/agents/agent-1/runtime/terminate',
      {},
    );
    expect(result.status).toBe('terminated');
  });
});
