/**
 * Rails Service - Allternit Agent System Rails API Client
 * 
 * This service connects to the ACTUAL Allternit Agent System Rails backend.
 * Rails provides: DAG planning, WIH tracking, Ledger events, Mail, Gates, Vault
 * 
 * Service: allternit-agent-system-rails (port 3011)
 * Gateway: /api/v1/rails/*
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

export interface LeaseRenewRequest {
  ttl_seconds: number;
}

export interface LeaseRenewResponse {
  renewed: boolean;
  expires_at: number;
}

// Context Packs
export interface ContextPackInputs {
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

// Ledger - Event history
export interface LedgerTailRequest {
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
}

export interface MailMessage {
  message_id: string;
  thread_id: string;
  from_agent: string;
  body: string;
  timestamp: string;
  acknowledged?: boolean;
}

export interface MailShareResponse {
  share_id: string;
}

export interface MailSendRequest {
  thread_id: string;
  body_ref: string;
  attachments?: string[];
}

export interface MailInboxRequest {
  thread_id?: string;
  limit?: number;
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

// console.log('[Rails Service] Using Rails base URL:', RAILS_BASE);

export const railsApi = {
  // Health check with better error handling
  health: async () => {
    try {
      return await apiRequestWithError<{
        status: string;
        service: string;
        version: string;
      }>(`${RAILS_BASE}/health`);
    } catch (error: any) {
      console.error(`[Rails API] Health check failed at ${RAILS_BASE}/health:`, error.message);
      throw error;
    }
  },

  // Initialize
  init: () => apiRequestWithError<{ initialized: boolean; stores: string[] }>(
    `${RAILS_BASE}/init`,
    { method: "POST" }
  ),

  // ============================================================================
  // PLAN - DAG Planning (Agent Runs)
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
      `${RAILS_BASE}/plan/${dagId}`
    ),

    /** Render plan as JSON or Markdown */
    render: (dagId: string, format: "json" | "markdown" = "json") => 
      apiRequestWithError<DagRenderResponse>(
        `${RAILS_BASE}/dags/${dagId}/render?format=${format}`
      ),

    /** Execute a DAG */
    execute: (dagId: string, runId?: string) => apiRequestWithError<{ run_id: string; status: string }>(
      `${RAILS_BASE}/dags/${dagId}/execute`,
      { method: "POST", body: JSON.stringify({ run_id: runId }) }
    ),

    /** Cancel a running DAG execution */
    cancel: (runId: string) => apiRequestWithError<{ cancelled: boolean }>(
      `${RAILS_BASE}/runs/${runId}/cancel`,
      { method: "POST" }
    ),
  },

  // ============================================================================
  // WIH - Work In Hand (Tasks/Runs)
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
        // Silent fail - Rails API may not be running
        if (import.meta.env.DEV) {
          console.debug(`[Rails API] WIHs not available (backend not running)`);
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
  // ============================================================================
  
  leases: {
    /** List active leases */
    list: (dagId?: string) => apiRequestWithError<LeaseListResponse>(
      `${RAILS_BASE}/leases`,
      { method: "GET" }
    ),

    /** Request lease on files/resources */
    request: (req: LeaseRequest) => apiRequestWithError<LeaseResponse>(
      `${RAILS_BASE}/leases`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Renew lease */
    renew: (leaseId: string, ttlSeconds: number = 300) => apiRequestWithError<LeaseRenewResponse>(
      `${RAILS_BASE}/leases/${leaseId}/renew`,
      { method: "POST", body: JSON.stringify({ ttl_seconds: ttlSeconds }) }
    ),

    /** Release lease */
    release: (leaseId: string) => apiRequestWithError<{ released: boolean }>(
      `${RAILS_BASE}/leases/${leaseId}`,
      { method: "DELETE" }
    ),
  },

  // ============================================================================
  // CONTEXT PACKS - Sealed Execution Context
  // ============================================================================
  
  contextPacks: {
    /** List context packs */
    list: (req?: ContextPackListRequest) => apiRequestWithError<ContextPackListResponse>(
      `${RAILS_BASE}/context-packs`,
      { method: "POST", body: JSON.stringify(req || {}) }
    ),

    /** Get context pack by ID */
    get: (packId: string) => apiRequestWithError<ContextPack>(
      `${RAILS_BASE}/context-packs/${packId}`
    ),

    /** Seal a new context pack */
    seal: (req: ContextPackSealRequest) => apiRequestWithError<ContextPackSealResponse>(
      `${RAILS_BASE}/context-packs/seal`,
      { method: "POST", body: JSON.stringify(req) }
    ),
  },

  // ============================================================================
  // RECEIPTS - Audit Evidence
  // ============================================================================
  
  receipts: {
    /** Query receipts with filters */
    query: (req: ReceiptQueryRequest) => apiRequestWithError<ReceiptQueryResponse>(
      `${RAILS_BASE}/receipts`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Write a new receipt */
    write: (receipt: Omit<Receipt, 'receipt_id'>) => apiRequestWithError<{ receipt_id: string }>(
      `${RAILS_BASE}/receipts`,
      { method: "PUT", body: JSON.stringify(receipt) }
    ),

    /** Get receipt by ID */
    get: (receiptId: string) => apiRequestWithError<Receipt>(
      `${RAILS_BASE}/receipts/${receiptId}`
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

    /** Trace events by node/wih/prompt */
    trace: (req: LedgerTraceRequest) => apiRequestWithError<LedgerEvent[]>(
      `${RAILS_BASE}/ledger/trace`,
      { method: "POST", body: JSON.stringify(req) }
    ),
  },

  // ============================================================================
  // MAIL - Agent Messaging
  // ============================================================================
  
  mail: {
    /** Ensure/create thread */
    ensureThread: (topic: string) => apiRequestWithError<{ thread_id: string }>(
      `${RAILS_BASE}/mail/threads`,
      { method: "POST", body: JSON.stringify({ topic }) }
    ),

    /** Send message */
    send: (req: MailSendRequest) => apiRequestWithError<{ sent: boolean }>(
      `${RAILS_BASE}/mail/send`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Get inbox */
    inbox: (req: MailInboxRequest = {}) => apiRequestWithError<{ messages: MailMessage[] }>(
      `${RAILS_BASE}/mail/inbox`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Acknowledge message */
    ack: (threadId: string, messageId: string, note?: string) => apiRequestWithError<void>(
      `${RAILS_BASE}/mail/ack`,
      { method: "POST", body: JSON.stringify({ thread_id: threadId, message_id: messageId, note }) }
    ),

    /** Request review */
    requestReview: (threadId: string, wihId: string, diffRef: string) => apiRequestWithError<void>(
      `${RAILS_BASE}/mail/review`,
      { method: "POST", body: JSON.stringify({ thread_id: threadId, wih_id: wihId, diff_ref: diffRef }) }
    ),

    /** Decide on review */
    decide: (threadId: string, approve: boolean, notesRef?: string) => apiRequestWithError<void>(
      `${RAILS_BASE}/mail/decide`,
      { method: "POST", body: JSON.stringify({ thread_id: threadId, approve, notes_ref: notesRef }) }
    ),

    /** Reserve via mail */
    reserve: (wihId: string, agentId: string, paths: string[], ttl?: number) => apiRequestWithError<void>(
      `${RAILS_BASE}/mail/reserve`,
      { method: "POST", body: JSON.stringify({ wih_id: wihId, agent_id: agentId, paths, ttl }) }
    ),

    /** Share asset */
    share: (threadId: string, assetRef: string, note?: string) => apiRequestWithError<MailShareResponse>(
      `${RAILS_BASE}/mail/share`,
      { method: "POST", body: JSON.stringify({ thread_id: threadId, asset_ref: assetRef, note }) }
    ),

    /** Archive thread */
    archive: (threadId: string, path: string, reason?: string) => apiRequestWithError<void>(
      `${RAILS_BASE}/mail/archive`,
      { method: "POST", body: JSON.stringify({ thread_id: threadId, path, reason }) }
    ),

    /** Guard action */
    guard: (action: string, detail?: string) => apiRequestWithError<void>(
      `${RAILS_BASE}/mail/guard`,
      { method: "POST", body: JSON.stringify({ action, detail }) }
    ),
  },

  // ============================================================================
  // GATE - Policy Enforcement
  // ============================================================================
  
  gate: {
    /** Get gate status */
    status: () => apiRequestWithError<{ status: string }>(
      `${RAILS_BASE}/gate/status`
    ),

    /** Check if action allowed */
    check: (req: GateCheckRequest) => apiRequestWithError<GateCheckResponse>(
      `${RAILS_BASE}/gate/check`,
      { method: "POST", body: JSON.stringify(req) }
    ),

    /** Get GATE_RULES.md */
    rules: () => apiRequestWithError<{ rules?: string }>(
      `${RAILS_BASE}/gate/rules`
    ),

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
    decision: (note: string, reason?: string, links: string[] = []) => apiRequestWithError<{
      decision_id: string;
    }>(
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
    /** Rebuild index from ledger */
    rebuild: () => apiRequestWithError<{ indexed_count: number }>(
      `${RAILS_BASE}/index/rebuild`,
      { method: "POST" }
    ),
  },
};

export default railsApi;
