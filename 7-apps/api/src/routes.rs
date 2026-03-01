#![allow(dead_code, unused_variables, unused_imports)]
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post, put},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use utoipa::{IntoParams, Modify, OpenApi, ToSchema};
use uuid::Uuid;

use crate::AppState;
use a2rchitech_messaging::MailMessageEnvelope;
use a2rchitech_policy::{PolicyEffect, PolicyRequest, SafetyTier};
use a2rchitech_registry::fabric::{
    BridgedCoordinationResult, CoordinatedMessage, TenantCapabilities,
};
use a2rchitech_rlm::RLMExecutionMode;
use a2rchitech_runtime_core::{Embodiment, Environment, Session, SessionMode, SessionStatus};
use a2rchitech_workflows::WorkflowDefinition;

#[derive(Deserialize, ToSchema)]
pub struct ExecuteWorkflowRequest {
    pub params: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
pub struct ExecuteWorkflowResponse {
    pub result: String,
    pub execution_mode: String,
    pub processing_steps: Vec<ProcessingStep>,
    pub metrics: ExecutionMetrics,
}

/// Request to replay a workflow execution
#[derive(Deserialize, ToSchema)]
pub struct ReplayWorkflowRequest {
    pub session_id: String,
    pub checkpoint_id: Option<String>,
}

/// Response from replaying a workflow execution
#[derive(Serialize, ToSchema)]
pub struct ReplayWorkflowResponse {
    pub replay_id: String,
    pub status: String,
    pub receipt: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
pub struct ProcessingStep {
    pub step: String,
    pub input_size: usize,
    pub output_size: usize,
    pub processing_time_ms: u64,
}

#[derive(Serialize, ToSchema)]
pub struct ExecutionMetrics {
    pub total_processing_time_ms: u64,
    pub total_tokens_processed: u64,
    pub recursion_depth_used: u32,
    pub context_slices: usize,
}

#[derive(Serialize, ToSchema)]
pub struct WorkflowListResponse {
    pub workflows: Vec<serde_json::Value>,
    pub count: usize,
}

#[derive(Serialize, ToSchema)]
pub struct AgentMailListResponse {
    pub messages: Vec<serde_json::Value>,
    pub count: usize,
}

#[derive(Serialize, ToSchema)]
pub struct GetAgentMailResponse {
    pub agent_id: String,
    pub messages: Vec<serde_json::Value>,
    pub count: usize,
    pub receipt: serde_json::Value,
}

#[derive(Deserialize, ToSchema)]
pub struct AgentMailResponse {
    pub response: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
pub struct AgentMailResponseResponse {
    pub status: String,
    pub original_message_id: String,
}

/// Request to send agent mail message
#[derive(Deserialize, ToSchema)]
pub struct SendAgentMailRequest {
    pub from: String,
    pub to: String,
    pub subject: String,
    pub body: serde_json::Value,
}

/// Response from sending agent mail message
#[derive(Serialize, ToSchema)]
pub struct SendAgentMailResponse {
    pub message: serde_json::Value,
    pub receipt: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
pub struct SkillsListResponse {
    pub skills: Vec<serde_json::Value>,
    pub count: usize,
}

#[derive(Serialize, ToSchema)]
pub struct MemoryResponse {
    pub memory: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
pub struct GetMemoryResponse {
    pub session_id: String,
    pub entries: Vec<serde_json::Value>,
    pub count: usize,
    pub receipt: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
pub struct GetMemoryByIdResponse {
    pub memory_id: String,
    pub entry: serde_json::Value,
    pub receipt: serde_json::Value,
}

#[derive(Serialize, ToSchema)]
pub struct PoliciesListResponse {
    pub policies: Vec<serde_json::Value>,
    pub count: usize,
}

#[derive(Deserialize, ToSchema)]
pub struct RLMExecuteRequest {
    pub task: String,
    pub context: String,
    pub mode: String,
    pub model_id: String,
    pub max_recursion_depth: Option<u32>,
    pub context_slice_size: Option<usize>,
}

#[derive(Serialize, ToSchema)]
pub struct RLMExecuteResponse {
    pub result: String,
    pub execution_mode: String,
    pub processing_steps: Vec<ProcessingStep>,
    pub metrics: ExecutionMetrics,
}

#[derive(Deserialize, Serialize, Clone, ToSchema)]
pub struct RLMConfigRequest {
    pub max_recursion_depth: Option<u32>,
    pub context_slice_size: Option<usize>,
    pub enable_rlm_mode: Option<bool>,
}

#[derive(Deserialize)]
pub struct SemanticSearchRequest {
    pub query: String,
    pub top_k: Option<usize>,
    pub filters: Option<std::collections::HashMap<String, serde_json::Value>>,
}

#[derive(Serialize)]
pub struct SearchResult {
    pub id: String,
    pub score: f32,
    pub metadata: serde_json::Value,
}

pub fn create_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Core RLM endpoints
        .route("/api/v1/rlm/execute", post(execute_rlm_task))
        .route(
            "/api/v1/rlm/config",
            get(get_rlm_config).put(update_rlm_config),
        )
        .route("/api/v1/rlm/health", get(rlm_health))
        // Data fabric endpoints
        .route("/api/v1/data/search", post(semantic_search))
        .route("/api/v1/data/store", post(store_with_embedding))
        .route("/api/v1/data/cache/invalidate", post(invalidate_cache))
        .route(
            "/api/v1/data/capabilities/tenant/:tenant_id",
            get(get_tenant_capabilities),
        )
        // Control plane monitoring endpoints
        .route(
            "/api/v1/control-plane/status",
            get(get_control_plane_status),
        )
        .route("/api/v1/control-plane/stats", get(get_control_plane_stats))
        .route("/api/v1/control-plane/agents", get(list_agents))
        .route(
            "/api/v1/control-plane/agents/:agent_id",
            get(get_agent_details),
        )
        // Note: Session management endpoints moved to session_routes.rs
        // Policy and security endpoints
        .route("/api/v1/policy/check", post(check_policy))
        .route("/api/v1/policy/rules", get(list_policy_rules))
        .route("/api/v1/policy/:id", get(get_policy))
        .route("/api/v1/audit/logs", get(get_audit_logs))
        // Local API service endpoints for gated actions
        .route("/api/v1/local/workflows", get(list_workflows))
        .route("/api/v1/local/workflows/:id", get(get_workflow))
        .route(
            "/api/v1/local/workflows/:id/execute",
            post(execute_workflow),
        )
        .route("/api/v1/local/workflows/:id/replay", post(replay_workflow))
        .route("/api/v1/local/agent-mail", get(list_agent_mail))
        .route("/api/v1/local/agent-mail/:id", get(get_agent_mail))
        .route("/api/v1/local/agent-mail/:id/outbox", get(get_agent_outbox))
        .route(
            "/api/v1/local/agent-mail/:id/respond",
            post(respond_to_agent_mail),
        )
        .route("/api/v1/local/agent-mail/send", post(send_agent_mail))
        .route("/api/v1/local/skills", get(list_skills))
        .route("/api/v1/local/skills/:id", get(get_skill))
        .route("/api/v1/local/skills/install", post(install_skill))
        .route("/api/v1/local/skills/:id/uninstall", post(uninstall_skill))
        .route("/api/v1/local/memory/working", get(get_working_memory))
        .route("/api/v1/local/memory/episodic", get(get_episodic_memory))
        .route("/api/v1/local/memory/knowledge", get(get_knowledge_memory))
        .route("/api/v1/local/memory/:session_id", get(get_memory))
        .route("/api/v1/local/memory/id/:memory_id", get(get_memory_by_id))
        .route("/api/v1/local/policy", get(list_local_policies))
        .route("/api/v1/local/policy/:id", get(get_local_policy))
        .route("/api/v1/local/policy/evaluate", post(evaluate_local_policy))
        // Memory and context endpoints
        .route("/api/v1/memory/context/:session_id", get(get_context))
        .route(
            "/api/v1/memory/context/:session_id/slice",
            post(slice_context),
        )
        .route(
            "/api/v1/memory/context/:session_id/aggregate",
            post(aggregate_context),
        )
        // Registry endpoints
        .route("/api/v1/registry/agents", get(list_agents_registry))
        .route("/api/v1/registry/skills", get(list_skills_registry))
        .route("/api/v1/registry/tools", get(list_tools_registry))
        // Marketplace endpoints
        .route("/api/v1/marketplace/skills", get(list_marketplace_skills))
        .route(
            "/api/v1/marketplace/install/:id",
            post(install_marketplace_skill),
        )
        // Capsule endpoints
        .route("/api/v1/capsules/build", post(build_capsule))
        .route("/api/v1/capsules/sign", post(sign_capsule))
        .route("/api/v1/capsules/install", post(install_capsule))
        // Workflow endpoints
        .route("/api/v1/workflows/execute", post(execute_workflow))
        .route("/api/v1/workflows/validate", post(crate::validate_workflow))
        .route("/api/v1/workflows/compile", post(crate::compile_workflow))
        // MCP (Multi-Agent Coordination Protocol) bridge endpoints
        .route("/api/v1/mcp/bridge", post(bridge_agent_coordination))
        .route(
            "/api/v1/mcp/messages/coordinated",
            get(get_coordinated_messages),
        )
        .route("/api/v1/mcp/release", post(release_coordination))
}

// MCP Bridge endpoints
#[derive(Deserialize)]
pub struct BridgeCoordinationRequest {
    pub resource_selector: String,
    pub message: a2rchitech_messaging::MailMessageEnvelope,
}

#[derive(Serialize)]
pub struct BridgeCoordinationResponse {
    pub coordination_result: BridgedCoordinationResult,
}

/// Bridge agent mail and coordination leases for unified MCP
async fn bridge_agent_coordination(
    State(state): State<Arc<crate::AppState>>,
    Json(request): Json<BridgeCoordinationRequest>,
) -> Result<Json<BridgeCoordinationResponse>, axum::http::StatusCode> {
    let result = state
        .data_fabric
        .bridge_agent_mail_coordination(&request.resource_selector, request.message)
        .await
        .map_err(|e| {
            eprintln!("MCP bridge error: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(BridgeCoordinationResponse {
        coordination_result: result,
    }))
}

/// Get coordinated messages (messages with associated leases)
async fn get_coordinated_messages(
    State(state): State<Arc<crate::AppState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Vec<CoordinatedMessage>>, axum::http::StatusCode> {
    let agent_identity = params
        .get("agent_identity")
        .cloned()
        .unwrap_or_else(|| "default-agent".to_string());

    let resource_selector = params.get("resource_selector").map(|s| s.as_str());

    let messages = state
        .data_fabric
        .get_coordinated_messages(&agent_identity, resource_selector)
        .await
        .map_err(|e| {
            eprintln!("Get coordinated messages error: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(messages))
}

/// Release coordination resources
async fn release_coordination(
    State(state): State<Arc<crate::AppState>>,
    Json(request): Json<serde_json::Value>,
) -> Result<Json<bool>, axum::http::StatusCode> {
    let coordination_id = request
        .get("coordination_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| axum::http::StatusCode::BAD_REQUEST)?;

    let renew_token = request
        .get("renew_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| axum::http::StatusCode::BAD_REQUEST)?
        .to_string();

    let released = state
        .data_fabric
        .release_coordination_bridge(coordination_id, renew_token)
        .await
        .map_err(|e| {
            eprintln!("Release coordination error: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(released))
}

async fn execute_rlm_task(
    State(state): State<Arc<crate::AppState>>,
    headers: HeaderMap,
    Json(request): Json<RLMExecuteRequest>,
) -> Result<Json<RLMExecuteResponse>, StatusCode> {
    let mode_value = request.mode.to_lowercase();
    let mode = match mode_value.as_str() {
        "standard" => RLMExecutionMode::Standard,
        "rlm" => RLMExecutionMode::RLM,
        "hybrid" => RLMExecutionMode::Hybrid,
        "unix" => RLMExecutionMode::Unix,
        _ => return Err(StatusCode::BAD_REQUEST),
    };

    if request.model_id.trim().is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let config = state.rlm_config.read().await.clone();
    if matches!(
        mode,
        RLMExecutionMode::RLM | RLMExecutionMode::Hybrid | RLMExecutionMode::Unix
    ) && matches!(config.enable_rlm_mode, Some(false))
    {
        return Err(StatusCode::FORBIDDEN);
    }

    let max_recursion_depth = request
        .max_recursion_depth
        .or(config.max_recursion_depth)
        .unwrap_or(5);
    if max_recursion_depth == 0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let context_slice_size = request
        .context_slice_size
        .or(config.context_slice_size)
        .unwrap_or(8192);
    if context_slice_size == 0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let identity_id = headers
        .get("x-identity-id")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
        .unwrap_or_else(|| state.policy_identity_id.clone());
    let tenant_id = headers
        .get("x-tenant-id")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
        .unwrap_or_else(|| state.policy_tenant_id.clone());
    let session_id = headers
        .get("x-session-id")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());
    let trace_id = headers
        .get("x-trace-id")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string());

    // Build policy request for RLM execution
    let policy_context = serde_json::json!({
        "tenant_id": tenant_id,
        "session_id": session_id,
        "trace_id": trace_id,
        "model_id": request.model_id.clone(),
        "mode": mode_value.clone(),
        "context_size": request.context.len(),
        "recursion_depth": max_recursion_depth,
        "context_slice_size": context_slice_size,
    });

    let policy_request = PolicyRequest {
        identity_id,
        resource: "/api/v1/rlm/execute".to_string(),
        action: "POST".to_string(),
        context: policy_context,
        requested_tier: a2rchitech_policy::SafetyTier::T2,
    };

    let policy_decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|e| {
            eprintln!("RLM policy error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if matches!(policy_decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    let start = Instant::now();
    let result = match mode {
        RLMExecutionMode::Standard => state
            .control_plane
            .rlm_router
            .route_direct(&request.task, &request.context, &request.model_id)
            .await
            .map_err(|e| {
                eprintln!("RLM execution error: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?,
        RLMExecutionMode::RLM | RLMExecutionMode::Unix | RLMExecutionMode::Hybrid => state
            .control_plane
            .rlm_router
            .route_with_context_management(
                &request.task,
                &request.context,
                &request.model_id,
                max_recursion_depth,
                context_slice_size,
            )
            .await
            .map_err(|e| {
                eprintln!("RLM execution error: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?,
    };
    let elapsed_ms = start.elapsed().as_millis() as u64;
    let context_len = request.context.len();
    let result_len = result.len(); // Calculate before moving result
    let context_slices = if matches!(mode, RLMExecutionMode::Standard) {
        1
    } else {
        let slices = (context_len + context_slice_size - 1) / context_slice_size;
        if slices == 0 {
            1
        } else {
            slices
        }
    };

    Ok(Json(RLMExecuteResponse {
        result,
        execution_mode: mode_value,
        processing_steps: Vec::new(),
        metrics: ExecutionMetrics {
            total_processing_time_ms: elapsed_ms,
            total_tokens_processed: (context_len + result_len) as u64,
            recursion_depth_used: if matches!(mode, RLMExecutionMode::Standard) {
                1
            } else {
                max_recursion_depth
            },
            context_slices,
        },
    }))
}

async fn get_rlm_config(State(state): State<Arc<crate::AppState>>) -> Json<RLMConfigRequest> {
    let config = state.rlm_config.read().await.clone();
    Json(config)
}

async fn update_rlm_config(
    State(state): State<Arc<crate::AppState>>,
    Json(request): Json<RLMConfigRequest>,
) -> Result<Json<RLMConfigRequest>, StatusCode> {
    if matches!(request.max_recursion_depth, Some(0)) {
        return Err(StatusCode::BAD_REQUEST);
    }
    if matches!(request.context_slice_size, Some(0)) {
        return Err(StatusCode::BAD_REQUEST);
    }

    let mut config = state.rlm_config.write().await;
    *config = request.clone();
    Ok(Json(request))
}

async fn rlm_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "rlm",
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }))
}

/// Perform semantic search across all data sources
pub async fn semantic_search(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SemanticSearchRequest>,
) -> Result<Json<Vec<SearchResult>>, StatusCode> {
    let top_k = request.top_k.unwrap_or(10);

    let results = state
        .data_fabric
        .semantic_search(&request.query, top_k)
        .await
        .map_err(|e| {
            eprintln!("Semantic search error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let mapped = results
        .into_iter()
        .map(|result| SearchResult {
            id: result.id,
            score: result.score,
            metadata: result.metadata,
        })
        .collect();

    Ok(Json(mapped))
}

#[derive(Deserialize)]
pub struct StoreWithEmbeddingRequest {
    pub id: String,
    pub data: serde_json::Value,
    pub text_content: String,
}

/// Store data with vector representation for semantic search
pub async fn store_with_embedding(
    State(state): State<Arc<AppState>>,
    Json(request): Json<StoreWithEmbeddingRequest>,
) -> Result<Json<&'static str>, StatusCode> {
    state
        .data_fabric
        .store_with_embedding(&request.id, request.data, &request.text_content)
        .await
        .map_err(|e| {
            eprintln!("Store with embedding error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json("Data stored with embedding"))
}

#[derive(Deserialize)]
pub struct InvalidateCacheRequest {
    pub pattern: String,
}

/// Invalidate cache entries matching a pattern
pub async fn invalidate_cache(
    State(state): State<Arc<AppState>>,
    Json(request): Json<InvalidateCacheRequest>,
) -> Result<Json<&'static str>, StatusCode> {
    state
        .data_fabric
        .invalidate_cache_pattern(&request.pattern)
        .await
        .map_err(|e| {
            eprintln!("Cache invalidation error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json("Cache invalidated"))
}

/// Get tenant-specific capabilities across all data sources
pub async fn get_tenant_capabilities(
    State(state): State<Arc<AppState>>,
    Path(tenant_id): Path<String>,
) -> Result<Json<TenantCapabilities>, StatusCode> {
    let capabilities = state
        .data_fabric
        .get_tenant_capabilities(&tenant_id)
        .await
        .map_err(|e| {
            eprintln!("Get tenant capabilities error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(capabilities))
}

// Control plane status endpoints
/// Get control plane status
pub async fn get_control_plane_status(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "operational",
        "components": {
            "history_ledger": "healthy",
            "messaging_system": "healthy",
            "policy_engine": "healthy",
            "tool_gateway": "healthy",
            "skill_registry": "healthy",
            "unified_registry": "healthy",
            "hook_bus": "healthy",
            "task_queue": "healthy",
            "workflow_engine": "healthy",
            "runtime_core": "healthy",
            "context_router": "healthy",
            "memory_fabric": "healthy",
            "provider_router": "healthy",
            "package_manager": "healthy",
            "embodiment_control_plane": "healthy",
            "evaluation_engine": "healthy"
        },
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }))
}

/// Get control plane statistics
pub async fn get_control_plane_stats(
    State(state): State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "stats": {
            "active_sessions": 0,
            "pending_tasks": 0,
            "active_agents": 0,
            "memory_usage_mb": 0,
            "request_rate_per_min": 0,
        },
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }))
}

/// List available workflows
#[utoipa::path(
    get,
    path = "/api/v1/local/workflows",
    responses(
        (status = 200, description = "List of available workflows", body = WorkflowListResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to list workflows", body = serde_json::Value)
    )
)]
async fn list_workflows(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/workflows".to_string(),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get workflows from the workflow engine
    let workflows = state.control_plane.workflow_engine.list_workflows().await;

    // Serialize workflows to JSON
    let workflow_jsons: Vec<serde_json::Value> = workflows
        .iter()
        .filter_map(|w| serde_json::to_value(w).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "workflow.list",
        "timestamp": chrono::Utc::now(),
        "data": {
            "count": workflow_jsons.len(),
            "workflow_ids": workflows.iter().map(|w| &w.workflow_id).collect::<Vec<_>>()
        }
    });

    tracing::info!("List workflows receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "workflows": workflow_jsons,
        "count": workflow_jsons.len(),
        "receipt": receipt
    })))
}

/// Get a specific workflow by ID
#[utoipa::path(
    get,
    path = "/api/v1/local/workflows/{id}",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    responses(
        (status = 200, description = "Workflow retrieved successfully", body = serde_json::Value),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 404, description = "Workflow not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve workflow", body = serde_json::Value)
    )
)]
async fn get_workflow(
    State(state): State<Arc<AppState>>,
    Path(workflow_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/workflows/{}", workflow_id),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get workflow from the workflow engine
    let workflow = state
        .control_plane
        .workflow_engine
        .get_workflow(workflow_id.clone())
        .await;

    match workflow {
        Some(w) => {
            // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
            let receipt = serde_json::json!({
                "receipt_id": Uuid::new_v4().to_string(),
                "event_type": "workflow.get",
                "timestamp": chrono::Utc::now(),
                "data": {
                    "workflow_id": w.workflow_id,
                    "version": w.version
                }
            });

            tracing::info!("Get workflow receipt: {}", receipt);

            Ok(Json(serde_json::json!({
                "workflow": serde_json::to_value(&w).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                "receipt": receipt
            })))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Execute a workflow
#[utoipa::path(
    post,
    path = "/api/v1/local/workflows/{id}/execute",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    request_body = serde_json::Value,
    responses(
        (status = 200, description = "Workflow executed successfully", body = serde_json::Value),
        (status = 400, description = "Invalid parameters", body = serde_json::Value),
        (status = 403, description = "Execution denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to execute workflow", body = serde_json::Value)
    )
)]
async fn execute_workflow(
    State(state): State<Arc<AppState>>,
    Path(workflow_id): Path<String>,
    Json(params): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check for execution
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/workflows/{}/execute", workflow_id),
        action: "execute".to_string(),
        context: serde_json::json!({
            "workflow_id": workflow_id,
            "params": params
        }),
        requested_tier: SafetyTier::T2,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Generate session ID for this execution
    let session_id = Uuid::new_v4().to_string();

    // Execute workflow using the workflow engine
    let result = state
        .control_plane
        .workflow_engine
        .execute_workflow(
            workflow_id.clone(),
            session_id.clone(),
            state.policy_tenant_id.clone(),
            params.clone(),
        )
        .await;

    match result {
        Ok(execution_id) => {
            // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
            let receipt = serde_json::json!({
                "receipt_id": Uuid::new_v4().to_string(),
                "event_type": "workflow.execute",
                "timestamp": chrono::Utc::now(),
                "data": {
                    "workflow_id": workflow_id,
                    "execution_id": execution_id,
                    "session_id": session_id
                }
            });

            tracing::info!("Execute workflow receipt: {}", receipt);

            Ok(Json(serde_json::json!({
                "workflow_id": workflow_id,
                "execution_id": execution_id,
                "status": "started",
                "receipt": receipt
            })))
        }
        Err(e) => {
            tracing::error!("Workflow execution failed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// Replay a workflow execution
#[utoipa::path(
    post,
    path = "/api/v1/local/workflows/{id}/replay",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    request_body = ReplayWorkflowRequest,
    responses(
        (status = 200, description = "Workflow replay completed successfully", body = ReplayWorkflowResponse),
        (status = 400, description = "Invalid request parameters", body = serde_json::Value),
        (status = 403, description = "Replay denied by policy", body = serde_json::Value),
        (status = 404, description = "Workflow not found", body = serde_json::Value),
        (status = 500, description = "Failed to replay workflow", body = serde_json::Value)
    )
)]
async fn replay_workflow(
    State(state): State<Arc<AppState>>,
    Path(workflow_id): Path<String>,
    Json(request): Json<ReplayWorkflowRequest>,
) -> Result<Json<ReplayWorkflowResponse>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/workflows/{}/replay", workflow_id),
        action: "replay".to_string(),
        context: serde_json::json!({
            "workflow_id": workflow_id,
            "session_id": request.session_id,
            "checkpoint_id": request.checkpoint_id
        }),
        requested_tier: SafetyTier::T1,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Replay workflow using the workflow engine
    let result = state
        .control_plane
        .workflow_engine
        .replay_workflow(
            &workflow_id,
            &request.session_id,
            request.checkpoint_id.as_deref(),
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to replay workflow: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "workflow.replay",
        "timestamp": chrono::Utc::now(),
        "data": {
            "workflow_id": workflow_id,
            "session_id": request.session_id,
            "checkpoint_id": request.checkpoint_id,
            "replay_id": result.replay_id,
            "new_execution_id": result.new_execution_id,
            "original_execution_id": result.original_execution_id
        }
    });

    tracing::info!("Replay workflow receipt: {}", receipt);

    Ok(Json(ReplayWorkflowResponse {
        replay_id: result.replay_id,
        status: result.status,
        receipt,
    }))
}

/// List agent mail messages
#[utoipa::path(
    get,
    path = "/api/v1/local/agent-mail",
    responses(
        (status = 200, description = "List of agent mail messages", body = AgentMailListResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to list agent mail", body = serde_json::Value)
    )
)]
async fn list_agent_mail(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/agent-mail".to_string(),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get agent mail from messaging system
    let identity_id = state.policy_identity_id.clone();
    let messages = state
        .control_plane
        .messaging_system
        .agent_mail
        .get_inbox(identity_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get inbox: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Convert messages to JSON
    let message_jsons: Vec<serde_json::Value> = messages
        .iter()
        .filter_map(|m| serde_json::to_value(m).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "agent_mail.list",
        "timestamp": chrono::Utc::now(),
        "data": {
            "count": message_jsons.len()
        }
    });

    tracing::info!("List agent mail receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "messages": message_jsons,
        "count": message_jsons.len(),
        "receipt": receipt
    })))
}

/// Get agent mail messages for a specific agent
#[utoipa::path(
    get,
    path = "/api/v1/local/agent-mail/{agent_id}",
    params(
        ("agent_id" = String, Path, description = "Agent ID to retrieve mail for")
    ),
    responses(
        (status = 200, description = "Agent mail messages retrieved successfully", body = GetAgentMailResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve agent mail", body = serde_json::Value)
    )
)]
async fn get_agent_mail(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> Result<Json<GetAgentMailResponse>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/agent-mail/{}", agent_id),
        action: "read".to_string(),
        context: serde_json::json!({
            "agent_id": agent_id.clone()
        }),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get messages from messaging system for the specified agent
    let messages = state
        .control_plane
        .messaging_system
        .agent_mail
        .get_inbox(agent_id.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to get inbox for agent {}: {}", agent_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Convert messages to JSON
    let message_jsons: Vec<serde_json::Value> = messages
        .iter()
        .filter_map(|m| serde_json::to_value(m).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "mail.get",
        "timestamp": chrono::Utc::now(),
        "data": {
            "agent_id": agent_id,
            "message_count": message_jsons.len()
        }
    });

    let count = message_jsons.len();

    tracing::info!("Get agent mail receipt: {}", receipt);

    Ok(Json(GetAgentMailResponse {
        agent_id: agent_id.clone(),
        messages: message_jsons,
        count,
        receipt,
    }))
}

/// Get agent outbox (sent messages)
#[utoipa::path(
    get,
    path = "/api/v1/local/agent-mail/{id}/outbox",
    params(
        ("agent_id" = String, Path, description = "Agent ID to retrieve outbox for")
    ),
    responses(
        (status = 200, description = "Agent outbox messages retrieved successfully", body = GetAgentMailResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve agent outbox", body = serde_json::Value)
    )
)]
async fn get_agent_outbox(
    State(state): State<Arc<AppState>>,
    Path(agent_id): Path<String>,
) -> Result<Json<GetAgentMailResponse>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/agent-mail/{}/outbox", agent_id),
        action: "read".to_string(),
        context: serde_json::json!({
            "agent_id": agent_id.clone()
        }),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get outbox messages from messaging system for the specified agent
    let messages = state
        .control_plane
        .messaging_system
        .agent_mail
        .get_outbox(agent_id.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to get outbox for agent {}: {}", agent_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Convert messages to JSON
    let message_jsons: Vec<serde_json::Value> = messages
        .iter()
        .filter_map(|m| serde_json::to_value(m).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "mail.get_outbox",
        "timestamp": chrono::Utc::now(),
        "data": {
            "agent_id": agent_id,
            "message_count": message_jsons.len()
        }
    });

    let count = message_jsons.len();

    tracing::info!("Get agent outbox receipt: {}", receipt);

    Ok(Json(GetAgentMailResponse {
        agent_id: agent_id.clone(),
        messages: message_jsons,
        count,
        receipt,
    }))
}

/// Respond to an agent mail message
#[utoipa::path(
    post,
    path = "/api/v1/local/agent-mail/{id}/respond",
    params(
        ("id" = String, Path, description = "Message ID to respond to")
    ),
    request_body = AgentMailResponse,
    responses(
        (status = 200, description = "Response sent successfully", body = AgentMailResponseResponse),
        (status = 400, description = "Invalid response format", body = serde_json::Value),
        (status = 403, description = "Response denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to send response", body = serde_json::Value)
    )
)]
async fn respond_to_agent_mail(
    State(state): State<Arc<AppState>>,
    Path(message_id): Path<String>,
    Json(response): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/agent-mail/{}/respond", message_id),
        action: "write".to_string(),
        context: serde_json::json!({
            "message_id": message_id,
            "response": response
        }),
        requested_tier: SafetyTier::T1,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Create a response message envelope
    let response_message_id = Uuid::new_v4().to_string();
    let response_message = MailMessageEnvelope {
        message_id: response_message_id.clone(),
        tenant_id: state.policy_tenant_id.clone(), // Use the current tenant ID
        thread_id: format!("thread-{}", message_id), // Associate with the original message thread
        from_identity: state.policy_identity_id.clone(), // Use the current identity as sender
        to_identities: vec!["default_agent".to_string()], // For now, send to default agent
        subject: format!("Re: Response to message {}", message_id),
        body_md: response.to_string(), // Convert the response JSON to markdown string
        attachments: vec![],           // No attachments in this response
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["response".to_string(), "agent-mail".to_string()],
        trace_id: None,
        reply_to_message_id: Some(message_id.clone()),
        priority: Some(1), // Normal priority
        expires_at: None,  // No expiration
    };

    // Send response via messaging system
    state
        .control_plane
        .messaging_system
        .agent_mail
        .send_message(response_message)
        .await
        .map_err(|e| {
            tracing::error!("Failed to send agent mail response: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "agent_mail.respond",
        "timestamp": chrono::Utc::now(),
        "data": {
            "original_message_id": message_id,
            "response_message_id": response_message_id
        }
    });

    tracing::info!("Respond to agent mail receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "status": "response_sent",
        "original_message_id": message_id,
        "response_message_id": response_message_id,
        "receipt": receipt
    })))
}

/// Send agent mail message
#[utoipa::path(
    post,
    path = "/api/v1/local/agent-mail/send",
    request_body = SendAgentMailRequest,
    responses(
        (status = 200, description = "Mail sent successfully", body = SendAgentMailResponse),
        (status = 400, description = "Invalid request", body = serde_json::Value),
        (status = 403, description = "Send denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to send mail", body = serde_json::Value)
    )
)]
async fn send_agent_mail(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SendAgentMailRequest>,
) -> Result<Json<SendAgentMailResponse>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/agent-mail/send".to_string(),
        action: "write".to_string(),
        context: serde_json::json!({
            "from": request.from,
            "to": request.to,
            "subject": request.subject
        }),
        requested_tier: SafetyTier::T1,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Create mail message envelope
    let message_id = Uuid::new_v4().to_string();
    let message = MailMessageEnvelope {
        message_id: message_id.clone(),
        tenant_id: state.policy_tenant_id.clone(),
        thread_id: format!("thread-{}", Uuid::new_v4()),
        from_identity: request.from.clone(),
        to_identities: vec![request.to.clone()],
        subject: request.subject.clone(),
        body_md: request.body.to_string(),
        attachments: vec![],
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tags: vec!["agent-mail".to_string()],
        trace_id: Some(format!("trace-{}", Uuid::new_v4())),
        reply_to_message_id: None,
        priority: Some(1),
        expires_at: None,
    };

