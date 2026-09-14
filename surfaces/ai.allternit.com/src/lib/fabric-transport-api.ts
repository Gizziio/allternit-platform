/**
 * Fabric Transport control-surface client (A:// conformance, §17 control list).
 *
 * Talks to the local allternit-api `/api/v1` surface with the platform user
 * token. Worker bearer auth is never used here — human decisions and control
 * observation go through normal user auth.
 */

import { GATEWAY_BASE_URL } from '@/integration/api-client';

const BASE = `${String(GATEWAY_BASE_URL || '').replace(/\/+$/, '')}/api/v1`;

export type TokenGetter = () => Promise<string | null>;

async function withAuth(getToken: TokenGetter, init: RequestInit = {}): Promise<RequestInit> {
  const token = await getToken().catch(() => null);
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

async function req<T>(getToken: TokenGetter, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, await withAuth(getToken, init));
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${path}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// ─── Types (mirror A_PROTOCOL_SCHEMA.md) ────────────────────────────────────

export interface TransportRun {
  id: string;
  workspace_id: string;
  initiator: string;
  delegator?: string | null;
  state: string;
  entrypoint: string;
  current_job_id?: string | null;
  created_at: string;
  completed_at?: string | null;
}

export interface TransportJobView {
  job_id: string;
  run_id: string;
  state: string;
  lease_owner?: string | null;
  lease_generation?: number;
  retry_count?: number;
  payload?: unknown;
  result?: { result_id?: string; status?: string; summary?: string; executor?: string } | null;
  initiator?: string | null;
  delegator?: string | null;
}

export interface TransportEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  initiator?: string | null;
  delegator?: string | null;
  executor?: string | null;
  created_at: string;
}

export interface ApprovalRow {
  id: string;
  run_id: string;
  job_id: string;
  executor: string;
  capability: string;
  target: string;
  status: string;
  decided_by?: string | null;
  lease_generation: number;
  created_at: string;
}

