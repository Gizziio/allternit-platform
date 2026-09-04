/**
 * Rails Service - Allternit Agent System Rails API Client
 *
 * This service connects to the Allternit Agent System Rails surface mounted
 * on the allternit-api gateway (port 8013) at `/api/rails/*`
 * (cmd/allternit-api/src/rails/mod.rs). It is NOT the standalone
 * rails service dialect (port 3011, /api/v1/*) this client was originally
 * written against — every method below calls a route that exists on the
 * gateway, including the plan/leases/context-pack/gate data plane that was
 * backfilled onto the gateway router.
 *
 * UI Concepts → Rails Concepts:
 * - Agent Run → DAG (plan) + WIHs
 * - Task → WIH (Work In Hand)
 * - Execution History → Ledger
 * - Agent Messaging → Mail
 * - Checkpoint → Vault archive
 * - Queue → WIHs with status filtering
 */

// Import shared API configuration (avoids circular dependencies with agent.service.ts)
import { GATEWAY_BASE_URL, apiRequestWithError } from "./api-config";

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('Rails');

// ============================================================================
// Types - Matching Rails API
// ============================================================================

export interface PlanNewRequest {
  text: string;
  dag_id?: string;
}

export interface PlanNewResponse {
  prompt_id: string;
  dag_id: string;
  node_id: string;
}

export interface PlanRefineRequest {
  dag_id: string;
  delta: string;
  reason?: string;
  mutations?: DagMutation[];
}

export interface PlanRefineResponse {
  delta_id: string;
}

export interface DagMutation {
  action: "add" | "remove" | "modify" | "set_status";
  node_id?: string;
  parent_id?: string;
  after_node_id?: string;
  title?: string;
  description?: string;
  status?: string;
}

export interface DagRenderResponse {
  dag_id: string;
  format: string;
  content: string;
}