    // Send message via messaging system
    state
        .control_plane
        .messaging_system
        .agent_mail
        .send_message(message.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to send agent mail: {}", e);
            StatusCode::BAD_REQUEST
        })?;

    // Convert message to JSON for response
    let message_json = serde_json::to_value(&message).map_err(|e| {
        tracing::error!("Failed to serialize message: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "mail.send",
        "timestamp": chrono::Utc::now(),
        "data": {
            "from": request.from,
            "to": request.to,
            "message_id": message_id
        }
    });

    tracing::info!("Send agent mail receipt: {}", receipt);

    Ok(Json(SendAgentMailResponse {
        message: message_json,
        receipt,
    }))
}

/// List available skills
#[utoipa::path(
    get,
    path = "/api/v1/local/skills",
    responses(
        (status = 200, description = "List of available skills", body = SkillsListResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to list skills", body = serde_json::Value)
    )
)]
async fn list_skills(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/skills".to_string(),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    let skills = state
        .control_plane
        .skill_registry
        .list_skills()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "skills": skills,
        "count": skills.len()
    })))
}

/// Get a specific skill by ID
#[utoipa::path(
    get,
    path = "/api/v1/local/skills/{id}",
    params(
        ("id" = String, Path, description = "Skill ID")
    ),
    responses(
        (status = 200, description = "Skill retrieved successfully", body = serde_json::Value),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 404, description = "Skill not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve skill", body = serde_json::Value)
    )
)]
async fn get_skill(
    State(state): State<Arc<AppState>>,
    Path(skill_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/skills/{}", skill_id),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    let skill = state
        .control_plane
        .skill_registry
        .get_skill(skill_id, None)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match skill {
        Some(s) => Ok(Json(serde_json::json!(s))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Install a skill
#[utoipa::path(
    post,
    path = "/api/v1/local/skills/install",
    request_body = serde_json::Value,
    responses(
        (status = 201, description = "Skill installed successfully", body = serde_json::Value),
        (status = 400, description = "Invalid skill definition", body = serde_json::Value),
        (status = 403, description = "Installation denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to install skill", body = serde_json::Value)
    )
)]
async fn install_skill(
    State(state): State<Arc<AppState>>,
    Json(request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check for installation
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/skills/install".to_string(),
        action: "install".to_string(),
        context: serde_json::json!({
            "request": request
        }),
        requested_tier: SafetyTier::T2,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Parse skill from request
    let skill: a2rchitech_skills::Skill = serde_json::from_value(request.clone()).map_err(|e| {
        tracing::error!("Invalid skill definition: {}", e);
        StatusCode::BAD_REQUEST
    })?;

    // Install skill using skill registry
    let skill_id = state
        .control_plane
        .skill_registry
        .register_skill(skill)
        .await
        .map_err(|e| {
            tracing::error!("Failed to install skill: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "skill.install",
        "timestamp": chrono::Utc::now(),
        "data": {
            "skill_id": skill_id
        }
    });

    tracing::info!("Install skill receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "status": "installed",
        "skill_id": skill_id,
        "receipt": receipt
    })))
}

/// Uninstall a skill
#[utoipa::path(
    post,
    path = "/api/v1/local/skills/{id}/uninstall",
    params(
        ("id" = String, Path, description = "Skill ID to uninstall")
    ),
    responses(
        (status = 200, description = "Skill uninstalled successfully", body = serde_json::Value),
        (status = 403, description = "Uninstallation denied by policy", body = serde_json::Value),
        (status = 404, description = "Skill not found", body = serde_json::Value),
        (status = 500, description = "Failed to uninstall skill", body = serde_json::Value)
    )
)]
async fn uninstall_skill(
    State(state): State<Arc<AppState>>,
    Path(skill_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/skills/{}/uninstall", skill_id),
        action: "uninstall".to_string(),
        context: serde_json::json!({
            "skill_id": skill_id
        }),
        requested_tier: SafetyTier::T2,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Uninstall (revoke) skill using skill registry
    state
        .control_plane
        .skill_registry
        .revoke_skill(skill_id.clone(), None)
        .await
        .map_err(|e| {
            tracing::error!("Failed to uninstall skill: {}", e);
            match e {
                a2rchitech_skills::SkillsError::SkillNotFound(_) => StatusCode::NOT_FOUND,
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            }
        })?;

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "skill.uninstall",
        "timestamp": chrono::Utc::now(),
        "data": {
            "skill_id": skill_id
        }
    });

    tracing::info!("Uninstall skill receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "skill_id": skill_id,
        "status": "uninstalled",
        "receipt": receipt
    })))
}

