//! Rails System Integration
//!
//! Provides HTTP API for the A2R Agent System Rails:
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
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, error, info, warn};

use a2r_agent_system_rails::{
    ContextPackStore, ContextPackStoreOptions, DagMutation, Gate, GateOptions, Index, IndexOptions,
    LeaseRecord, LeaseRequest, Leases, LeasesOptions, Ledger, LedgerQuery, Mail, MailOptions,
    ReceiptStore, ReceiptStoreOptions, Vault, VaultOptions, WorkOps,
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
        let ledger = Arc::new(Ledger::new(a2r_agent_system_rails::LedgerOptions {
            root_dir: Some(root_dir.clone()),
            ledger_dir: Some(std::path::PathBuf::from(".a2r/ledger")),
        }));

        // Initialize Leases
        let leases = Arc::new(
            Leases::new(LeasesOptions {
                root_dir: Some(root_dir.clone()),
                leases_dir: Some(std::path::PathBuf::from(".a2r/leases")),
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
            receipts_dir: Some(std::path::PathBuf::from(".a2r/receipts")),
            blobs_dir: Some(std::path::PathBuf::from(".a2r/blobs")),
        })?);

        // Initialize Context Packs
        let context_packs = Arc::new(ContextPackStore::new(ContextPackStoreOptions {
            root_dir: Some(root_dir.clone()),
            context_packs_dir: Some(std::path::PathBuf::from(".a2r/context-packs")),
        })?);

        // Initialize Index
        let index = Arc::new(
            Index::new(IndexOptions {
                root_dir: Some(root_dir.clone()),
                index_dir: Some(std::path::PathBuf::from(".a2r/index")),
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
            root_dir: Some(root_dir.clone()),
            actor_id: Some("api".to_string()),
            strict_provenance: None,
        }));

        // Initialize Mail
        let mail = Arc::new(Mail::new(MailOptions {
            root_dir: Some(root_dir.clone()),
            mail_dir: Some(std::path::PathBuf::from(".a2r/mail")),
        })?);

        // Initialize WorkOps
        let work_ops = Arc::new(WorkOps::new(
            ledger.clone(),
            gate.clone(),
            std::path::PathBuf::from(".a2r/work"),
        ));

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

pub fn rails_router() -> Router<RailsState> {
    Router::new()
        // Health
        .route("/health", get(health_check))
        // Ledger
        .route("/ledger/events", get(query_ledger))
        // DAGs / Work
        .route("/workspace/:workspace_id/dags", get(list_dags))
        .route("/workspace/:workspace_id/dags", post(create_dag))
        .route("/workspace/:workspace_id/dags/:dag_id", get(get_dag))
        .route("/workspace/:workspace_id/dags/:dag_id/start", post(start_dag))
        // Leases
        .route("/leases", post(request_lease))
        .route("/leases/:lease_id", get(get_lease))
        // Context Packs (Checkpoints)
        .route("/workspace/:workspace_id/packs", post(create_context_pack))
        .route("/workspace/:workspace_id/packs/:pack_id", get(get_context_pack))
        // Gate / Policy
        .route("/gate/evaluate", post(evaluate_policy))
}

// ============================================================================
// Health
// ============================================================================

async fn health_check(State(state): State<RailsState>) -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "rails": {
            "ledger": true,
            "gate": true,
            "leases": true,
        }
    }))
}

// ============================================================================
// Ledger
// ============================================================================

#[derive(Debug, Deserialize)]
struct LedgerQueryParams {
    since: Option<String>,
    dag_id: Option<String>,
    wih_id: Option<String>,
    limit: Option<usize>,
}