// WIH (Work In Hand) - Tasks/Runs
export interface WihInfo {
  wih_id: string;
  node_id: string;
  dag_id?: string;
  status: "open" | "ready" | "signed" | "in_progress" | "blocked" | "closed" | "archived";
  title?: string;
  description?: string;
  assignee?: string;
  blocked_by?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface WihListRequest {
  dag_id?: string;
  ready_only?: boolean;
}

export interface WihListResponse {
  wihs: WihInfo[];
}

export interface WihPickupRequest {
  dag_id: string;
  node_id: string;
  agent_id: string;
  role?: string;
  fresh?: boolean;
}

export interface WihPickupResponse {
  wih_id: string;
  context_pack_path?: string;
}

export interface WihCloseRequest {
  status: "completed" | "failed" | "cancelled";
  evidence?: string[];
}

export interface WihCloseResponse {
  closed: boolean;
}

// Leases - Resource reservations
export interface LeaseRequest {
  wih_id: string;
  agent_id: string;
  paths: string[];
  /** Standalone-dialect field; ignored by the gateway's POST /leases. */
  tools?: string[];
  ttl_seconds?: number;
}

export interface LeaseResponse {
  lease_id: string;
  granted: boolean;
  expires_at?: number;
}

export interface ManagedLease {
  lease_id: string;
  wih_id: string;
  dag_id: string;
  node_id: string;
  agent_id: string;
  acquired_at: number;
  expires_at: number;
  keys: string[];
  tools: string[];
  renewal_count: number;
  status: 'active' | 'expiring' | 'expired' | 'released';
}

export interface LeaseListResponse {
  leases: ManagedLease[];
}

interface LeaseRenewRequest {
  ttl_seconds: number;
}

export interface LeaseRenewResponse {
  renewed: boolean;
  expires_at: number;
}

// Context Packs
interface ContextPackInputs {
  wih_id: string;
  dag_id: string;
  node_id: string;
  wih_content?: string;
  receipt_refs: string[];
  policy_bundle_id?: string;
  plan_hashes?: Record<string, string>;
  tool_registry_version?: string;
  lease_info?: {
    lease_id: string;
    keys: string[];
    expires_at: number;
  };
}

export interface ContextPack {
  context_pack_id: string;
  version: string;
  created_at: string;
  inputs: ContextPackInputs;
  correlation_id: string;
}

export interface ContextPackSealRequest {
  dag_id: string;
  node_id: string;
  wih_id: string;
  inputs: ContextPackInputs;
}

export interface ContextPackSealResponse {
  sealed: boolean;
  context_pack_id: string;
  stored_at: string;
}

export interface ContextPackListRequest {
  dag_id?: string;
  node_id?: string;
  wih_id?: string;
  limit?: number;
}

export interface ContextPackListResponse {
  packs: ContextPack[];
}

// Receipts
export type ReceiptKind =
  | 'tool_call_post'
  | 'validator_report'
  | 'build_report'
  | 'gate_decision'
  | 'session_start'
  | 'dag_load'
  | 'node_entry'
  | 'context_pack_sealed';

export interface Receipt {
  receipt_id: string;
  kind: ReceiptKind;
  run_id: string;
  dag_id: string;
  node_id: string;
  wih_id: string;
  timestamp: string;
  payload: unknown;
  signature?: string;
}

export interface ReceiptQueryRequest {
  dag_id?: string;
  node_id?: string;
  wih_id?: string;
  kinds?: ReceiptKind[];
  since?: string;
  until?: string;
  limit?: number;
}

export interface ReceiptQueryResponse {
  receipts: Receipt[];
}

/** Request body for POST /receipts/write (allternit-api `ReceiptWriteRequest`). */
export interface ReceiptWriteRequest {
  tool?: string;
  run_id?: string;
  inputs_ref?: string;
  outputs_ref?: string;
  exit_code?: number;
  summary?: string;
}

// Ledger - Event history
interface LedgerTailRequest {
  count?: number;
}

export interface LedgerEvent {
  event_id: string;
  event_type: string;
  timestamp: string;
  scope?: {
    dag_id?: string;
    node_id?: string;
    wih_id?: string;
  };
  payload: unknown;
}

export interface LedgerTraceRequest {
  node_id?: string;
  wih_id?: string;
  prompt_id?: string;
}

// Mail - Agent messaging
export interface MailThread {
  thread_id: string;
  topic: string;
  created_at: string;
  participants?: string[];
}

export interface MailMessage {
  message_id: string;
  thread_id: string;
  from_agent: string;
  to_agent?: string;
  to_agents?: string[];
  body: string;
  body_ref?: string;
  body_path?: string;
  timestamp: string;
  acknowledged?: boolean;
  ack_required?: boolean;
  /** Message subject/topic (mirrors MailSendRequest). */
  subject?: string;
  /** Message priority. */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Backend importance (low/normal/high). */
  importance?: 'low' | 'normal' | 'high';
}

export interface MailShareResponse {
  share_id: string;
}

/** Response of POST /mail/decide. `email` is present only when the thread
 * belongs to a pending outbound agent email (`mail:email-out-*`). */
export interface MailDecideResponse {
  decided: boolean;
  thread_id: string;
  email?: {
    actioned: boolean;
    /** Present when actioned: the resulting outbound status. */
    status?: 'sent' | 'rejected';
    /** Present when the provider-side action failed (decision still stands). */
    error?: string;
  };
}

export interface MailSendRequest {
  thread_id: string;
  body_ref?: string;
  /** Message body (newer backends accept this directly). */
  body?: string;
  /** Sender agent id (typed envelope path). */
  from_agent?: string;
  /** Recipients for typed envelope path. */
  to_agents?: string[];
  /** Single-recipient alias for typed envelope path. */
  to_agent_id?: string;
  /** Message subject/topic. */
  subject?: string;
  /** Message priority; maps to backend `importance`. */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Request read acknowledgement. */
  requires_ack?: boolean;
  attachments?: string[];
}

export interface MailThreadSummary {
  thread_id: string;
  messages: number;
  last_ts: string;
}

export interface MailInboxRequest {
  agent_id: string;
  limit?: number;
}

export interface MailAckRequest {
  thread_id: string;
  message_id: string;
  agent_id?: string;
  note?: string;
}

// Gate - Policy enforcement
export interface GateCheckRequest {
  wih_id: string;
  tool: string;
  paths: string[];
}

export interface GateCheckResponse {
  allowed: boolean;
  reason?: string;
}

// Vault - Checkpoint/Archive
export interface VaultArchiveRequest {
  wih_id: string;
}

export interface VaultArchiveResponse {
  archived: boolean;
  path: string;
}

// ============================================================================
// Rails API Client
// ============================================================================

// Rails service can be accessed:
// - Through Gateway (recommended): http://127.0.0.1:8013/api/rails
// - Direct to Rails: http://127.0.0.1:3011/api/v1
//
// Using Gateway is preferred as it handles auth, rate limiting, etc.
const RAILS_BASE = `${GATEWAY_BASE_URL}/api/rails`;

export const railsApi = {
  // Health check with better error handling
  health: async () => {
    try {
      // 8013 GET /health returns { status: "healthy", rails: { ledger, gate, leases } }.
      // The standalone service also returned `service`/`version`; those stay optional.
      return await apiRequestWithError<{
        status: string;
        rails?: { ledger: boolean; gate: boolean; leases: boolean };
        service?: string;
        version?: string;
      }>(`${RAILS_BASE}/health`);
    } catch (error: any) {
      console.error(`[Rails API] Health check failed at ${RAILS_BASE}/health:`, error.message);
      throw error;
    }
  },

  // ============================================================================
  // PLAN - DAG Planning (Agent Runs)
  //
  // All seven routes exist on the gateway (GET /plans, POST /plan,
  // POST /plan/refine, GET /plan/:dag_id, GET /dags/:dag_id/render,
  // POST /dags/:dag_id/execute, POST /runs/:run_id/cancel). DAG state is
  // projected from the ledger by the gateway.
  // ============================================================================

  plan: {
    /** List all DAG plans */
    list: () => apiRequestWithError<{ dags: Array<{ dag_id: string; version: string; created_at: string; metadata?: { title?: string; description?: string } }> }>(
      `${RAILS_BASE}/plans`
    ),

    /** Create new execution plan (like starting an agent run) */
    new: (req: PlanNewRequest) => apiRequestWithError<PlanNewResponse>(
      `${RAILS_BASE}/plan`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Refine existing plan */
    refine: (req: PlanRefineRequest) => apiRequestWithError<PlanRefineResponse>(
      `${RAILS_BASE}/plan/refine`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Get plan details */
    show: (dagId: string) => apiRequestWithError<{ dag_id: string; dag: unknown }>(
      `${RAILS_BASE}/plan/${encodeURIComponent(dagId)}`
    ),

    /** Render plan as JSON or Markdown */
    render: (dagId: string, format: "json" | "markdown" = "json") => apiRequestWithError<DagRenderResponse>(
      `${RAILS_BASE}/dags/${encodeURIComponent(dagId)}/render?format=${format}`
    ),

    /** Execute a DAG */
    execute: (dagId: string, runId?: string) => apiRequestWithError<{ run_id: string; status: string }>(
      `${RAILS_BASE}/dags/${encodeURIComponent(dagId)}/execute`,
      { method: "POST", body: JSON.stringify(runId ? { run_id: runId } : {}) }
    ),

    /** Cancel a running DAG execution */
    cancel: (runId: string) => apiRequestWithError<{ cancelled: boolean }>(
      `${RAILS_BASE}/runs/${encodeURIComponent(runId)}/cancel`,
      { method: "POST" }
    ),
  },

  // ============================================================================
  // WIH - Work In Hand (Tasks/Runs)
  //
  // All five routes match the gateway verbatim (request + response shapes).
  // ============================================================================

  wihs: {
    /** List work items (like listing agent runs/tasks) */
    list: async (req: WihListRequest = {}) => {
      try {
        return await apiRequestWithError<WihListResponse>(
          `${RAILS_BASE}/wihs`,
          { method: "POST", body: JSON.stringify(req) }
        );
      } catch (error: any) {
        // Silent fail - the Rails surface may be unavailable, unauthorized, or still starting.
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[Rails API] WIHs unavailable`, error);
        }
        throw error;
      }
    },

    /** Pick up work (start working on a task) */
    pickup: (req: WihPickupRequest) => apiRequestWithError<WihPickupResponse>(
      `${RAILS_BASE}/wihs/pickup`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Get WIH context */
    context: (wihId: string) => apiRequestWithError<{
      wih_id: string;
      context_pack?: string;
    }>(`${RAILS_BASE}/wihs/${wihId}/context`),

    /** Sign open WIH */
    sign: (wihId: string, signature: string) => apiRequestWithError<{
      signed: boolean;
    }>(
      `${RAILS_BASE}/wihs/${wihId}/sign`,
      { method: "POST", body: JSON.stringify({ signature }) }
    ),

    /** Close WIH (complete task) */
    close: (wihId: string, req: WihCloseRequest) => apiRequestWithError<WihCloseResponse>(
      `${RAILS_BASE}/wihs/${wihId}/close`,
      { method: "POST", body: JSON.stringify(req) }
    ),
  },

  // ============================================================================
  // LEASES - Resource Reservations
  //
  // The gateway mounts the full lease data plane: POST /leases,
  // GET /leases, GET /leases/:lease_id, POST /leases/:lease_id/renew, and
  // DELETE /leases/:lease_id.
  // ============================================================================

  leases: {
    /** List active leases — GET /leases on the gateway. */
    list: (dagId?: string) =>
      apiRequestWithError<LeaseListResponse>(`${RAILS_BASE}/leases`).then((res) =>
        dagId
          ? { leases: res.leases.filter((l) => l.dag_id === dagId) }
          : res
      ),

    /** Request lease on files/resources */
    request: async (req: LeaseRequest): Promise<LeaseResponse> => {
      // 8013 POST /leases takes { wih_id, agent_id, paths, ttl_seconds } and
      // responds { lease_id, status: "requested" }. The standalone dialect's
      // `tools` field and `granted`/`expires_at` response fields do not exist
      // on the gateway; `tools` is dropped and `granted` derives from status.
      const raw = await apiRequestWithError<{ lease_id: string; status: string }>(
        `${RAILS_BASE}/leases`,
        { method: "POST", body: JSON.stringify(req) }
      );
      return { lease_id: raw.lease_id, granted: raw.status === "requested" };
    },

    /** Renew lease — POST /leases/:lease_id/renew on the gateway. */
    renew: (leaseId: string, ttlSeconds: number = 300) => apiRequestWithError<LeaseRenewResponse>(
      `${RAILS_BASE}/leases/${encodeURIComponent(leaseId)}/renew`,
      { method: "POST", body: JSON.stringify({ ttl_seconds: ttlSeconds } satisfies LeaseRenewRequest) }
    ),

    /** Release lease — DELETE /leases/:lease_id on the gateway. */
    release: (leaseId: string) => apiRequestWithError<{ released: boolean }>(
      `${RAILS_BASE}/leases/${encodeURIComponent(leaseId)}`,
      { method: "DELETE" }
    ),
  },

  // ============================================================================
  // CONTEXT PACKS - Sealed Execution Context
  //
  // The unscoped data plane exists on the gateway: POST /context-packs (list)
  // and POST /context-packs/seal. Packs sealed here persist their inputs
  // verbatim under .allternit/context-packs/<pack_id>/pack.json.
  // ============================================================================

  contextPacks: {
    /** List context packs — POST /context-packs on the gateway. */
    list: (req: ContextPackListRequest = {}) => apiRequestWithError<ContextPackListResponse>(
      `${RAILS_BASE}/context-packs`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Seal a new context pack — POST /context-packs/seal on the gateway. */
    seal: (req: ContextPackSealRequest) => apiRequestWithError<ContextPackSealResponse>(
      `${RAILS_BASE}/context-packs/seal`,
      { method: "POST", body: JSON.stringify(req) }
    ),
  },

  // ============================================================================
  // RECEIPTS - Audit Evidence
  //
  // POST /receipts and POST /receipts/write exist on the gateway; the
  // standalone GET /receipts/:id route does not (removed — no callers).
  // ============================================================================

  receipts: {
    /** Query receipts with filters */
    query: (req: ReceiptQueryRequest) => apiRequestWithError<ReceiptQueryResponse>(
      `${RAILS_BASE}/receipts`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Write a new receipt (gateway ReceiptWriteRequest shape). */
    write: (receipt: ReceiptWriteRequest) => apiRequestWithError<{ receipt_id: string }>(
      `${RAILS_BASE}/receipts/write`,
      { method: "POST", body: JSON.stringify(receipt) }
    ),
  },

  // ============================================================================
  // LEDGER - Event History
  // ============================================================================

  ledger: {
    /** Get recent events (like run logs) */
    tail: (count: number = 50) => apiRequestWithError<LedgerEvent[]>(
      `${RAILS_BASE}/ledger/tail`,
      { method: "POST", body: JSON.stringify({ count }) }
    ),

    /**
     * Trace events by node/wih/prompt. The standalone POST /ledger/trace
     * route does not exist on the gateway; the equivalent is
     * GET /ledger/events (query params: since, dag_id, wih_id, limit).
     * `node_id`/`prompt_id` filters have no gateway equivalent and are not
     * forwarded. Response fields are mapped from the gateway's
     * LedgerEventResponse (ts -> timestamp; scope.run_id -> node_id, matching
     * the receipts surface's run_id-as-node convention).
     */
    trace: async (req: LedgerTraceRequest): Promise<LedgerEvent[]> => {
      const params = new URLSearchParams();
      if (req.wih_id) params.set("wih_id", req.wih_id);
      params.set("limit", "100");
      const query = params.toString();
      const raw = await apiRequestWithError<Array<{
        event_id: string;
        ts: string;
        actor_type: string;
        actor_id: string;
        event_type: string;
        payload: unknown;
        scope?: { dag_id?: string; wih_id?: string; run_id?: string };
      }>>(`${RAILS_BASE}/ledger/events${query ? `?${query}` : ""}`);
      return raw.map((e) => ({
        event_id: e.event_id,
        event_type: e.event_type,
        timestamp: e.ts,
        scope: e.scope
          ? {
              dag_id: e.scope.dag_id,
              wih_id: e.scope.wih_id,
              node_id: e.scope.run_id,
            }
          : undefined,
        payload: e.payload,
      }));
    },
  },

  // ============================================================================
  // MAIL - Agent Messaging
  //
  // All live routes below exist on the gateway. Note the thread key: the
  // gateway's MailDecideRequest/MailShareRequest use `thread` (no `thread_id`
  // serde alias), while MailWriteRequest/MailAckRequest accept `thread_id`.
  // ============================================================================

  mail: {
    /** Ensure/create thread */
    ensureThread: (topic: string, _participants?: string[]) => {
      const canonicalTopic = /^((dag|wih|mail):)/.test(topic) ? topic : `mail:${topic}`;
      return apiRequestWithError<{ thread_id: string }>(
        `${RAILS_BASE}/mail/threads`,
        { method: "POST", body: JSON.stringify({ topic: canonicalTopic }) }
      );
    },

    /** Send message */
    send: (req: MailSendRequest) => apiRequestWithError<{ sent: boolean; thread_id?: string; message_id?: string }>(
      `${RAILS_BASE}/mail/send`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** List threads — GET /mail/threads on the gateway. */
    threads: () => apiRequestWithError<{ threads: MailThreadSummary[] }>(
      `${RAILS_BASE}/mail/threads`
    ),

    /** Read a single thread — GET /mail/thread/:thread_id on the gateway. */
    thread: (threadId: string) => apiRequestWithError<{ messages: MailMessage[] }>(
      `${RAILS_BASE}/mail/thread/${encodeURIComponent(threadId)}`
    ),

    /** Get inbox for a specific agent — GET /mail/inbox/:agent_id on the gateway. */
    inbox: (req: MailInboxRequest) => {
      const params = new URLSearchParams()
      if (req.limit !== undefined) params.set("limit", String(req.limit))
      const query = params.toString()
      return apiRequestWithError<{ agent_id: string; messages: MailMessage[] }>(
        `${RAILS_BASE}/mail/inbox/${encodeURIComponent(req.agent_id)}${query ? `?${query}` : ""}`
      )
    },

    /** Acknowledge message */
    ack: (threadId: string, messageId: string, note?: string) => apiRequestWithError<void>(
      `${RAILS_BASE}/mail/ack`,
      { method: "POST", body: JSON.stringify({ thread_id: threadId, message_id: messageId, note }) }
    ),

    /** Acknowledge message (explicit request object). */
    ackMessage: (req: MailAckRequest) => apiRequestWithError<{ acknowledged: boolean }>(
      `${RAILS_BASE}/mail/ack`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /**
     * Decide on review. For `mail:email-out-*` threads the response carries an
     * `email` object with the provider-side outcome (rails/mod.rs mail_decide).
     * The gateway request struct is { thread, decision?, approve?, notes_ref? } —
     * the thread key is `thread`, NOT `thread_id` (MailDecideRequest has no
     * serde alias), so sending `thread_id` would post the decision to the
     * default `mail:general` thread.
     */
    decide: (threadId: string, approve: boolean, notesRef?: string) => apiRequestWithError<MailDecideResponse>(
      `${RAILS_BASE}/mail/decide`,
      { method: "POST", body: JSON.stringify({ thread: threadId, approve, notes_ref: notesRef }) }
    ),

    /** Request review — POST /mail/review on the gateway. */
    requestReview: (threadId: string, wihId: string, diffRef: string) => apiRequestWithError<void>(
      `${RAILS_BASE}/mail/review`,
      { method: "POST", body: JSON.stringify({ thread_id: threadId, wih_id: wihId, diff_ref: diffRef }) }
    ),

    /**
     * Share asset. The gateway request struct is { thread, asset_ref?, path?,
     * note? } — the thread key is `thread`, NOT `thread_id` (MailShareRequest
     * has no serde alias), so sending `thread_id` would silently share into
     * the default `mail:general` thread.
     */
    share: (threadId: string, assetRef: string, note?: string) => apiRequestWithError<MailShareResponse>(
      `${RAILS_BASE}/mail/share`,
      { method: "POST", body: JSON.stringify({ thread: threadId, asset_ref: assetRef, note }) }
    ),

    /** Archive thread — POST /mail/archive on the gateway. */
    archive: (threadId: string, path: string, reason?: string) => apiRequestWithError<void>(
      `${RAILS_BASE}/mail/archive`,
      { method: "POST", body: JSON.stringify({ thread_id: threadId, path, reason }) }
    ),
  },

  // ============================================================================
  // GATE - Policy Enforcement
  //
  // The full gate data plane exists on the gateway alongside POST
  // /gate/evaluate: GET /gate/status, POST /gate/check, GET /gate/rules,
  // POST /gate/verify, POST /gate/decision, POST /gate/mutate. Decisions and
  // mutations run in strict-provenance mode (a decision needs linked event
  // ids; a delta needs at least one mutation).
  // ============================================================================

  gate: {
    /** Get gate status */
    status: () => apiRequestWithError<{ status: string }>(`${RAILS_BASE}/gate/status`),

    /** Check if action allowed */
    check: (req: GateCheckRequest) => apiRequestWithError<GateCheckResponse>(
      `${RAILS_BASE}/gate/check`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Get GATE_RULES.md */
    rules: () => apiRequestWithError<{ rules?: string }>(`${RAILS_BASE}/gate/rules`),

    /** Verify ledger/DAGs */
    verify: (json: boolean = true) => apiRequestWithError<{
      ok: boolean;
      ledger_chain_ok: boolean;
      ledger_chain_issues?: string[];
      cycle_dags: string[];
    }>(
      `${RAILS_BASE}/gate/verify`,
      { method: "POST", body: JSON.stringify({ json }) }
    ),

    /** Record decision */
    decision: (note: string, reason?: string, links: string[] = []) => apiRequestWithError<{ decision_id: string }>(
      `${RAILS_BASE}/gate/decision`,
      { method: "POST", body: JSON.stringify({ note, reason, links }) }
    ),

    /** Mutate DAG with decision */
    mutate: (dagId: string, note: string, reason?: string, mutations?: DagMutation[]) => apiRequestWithError<{
      decision_id: string;
      mutation_ids: string[];
    }>(
      `${RAILS_BASE}/gate/mutate`,
      { method: "POST", body: JSON.stringify({ dag_id: dagId, note, reason, mutations }) }
    ),
  },

  // ============================================================================
  // VAULT - Checkpoint/Archive
  //
  // Both routes match the gateway verbatim (request + response shapes).
  // ============================================================================

  vault: {
    /** Archive WIH (like checkpoint) */
    archive: (req: VaultArchiveRequest) => apiRequestWithError<VaultArchiveResponse>(
      `${RAILS_BASE}/vault/archive`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Get vault status */
    status: () => apiRequestWithError<{
      jobs: Array<{
        wih_id: string;
        status: string;
        created_at?: string;
        completed_at?: string;
      }>;
    }>(`${RAILS_BASE}/vault/status`),
  },

  // ============================================================================
  // INDEX - Search/Rebuild
  // ============================================================================

  index: {
    /** Rebuild index from ledger — POST /index/rebuild on the gateway. */
    rebuild: () => apiRequestWithError<{ indexed_count: number }>(
      `${RAILS_BASE}/index/rebuild`,
      { method: "POST" }
    ),
  },
};

export default railsApi;