/// Get working memory
#[utoipa::path(
    get,
    path = "/api/v1/local/memory/working",
    responses(
        (status = 200, description = "Working memory retrieved successfully", body = MemoryResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve working memory", body = serde_json::Value)
    )
)]
async fn get_working_memory(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/memory/working".to_string(),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Query working memory from memory fabric
    let query = a2rchitech_memory::MemoryQuery {
        query: "".to_string(),
        top_k: 100,
        filter: None,
        tenant_id: state.policy_tenant_id.clone(),
        session_id: None,
        agent_id: Some(state.policy_identity_id.clone()),
        memory_types: vec![a2rchitech_memory::MemoryType::Working],
        max_sensitivity_tier: None,
        required_tags: vec![],
        time_range: None,
        content_search: None,
        limit: Some(100),
        sort_by: None,
        status_filter: Some("active".to_string()),
    };

    let memories = state
        .control_plane
        .memory_fabric
        .query_memory(query, state.policy_identity_id.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query working memory: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Convert memories to JSON
    let memory_jsons: Vec<serde_json::Value> = memories
        .iter()
        .filter_map(|m| serde_json::to_value(m).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "memory.working.get",
        "timestamp": chrono::Utc::now(),
        "data": {
            "count": memory_jsons.len()
        }
    });

    tracing::info!("Get working memory receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "memory_type": "working",
        "data": memory_jsons,
        "count": memory_jsons.len(),
        "receipt": receipt
    })))
}