async fn query_ledger(
    State(state): State<RailsState>,
    Query(params): Query<LedgerQueryParams>,
) -> impl IntoResponse {
    debug!(?params, "Querying ledger");

    let mut scope = a2r_agent_system_rails::EventScope::default();
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

    match state.ledger.query(query).await {
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

// ============================================================================
// DAGs / Work
// ============================================================================

async fn list_dags(
    State(state): State<RailsState>,
    Path(workspace_id): Path<String>,
) -> impl IntoResponse {
    debug!(workspace_id, "Listing DAGs");

    // Query work_ops for DAGs
    match state.work_ops.list_dags(&workspace_id).await {
        Ok(dags) => {
            let response: Vec<DagSummaryResponse> = dags
                .into_iter()
                .map(|(dag_id, dag)| DagSummaryResponse {
                    dag_id,
                    status: format!("{:?}", dag.status),
                    node_count: dag.nodes.len(),
                    created_at: dag.created_at,
                    updated_at: dag.updated_at,
                })
                .collect();
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(e) => {
            error!(error = %e, "Failed to list DAGs");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
                .into_response()
        }
    }
}

#[derive(Debug, Serialize)]
struct DagSummaryResponse {
    dag_id: String,
    status: String,
    node_count: usize,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
struct CreateDagRequest {
    dag_id: Option<String>,
    name: String,
    description: Option<String>,
}

async fn create_dag(
    State(state): State<RailsState>,
    Path(workspace_id): Path<String>,
    Json(req): Json<CreateDagRequest>,
) -> impl IntoResponse {
    info!(workspace_id, name = req.name, "Creating DAG");

    let dag_id = req.dag_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let mutation = DagMutation::Create {
        dag_id: dag_id.clone(),
        name: req.name,
        description: req.description.unwrap_or_default(),
    };

    match state.work_ops.apply_mutation(&workspace_id, mutation).await {
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
    State(state): State<RailsState>,
    Path((workspace_id, dag_id)): Path<(String, String)>,
) -> impl IntoResponse {
    debug!(workspace_id, dag_id, "Getting DAG");

    match state.work_ops.get_dag(&workspace_id, &dag_id).await {
        Ok(Some(dag)) => {
            let response = DagDetailResponse {
                dag_id: dag.dag_id,
                status: format!("{:?}", dag.status),
                nodes: dag
                    .nodes
                    .into_iter()
                    .map(|(id, n)| DagNodeResponse {
                        id,
                        name: n.name,
                        description: n.description,
                        status: format!("{:?}", n.status),
                        execution_mode: format!("{:?}", n.execution_mode),
                        blocked_by: n.blocked_by,
                        related_to: n.related_to,
                    })
                    .collect(),
                edges: dag.edges.into_iter().map(|e| DagEdgeResponse {
                    from: e.from_node_id,
                    to: e.to_node_id,
                    edge_type: format!("{:?}", e.edge_type),
                }).collect(),
                created_at: dag.created_at,
                updated_at: dag.updated_at,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "DAG not found" }))).into_response(),
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

async fn start_dag(
    State(state): State<RailsState>,
    Path((workspace_id, dag_id)): Path<(String, String)>,
) -> impl IntoResponse {
    info!(workspace_id, dag_id, "Starting DAG execution");

    let mutation = DagMutation::Start { dag_id: dag_id.clone() };

    match state.work_ops.apply_mutation(&workspace_id, mutation).await {
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

// ============================================================================
// Leases
// ============================================================================

#[derive(Debug, Deserialize)]
struct RequestLeaseRequest {
    wih_id: String,
    agent_id: String,
    paths: Vec<String>,
    ttl_seconds: Option<i64>,
}

async fn request_lease(
    State(state): State<RailsState>,
    Json(req): Json<RequestLeaseRequest>,
) -> impl IntoResponse {
    info!(wih_id = req.wih_id, "Requesting lease");

    let lease_req = LeaseRequest {
        lease_id: uuid::Uuid::new_v4().to_string(),
        wih_id: req.wih_id,
        agent_id: req.agent_id,
        paths: req.paths,
        requested_at: chrono::Utc::now().to_rfc3339(),
        ttl_seconds: req.ttl_seconds,
    };

    match state.leases.request(lease_req).await {
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
    State(state): State<RailsState>,
    Path(lease_id): Path<String>,
) -> impl IntoResponse {
    debug!(lease_id, "Getting lease");

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

// ============================================================================
// Context Packs (Checkpoints)
// ============================================================================

#[derive(Debug, Deserialize)]
struct CreatePackRequest {
    dag_id: Option<String>,
    wih_id: Option<String>,
    run_id: Option<String>,
}

async fn create_context_pack(
    State(state): State<RailsState>,
    Path(workspace_id): Path<String>,
    Json(req): Json<CreatePackRequest>,
) -> impl IntoResponse {
    info!(workspace_id, "Creating context pack (checkpoint)");

    let inputs = a2r_agent_system_rails::ContextPackInputs {
        dag_id: req.dag_id,
        wih_id: req.wih_id,
        run_id: req.run_id,
        files: vec![],
        environment: std::collections::HashMap::new(),
    };

    match state.context_packs.create(inputs).await {
        Ok(pack_id) => (
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
    State(state): State<RailsState>,
    Path((workspace_id, pack_id)): Path<(String, String)>,
) -> impl IntoResponse {
    debug!(workspace_id, pack_id, "Getting context pack");

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

// ============================================================================
// Gate / Policy
// ============================================================================

#[derive(Debug, Deserialize)]
struct EvaluatePolicyRequest {
    action: String,
    resource: String,
    tenant_id: String,
    context: Option<serde_json::Value>,
}

async fn evaluate_policy(
    State(state): State<RailsState>,
    Json(req): Json<EvaluatePolicyRequest>,
) -> impl IntoResponse {
    debug!(action = req.action, resource = req.resource, "Evaluating policy");

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