export interface IntentSubmission {
  intent_id: string;
  run_id: string;
  created: boolean;
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

export function listRuns(getToken: TokenGetter): Promise<TransportRun[]> {
  return req(getToken, '/runs');
}

export function listRunEvents(getToken: TokenGetter, runId: string): Promise<TransportEvent[]> {
  return req(getToken, `/runs/${runId}/events`);
}

export function listRunJobs(getToken: TokenGetter, runId: string): Promise<Array<{ id: string; state: string; job_type: string }>> {
  // The legacy jobs endpoint returns manager-mirror DTOs; job detail comes
  // from the canonical transport view below.
  return req(getToken, `/runs/${runId}/jobs`);
}

export function getJob(getToken: TokenGetter, jobId: string): Promise<TransportJobView> {
  return req(getToken, `/fabric/transport/jobs/${jobId}`);
}

export function listApprovals(
  getToken: TokenGetter,
  workspace: string,
  status?: string,
): Promise<{ approvals: ApprovalRow[] }> {
  const q = new URLSearchParams();
  if (workspace) q.set('workspace', workspace);
  if (status) q.set('status', status);
  return req(getToken, `/fabric/transport/approvals?${q.toString()}`);
}

export function decideApproval(
  getToken: TokenGetter,
  approvalId: string,
  decision: 'grant' | 'deny',
): Promise<ApprovalRow> {
  return req(getToken, `/fabric/transport/approvals/${approvalId}/${decision}`, { method: 'POST' });
}

export interface IntentInput {
  workspace: string;
  initiator: string;
  delegator?: string;
  target?: string;
  actionType: string;
  description: string;
  causationChain: string[];
}

export function submitIntent(getToken: TokenGetter, input: IntentInput): Promise<IntentSubmission> {
  return req(getToken, '/fabric/transport/intents', {
    method: 'POST',
    body: JSON.stringify({
      version: 'a/0.1',
      intent_id: `intent_${crypto.randomUUID()}`,
      workspace: `a://workspace/${input.workspace}`,
      initiator: input.initiator,
      delegator: input.delegator || null,
      target: input.target || null,
      action: { action_type: input.actionType, description: input.description },
      permissions: [],
      causation_chain: input.causationChain,
    }),
  });
}

export function getIntent(getToken: TokenGetter, intentId: string): Promise<{ intent_id: string; run_id: string; envelope: unknown }> {
  return req(getToken, `/fabric/transport/intents/${intentId}`);
}

export function continueJobInCloud(getToken: TokenGetter, jobId: string): Promise<{ job_id: string; run_id: string; state: string }> {
  return req(getToken, `/fabric/transport/jobs/${encodeURIComponent(jobId)}/continue-in-cloud`, { method: 'POST' });
}

export function continueRunInCloud(getToken: TokenGetter, runId: string): Promise<{ run_id: string; jobs: unknown[] }> {
  return req(getToken, `/fabric/transport/runs/${encodeURIComponent(runId)}/continue-in-cloud`, { method: 'POST' });
}

export function getCoworkPreferences(getToken: TokenGetter): Promise<{ trusted_folders: string[]; cloud_continuation: boolean; continuation_api_url?: string | null }> {
  return req(getToken, '/cowork-preferences');
}

export function setCloudContinuation(
  getToken: TokenGetter,
  enabled: boolean,
  continuationApiUrl?: string,
): Promise<{ cloud_continuation: boolean; continuation_api_url?: string | null }> {
  return req(getToken, '/cowork-preferences', {
    method: 'PUT',
    body: JSON.stringify({ cloud_continuation: enabled, continuation_api_url: continuationApiUrl }),
  });
}

// ─── P-T6: principals / delegation rules / connector sessions ───────────────

export interface PrincipalRow {
  id: string;
  workspace: string;
  capabilities: string[];
  roles: string[];
  status: string;
  created_at: string;
}

export interface DelegationRuleRow {
  workspace: string;
  action_type: string;
  target_principal: string;
  priority: number;
  created_at: string;
}

export interface ConnectorSessionRow {
  id: string;
  principal: string;
  run_id: string;
  job_id: string;
  capability: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export function listPrincipals(getToken: TokenGetter, workspace?: string): Promise<{ principals: PrincipalRow[] }> {
  const q = workspace ? `?workspace=${encodeURIComponent(workspace)}` : '';
  return req(getToken, `/fabric/transport/principals${q}`);
}

/** Provisions a NEW principal token (returned exactly once). */
export function provisionPrincipalToken(getToken: TokenGetter, principalId: string): Promise<{ principal_id: string; token: string }> {
  return req(getToken, `/fabric/transport/principals/${encodeURIComponent(principalId)}/provision-token`, { method: 'POST' });
}

export function listDelegationRules(getToken: TokenGetter, workspace: string): Promise<{ workspace: string; rules: DelegationRuleRow[] }> {
  return req(getToken, `/fabric/transport/delegation-rules?workspace=${encodeURIComponent(workspace)}`);
}

export function upsertDelegationRule(
  getToken: TokenGetter,
  input: { workspace: string; action_type: string; target_principal: string; priority?: number },
): Promise<DelegationRuleRow> {
  return req(getToken, '/fabric/transport/delegation-rules', { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteDelegationRule(getToken: TokenGetter, workspace: string, actionType: string): Promise<{ deleted: boolean }> {
  return req(
    getToken,
    `/fabric/transport/delegation-rules/${encodeURIComponent(workspace)}/${encodeURIComponent(actionType)}`,
    { method: 'DELETE' },
  );
}

export function listConnectorSessions(getToken: TokenGetter, runId?: string): Promise<{ sessions: ConnectorSessionRow[] }> {
  const q = runId ? `?run_id=${encodeURIComponent(runId)}` : '';
  return req(getToken, `/fabric/transport/connector-sessions${q}`);
}

// ─── P4.2: Cowork routines (scheduled work on Fabric Transport) ─────────────

export interface RoutineRow {
  id: string;
  workspace: string;
  principal?: string | null;
  name: string;
  message: string;
  schedule: string;
  enabled: boolean;
  last_run_at?: string | null;
  next_run_at?: string | null;
}

export function listRoutines(getToken: TokenGetter): Promise<{ routines: RoutineRow[] }> {
  return req(getToken, '/cowork/routines');
}

export function createRoutine(
  getToken: TokenGetter,
  input: { name: string; message: string; schedule: string; workspace?: string; principal?: string },
): Promise<RoutineRow> {
  return req(getToken, '/cowork/routines', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteRoutine(getToken: TokenGetter, routineId: string): Promise<{ deleted: string }> {
  return req(getToken, `/cowork/routines/${encodeURIComponent(routineId)}`, { method: 'DELETE' });
}

export function runRoutineNow(getToken: TokenGetter, routineId: string): Promise<{ id: string; fired: number }> {
  return req(getToken, `/cowork/routines/${encodeURIComponent(routineId)}/run`, { method: 'POST' });
}