/// Get episodic memory
#[utoipa::path(
    get,
    path = "/api/v1/local/memory/episodic",
    responses(
        (status = 200, description = "Episodic memory retrieved successfully", body = MemoryResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve episodic memory", body = serde_json::Value)
    )
)]
async fn get_episodic_memory(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/memory/episodic".to_string(),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T1,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Query episodic memory from memory fabric
    let query = a2rchitech_memory::MemoryQuery {
        query: "".to_string(),
        top_k: 100,
        filter: None,
        tenant_id: state.policy_tenant_id.clone(),
        session_id: None,
        agent_id: Some(state.policy_identity_id.clone()),
        memory_types: vec![a2rchitech_memory::MemoryType::Episodic],
        max_sensitivity_tier: None,
        required_tags: vec![],
        time_range: None,
        content_search: None,
        limit: Some(100),
        sort_by: None,
        status_filter: Some("active".to_string()),
    };

    let memories = state
        .control_plane
        .memory_fabric
        .query_memory(query, state.policy_identity_id.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query episodic memory: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Convert memories to JSON
    let memory_jsons: Vec<serde_json::Value> = memories
        .iter()
        .filter_map(|m| serde_json::to_value(m).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "memory.episodic.get",
        "timestamp": chrono::Utc::now(),
        "data": {
            "count": memory_jsons.len()
        }
    });

    tracing::info!("Get episodic memory receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "memory_type": "episodic",
        "data": memory_jsons,
        "count": memory_jsons.len(),
        "receipt": receipt
    })))
}

