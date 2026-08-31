import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/integration/api-client';
import {
  listResourceClasses,
  createResource,
  getResource,
  terminateResource,
  getCreditBalance,
  listCreditTransactions,
  createEnrollmentToken,
  listEnrollmentTokens,
  listFabricNodes,
  approveFabricNode,
  rejectFabricNode,
} from './cloud-console-api';

vi.mock('@/integration/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  AllternitApiError: class AllternitApiError extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = 'AllternitApiError';
    }
  },
}));

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.resetAllMocks();
});

describe('cloud-console-api', () => {
  it('listResourceClasses calls /api/v1/fabric/resource-classes', async () => {
    mockApi.get.mockResolvedValue({
      classes: [{ id: 'compute.s', kind: 'compute', class: 's', display_name: 'Compute S', vcpu: 1, memory_mib: 2048, gpu_vram_mib: 0, reliability_tier: 'standard', retail_price_per_hour_cents: 5 }],
    });
    const classes = await listResourceClasses();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/fabric/resource-classes');
    expect(classes).toHaveLength(1);
    expect(classes[0].class).toBe('s');
  });

  it('createResource posts to /api/v1/fabric/resources', async () => {
    mockApi.post.mockResolvedValue({ resource_id: 'r-1', provider_kind: 'fake', provider_resource_id: 'fake-1', region: 'us-east', instance_type: 'small', ipv4: null, endpoint: null, status: 'active' });
    const result = await createResource({ class: 's', display_name: 'test' });
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/fabric/resources', { class: 's', display_name: 'test' });
    expect(result.resource_id).toBe('r-1');
  });

  it('getResource calls resource endpoint', async () => {
    mockApi.get.mockResolvedValue({ id: 'r-1', status: 'active' });
    const result = await getResource('r-1');
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/fabric/resources/r-1');
    expect(result.status).toBe('active');
  });

  it('terminateResource posts terminate endpoint', async () => {
    mockApi.post.mockResolvedValue({ id: 'r-1', status: 'terminated' });
    const result = await terminateResource('r-1');
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/fabric/resources/r-1/terminate');
    expect(result.status).toBe('terminated');
  });

  it('getCreditBalance calls /api/v1/credits/balance', async () => {
    mockApi.get.mockResolvedValue({ organization_id: 'org-1', balance_cents: 5000, currency: 'USD' });
    const result = await getCreditBalance();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/credits/balance');
    expect(result.balance_cents).toBe(5000);
  });

  it('listCreditTransactions calls /api/v1/credits/transactions', async () => {
    mockApi.get.mockResolvedValue({ transactions: [{ id: 't-1', organization_id: 'org-1', transaction_type: 'purchase', amount_cents: 5000, currency: 'USD', reference_id: null, idempotency_key: null, created_at: '2026-01-01T00:00:00Z' }] });
    const result = await listCreditTransactions();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/credits/transactions');
    expect(result[0].transaction_type).toBe('purchase');
  });

  it('createEnrollmentToken posts admin endpoint', async () => {
    mockApi.post.mockResolvedValue({ id: 'tok-1', organization_id: 'org-1', display_name: 'rig', status: 'pending', token: 'plain-token', node_id: null, created_at: '2026-01-01T00:00:00Z', used_at: null });
    const result = await createEnrollmentToken('rig');
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/admin/fabric/nodes/enrollment-token', { display_name: 'rig' });
    expect(result.token).toBe('plain-token');
  });

  it('listEnrollmentTokens calls admin endpoint', async () => {
    mockApi.get.mockResolvedValue({ tokens: [{ id: 'tok-1', organization_id: 'org-1', display_name: null, status: 'pending', node_id: null, created_at: '2026-01-01T00:00:00Z', used_at: null }] });
    const result = await listEnrollmentTokens();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/admin/fabric/nodes/enrollment-tokens');
    expect(result[0].status).toBe('pending');
  });

  it('listFabricNodes calls /api/v1/admin/fabric/nodes', async () => {
    mockApi.get.mockResolvedValue({ nodes: [{ id: 'n-1', organization_id: 'org-1', display_name: 'node-1', status: 'pending', region: 'us-east', labels: {}, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', approved_at: null, last_heartbeat_at: null }] });
    const result = await listFabricNodes();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/admin/fabric/nodes');
    expect(result[0].status).toBe('pending');
  });

  it('approveFabricNode posts approve endpoint', async () => {
    mockApi.post.mockResolvedValue({ id: 'n-1', status: 'active' });
    const result = await approveFabricNode('n-1');
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/admin/fabric/nodes/n-1/approve');
    expect(result.status).toBe('active');
  });

  it('rejectFabricNode posts reject endpoint', async () => {
    mockApi.post.mockResolvedValue({ id: 'n-1', status: 'rejected' });
    const result = await rejectFabricNode('n-1');
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/admin/fabric/nodes/n-1/reject');
    expect(result.status).toBe('rejected');
  });
});
