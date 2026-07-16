// BYOC (Bring Your Own Cloud) credential client.
//
// Talks to the org-scoped cloud-credentials API at /api/v1/cloud-credentials
// (cmd/allternit-api/src/cloud_credentials_routes.rs). Enterprise customers
// connect their own AWS/GCP/Azure account here so ACU sandboxes provision
// into the customer's cloud instead of allternit's. Mirrors
// owned-connector.ts's shape: plain fetch, no generated client.
//
// testCloudCredential is different: it validates a not-yet-saved secret
// (still sitting in the add-credential form) live against the real
// AWS/GCP/Azure API, so it talks directly to the Python ACU gateway
// (core/cloud_provisioning.py's validate_credential, via
// gateway/cloud_credentials_router.py) rather than the Rust API -- the same
// direct-to-gateway pattern computer-use-engine.ts already uses.

import { getPlatformComputerUseBaseUrl } from '@/integration/computer-use-engine';

export type CloudProvider = 'aws' | 'gcp' | 'azure';

export interface CloudCredential {
  id: string;
  provider: CloudProvider;
  label: string;
  region?: string | null;
  external_id?: string | null;
  status: 'active' | 'revoked' | 'error';
  last_validated_at?: string | null;
  created_at: string;
}

export interface CreateCloudCredentialInput {
  provider: CloudProvider;
  label: string;
  region?: string;
  external_id?: string;
  /** Provider-shaped secret payload -- e.g. { role_arn: "..." } for AWS,
   * { service_account_json: {...} } for GCP, { client_secret: "..." } for
   * Azure. Sealed server-side before storage; never persisted client-side. */
  secret: Record<string, unknown>;
}

const BASE = '/api/v1/cloud-credentials';

async function parseOrThrow<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data && (data.message || data.error)) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function listCloudCredentials(): Promise<CloudCredential[]> {
  const res = await fetch(BASE);
  const data = await parseOrThrow<{ cloud_credentials: CloudCredential[] }>(res);
  return data.cloud_credentials ?? [];
}

export async function createCloudCredential(input: CreateCloudCredentialInput): Promise<CloudCredential> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow<CloudCredential>(res);
}

export async function revokeCloudCredential(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    await parseOrThrow(res);
  }
}

export interface TestCloudCredentialInput {
  provider: CloudProvider;
  region?: string;
  external_id?: string;
  secret: Record<string, unknown>;
}

export interface TestCloudCredentialResult {
  success: boolean;
  message: string;
  identity?: Record<string, unknown> | null;
}

/** Live-validates a not-yet-saved credential directly against the real cloud
 * provider (STS AssumeRole+GetCallerIdentity / GCP token mint / Azure token
 * acquisition) via the local ACU gateway. Never touches the Rust API or the
 * database -- nothing is persisted by this call. */
export async function testCloudCredential(input: TestCloudCredentialInput): Promise<TestCloudCredentialResult> {
  const gatewayBase = getPlatformComputerUseBaseUrl();
  const res = await fetch(`${gatewayBase}/v1/cloud-credentials/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parseOrThrow<TestCloudCredentialResult>(res);
}