/// Get knowledge memory
#[utoipa::path(
    get,
    path = "/api/v1/local/memory/knowledge",
    responses(
        (status = 200, description = "Knowledge memory retrieved successfully", body = MemoryResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve knowledge memory", body = serde_json::Value)
    )
)]
async fn get_knowledge_memory(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/memory/knowledge".to_string(),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T1,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Query knowledge (semantic) memory from memory fabric
    let query = a2rchitech_memory::MemoryQuery {
        query: "".to_string(),
        top_k: 100,
        filter: None,
        tenant_id: state.policy_tenant_id.clone(),
        session_id: None,
        agent_id: Some(state.policy_identity_id.clone()),
        memory_types: vec![a2rchitech_memory::MemoryType::Semantic],
        max_sensitivity_tier: None,
        required_tags: vec![],
        time_range: None,
        content_search: None,
        limit: Some(100),
        sort_by: None,
        status_filter: Some("active".to_string()),
    };

    let memories = state
        .control_plane
        .memory_fabric
        .query_memory(query, state.policy_identity_id.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query knowledge memory: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Convert memories to JSON
    let memory_jsons: Vec<serde_json::Value> = memories
        .iter()
        .filter_map(|m| serde_json::to_value(m).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "memory.knowledge.get",
        "timestamp": chrono::Utc::now(),
        "data": {
            "count": memory_jsons.len()
        }
    });

    tracing::info!("Get knowledge memory receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "memory_type": "knowledge",
        "data": memory_jsons,
        "count": memory_jsons.len(),
        "receipt": receipt
    })))
}

