/**
 * Rails Service - Allternit Agent System Rails API Client
 *
 * This service connects to the Allternit Agent System Rails surface mounted
 * on the allternit-api gateway (port 8013) at `/api/rails/*`
 * (cmd/allternit-api/src/rails/mod.rs). It is NOT the standalone
 * rails service dialect (port 3011, /api/v1/*) this client was originally
 * written against — only routes that exist on the gateway are called live
 * here. Methods whose standalone data-plane route has no gateway equivalent
 * are marked TODO(rails-gateway) and fail fast instead of firing requests
 * that 404.
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

/**
 * Fail fast for client methods whose standalone rails-service (port 3011)
 * data-plane route has NO equivalent on the allternit-api `/api/rails`
 * gateway (cmd/allternit-api/src/rails/mod.rs). Throwing preserves the
 * rejection semantics every existing call site already handles (these calls
 * previously 404'd through apiRequestWithError).
 */
// TODO(rails-gateway): the following standalone data-plane routes have no
// equivalent on the 8013 rails router — add them there or retire these call
// sites: /init, /plans, /plan, /plan/refine, /plan/:id, /dags/:id/render,
// /dags/:id/execute, /runs/:id/cancel, GET /leases, /leases/:id/renew,
// DELETE /leases/:id, POST /context-packs, /context-packs/seal,
// /gate/status, /gate/check, /gate/rules, /gate/verify, /gate/decision,
// /gate/mutate, /index/rebuild, /mail/review, /mail/archive.
function unavailableOnGateway(feature: string, standaloneRoute: string): never {
  throw new Error(
    `[Rails API] '${feature}' targets standalone rails route '${standaloneRoute}', ` +
      "which has no equivalent on the allternit-api /api/rails gateway."
  );
}

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
  // TODO(rails-gateway): the planning data plane (/plans, /plan, /plan/refine,
  // /plan/:id, /dags/:id/render, /dags/:id/execute, /runs/:id/cancel) does not
  // exist on the 8013 rails router. The only DAG routes there are workspace
  // scoped (/workspace/:workspace_id/dags[...]) and require a workspace id the
  // call sites do not have, so these fail fast instead of inventing paths.
  // ============================================================================

  plan: {
    /** List all DAG plans */
    list: (): Promise<{ dags: Array<{ dag_id: string; version: string; created_at: string; metadata?: { title?: string; description?: string } }> }> =>
      unavailableOnGateway("plan.list", "GET /v1/plans"),

    /** Create new execution plan (like starting an agent run) */
    new: (_req: PlanNewRequest): Promise<PlanNewResponse> =>
      unavailableOnGateway("plan.new", "POST /v1/plan"),

    /** Refine existing plan */
    refine: (_req: PlanRefineRequest): Promise<PlanRefineResponse> =>
      unavailableOnGateway("plan.refine", "POST /v1/plan/refine"),

    /** Get plan details */
    show: (_dagId: string): Promise<{ dag_id: string; dag: unknown }> =>
      unavailableOnGateway("plan.show", "GET /v1/plan/:dag_id"),

    /** Render plan as JSON or Markdown */
    render: (_dagId: string, _format: "json" | "markdown" = "json"): Promise<DagRenderResponse> =>
      unavailableOnGateway("plan.render", "GET /v1/dags/:dag_id/render"),

    /** Execute a DAG */
    execute: (_dagId: string, _runId?: string): Promise<{ run_id: string; status: string }> =>
      unavailableOnGateway("plan.execute", "POST /v1/dags/:dag_id/execute"),

    /** Cancel a running DAG execution */
    cancel: (_runId: string): Promise<{ cancelled: boolean }> =>
      unavailableOnGateway("plan.cancel", "POST /v1/runs/:run_id/cancel"),
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
  // 8013 only mounts POST /leases and GET /leases/:lease_id. The standalone
  // list/renew/release data-plane routes are missing — see TODO(rails-gateway).
  // ============================================================================

  leases: {
    /** List active leases — NOT available on the gateway. */
    list: (_dagId?: string): Promise<LeaseListResponse> =>
      unavailableOnGateway("leases.list", "GET /v1/leases"),

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

    /** Renew lease — NOT available on the gateway. */
    renew: (_leaseId: string, _ttlSeconds: number = 300): Promise<LeaseRenewResponse> =>
      unavailableOnGateway("leases.renew", "POST /v1/leases/:lease_id/renew"),

    /** Release lease — NOT available on the gateway. */
    release: (_leaseId: string): Promise<{ released: boolean }> =>
      unavailableOnGateway("leases.release", "DELETE /v1/leases/:lease_id"),
  },

  // ============================================================================
  // CONTEXT PACKS - Sealed Execution Context
  //
  // TODO(rails-gateway): the gateway mounts context packs under
  // /workspace/:workspace_id/packs, which requires a workspace id these call
  // sites do not have. The unscoped /context-packs data plane is missing.
  // ============================================================================

  contextPacks: {
    /** List context packs — NOT available on the gateway. */
    list: (_req?: ContextPackListRequest): Promise<ContextPackListResponse> =>
      unavailableOnGateway("contextPacks.list", "POST /v1/context-packs"),

    /** Seal a new context pack — NOT available on the gateway. */
    seal: (_req: ContextPackSealRequest): Promise<ContextPackSealResponse> =>
      unavailableOnGateway("contextPacks.seal", "POST /v1/context-packs/seal"),
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
     * GET /ledger/events (query params: since, dag_id, wih_id, limit) — see
     * TODO(rails-gateway). `node_id`/`prompt_id` filters have no gateway
     * equivalent and are not forwarded. Response fields are mapped from the
     * gateway's LedgerEventResponse (ts -> timestamp; scope.run_id -> node_id,
     * matching the receipts surface's run_id-as-node convention).
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

    // TODO(rails-gateway): POST /mail/review has no equivalent on the 8013
    // rails router; review requests would 404 on the gateway.
    /** Request review — NOT available on the gateway. */
    requestReview: (_threadId: string, _wihId: string, _diffRef: string): Promise<void> =>
      unavailableOnGateway("mail.requestReview", "POST /v1/mail/review"),

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

    // TODO(rails-gateway): POST /mail/archive has no equivalent on the 8013
    // rails router. Callers degrade gracefully — archived state is tracked
    // locally and the failed call never blocked the UI.
    /** Archive thread — NOT available on the gateway. */
    archive: (_threadId: string, _path: string, _reason?: string): Promise<void> =>
      unavailableOnGateway("mail.archive", "POST /v1/mail/archive"),
  },

  // ============================================================================
  // GATE - Policy Enforcement
  //
  // TODO(rails-gateway): the 8013 router mounts only POST /gate/evaluate with
  // an incompatible contract ({ action, resource, tenant_id, context }), so
  // none of the standalone gate data plane below has a usable equivalent.
  // ============================================================================

  gate: {
    /** Get gate status — NOT available on the gateway. */
    status: (): Promise<{ status: string }> =>
      unavailableOnGateway("gate.status", "GET /v1/gate/status"),

    /** Check if action allowed — NOT available on the gateway. */
    check: (_req: GateCheckRequest): Promise<GateCheckResponse> =>
      unavailableOnGateway("gate.check", "POST /v1/gate/check"),

    /** Get GATE_RULES.md — NOT available on the gateway. */
    rules: (): Promise<{ rules?: string }> =>
      unavailableOnGateway("gate.rules", "GET /v1/gate/rules"),

    /** Verify ledger/DAGs — NOT available on the gateway. */
    verify: (_json: boolean = true): Promise<{
      ok: boolean;
      ledger_chain_ok: boolean;
      ledger_chain_issues?: string[];
      cycle_dags: string[];
    }> => unavailableOnGateway("gate.verify", "POST /v1/gate/verify"),

    /** Record decision — NOT available on the gateway. */
    decision: (_note: string, _reason?: string, _links: string[] = []): Promise<{ decision_id: string }> =>
      unavailableOnGateway("gate.decision", "POST /v1/gate/decision"),

    /** Mutate DAG with decision — NOT available on the gateway. */
    mutate: (_dagId: string, _note: string, _reason?: string, _mutations?: DagMutation[]): Promise<{
      decision_id: string;
      mutation_ids: string[];
    }> => unavailableOnGateway("gate.mutate", "POST /v1/gate/mutate"),
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
  //
  // TODO(rails-gateway): POST /index/rebuild has no equivalent on the 8013
  // rails router.
  // ============================================================================

  index: {
    /** Rebuild index from ledger — NOT available on the gateway. */
    rebuild: (): Promise<{ indexed_count: number }> =>
      unavailableOnGateway("index.rebuild", "POST /v1/index/rebuild"),
  },
};

export default railsApi;
