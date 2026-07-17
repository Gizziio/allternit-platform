//! Rails System Integration
//!
//! Provides HTTP API for the Allternit Agent System Rails:
//! - Ledger event querying
//! - DAG/Work management
//! - Lease operations
//! - Policy gate queries

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
pub mod routes_cowork;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::{debug, error, info};

use crate::AppState;
use allternit_agent_system_rails::receipts::ReceiptQuery;
use allternit_agent_system_rails::{
    project_dag, ContextPackSeal, ContextPackStore, ContextPackStoreOptions, DagMutation, Gate,
    GateOptions, Index, IndexOptions, Leases, LeasesOptions, Ledger, LedgerOptions, LedgerQuery,
    Mail, MailOptions, ReceiptRecord, ReceiptStore, ReceiptStoreOptions, Vault, VaultOptions,
    WorkOps,
};

// ============================================================================
// State
// ============================================================================

/// Rails service state shared across handlers
#[derive(Clone)]
pub struct RailsState {
    pub ledger: Arc<Ledger>,
    pub gate: Arc<Gate>,
    pub leases: Arc<Leases>,
    pub mail: Arc<Mail>,
    pub vault: Arc<Vault>,
    pub index: Arc<Index>,
    pub receipts: Arc<ReceiptStore>,
    pub work_ops: Arc<WorkOps>,
    pub context_packs: Arc<ContextPackStore>,
}

impl RailsState {
    pub async fn new(root_dir: std::path::PathBuf) -> anyhow::Result<Self> {
        info!("Initializing Rails service state...");

        // Initialize Ledger
        let ledger = Arc::new(Ledger::new(LedgerOptions {
            root_dir: Some(root_dir.clone()),
            ledger_dir: Some(std::path::PathBuf::from(".allternit/ledger")),
        }));

        // Initialize Leases
        let leases = Arc::new(
            Leases::new(LeasesOptions {
                root_dir: Some(root_dir.clone()),
                leases_dir: Some(std::path::PathBuf::from(".allternit/leases")),
                event_sink: Some(ledger.clone()),
                actor_id: Some("api".to_string()),
                auto_renewal_enabled: true,
                auto_renewal_threshold_seconds: 300,
                auto_renewal_interval_seconds: 60,
                auto_renewal_extend_seconds: 600,
            })
            .await?,
        );

        // Initialize Receipts
        let receipts = Arc::new(ReceiptStore::new(ReceiptStoreOptions {
            root_dir: Some(root_dir.clone()),
            receipts_dir: Some(std::path::PathBuf::from(".allternit/receipts")),
            blobs_dir: Some(std::path::PathBuf::from(".allternit/blobs")),
        })?);

        // Initialize Context Packs
        let context_packs = Arc::new(ContextPackStore::new(ContextPackStoreOptions {
            root_dir: Some(root_dir.clone()),
            context_packs_dir: Some(std::path::PathBuf::from(".allternit/context-packs")),
        })?);

        // Initialize Index
        let index = Arc::new(
            Index::new(IndexOptions {
                root_dir: Some(root_dir.clone()),
                index_dir: Some(std::path::PathBuf::from(".allternit/index")),
            })
            .await?,
        );

        // Initialize Vault
        let vault = Arc::new(Vault::new(VaultOptions {
            root_dir: Some(root_dir.clone()),
            ledger: ledger.clone(),
            actor_id: Some("api".to_string()),
        }));

        // Initialize Gate
        let gate = Arc::new(Gate::new(GateOptions {
            ledger: ledger.clone(),
            leases: leases.clone(),
            receipts: receipts.clone(),
            index: Some(index.clone()),
            vault: Some(vault.clone()),
            oauth_vault: None,
            root_dir: Some(root_dir.clone()),
            actor_id: Some("api".to_string()),
            strict_provenance: Some(true),
            visual_provider: None,
            visual_config: None,
        }));

        // Initialize Mail
        let mail = Arc::new(Mail::new(MailOptions {
            root_dir: Some(root_dir.clone()),
            ledger: ledger.clone(),
            actor_id: Some("api".to_string()),
            actor_type: None,
        }));

        // Initialize WorkOps
        let work_ops = Arc::new(WorkOps::new(ledger.clone(), Some("api".to_string()), None));

        info!("Rails service state initialized successfully");

        Ok(Self {
            ledger,
            gate,
            leases,
            mail,
            vault,
            index,
            receipts,
            work_ops,
            context_packs,
        })
    }
}