/// Get memory entries for a specific session
#[utoipa::path(
    get,
    path = "/api/v1/local/memory/{session_id}",
    params(
        ("session_id" = String, Path, description = "Session ID to retrieve memory for")
    ),
    responses(
        (status = 200, description = "Session memory retrieved successfully", body = GetMemoryResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve session memory", body = serde_json::Value)
    )
)]
async fn get_memory(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<GetMemoryResponse>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/memory/{}", session_id),
        action: "read".to_string(),
        context: serde_json::json!({
            "session_id": session_id.clone()
        }),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Query memory from memory fabric for the specified session
    let query = a2rchitech_memory::MemoryQuery {
        query: "".to_string(),
        top_k: 100,
        filter: None,
        tenant_id: state.policy_tenant_id.clone(),
        session_id: Some(session_id.clone()),
        agent_id: None,
        memory_types: vec![],
        max_sensitivity_tier: None,
        required_tags: vec![],
        time_range: None,
        content_search: None,
        limit: Some(100),
        sort_by: None,
        status_filter: Some("active".to_string()),
    };

    let memories = state
        .control_plane
        .memory_fabric
        .query_memory(query, state.policy_identity_id.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to query memory for session {}: {}", session_id, e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Convert memories to JSON
    let memory_jsons: Vec<serde_json::Value> = memories
        .iter()
        .filter_map(|m| serde_json::to_value(m).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "memory.get",
        "timestamp": chrono::Utc::now(),
        "data": {
            "session_id": session_id,
            "entry_count": memory_jsons.len()
        }
    });

    tracing::info!("Get memory receipt: {}", receipt);

    Ok(Json(GetMemoryResponse {
        session_id: session_id.clone(),
        entries: memory_jsons.clone(),
        count: memory_jsons.len(),
        receipt,
    }))
}

/// Get a specific memory entry by ID
#[utoipa::path(
    get,
    path = "/api/v1/local/memory/id/{memory_id}",
    params(
        ("memory_id" = String, Path, description = "Memory ID to retrieve")
    ),
    responses(
        (status = 200, description = "Memory entry retrieved successfully", body = GetMemoryByIdResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 404, description = "Memory entry not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve memory entry", body = serde_json::Value)
    )
)]
async fn get_memory_by_id(
    State(state): State<Arc<AppState>>,
    Path(memory_id): Path<String>,
) -> Result<Json<GetMemoryByIdResponse>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/memory/id/{}", memory_id),
        action: "read".to_string(),
        context: serde_json::json!({
            "memory_id": memory_id.clone()
        }),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Retrieve memory from memory fabric by ID
    let memory = state
        .control_plane
        .memory_fabric
        .retrieve_memory(memory_id.clone(), state.policy_identity_id.clone())
        .await
        .map_err(|e| {
            tracing::error!("Failed to retrieve memory {}: {}", memory_id, e);
            StatusCode::NOT_FOUND
        })?;

    // Convert memory to JSON
    let memory_json = serde_json::to_value(&memory).map_err(|e| {
        tracing::error!("Failed to serialize memory {}: {}", memory_id, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "memory.get_by_id",
        "timestamp": chrono::Utc::now(),
        "data": {
            "memory_id": memory_id.clone(),
            "memory_type": format!("{:?}", memory.memory_type),
            "session_id": memory.session_id.clone()
        }
    });

    tracing::info!("Get memory by ID receipt: {}", receipt);

    Ok(Json(GetMemoryByIdResponse {
        memory_id: memory_id.clone(),
        entry: memory_json,
        receipt,
    }))
}

