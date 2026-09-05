import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/integration/api-client';
import {
  listResourceClasses,
  createResource,
  getResource,
  terminateResource,
  getBillingSubscription,
  getCreditBalance,
  listCreditTransactions,
  createEnrollmentToken,
  listEnrollmentTokens,
  listFabricNodes,
  approveFabricNode,
  rejectFabricNode,
  listLocalCloudAccounts,
  listCloudInferenceKeys,
  saveLocalCloudAccount,
} from './cloud-console-api';
import { cloudApiFetch } from '@/lib/cloud-api';

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

vi.mock('@/lib/cloud-api', () => ({
  cloudApiFetch: vi.fn(),
  allternitCloudOrigin: () => 'https://api.allternit.com',
}));

vi.mock('@/lib/agents/api-config', () => ({
  buildAuthHeaders: vi.fn(async () => ({})),
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

  it('getBillingSubscription reads the live Free/Plus/Super/Ultra plan', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ plan_id: 'ultra', label: 'Ultra', plan_tier: 'team', status: 'active' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const result = await getBillingSubscription();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.allternit.com/api/v1/billing/subscription',
    );
    expect(result).toEqual({
      plan_id: 'ultra',
      label: 'Ultra',
      plan_tier: 'team',
      status: 'active',
    });
    vi.unstubAllGlobals();
  });

  it('getCreditBalance maps Allternit subscription usage to credit balance', async () => {
    mockApi.get.mockResolvedValue({ plan: 'plus', label: 'Plus', credits: 10.5, monthToDateUsageUsd: 1.25 });
    const result = await getCreditBalance();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/me/usage');
    expect(result.balance_cents).toBe(1050);
    expect(result.planLabel).toBe('Plus');
  });

  it('listCreditTransactions maps Allternit subscription ledger entries', async () => {
    mockApi.get.mockResolvedValue({
      plan: 'plus',
      recentTransactions: [{ source: 'grant', amountUsd: 22, createdAt: '2026-01-01T00:00:00Z' }],
    });
    const result = await listCreditTransactions();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/me/usage');
    expect(result[0].transaction_type).toBe('grant');
    expect(result[0].amount_cents).toBe(2200);
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

  it('listLocalCloudAccounts returns API-key providers from the local kernel', async () => {
    mockApi.get.mockResolvedValue({
      providers: [
        { provider_id: 'openai', status: 'ok', authenticated: true, details: { provider_type: 'api', model_count: 12, api_key_set: true } },
        { provider_id: 'groq', status: 'missing', authenticated: false, details: { provider_type: 'api', api_key_set: false } },
        { provider_id: 'claude-cli', status: 'missing', authenticated: false, details: { provider_type: 'subprocess' } },
        { provider_id: 'ollama', status: 'ok', authenticated: true, details: { provider_type: 'local' } },
      ],
    });
    const accounts = await listLocalCloudAccounts();
    expect(mockApi.get).toHaveBeenCalledWith('/api/v1/providers/auth/status');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].provider_id).toBe('openai');
    expect(accounts[0].source).toBe('local');
  });

  it('listCloudInferenceKeys fail-softs device-token 401 instead of throwing', async () => {
    vi.mocked(cloudApiFetch).mockResolvedValue(new Response('{}', { status: 401 }));
    const result = await listCloudInferenceKeys();
    expect(result.error).toBe('cloud_auth_required');
    expect(result.keys).toEqual([]);
  });

  it('saveLocalCloudAccount posts the key to the local onboarding route', async () => {
    mockApi.post.mockResolvedValue({ success: true, provider: 'openai' });
    const result = await saveLocalCloudAccount('openai', 'sk-test');
    expect(mockApi.post).toHaveBeenCalledWith('/api/v1/onboarding/provider', {
      provider: 'openai',
      name: 'openai',
      apiKey: 'sk-test',
      authType: 'api_key',
      setDefault: false,
    });
    expect(result.success).toBe(true);
  });
});