// ============================================================================
// Routes
// ============================================================================

pub fn rails_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(rails_status))
        // Health
        .route("/health", get(health_check))
        // Ledger
        .route("/ledger/events", get(query_ledger))
        .route("/ledger/tail", post(tail_ledger))
        // Receipts
        .route("/receipts", post(query_receipts))
        .route("/receipts/write", post(write_receipt))
        // Mail (orchestrator bridge / CLI agent access)
        .route("/mail/send", post(mail_send))
        .route("/mail/threads", get(list_mail_threads))
        .route("/mail/thread/:thread_id", get(read_mail_thread))
        .route("/mail/share", post(mail_share))
        .route("/mail/decide", post(mail_decide))
        // WIHs (compatibility surface used by platform cowork/chat views)
        .route("/wihs", get(list_wihs_get).post(list_wihs))
        .route("/wihs/pickup", post(pickup_wih))
        .route("/wihs/:wih_id/context", get(get_wih_context))
        .route("/wihs/:wih_id/sign", post(sign_wih))
        .route("/wihs/:wih_id/close", post(close_wih))
        // DAGs / Work
        .route("/workspace/:workspace_id/dags", get(list_dags))
        .route("/workspace/:workspace_id/dags", post(create_dag))
        .route("/workspace/:workspace_id/dags/:dag_id", get(get_dag))
        .route(
            "/workspace/:workspace_id/dags/:dag_id/start",
            post(start_dag),
        )
        // Leases
        .route("/leases", post(request_lease))
        .route("/leases/:lease_id", get(get_lease))
        // Context Packs (Checkpoints)
        .route("/workspace/:workspace_id/packs", post(create_context_pack))
        .route(
            "/workspace/:workspace_id/packs/:pack_id",
            get(get_context_pack),
        )
        // Gate / Policy
        .route("/gate/evaluate", post(evaluate_policy))
        // Vault
        .route("/vault/status", get(vault_status))
        .route("/vault/archive", post(vault_archive))
}

// ============================================================================
// Handlers
// ============================================================================

async fn rails_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "rails",
    }))
}

async fn health_check(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let _ = state;
    Json(serde_json::json!({
        "status": "healthy",
        "rails": {
            "ledger": true,
            "gate": true,
            "leases": true,
        }
    }))
}

#[derive(Debug, Deserialize)]
struct LedgerQueryParams {
    since: Option<String>,
    dag_id: Option<String>,
    wih_id: Option<String>,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
struct WihListRequest {
    dag_id: Option<String>,
    ready_only: Option<bool>,
}

#[derive(Debug, Serialize)]
struct WihInfoResponse {
    wih_id: String,
    node_id: String,
    dag_id: Option<String>,
    status: String,
    title: Option<String>,
    description: Option<String>,
    assignee: Option<String>,
    blocked_by: Vec<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize)]
struct WihListResponse {
    wihs: Vec<WihInfoResponse>,
}

#[derive(Debug, Deserialize)]
struct WihPickupRequest {
    dag_id: String,
    node_id: String,
    agent_id: String,
    role: Option<String>,
    fresh: Option<bool>,
}

#[derive(Debug, Serialize)]
struct WihPickupResponse {
    wih_id: String,
    context_pack_path: Option<String>,
}