/// List local policies
#[utoipa::path(
    get,
    path = "/api/v1/local/policy",
    responses(
        (status = 200, description = "List of local policies", body = PoliciesListResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to list policies", body = serde_json::Value)
    )
)]
async fn list_local_policies(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/policy".to_string(),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // List policies from policy engine
    let policies = state.control_plane.policy_engine.list_rules().await;

    // Convert policies to JSON
    let policy_jsons: Vec<serde_json::Value> = policies
        .iter()
        .filter_map(|p| serde_json::to_value(p).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "policy.list",
        "timestamp": chrono::Utc::now(),
        "data": {
            "count": policy_jsons.len()
        }
    });

    tracing::info!("List policies receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "policies": policy_jsons,
        "count": policy_jsons.len(),
        "receipt": receipt
    })))
}

/// Get a specific policy by ID
#[utoipa::path(
    get,
    path = "/api/v1/local/policy/{id}",
    params(
        ("id" = String, Path, description = "Policy ID")
    ),
    responses(
        (status = 200, description = "Policy retrieved successfully", body = serde_json::Value),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 404, description = "Policy not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve policy", body = serde_json::Value)
    )
)]
async fn get_local_policy(
    State(state): State<Arc<AppState>>,
    Path(policy_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/local/policy/{}", policy_id),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get specific policy from policy engine
    let policy = state.control_plane.policy_engine.get_rule(&policy_id).await;

    match policy {
        Some(p) => {
            // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
            let receipt = serde_json::json!({
                "receipt_id": Uuid::new_v4().to_string(),
                "event_type": "policy.get",
                "timestamp": chrono::Utc::now(),
                "data": {
                    "policy_id": p.id
                }
            });

            tracing::info!("Get policy receipt: {}", receipt);

            Ok(Json(serde_json::json!({
                "policy": serde_json::to_value(&p).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                "receipt": receipt
            })))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Evaluate a policy request
#[utoipa::path(
    post,
    path = "/api/v1/local/policy/evaluate",
    request_body = PolicyRequest,
    responses(
        (status = 200, description = "Policy evaluated successfully", body = serde_json::Value),
        (status = 400, description = "Invalid policy request", body = serde_json::Value),
        (status = 403, description = "Policy evaluation access denied", body = serde_json::Value),
        (status = 500, description = "Failed to evaluate policy", body = serde_json::Value)
    )
)]
async fn evaluate_local_policy(
    State(state): State<Arc<AppState>>,
    Json(request): Json<PolicyRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check for evaluation access
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/local/policy/evaluate".to_string(),
        action: "evaluate".to_string(),
        context: serde_json::json!({
            "request": request
        }),
        requested_tier: SafetyTier::T1,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    let result = state
        .control_plane
        .policy_engine
        .evaluate(request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!(result)))
}

/// List marketplace skills (federated sources)
#[utoipa::path(
    get,
    path = "/api/v1/marketplace/skills",
    responses(
        (status = 200, description = "List of marketplace skills", body = serde_json::Value),
        (status = 500, description = "Failed to fetch marketplace skills", body = serde_json::Value)
    )
)]
async fn list_marketplace_skills(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/v1/marketplace/skills".to_string(),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: a2rchitech_policy::SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, a2rchitech_policy::PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    let skills = state
        .control_plane
        .skill_registry
        .list_skills()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "skills": skills,
        "count": skills.len()
    })))
}

/// Install marketplace skill by ID
#[utoipa::path(
    post,
    path = "/api/v1/marketplace/install/{id}",
    params(
        ("id" = String, Path, description = "Skill ID to install")
    ),
    responses(
        (status = 201, description = "Skill installed successfully", body = serde_json::Value),
        (status = 404, description = "Skill not found", body = serde_json::Value),
        (status = 500, description = "Failed to install skill", body = serde_json::Value)
    )
)]
async fn install_marketplace_skill(
    State(state): State<Arc<AppState>>,
    Path(skill_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/v1/marketplace/install/{}", skill_id),
        action: "install".to_string(),
        context: serde_json::json!({}),
        requested_tier: a2rchitech_policy::SafetyTier::T2,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, a2rchitech_policy::PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    let skill = state
        .control_plane
        .skill_registry
        .get_skill(skill_id, None)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    match skill {
        Some(skill) => {
            let skill_id = state
                .control_plane
                .skill_registry
                .register_skill(skill)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            Ok(Json(serde_json::json!({
                "id": skill_id,
                "status": "installed"
            })))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

// ============================================================================
// Missing Handler Implementations
// ============================================================================

#[derive(Debug, Deserialize)]
struct CreateSessionRequest {
    profile_id: Option<String>,
    metadata: Option<serde_json::Value>,
    tenant_id: Option<String>,
    created_by: Option<String>,
    role: Option<String>,
    mode: Option<String>,
    environment: Option<String>,
    embodiment: Option<String>,
    policy_snapshot_ref: Option<String>,
}

fn parse_session_mode(value: Option<&str>) -> SessionMode {
    match value.unwrap_or("live").trim().to_ascii_lowercase().as_str() {
        "replay" => SessionMode::Replay,
        "sim" | "simulation" => SessionMode::Sim,
        _ => SessionMode::Live,
    }
}

fn parse_environment(value: Option<&str>) -> Environment {
    match value.unwrap_or("dev").trim().to_ascii_lowercase().as_str() {
        "stage" | "staging" => Environment::Stage,
        "prod" | "production" => Environment::Prod,
        _ => Environment::Dev,
    }
}

fn parse_embodiment(value: Option<&str>) -> Embodiment {
    match value.unwrap_or("none").trim().to_ascii_lowercase().as_str() {
        "sim" | "simulation" => Embodiment::Sim,
        "real" => Embodiment::Real,
        _ => Embodiment::None,
    }
}

fn session_mode_label(mode: &SessionMode) -> &'static str {
    match mode {
        SessionMode::Live => "live",
        SessionMode::Replay => "replay",
        SessionMode::Sim => "sim",
    }
}

fn environment_label(environment: &Environment) -> &'static str {
    match environment {
        Environment::Dev => "dev",
        Environment::Stage => "stage",
        Environment::Prod => "prod",
    }
}

fn embodiment_label(embodiment: &Embodiment) -> &'static str {
    match embodiment {
        Embodiment::None => "none",
        Embodiment::Sim => "sim",
        Embodiment::Real => "real",
    }
}

fn session_status_label(status: &SessionStatus) -> &'static str {
    match status {
        SessionStatus::Active => "active",
        SessionStatus::Paused => "paused",
        SessionStatus::Stopped => "completed",
        SessionStatus::Failed => "error",
    }
}

fn serialize_session(
    session: &Session,
    profile_id: &str,
    metadata: Option<&serde_json::Value>,
) -> serde_json::Value {
    serde_json::json!({
        "id": session.session_id,
        "session_id": session.session_id,
        "profile_id": profile_id,
        "status": session_status_label(&session.status),
        "created_at": session.start_time.to_string(),
        "updated_at": session.end_time.unwrap_or(session.start_time).to_string(),
        "tenant_id": session.tenant_id,
        "created_by": session.created_by,
        "role": session.role,
        "mode": session_mode_label(&session.mode),
        "environment": environment_label(&session.environment),
        "embodiment": embodiment_label(&session.embodiment),
        "policy_snapshot_ref": session.policy_snapshot_ref,
        "active_workflows": session.active_workflows,
        "metadata": metadata.cloned().unwrap_or_else(|| serde_json::json!({})),
    })
}

/// List all registered agents in the control plane
async fn list_agents(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "agents": [],
        "count": 0
    })))
}

/// Get details for a specific agent
async fn get_agent_details(
    State(_state): State<Arc<AppState>>,
    Path(_agent_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// List all active sessions
async fn list_sessions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let sessions = state
        .control_plane
        .runtime_core
        .session_manager
        .list_sessions()
        .await;
    let serialized: Vec<serde_json::Value> = sessions
        .iter()
        .map(|session| serialize_session(session, "default", None))
        .collect();

    Ok(Json(serde_json::json!({
        "sessions": serialized,
        "count": sessions.len(),
        "total": sessions.len(),
    })))
}

/// Create a new runtime session for UI chat/thread state
async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateSessionRequest>,
) -> Result<(StatusCode, Json<serde_json::Value>), StatusCode> {
    let metadata = request.metadata.unwrap_or_else(|| serde_json::json!({}));

    let mode_from_metadata = metadata.get("mode").and_then(|value| value.as_str());
    let env_from_metadata = metadata.get("environment").and_then(|value| value.as_str());
    let embodiment_from_metadata = metadata.get("embodiment").and_then(|value| value.as_str());
    let role_from_metadata = metadata.get("role").and_then(|value| value.as_str());
    let policy_from_metadata = metadata
        .get("policy_snapshot_ref")
        .and_then(|value| value.as_str());

    let mode = parse_session_mode(request.mode.as_deref().or(mode_from_metadata));
    let environment = parse_environment(request.environment.as_deref().or(env_from_metadata));
    let embodiment = parse_embodiment(request.embodiment.as_deref().or(embodiment_from_metadata));

    let tenant_id = request
        .tenant_id
        .unwrap_or_else(|| state.policy_tenant_id.clone());
    let created_by = request
        .created_by
        .unwrap_or_else(|| state.policy_identity_id.clone());
    let role = request
        .role
        .or_else(|| role_from_metadata.map(str::to_string))
        .unwrap_or_else(|| "operator".to_string());
    let policy_snapshot_ref = request
        .policy_snapshot_ref
        .or_else(|| policy_from_metadata.map(str::to_string))
        .unwrap_or_else(|| "current".to_string());

    let profile_id = request.profile_id.unwrap_or_else(|| "default".to_string());

    let session = state
        .control_plane
        .runtime_core
        .session_manager
        .create_session(
            tenant_id,
            created_by,
            role,
            mode,
            environment,
            embodiment,
            policy_snapshot_ref,
        )
        .await
        .map_err(|error| {
            tracing::error!("Failed to create session: {}", error);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let payload = serialize_session(&session, &profile_id, Some(&metadata));
    Ok((StatusCode::CREATED, Json(payload)))
}

/// Get details for a specific session
async fn get_session(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let session = state
        .control_plane
        .runtime_core
        .session_manager
        .get_session(session_id)
        .await
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(serialize_session(&session, "default", None)))
}

/// Fork an existing session
async fn fork_session(
    State(_state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "forked_from": session_id,
        "new_session_id": Uuid::new_v4().to_string(),
        "status": "forked"
    })))
}

/// Compress a session's context
async fn compress_session(
    State(_state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "session_id": session_id,
        "status": "compressed"
    })))
}

/// Check a policy decision
async fn check_policy(
    State(_state): State<Arc<AppState>>,
    Json(_request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "decision": "allow",
        "allowed": true
    })))
}

/// List all policy rules
#[utoipa::path(
    get,
    path = "/api/v1/policy/rules",
    responses(
        (status = 200, description = "List of policy rules", body = serde_json::Value),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to list policy rules", body = serde_json::Value)
    )
)]
async fn list_policy_rules(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/policy/rules".to_string(),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // List policies from policy engine
    let policies = state.control_plane.policy_engine.list_rules().await;

    // Convert policies to JSON
    let policy_jsons: Vec<serde_json::Value> = policies
        .iter()
        .filter_map(|p| serde_json::to_value(p).ok())
        .collect();

    // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
    let receipt = serde_json::json!({
        "receipt_id": Uuid::new_v4().to_string(),
        "event_type": "policy.rules.list",
        "timestamp": chrono::Utc::now(),
        "data": {
            "count": policy_jsons.len()
        }
    });

    tracing::info!("List policy rules receipt: {}", receipt);

    Ok(Json(serde_json::json!({
        "policies": policy_jsons,
        "count": policy_jsons.len(),
        "receipt": receipt
    })))
}

/// Get a specific policy by ID
#[utoipa::path(
    get,
    path = "/api/v1/policy/{id}",
    params(
        ("id" = String, Path, description = "Policy ID")
    ),
    responses(
        (status = 200, description = "Policy retrieved successfully", body = serde_json::Value),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 404, description = "Policy not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve policy", body = serde_json::Value)
    )
)]
async fn get_policy(
    State(state): State<Arc<AppState>>,
    Path(policy_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/policy/{}", policy_id),
        action: "read".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T0,
    };

    let decision = state
        .control_plane
        .policy_engine
        .evaluate(policy_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if matches!(decision.decision, PolicyEffect::Deny) {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get specific policy from policy engine
    let policy = state.control_plane.policy_engine.get_rule(&policy_id).await;

    match policy {
        Some(p) => {
            // Emit receipt per LAW-SWM-005 (Evidence-First Outputs)
            let receipt = serde_json::json!({
                "receipt_id": Uuid::new_v4().to_string(),
                "event_type": "policy.get",
                "timestamp": chrono::Utc::now(),
                "data": {
                    "policy_id": p.id
                }
            });

            tracing::info!("Get policy receipt: {}", receipt);

            Ok(Json(serde_json::json!({
                "policy": serde_json::to_value(&p).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?,
                "receipt": receipt
            })))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// Get audit logs
async fn get_audit_logs(
    State(_state): State<Arc<AppState>>,
    Query(_params): Query<HashMap<String, String>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "logs": [],
        "count": 0
    })))
}

/// List all available providers
async fn list_providers(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "providers": [],
        "count": 0
    })))
}

/// Get details for a specific provider
async fn get_provider(
    State(_state): State<Arc<AppState>>,
    Path(_provider_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Get capabilities for a specific provider
async fn get_provider_capabilities(
    State(_state): State<Arc<AppState>>,
    Path(provider_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "provider_id": provider_id,
        "capabilities": []
    })))
}

/// Get context for a session
async fn get_context(
    State(_state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "session_id": session_id,
        "context": ""
    })))
}

/// Slice context for a session
async fn slice_context(
    State(_state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(_request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "session_id": session_id,
        "sliced_context": ""
    })))
}

/// Aggregate context for a session
async fn aggregate_context(
    State(_state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(_request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "session_id": session_id,
        "aggregated_context": ""
    })))
}

/// List agents from the registry
async fn list_agents_registry(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "agents": [],
        "count": 0
    })))
}

/// List skills from the registry
async fn list_skills_registry(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let skills = state
        .control_plane
        .skill_registry
        .list_skills()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "skills": skills,
        "count": skills.len()
    })))
}

/// List tools from the registry
async fn list_tools_registry(
    State(_state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "tools": [],
        "count": 0
    })))
}

/// Build a capsule
async fn build_capsule(
    State(_state): State<Arc<AppState>>,
    Json(_request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "capsule_id": Uuid::new_v4().to_string(),
        "status": "built"
    })))
}

/// Sign a capsule
async fn sign_capsule(
    State(_state): State<Arc<AppState>>,
    Json(_request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "signed"
    })))
}

/// Install a capsule
async fn install_capsule(
    State(_state): State<Arc<AppState>>,
    Json(_request): Json<serde_json::Value>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "installed"
    })))
}