#[derive(Debug, Serialize)]
struct WihContextResponse {
    wih_id: String,
    context_pack: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WihSignRequest {
    signature: String,
}

#[derive(Debug, Serialize)]
struct WihSignResponse {
    signed: bool,
}

#[derive(Debug, Deserialize)]
struct WihCloseRequest {
    status: String,
    evidence: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
struct WihCloseResponse {
    closed: bool,
}

async fn query_ledger(
    State(state): State<Arc<AppState>>,
    Query(params): Query<LedgerQueryParams>,
) -> impl IntoResponse {
    debug!(?params, "Querying ledger");

    let mut scope = allternit_agent_system_rails::EventScope::default();
    if let Some(dag_id) = params.dag_id {
        scope.dag_id = Some(dag_id);
    }
    if let Some(wih_id) = params.wih_id {
        scope.wih_id = Some(wih_id);
    }

    let query = LedgerQuery {
        r#type: None,
        types: None,
        scope: if scope.dag_id.is_some() || scope.wih_id.is_some() {
            Some(scope)
        } else {
            None
        },
        since: params.since,
        until: None,
        limit: params.limit.or(Some(100)),
    };

    match state.rails.ledger.query(query).await {
        Ok(events) => {
            let response: Vec<LedgerEventResponse> = events
                .into_iter()
                .map(|e| LedgerEventResponse {
                    event_id: e.event_id,
                    ts: e.ts,
                    actor_type: format!("{:?}", e.actor.r#type),
                    actor_id: e.actor.id,
                    event_type: e.r#type,
                    payload: e.payload,
                    scope: e.scope.map(|s| EventScopeResponse {
                        dag_id: s.dag_id,
                        wih_id: s.wih_id,
                        run_id: s.run_id,
                    }),
                })
                .collect();
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!(error = %e, "Failed to query ledger");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

/// Request body for the UI's ledger tail surface (`rails.service.ts` ledger.tail).
#[derive(Debug, Deserialize)]
struct LedgerTailRequest {
    count: Option<usize>,
}

/// Ledger event shape the web surfaces render (`rails.service.ts` LedgerEvent).
#[derive(Debug, Serialize)]
struct UiLedgerEvent {
    event_id: String,
    event_type: String,
    timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    scope: Option<UiLedgerEventScope>,
    payload: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct UiLedgerEventScope {
    #[serde(skip_serializing_if = "Option::is_none")]
    dag_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    wih_id: Option<String>,
}

async fn tail_ledger(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LedgerTailRequest>,
) -> impl IntoResponse {
    let count = req.count.unwrap_or(50);
    debug!(count, "Tailing ledger");

    match state.rails.ledger.tail(count).await {
        Ok(events) => {
            let response: Vec<UiLedgerEvent> = events
                .into_iter()
                .map(|e| UiLedgerEvent {
                    event_id: e.event_id,
                    event_type: e.r#type,
                    timestamp: e.ts,
                    scope: e.scope.map(|s| UiLedgerEventScope {
                        dag_id: s.dag_id,
                        node_id: s.node_id,
                        wih_id: s.wih_id,
                    }),
                    payload: e.payload,
                })
                .collect();
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!(error = %e, "Failed to tail ledger");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

/// Request body for the UI's receipts surface (`rails.service.ts` ReceiptQueryRequest).
#[derive(Debug, Deserialize)]
struct ReceiptsUiQueryRequest {
    dag_id: Option<String>,
    node_id: Option<String>,
    wih_id: Option<String>,
    kinds: Option<Vec<String>>,
    since: Option<String>,
    until: Option<String>,
    limit: Option<usize>,
}

async fn query_receipts(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ReceiptsUiQueryRequest>,
) -> impl IntoResponse {
    debug!(limit = ?req.limit, "Querying receipts");

    // Records carry only run_id/tool; the orchestrator bridge tags executor
    // receipts with run_id = executor slug, so dag/node filters map to run_id.
    const TOOL_CALL_KIND: &str = "tool_call_post";
    if let Some(kinds) = &req.kinds {
        if !kinds.iter().any(|k| k == TOOL_CALL_KIND) {
            return (StatusCode::OK, Json(json!({ "receipts": [] }))).into_response();
        }
    }

    let since_ts = req.since.as_deref().and_then(parse_rfc3339);
    let until_ts = req.until.as_deref().and_then(parse_rfc3339);

    let store_query = ReceiptQuery {
        run_id: req
            .node_id
            .clone()
            .or_else(|| req.dag_id.clone())
            .or_else(|| req.wih_id.clone()),
        limit: req.limit,
        ..Default::default()
    };

    let records = match state.rails.receipts.query_receipts(&store_query) {
        Ok(records) => records,
        Err(e) => {
            error!(error = %e, "Failed to query receipts");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let receipts: Vec<serde_json::Value> = records
        .into_iter()
        .filter_map(|record| {
            let written_at = receipt_written_at(&state.rails, &record.receipt_id);
            if let Some(since) = since_ts {
                if written_at < since {
                    return None;
                }
            }
            if let Some(until) = until_ts {
                if written_at > until {
                    return None;
                }
            }
            let outputs_ref = record.outputs_ref.clone();
            let run_id = record.run_id.clone();
            let mut payload = serde_json::to_value(&record).unwrap_or_else(|_| json!({}));
            // Artifact scanners (ArtifactCenter, executor tiles) look for a
            // `path` key in the payload — alias outputs_ref to it.
            if let (Some(obj), Some(reference)) = (payload.as_object_mut(), outputs_ref) {
                obj.insert("path".to_string(), json!(reference));
            }
            Some(json!({
                "receipt_id": record.receipt_id,
                "kind": TOOL_CALL_KIND,
                "run_id": run_id.clone(),
                "dag_id": "",
                "node_id": run_id,
                "wih_id": "",
                "timestamp": written_at.to_rfc3339(),
                "payload": payload,
            }))
        })
        .collect();

    (StatusCode::OK, Json(json!({ "receipts": receipts }))).into_response()
}

fn parse_rfc3339(value: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    chrono::DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|d| d.with_timezone(&chrono::Utc))
}

/// Receipts have no timestamp field; the receipt file's mtime is when it was
/// written. Falls back to the epoch if the file cannot be stat'ed.
fn receipt_written_at(rails: &RailsState, receipt_id: &str) -> chrono::DateTime<chrono::Utc> {
    let path = rails.receipts.receipt_path(receipt_id);
    std::fs::metadata(&path)
        .and_then(|m| m.modified())
        .map(chrono::DateTime::<chrono::Utc>::from)
        .unwrap_or_else(|_| chrono::DateTime::<chrono::Utc>::from(std::time::SystemTime::UNIX_EPOCH))
}

// ---------------------------------------------------------------------------
// Mail + receipt write routes (orchestrator bridge / CLI agent access)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct MailWriteRequest {
    thread: Option<String>,
    body_ref: Option<String>,
    body: Option<String>,
    attachments: Option<Vec<String>>,
}

async fn ensure_mail_thread(state: &AppState, topic: &str) -> Result<String, axum::response::Response> {
    state.rails.mail.ensure_thread(topic).await.map_err(|e| {
        error!(error = %e, "mail: ensure_thread failed");
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": e.to_string() })),
        )
            .into_response()
    })
}

async fn mail_send(
    State(state): State<Arc<AppState>>,
    Json(req): Json<MailWriteRequest>,
) -> impl IntoResponse {
    let topic = req.thread.unwrap_or_else(|| "default".to_string());
    let thread_id = match ensure_mail_thread(&state, &topic).await {
        Ok(id) => id,
        Err(response) => return response,
    };
    let body = req.body_ref.or(req.body).unwrap_or_default();
    match state
        .rails
        .mail
        .send_message(&thread_id, &body, req.attachments.unwrap_or_default())
        .await
    {
        Ok(_) => (StatusCode::OK, Json(json!({ "sent": true, "thread_id": thread_id }))).into_response(),
        Err(e) => {
            error!(error = %e, "mail: send_message failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn list_mail_threads(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.rails.mail.list_messages(None, 5000).await {
        Ok(events) => {
            // Events arrive sorted by ts ascending; overwriting keeps the latest.
            let mut threads: std::collections::HashMap<String, (usize, String)> =
                std::collections::HashMap::new();
            for evt in &events {
                if let Some(thread_id) = evt.payload.get("thread_id").and_then(|v| v.as_str()) {
                    let entry = threads
                        .entry(thread_id.to_string())
                        .or_insert((0, evt.ts.clone()));
                    entry.0 += 1;
                    entry.1 = evt.ts.clone();
                }
            }
            let rows: Vec<serde_json::Value> = threads
                .into_iter()
                .map(|(thread_id, (messages, last_ts))| {
                    json!({ "thread_id": thread_id, "messages": messages, "last_ts": last_ts })
                })
                .collect();
            (StatusCode::OK, Json(json!({ "threads": rows }))).into_response()
        }
        Err(e) => {
            error!(error = %e, "mail: list threads failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn read_mail_thread(
    State(state): State<Arc<AppState>>,
    Path(thread_id): Path<String>,
) -> impl IntoResponse {
    match state.rails.mail.list_messages(Some(&thread_id), 500).await {
        Ok(events) => {
            let messages: Vec<serde_json::Value> = events
                .into_iter()
                .map(|evt| {
                    let body = evt
                        .payload
                        .get("body_ref")
                        .cloned()
                        .unwrap_or(serde_json::Value::Null);
                    json!({
                        "message_id": evt.event_id,
                        "thread_id": thread_id.clone(),
                        "from_agent": evt.actor.id,
                        "body": body,
                        "event_type": evt.r#type,
                        "timestamp": evt.ts,
                    })
                })
                .collect();
            (StatusCode::OK, Json(json!({ "messages": messages }))).into_response()
        }
        Err(e) => {
            error!(error = %e, "mail: read thread failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
struct MailShareRequest {
    thread: Option<String>,
    asset_ref: Option<String>,
    path: Option<String>,
    note: Option<String>,
}

async fn mail_share(
    State(state): State<Arc<AppState>>,
    Json(req): Json<MailShareRequest>,
) -> impl IntoResponse {
    let asset = match req.asset_ref.or(req.path) {
        Some(asset) => asset,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "asset_ref or path required" })),
            )
                .into_response();
        }
    };
    let topic = req.thread.unwrap_or_else(|| "default".to_string());
    let thread_id = match ensure_mail_thread(&state, &topic).await {
        Ok(id) => id,
        Err(response) => return response,
    };
    match state
        .rails
        .mail
        .share_asset(&thread_id, &asset, req.note.as_deref())
        .await
    {
        Ok(share_id) => {
            // Self-announced assets become receipts so artifact surfaces
            // (ArtifactCenter, executor tiles) pick them up via one channel.
            let run_id = thread_id
                .strip_prefix("wih:executor-")
                .or_else(|| thread_id.strip_prefix("executor:"))
                .unwrap_or(&thread_id)
                .to_string();
            let receipt = ReceiptRecord {
                receipt_id: allternit_agent_system_rails::core::ids::create_receipt_id(),
                run_id,
                step: None,
                tool: "executor".to_string(),
                tool_version: None,
                inputs_ref: None,
                outputs_ref: Some(asset.clone()),
                exit: None,
                input_tokens: None,
                output_tokens: None,
                total_tokens: None,
            };
            if let Err(e) = state.rails.receipts.write_receipt(&receipt) {
                error!(error = %e, "receipt write for shared asset failed");
            }
            (
                StatusCode::OK,
                Json(json!({ "shared": true, "share_id": share_id, "thread_id": thread_id })),
            )
                .into_response()
        }
        Err(e) => {
            error!(error = %e, "mail: share_asset failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
struct MailDecideRequest {
    thread: Option<String>,
    decision: Option<String>,
    approve: Option<bool>,
    notes_ref: Option<String>,
}

async fn mail_decide(
    State(state): State<Arc<AppState>>,
    Json(req): Json<MailDecideRequest>,
) -> impl IntoResponse {
    let decision = match req.decision.or_else(|| {
        req.approve
            .map(|approve| if approve { "accepted".to_string() } else { "rejected".to_string() })
    }) {
        Some(decision) => decision,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "decision or approve required" })),
            )
                .into_response();
        }
    };
    let topic = req.thread.unwrap_or_else(|| "default".to_string());
    let thread_id = match ensure_mail_thread(&state, &topic).await {
        Ok(id) => id,
        Err(response) => return response,
    };
    match state
        .rails
        .mail
        .decide_review(&thread_id, &decision, req.notes_ref)
        .await
    {
        Ok(_) => (StatusCode::OK, Json(json!({ "decided": true, "thread_id": thread_id }))).into_response(),
        Err(e) => {
            error!(error = %e, "mail: decide_review failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
struct ReceiptWriteRequest {
    tool: Option<String>,
    run_id: Option<String>,
    inputs_ref: Option<String>,
    outputs_ref: Option<String>,
    exit_code: Option<i32>,
    summary: Option<String>,
}

async fn write_receipt(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ReceiptWriteRequest>,
) -> impl IntoResponse {
    let exit = if req.exit_code.is_some() || req.summary.is_some() {
        Some(allternit_agent_system_rails::core::types::ReceiptExit {
            code: req.exit_code,
            summary: req.summary,
        })
    } else {
        None
    };
    let receipt = ReceiptRecord {
        receipt_id: allternit_agent_system_rails::core::ids::create_receipt_id(),
        run_id: req.run_id.unwrap_or_else(|| "run_orchestrator".to_string()),
        step: None,
        tool: req.tool.unwrap_or_else(|| "executor".to_string()),
        tool_version: None,
        inputs_ref: req.inputs_ref,
        outputs_ref: req.outputs_ref,
        exit,
        input_tokens: None,
        output_tokens: None,
        total_tokens: None,
    };
    let receipt_id = receipt.receipt_id.clone();
    match state.rails.receipts.write_receipt(&receipt) {
        Ok(_) => (StatusCode::CREATED, Json(json!({ "receipt_id": receipt_id }))).into_response(),
        Err(e) => {
            error!(error = %e, "Failed to write receipt");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn list_wihs(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<WihListRequest>,
) -> impl IntoResponse {
    info!(dag_id = ?req.dag_id, ready_only = ?req.ready_only, "Listing WIHs");

    (StatusCode::OK, Json(WihListResponse { wihs: Vec::new() }))
}

async fn list_wihs_get(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    (StatusCode::OK, Json(WihListResponse { wihs: Vec::new() }))
}

async fn pickup_wih(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<WihPickupRequest>,
) -> impl IntoResponse {
    info!(
        dag_id = %req.dag_id,
        node_id = %req.node_id,
        agent_id = %req.agent_id,
        role = ?req.role,
        fresh = ?req.fresh,
        "Picking up WIH"
    );

    (
        StatusCode::OK,
        Json(WihPickupResponse {
            wih_id: format!("{}:{}", req.dag_id, req.node_id),
            context_pack_path: None,
        }),
    )
}

async fn get_wih_context(
    State(_state): State<Arc<AppState>>,
    Path(wih_id): Path<String>,
) -> impl IntoResponse {
    info!(wih_id = %wih_id, "Fetching WIH context");

    (
        StatusCode::OK,
        Json(WihContextResponse {
            wih_id,
            context_pack: None,
        }),
    )
}

async fn sign_wih(
    State(_state): State<Arc<AppState>>,
    Path(wih_id): Path<String>,
    Json(req): Json<WihSignRequest>,
) -> impl IntoResponse {
    info!(wih_id = %wih_id, signature = %req.signature, "Signing WIH");

    (StatusCode::OK, Json(WihSignResponse { signed: true }))
}

async fn close_wih(
    State(_state): State<Arc<AppState>>,
    Path(wih_id): Path<String>,
    Json(req): Json<WihCloseRequest>,
) -> impl IntoResponse {
    info!(
        wih_id = %wih_id,
        status = %req.status,
        evidence_count = req.evidence.as_ref().map(|items| items.len()).unwrap_or(0),
        "Closing WIH"
    );

    (StatusCode::OK, Json(WihCloseResponse { closed: true }))
}

async fn list_dags(
    State(state): State<Arc<AppState>>,
    Path(workspace_id): Path<String>,
) -> impl IntoResponse {
    debug!(workspace_id, "Listing DAGs");

    // Query ledger for all events to project DAGs
    match state.rails.ledger.query(LedgerQuery::default()).await {
        Ok(events) => {
            // Group events by dag_id and project each
            let mut dags = std::collections::HashMap::new();
            for event in &events {
                if let Some(dag_id) = event.payload.get("dag_id").and_then(|v| v.as_str()) {
                    if !dags.contains_key(dag_id) {
                        dags.insert(dag_id.to_string(), project_dag(&events, dag_id));
                    }
                }
            }

            let response: Vec<DagSummaryResponse> = dags
                .into_iter()
                .map(|(dag_id, dag)| {
                    let status = dag
                        .nodes
                        .values()
                        .find(|n| n.parent_node_id.is_none())
                        .map(|n| n.status.clone())
                        .unwrap_or_else(|| "UNKNOWN".to_string());

                    let created_at = dag
                        .nodes
                        .values()
                        .filter_map(|n| n.created_at.as_ref())
                        .min()
                        .cloned()
                        .unwrap_or_default();

                    let updated_at = dag
                        .nodes
                        .values()
                        .filter_map(|n| n.updated_at.as_ref())
                        .max()
                        .cloned()
                        .unwrap_or_default();

                    DagSummaryResponse {
                        dag_id,
                        status,
                        node_count: dag.nodes.len(),
                        created_at,
                        updated_at,
                    }
                })
                .collect();
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!(error = %e, "Failed to query ledger for DAGs");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn create_dag(
    State(state): State<Arc<AppState>>,
    Path(workspace_id): Path<String>,
    Json(req): Json<CreateDagRequest>,
) -> impl IntoResponse {
    info!(workspace_id, name = req.name, "Creating DAG");

    let dag_id = req
        .dag_id
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let node_id = format!("{}-root", dag_id);

    // In the new system, creating a DAG often means creating the first node
    let mutation = DagMutation::CreateNode {
        node_id: node_id.clone(),
        node_kind: "task".to_string(),
        title: req.name,
        parent_node_id: None,
        execution_mode: "shared".to_string(),
    };

    match state
        .rails
        .gate
        .mutate_with_decision(
            &dag_id,
            "Creating DAG from API",
            Some(req.description.unwrap_or_default()),
            vec![mutation],
        )
        .await
    {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "dag_id": dag_id,
                "status": "created",
            })),
        )
            .into_response(),
        Err(e) => {
            error!(error = %e, "Failed to create DAG");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn get_dag(
    State(state): State<Arc<AppState>>,
    Path((workspace_id, dag_id)): Path<(String, String)>,
) -> impl IntoResponse {
    debug!(workspace_id, dag_id, "Getting DAG");

    match state.rails.ledger.query(LedgerQuery::default()).await {
        Ok(events) => {
            let dag = project_dag(&events, &dag_id);
            let status = dag
                .nodes
                .values()
                .find(|n| n.parent_node_id.is_none())
                .map(|n| n.status.clone())
                .unwrap_or_else(|| "UNKNOWN".to_string());

            let created_at = dag
                .nodes
                .values()
                .filter_map(|n| n.created_at.as_ref())
                .min()
                .cloned()
                .unwrap_or_default();

            let updated_at = dag
                .nodes
                .values()
                .filter_map(|n| n.updated_at.as_ref())
                .max()
                .cloned()
                .unwrap_or_default();

            let response = DagDetailResponse {
                dag_id: dag.dag_id,
                status,
                nodes: dag
                    .nodes
                    .into_iter()
                    .map(|(id, n)| DagNodeResponse {
                        id,
                        name: n.title,
                        description: n.description.unwrap_or_default(),
                        status: n.status,
                        execution_mode: n.execution_mode,
                        blocked_by: vec![], // Edges handled separately
                        related_to: vec![], // Relations handled separately
                    })
                    .collect(),
                edges: dag
                    .edges
                    .into_iter()
                    .map(|e| DagEdgeResponse {
                        from: e.from_node_id,
                        to: e.to_node_id,
                        edge_type: e.edge_type,
                    })
                    .collect(),
                created_at,
                updated_at,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!(error = %e, "Failed to get DAG");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

async fn start_dag(
    State(state): State<Arc<AppState>>,
    Path((workspace_id, dag_id)): Path<(String, String)>,
) -> impl IntoResponse {
    info!(workspace_id, dag_id, "Starting DAG execution");

    // Starting a DAG usually means setting the state of its root node(s)
    let mutation = DagMutation::SetState {
        node_id: format!("{}-root", dag_id),
        dimension: "status".to_string(),
        value: "RUNNING".to_string(),
        reason: Some("Starting via API".to_string()),
    };

    match state
        .rails
        .gate
        .mutate_with_decision(&dag_id, "Starting DAG", None, vec![mutation])
        .await
    {
        Ok(_) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "dag_id": dag_id,
                "status": "started",
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn request_lease(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RequestLeaseRequest>,
) -> impl IntoResponse {
    info!(wih_id = req.wih_id, "Requesting lease");

    let lease_req = allternit_agent_system_rails::LeaseRequest {
        lease_id: uuid::Uuid::new_v4().to_string(),
        wih_id: req.wih_id,
        agent_id: req.agent_id,
        paths: req.paths,
        requested_at: chrono::Utc::now().to_rfc3339(),
        ttl_seconds: req.ttl_seconds,
    };

    match state.rails.leases.request(lease_req).await {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "lease_id": uuid::Uuid::new_v4().to_string(), // Would return actual lease_id
                "status": "requested",
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn get_lease(
    State(state): State<Arc<AppState>>,
    Path(lease_id): Path<String>,
) -> impl IntoResponse {
    debug!(lease_id, "Getting lease");
    let _ = state;

    // Placeholder - would query leases
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "lease_id": lease_id,
            "status": "granted",
        })),
    )
        .into_response()
}

async fn create_context_pack(
    State(state): State<Arc<AppState>>,
    Path(workspace_id): Path<String>,
    Json(req): Json<CreatePackRequest>,
) -> impl IntoResponse {
    info!(workspace_id, "Creating context pack (checkpoint)");

    let pack_id = format!("cp_{}", uuid::Uuid::new_v4());
    let seal = ContextPackSeal {
        pack_id: pack_id.clone(),
        wih_id: req.wih_id.unwrap_or_else(|| "default".to_string()),
        dag_id: req.dag_id.unwrap_or_else(|| "default".to_string()),
        node_id: req.run_id.unwrap_or_else(|| "default".to_string()),
        inputs_manifest: vec![],
        method_version: "1.0.0".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        policy_bundle: None,
    };

    match state.rails.context_packs.store_seal(&seal) {
        Ok(_) => (
            StatusCode::CREATED,
            Json(serde_json::json!({
                "pack_id": pack_id,
                "status": "created",
            })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn get_context_pack(
    State(state): State<Arc<AppState>>,
    Path((workspace_id, pack_id)): Path<(String, String)>,
) -> impl IntoResponse {
    debug!(workspace_id, pack_id, "Getting context pack");
    let _ = state;

    // Placeholder
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "pack_id": pack_id,
            "status": "available",
        })),
    )
        .into_response()
}

async fn evaluate_policy(
    State(state): State<Arc<AppState>>,
    Json(req): Json<EvaluatePolicyRequest>,
) -> impl IntoResponse {
    debug!(
        action = req.action,
        resource = req.resource,
        tenant_id = req.tenant_id,
        context = ?req.context,
        "Evaluating policy"
    );
    let _ = state;

    // Placeholder - actual implementation would use Gate.evaluate()
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "action": req.action,
            "decision": "allow",
            "requires_approval": false,
        })),
    )
        .into_response()
}

/// Vault jobs are recorded in the ledger as `VaultJobCompleted` events (see
/// `Vault::archive_wih`). Status maps them to the shape the UI polls.
async fn vault_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.rails.ledger.query(LedgerQuery::default()).await {
        Ok(events) => {
            let jobs: Vec<serde_json::Value> = events
                .into_iter()
                .filter(|e| e.r#type == "VaultJobCompleted")
                .map(|e| {
                    let wih_id = e
                        .payload
                        .get("wih_id")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    json!({
                        "wih_id": wih_id,
                        "status": "completed",
                        "created_at": e.ts,
                        "completed_at": e.ts,
                    })
                })
                .collect();
            (StatusCode::OK, Json(json!({ "jobs": jobs }))).into_response()
        }
        Err(e) => {
            error!(error = %e, "Failed to query vault jobs");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Deserialize)]
struct VaultArchiveRequest {
    wih_id: String,
}

async fn vault_archive(
    State(state): State<Arc<AppState>>,
    Json(req): Json<VaultArchiveRequest>,
) -> impl IntoResponse {
    info!(wih_id = %req.wih_id, "Archiving WIH to vault");

    match state.rails.vault.archive_wih(&req.wih_id).await {
        Ok(path) => (
            StatusCode::OK,
            Json(json!({
                "archived": true,
                "path": path.to_string_lossy().to_string(),
            })),
        )
            .into_response(),
        Err(e) => {
            error!(error = %e, wih_id = %req.wih_id, "Failed to archive WIH");
            let status = if e.to_string().contains("not found") {
                StatusCode::NOT_FOUND
            } else {
                StatusCode::INTERNAL_SERVER_ERROR
            };
            (status, Json(json!({ "error": e.to_string() }))).into_response()
        }
    }
}

// ============================================================================
// Response Structs
// ============================================================================

#[derive(Debug, Serialize)]
struct LedgerEventResponse {
    event_id: String,
    ts: String,
    actor_type: String,
    actor_id: String,
    event_type: String,
    payload: serde_json::Value,
    scope: Option<EventScopeResponse>,
}

#[derive(Debug, Serialize)]
struct EventScopeResponse {
    dag_id: Option<String>,
    wih_id: Option<String>,
    run_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct DagSummaryResponse {
    dag_id: String,
    status: String,
    node_count: usize,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct DagDetailResponse {
    dag_id: String,
    status: String,
    nodes: Vec<DagNodeResponse>,
    edges: Vec<DagEdgeResponse>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
struct DagNodeResponse {
    id: String,
    name: String,
    description: String,
    status: String,
    execution_mode: String,
    blocked_by: Vec<String>,
    related_to: Vec<String>,
}

#[derive(Debug, Serialize)]
struct DagEdgeResponse {
    from: String,
    to: String,
    edge_type: String,
}

// ============================================================================
// Request Structs
// ============================================================================

#[derive(Debug, Deserialize)]
struct CreateDagRequest {
    dag_id: Option<String>,
    name: String,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RequestLeaseRequest {
    wih_id: String,
    agent_id: String,
    paths: Vec<String>,
    ttl_seconds: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct CreatePackRequest {
    dag_id: Option<String>,
    wih_id: Option<String>,
    run_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EvaluatePolicyRequest {
    action: String,
    resource: String,
    tenant_id: String,
    context: Option<serde_json::Value>,
}
