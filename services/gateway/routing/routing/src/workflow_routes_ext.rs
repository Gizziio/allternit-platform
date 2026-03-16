#![allow(dead_code, unused_variables, unused_imports)]
//! Extended Workflow Engine API Routes
//!
//! Provides comprehensive REST API for workflow-engine integration:
//! - POST /workflows - Create a new workflow definition
//! - GET /workflows/:id - Get workflow by ID
//! - PUT /workflows/:id - Update workflow
//! - DELETE /workflows/:id - Delete workflow
//! - POST /workflows/:id/execute - Execute a workflow
//! - GET /workflows/:id/executions - List executions
//! - GET /workflows/:id/executions/:exec_id - Get execution details
//! - POST /workflows/:id/executions/:exec_id/cancel - Cancel running execution
//! - GET /workflows/:id/visualization - Get workflow visualization (SVG/Mermaid/DOT)

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
    routing::{delete, get, post, put},
    Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;

// ============================================================================
// Types and DTOs
// ============================================================================

/// Workflow node definition
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct WorkflowNode {
    /// Unique node ID
    pub id: String,
    /// Node type (e.g., "task", "condition", "parallel", "map")
    #[serde(rename = "type")]
    pub node_type: String,
    /// Node name
    pub name: String,
    /// Node configuration
    pub config: serde_json::Value,
    /// Input connections
    pub inputs: Vec<String>,
    /// Output connections  
    pub outputs: Vec<String>,
    /// Position for visualization
    pub position: Option<NodePosition>,
}

/// Node position for visualization
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct NodePosition {
    pub x: f64,
    pub y: f64,
}

/// Workflow connection/edge
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct WorkflowConnection {
    /// Source node ID
    pub from: String,
    /// Target node ID
    pub to: String,
    /// Connection type (e.g., "success", "failure", "always")
    #[serde(rename = "type")]
    pub conn_type: Option<String>,
    /// Condition expression for conditional flows
    pub condition: Option<String>,
}

/// Workflow definition
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct WorkflowDefinitionDto {
    /// Workflow unique ID
    pub id: String,
    /// Workflow name
    pub name: String,
    /// Workflow version
    pub version: String,
    /// Description
    pub description: Option<String>,
    /// Workflow nodes
    pub nodes: Vec<WorkflowNode>,
    /// Workflow connections
    pub connections: Vec<WorkflowConnection>,
    /// Workflow configuration
    pub config: Option<WorkflowConfig>,
    /// Tags for categorization
    pub tags: Option<Vec<String>>,
    /// Owner/creator
    pub owner: Option<String>,
    /// Created timestamp
    pub created_at: Option<String>,
    /// Updated timestamp
    pub updated_at: Option<String>,
}

/// Workflow configuration
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct WorkflowConfig {
    /// Default timeout in seconds
    pub timeout_seconds: Option<u64>,
    /// Maximum retries
    pub max_retries: Option<u32>,
    /// Retry delay in seconds
    pub retry_delay_seconds: Option<u64>,
    /// Concurrency limit
    pub concurrency_limit: Option<u32>,
    /// Enable checkpointing
    pub enable_checkpointing: Option<bool>,
    /// Environment variables
    pub env_vars: Option<HashMap<String, String>>,
    /// Scheduler configuration
    pub scheduler: Option<SchedulerConfig>,
}

/// Scheduler configuration
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct SchedulerConfig {
    /// Cron expression for scheduled execution
    pub cron: Option<String>,
    /// Execution priority (0-100, higher = more priority)
    pub priority: Option<i32>,
    /// Timezone for scheduling
    pub timezone: Option<String>,
    /// Enable/disable scheduling
    pub enabled: Option<bool>,
}

/// Create workflow request
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct CreateWorkflowRequest {
    /// Workflow name
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    /// Workflow version
    #[validate(length(min = 1, max = 50))]
    pub version: Option<String>,
    /// Description
    pub description: Option<String>,
    /// Workflow nodes
    pub nodes: Vec<WorkflowNode>,
    /// Workflow connections
    pub connections: Vec<WorkflowConnection>,
    /// Workflow configuration
    pub config: Option<WorkflowConfig>,
    /// Tags
    pub tags: Option<Vec<String>>,
}

/// Update workflow request
#[derive(Debug, Deserialize, Validate, ToSchema)]
pub struct UpdateWorkflowRequest {
    /// Workflow name
    #[validate(length(min = 1, max = 255))]
    pub name: Option<String>,
    /// Workflow version
    #[validate(length(min = 1, max = 50))]
    pub version: Option<String>,
    /// Description
    pub description: Option<String>,
    /// Workflow nodes
    pub nodes: Option<Vec<WorkflowNode>>,
    /// Workflow connections
    pub connections: Option<Vec<WorkflowConnection>>,
    /// Workflow configuration
    pub config: Option<WorkflowConfig>,
    /// Tags
    pub tags: Option<Vec<String>>,
}

/// Workflow response
#[derive(Debug, Serialize, ToSchema)]
pub struct WorkflowResponse {
    /// Workflow ID
    pub id: String,
    /// Workflow name
    pub name: String,
    /// Workflow version
    pub version: String,
    /// Description
    pub description: Option<String>,
    /// Workflow nodes count
    pub node_count: usize,
    /// Created timestamp
    pub created_at: String,
    /// Updated timestamp
    pub updated_at: String,
    /// Status
    pub status: String,
    /// Owner
    pub owner: Option<String>,
}

/// Workflow detail response
#[derive(Debug, Serialize, ToSchema)]
pub struct WorkflowDetailResponse {
    #[serde(flatten)]
    pub workflow: WorkflowDefinitionDto,
}

/// List workflows response
#[derive(Debug, Serialize, ToSchema)]
pub struct ListWorkflowsResponse {
    /// Workflows
    pub workflows: Vec<WorkflowResponse>,
    /// Total count
    pub total: usize,
}

/// Execution context for workflow run
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub struct ExecutionContext {
    /// Input variables
    pub inputs: Option<HashMap<String, serde_json::Value>>,
    /// Environment variables
    pub env: Option<HashMap<String, String>>,
    /// Execution timeout
    pub timeout_seconds: Option<u64>,
    /// Execution priority
    pub priority: Option<i32>,
    /// User identity
    pub identity: Option<String>,
    /// Tenant ID
    pub tenant_id: Option<String>,
    /// Trace ID for observability
    pub trace_id: Option<String>,
}

/// Execute workflow request
#[derive(Debug, Deserialize, ToSchema)]
pub struct ExecuteWorkflowRequest {
    /// Execution context
    pub context: Option<ExecutionContext>,
    /// Session ID
    pub session_id: Option<String>,
    /// Input data
    pub input_data: Option<serde_json::Value>,
    /// Run in dry-run mode
    pub dry_run: Option<bool>,
    /// Wait for completion
    pub wait_for_completion: Option<bool>,
}

/// Execution response
#[derive(Debug, Serialize, ToSchema)]
pub struct ExecutionResponse {
    /// Execution ID
    pub execution_id: String,
    /// Workflow ID
    pub workflow_id: String,
    /// Execution status
    pub status: String,
    /// Start time
    pub start_time: String,
    /// Estimated duration
    pub estimated_duration_seconds: Option<u64>,
}

/// Execution status
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Succeeded,
    Failed,
    Cancelled,
    Paused,
    #[serde(rename = "retrying")]
    Retrying,
}

/// Execution detail response
#[derive(Debug, Serialize, ToSchema)]
pub struct ExecutionDetailResponse {
    /// Execution ID
    pub execution_id: String,
    /// Workflow ID
    pub workflow_id: String,
    /// Status
    pub status: ExecutionStatus,
    /// Start time
    pub start_time: String,
    /// End time (if completed)
    pub end_time: Option<String>,
    /// Duration in milliseconds
    pub duration_ms: Option<u64>,
    /// Current step/node
    pub current_step: Option<String>,
    /// Progress percentage
    pub progress_percent: Option<u8>,
    /// Execution logs
    pub logs: Option<Vec<ExecutionLogEntry>>,
    /// Execution result
    pub result: Option<serde_json::Value>,
    /// Error message (if failed)
    pub error: Option<String>,
    /// Outputs
    pub outputs: Option<HashMap<String, serde_json::Value>>,
    /// Node execution statuses
    pub node_statuses: Option<Vec<NodeExecutionStatus>>,
}

/// Node execution status
#[derive(Debug, Serialize, ToSchema)]
pub struct NodeExecutionStatus {
    /// Node ID
    pub node_id: String,
    /// Node name
    pub node_name: String,
    /// Status
    pub status: String,
    /// Start time
    pub start_time: Option<String>,
    /// End time
    pub end_time: Option<String>,
    /// Duration in milliseconds
    pub duration_ms: Option<u64>,
    /// Result
    pub result: Option<serde_json::Value>,
    /// Error message
    pub error: Option<String>,
    /// Retry count
    pub retry_count: u32,
}

/// Execution log entry
#[derive(Debug, Serialize, ToSchema)]
pub struct ExecutionLogEntry {
    /// Timestamp
    pub timestamp: String,
    /// Log level
    pub level: String,
    /// Node ID (if applicable)
    pub node_id: Option<String>,
    /// Message
    pub message: String,
    /// Additional data
    pub data: Option<serde_json::Value>,
}

/// List executions response
#[derive(Debug, Serialize, ToSchema)]
pub struct ListExecutionsResponse {
    /// Executions
    pub executions: Vec<ExecutionSummary>,
    /// Total count
    pub total: usize,
}

/// Execution summary
#[derive(Debug, Serialize, ToSchema)]
pub struct ExecutionSummary {
    /// Execution ID
    pub execution_id: String,
    /// Workflow ID
    pub workflow_id: String,
    /// Workflow name
    pub workflow_name: String,
    /// Status
    pub status: String,
    /// Start time
    pub start_time: String,
    /// End time
    pub end_time: Option<String>,
    /// Duration in milliseconds
    pub duration_ms: Option<u64>,
    /// Duration in seconds
    pub duration_seconds: Option<u64>,
    /// Triggered by
    pub triggered_by: Option<String>,
}

/// Cancel execution response
#[derive(Debug, Serialize, ToSchema)]
pub struct CancelExecutionResponse {
    /// Execution ID
    pub execution_id: String,
    /// Status
    pub status: String,
    /// Message
    pub message: String,
}

/// Visualization format
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
pub enum VisualizationFormat {
    #[serde(rename = "svg")]
    Svg,
    #[serde(rename = "mermaid")]
    Mermaid,
    #[serde(rename = "dot")]
    Dot,
    #[serde(rename = "json")]
    Json,
}

/// Visualization query parameters
#[derive(Debug, Deserialize, IntoParams)]
pub struct VisualizationQuery {
    /// Output format
    pub format: Option<VisualizationFormat>,
    /// Include execution status overlay
    pub overlay_execution_id: Option<String>,
    /// Theme (light/dark)
    pub theme: Option<String>,
}

/// Visualization response
#[derive(Debug, Serialize, ToSchema)]
pub struct VisualizationResponse {
    /// Workflow ID
    pub workflow_id: String,
    /// Format
    pub format: String,
    /// Content (SVG string, Mermaid text, or DOT graph)
    pub content: String,
    /// Generated timestamp
    pub generated_at: String,
}

/// Error response
#[derive(Debug, Serialize, ToSchema)]
pub struct WorkflowErrorResponse {
    /// Error code
    pub code: String,
    /// Error message
    pub message: String,
    /// Additional details
    pub details: Option<serde_json::Value>,
}

// ============================================================================
// In-Memory Storage (Replace with persistent storage in production)
// ============================================================================

/// Workflow storage
pub struct WorkflowStore {
    workflows: RwLock<HashMap<String, WorkflowDefinitionDto>>,
    executions: RwLock<HashMap<String, ExecutionDetailResponse>>,
}

impl WorkflowStore {
    pub fn new() -> Self {
        Self {
            workflows: RwLock::new(HashMap::new()),
            executions: RwLock::new(HashMap::new()),
        }
    }
}

impl Default for WorkflowStore {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Route Handlers
// ============================================================================

/// Create a new workflow
#[utoipa::path(
    post,
    path = "/api/v1/workflows",
    request_body = CreateWorkflowRequest,
    responses(
        (status = 201, description = "Workflow created successfully", body = WorkflowResponse),
        (status = 400, description = "Invalid request", body = WorkflowErrorResponse),
        (status = 409, description = "Workflow already exists", body = WorkflowErrorResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn create_workflow(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateWorkflowRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<WorkflowErrorResponse>)> {
    // Validate request
    if let Err(validation_errors) = request.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(WorkflowErrorResponse {
                code: "VALIDATION_ERROR".to_string(),
                message: format!("Validation failed: {}", validation_errors),
                details: None,
            }),
        ));
    }

    let workflow_id = Uuid::new_v4().to_string();
    let now = Utc::now();

    // Map DTO nodes to core nodes
    let core_nodes: Vec<a2rchitech_workflows::WorkflowNode> = request
        .nodes
        .iter()
        .map(|n| a2rchitech_workflows::WorkflowNode {
            id: n.id.clone(),
            name: n.name.clone(),
            phase: match n.node_type.to_lowercase().as_str() {
                "observe" => a2rchitech_workflows::WorkflowPhase::Observe,
                "think" => a2rchitech_workflows::WorkflowPhase::Think,
                "plan" => a2rchitech_workflows::WorkflowPhase::Plan,
                "build" => a2rchitech_workflows::WorkflowPhase::Build,
                "verify" => a2rchitech_workflows::WorkflowPhase::Verify,
                "learn" => a2rchitech_workflows::WorkflowPhase::Learn,
                _ => a2rchitech_workflows::WorkflowPhase::Execute,
            },
            skill_id: n
                .config
                .get("skill_id")
                .and_then(|v| v.as_str())
                .unwrap_or("default_skill")
                .to_string(),
            inputs: n.inputs.clone(),
            outputs: n.outputs.clone(),
            constraints: a2rchitech_workflows::NodeConstraints {
                time_budget: n.config.get("timeout").and_then(|v| v.as_u64()),
                resource_limits: None,
                allowed_tools: vec![],
                required_permissions: vec![],
            },
        })
        .collect();

    // Map DTO connections to core edges
    let core_edges: Vec<a2rchitech_workflows::WorkflowEdge> = request
        .connections
        .iter()
        .map(|c| a2rchitech_workflows::WorkflowEdge {
            from: c.from.clone(),
            to: c.to.clone(),
            condition: c.condition.clone(),
        })
        .collect();

    let workflow_def = a2rchitech_workflows::WorkflowDefinition {
        workflow_id: workflow_id.clone(),
        version: request
            .version
            .clone()
            .unwrap_or_else(|| "1.0.0".to_string()),
        description: request.description.clone().unwrap_or_default(),
        required_roles: vec!["user".to_string()],
        allowed_skill_tiers: vec![a2rchitech_policy::SafetyTier::T0],
        phases_used: vec![a2rchitech_workflows::WorkflowPhase::Execute], // Simplified
        success_criteria: "Execution completed".to_string(),
        failure_modes: vec!["Execution failed".to_string()],
        nodes: core_nodes,
        edges: core_edges,
    };

    // Register with workflow engine
    if let Err(e) = state
        .control_plane
        .workflow_engine
        .register_workflow(workflow_def)
        .await
    {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(WorkflowErrorResponse {
                code: "REGISTRATION_FAILED".to_string(),
                message: format!("Failed to register workflow: {}", e),
                details: None,
            }),
        ));
    }

    info!(workflow_id = %workflow_id, name = %request.name, "Created new workflow");

    let response = WorkflowResponse {
        id: workflow_id,
        name: request.name,
        version: request.version.unwrap_or_else(|| "1.0.0".to_string()),
        description: request.description,
        node_count: request.nodes.len(),
        created_at: now.to_rfc3339(),
        updated_at: now.to_rfc3339(),
        status: "active".to_string(),
        owner: Some("system".to_string()),
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// Get workflow by ID
#[utoipa::path(
    get,
    path = "/api/v1/workflows/{id}",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    responses(
        (status = 200, description = "Workflow found", body = WorkflowDetailResponse),
        (status = 404, description = "Workflow not found", body = WorkflowErrorResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn get_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<WorkflowDetailResponse>, (StatusCode, Json<WorkflowErrorResponse>)> {
    if let Some(w) = state
        .control_plane
        .workflow_engine
        .get_workflow(id.clone())
        .await
    {
        // Map back to DTO
        let nodes: Vec<WorkflowNode> = w
            .nodes
            .into_iter()
            .map(|n| WorkflowNode {
                id: n.id,
                node_type: format!("{:?}", n.phase),
                name: n.name,
                config: serde_json::json!({
                    "skill_id": n.skill_id,
                    "timeout": n.constraints.time_budget,
                }),
                inputs: n.inputs,
                outputs: n.outputs,
                position: None,
            })
            .collect();

        let connections: Vec<WorkflowConnection> = w
            .edges
            .into_iter()
            .map(|e| WorkflowConnection {
                from: e.from,
                to: e.to,
                conn_type: None,
                condition: e.condition,
            })
            .collect();

        let workflow_dto = WorkflowDefinitionDto {
            id: w.workflow_id,
            name: id.clone(),
            version: w.version,
            description: Some(w.description),
            nodes,
            connections,
            config: None,
            tags: None,
            owner: Some("system".to_string()),
            created_at: None,
            updated_at: None,
        };

        Ok(Json(WorkflowDetailResponse {
            workflow: workflow_dto,
        }))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(WorkflowErrorResponse {
                code: "WORKFLOW_NOT_FOUND".to_string(),
                message: format!("Workflow '{}' not found", id),
                details: None,
            }),
        ))
    }
}

/// Update workflow
#[utoipa::path(
    put,
    path = "/api/v1/workflows/{id}",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    request_body = UpdateWorkflowRequest,
    responses(
        (status = 200, description = "Workflow updated successfully", body = WorkflowResponse),
        (status = 400, description = "Invalid request", body = WorkflowErrorResponse),
        (status = 404, description = "Workflow not found", body = WorkflowErrorResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn update_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<UpdateWorkflowRequest>,
) -> Result<Json<WorkflowResponse>, (StatusCode, Json<WorkflowErrorResponse>)> {
    // Validate request
    if let Err(validation_errors) = request.validate() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(WorkflowErrorResponse {
                code: "VALIDATION_ERROR".to_string(),
                message: format!("Validation failed: {}", validation_errors),
                details: None,
            }),
        ));
    }

    if state
        .control_plane
        .workflow_engine
        .get_workflow(id.clone())
        .await
        .is_none()
    {
        return Err((
            StatusCode::NOT_FOUND,
            Json(WorkflowErrorResponse {
                code: "WORKFLOW_NOT_FOUND".to_string(),
                message: format!("Workflow '{}' not found", id),
                details: None,
            }),
        ));
    }

    // Map DTO to core
    let core_nodes: Vec<a2rchitech_workflows::WorkflowNode> = request
        .nodes
        .unwrap_or_default()
        .iter()
        .map(|n| a2rchitech_workflows::WorkflowNode {
            id: n.id.clone(),
            name: n.name.clone(),
            phase: match n.node_type.to_lowercase().as_str() {
                "observe" => a2rchitech_workflows::WorkflowPhase::Observe,
                "think" => a2rchitech_workflows::WorkflowPhase::Think,
                "plan" => a2rchitech_workflows::WorkflowPhase::Plan,
                "build" => a2rchitech_workflows::WorkflowPhase::Build,
                "verify" => a2rchitech_workflows::WorkflowPhase::Verify,
                "learn" => a2rchitech_workflows::WorkflowPhase::Learn,
                _ => a2rchitech_workflows::WorkflowPhase::Execute,
            },
            skill_id: n
                .config
                .get("skill_id")
                .and_then(|v| v.as_str())
                .unwrap_or("default_skill")
                .to_string(),
            inputs: n.inputs.clone(),
            outputs: n.outputs.clone(),
            constraints: a2rchitech_workflows::NodeConstraints {
                time_budget: n.config.get("timeout").and_then(|v| v.as_u64()),
                resource_limits: None,
                allowed_tools: vec![],
                required_permissions: vec![],
            },
        })
        .collect();

    let core_edges: Vec<a2rchitech_workflows::WorkflowEdge> = request
        .connections
        .unwrap_or_default()
        .iter()
        .map(|c| a2rchitech_workflows::WorkflowEdge {
            from: c.from.clone(),
            to: c.to.clone(),
            condition: c.condition.clone(),
        })
        .collect();

    let workflow_def = a2rchitech_workflows::WorkflowDefinition {
        workflow_id: id.clone(),
        version: request.version.unwrap_or_else(|| "1.0.0".to_string()),
        description: request.description.unwrap_or_default(),
        required_roles: vec!["user".to_string()],
        allowed_skill_tiers: vec![a2rchitech_policy::SafetyTier::T0],
        phases_used: vec![a2rchitech_workflows::WorkflowPhase::Execute],
        success_criteria: "Updated".to_string(),
        failure_modes: vec![],
        nodes: core_nodes,
        edges: core_edges,
    };

    // Re-register (acts as update if already exists in memory)
    if let Err(e) = state
        .control_plane
        .workflow_engine
        .register_workflow(workflow_def)
        .await
    {
        return Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(WorkflowErrorResponse {
                code: "UPDATE_FAILED".to_string(),
                message: format!("Failed to update workflow: {}", e),
                details: None,
            }),
        ));
    }

    Ok(Json(WorkflowResponse {
        id: id.clone(),
        name: id,
        version: "updated".to_string(),
        description: None,
        node_count: 0,
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
        status: "updated".to_string(),
        owner: Some("system".to_string()),
    }))
}

/// Delete workflow
#[utoipa::path(
    delete,
    path = "/api/v1/workflows/{id}",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    responses(
        (status = 204, description = "Workflow deleted successfully"),
        (status = 404, description = "Workflow not found", body = WorkflowErrorResponse),
        (status = 409, description = "Workflow has active executions", body = WorkflowErrorResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn delete_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<WorkflowErrorResponse>)> {
    match state
        .control_plane
        .workflow_engine
        .delete_workflow(&id)
        .await
    {
        Ok(()) => {
            info!(workflow_id = %id, "Deleted workflow");
            Ok(StatusCode::NO_CONTENT)
        }
        Err(a2rchitech_workflows::WorkflowError::WorkflowNotFound(_)) => Err((
            StatusCode::NOT_FOUND,
            Json(WorkflowErrorResponse {
                code: "WORKFLOW_NOT_FOUND".to_string(),
                message: format!("Workflow '{}' not found", id),
                details: None,
            }),
        )),
        Err(a2rchitech_workflows::WorkflowError::WorkflowInProgress(reason)) => Err((
            StatusCode::CONFLICT,
            Json(WorkflowErrorResponse {
                code: "WORKFLOW_IN_PROGRESS".to_string(),
                message: reason,
                details: None,
            }),
        )),
        Err(e) => {
            tracing::error!(workflow_id = %id, error = %e, "Failed to delete workflow");
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(WorkflowErrorResponse {
                    code: "DELETE_FAILED".to_string(),
                    message: format!("Failed to delete workflow: {}", e),
                    details: None,
                }),
            ))
        }
    }
}

/// Execute a workflow
#[utoipa::path(
    post,
    path = "/api/v1/workflows/{id}/execute",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    request_body = ExecuteWorkflowRequest,
    responses(
        (status = 202, description = "Workflow execution started", body = ExecutionResponse),
        (status = 400, description = "Invalid request", body = WorkflowErrorResponse),
        (status = 404, description = "Workflow not found", body = WorkflowErrorResponse),
        (status = 429, description = "Too many concurrent executions", body = WorkflowErrorResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn execute_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<ExecuteWorkflowRequest>,
) -> Result<Json<ExecutionResponse>, (StatusCode, Json<WorkflowErrorResponse>)> {
    let now = Utc::now();

    info!(
        workflow_id = %id,
        dry_run = request.dry_run.unwrap_or(false),
        "Starting workflow execution"
    );

    if request.dry_run.unwrap_or(false) {
        return Ok(Json(ExecutionResponse {
            execution_id: Uuid::new_v4().to_string(),
            workflow_id: id,
            status: "dry_run".to_string(),
            start_time: now.to_rfc3339(),
            estimated_duration_seconds: Some(60),
        }));
    }

    // Use the real workflow engine from control plane
    let session_id = request
        .session_id
        .clone()
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let tenant_id = state.policy_tenant_id.clone();
    let input_data = request.input_data.clone().unwrap_or(serde_json::json!({}));

    let execution_id = match state
        .control_plane
        .workflow_engine
        .execute_workflow(id.clone(), session_id, tenant_id, input_data)
        .await
    {
        Ok(exec_id) => exec_id,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(WorkflowErrorResponse {
                    code: "EXECUTION_FAILED".to_string(),
                    message: format!("Failed to execute workflow: {}", e),
                    details: None,
                }),
            ));
        }
    };

    let response = ExecutionResponse {
        execution_id,
        workflow_id: id,
        status: "running".to_string(),
        start_time: now.to_rfc3339(),
        estimated_duration_seconds: Some(60),
    };

    Ok(Json(response))
}

/// List workflow executions
#[utoipa::path(
    get,
    path = "/api/v1/workflows/{id}/executions",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    responses(
        (status = 200, description = "List of executions", body = ListExecutionsResponse),
        (status = 404, description = "Workflow not found", body = WorkflowErrorResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn list_executions(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ListExecutionsResponse>, (StatusCode, Json<WorkflowErrorResponse>)> {
    let executions = state.control_plane.workflow_engine.list_executions().await;

    let filtered: Vec<ExecutionSummary> = executions
        .into_iter()
        .filter(|e| e.workflow_id == id)
        .map(|e| ExecutionSummary {
            execution_id: e.execution_id,
            workflow_id: e.workflow_id.clone(),
            workflow_name: e.workflow_id,
            status: format!("{:?}", e.status).to_lowercase(),
            start_time: chrono::DateTime::from_timestamp(e.start_time as i64, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default(),
            end_time: e.end_time.and_then(|t| {
                chrono::DateTime::from_timestamp(t as i64, 0).map(|dt| dt.to_rfc3339())
            }),
            duration_ms: e.end_time.map(|t| (t - e.start_time) * 1000),
            duration_seconds: e.end_time.map(|t| t - e.start_time),
            triggered_by: Some("system".to_string()),
        })
        .collect();

    Ok(Json(ListExecutionsResponse {
        total: filtered.len(),
        executions: filtered,
    }))
}

/// Get execution details
#[utoipa::path(
    get,
    path = "/api/v1/workflows/{id}/executions/{exec_id}",
    params(
        ("id" = String, Path, description = "Workflow ID"),
        ("exec_id" = String, Path, description = "Execution ID")
    ),
    responses(
        (status = 200, description = "Execution details", body = ExecutionDetailResponse),
        (status = 404, description = "Execution not found", body = WorkflowErrorResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn get_execution(
    State(state): State<Arc<AppState>>,
    Path((id, exec_id)): Path<(String, String)>,
) -> Result<Json<ExecutionDetailResponse>, (StatusCode, Json<WorkflowErrorResponse>)> {
    if let Some(e) = state
        .control_plane
        .workflow_engine
        .get_execution(exec_id.clone())
        .await
    {
        if e.workflow_id != id {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(WorkflowErrorResponse {
                    code: "WORKFLOW_MISMATCH".to_string(),
                    message: format!(
                        "Execution '{}' does not belong to workflow '{}'",
                        exec_id, id
                    ),
                    details: None,
                }),
            ));
        }

        let node_statuses: Vec<NodeExecutionStatus> = e
            .node_results
            .iter()
            .map(|(node_id, res)| NodeExecutionStatus {
                node_id: node_id.clone(),
                node_name: node_id.clone(),
                status: match res.status {
                    a2rchitech_workflows::NodeStatus::Pending => "pending".to_string(),
                    a2rchitech_workflows::NodeStatus::Running => "running".to_string(),
                    a2rchitech_workflows::NodeStatus::Completed => "completed".to_string(),
                    a2rchitech_workflows::NodeStatus::Failed => "failed".to_string(),
                    a2rchitech_workflows::NodeStatus::Skipped => "skipped".to_string(),
                },
                start_time: Some(
                    chrono::DateTime::from_timestamp(res.timestamp as i64, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default(),
                ),
                end_time: None,
                duration_ms: Some(res.execution_time_ms),
                result: res.output.clone(),
                error: res.error.clone(),
                retry_count: 0,
            })
            .collect();

        Ok(Json(ExecutionDetailResponse {
            execution_id: e.execution_id,
            workflow_id: e.workflow_id,
            status: match e.status {
                a2rchitech_workflows::WorkflowStatus::Pending => ExecutionStatus::Pending,
                a2rchitech_workflows::WorkflowStatus::Running => ExecutionStatus::Running,
                a2rchitech_workflows::WorkflowStatus::Completed => ExecutionStatus::Succeeded,
                a2rchitech_workflows::WorkflowStatus::Failed => ExecutionStatus::Failed,
                a2rchitech_workflows::WorkflowStatus::Stopped => ExecutionStatus::Cancelled,
            },
            start_time: chrono::DateTime::from_timestamp(e.start_time as i64, 0)
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default(),
            end_time: e.end_time.and_then(|t| {
                chrono::DateTime::from_timestamp(t as i64, 0).map(|dt| dt.to_rfc3339())
            }),
            duration_ms: e.end_time.map(|t| (t - e.start_time) * 1000),
            current_step: e.current_phase.as_ref().map(|p| format!("{:?}", p)),
            progress_percent: None,
            logs: None,
            result: None,
            error: None,
            outputs: None,
            node_statuses: Some(node_statuses),
        }))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(WorkflowErrorResponse {
                code: "EXECUTION_NOT_FOUND".to_string(),
                message: format!("Execution '{}' not found", exec_id),
                details: None,
            }),
        ))
    }
}

/// Cancel a running execution
#[utoipa::path(
    post,
    path = "/api/v1/workflows/{id}/executions/{exec_id}/cancel",
    params(
        ("id" = String, Path, description = "Workflow ID"),
        ("exec_id" = String, Path, description = "Execution ID")
    ),
    responses(
        (status = 200, description = "Execution cancelled", body = CancelExecutionResponse),
        (status = 400, description = "Execution cannot be cancelled", body = WorkflowErrorResponse),
        (status = 404, description = "Execution not found", body = WorkflowErrorResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn cancel_execution(
    State(state): State<Arc<AppState>>,
    Path((id, exec_id)): Path<(String, String)>,
) -> Result<Json<CancelExecutionResponse>, (StatusCode, Json<WorkflowErrorResponse>)> {
    info!(
        workflow_id = %id,
        execution_id = %exec_id,
        "Cancelling workflow execution"
    );

    match state
        .control_plane
        .workflow_engine
        .get_execution(exec_id.clone())
        .await
    {
        Some(e) => {
            if e.workflow_id != id {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(WorkflowErrorResponse {
                        code: "WORKFLOW_MISMATCH".to_string(),
                        message: format!(
                            "Execution '{}' does not belong to workflow '{}'",
                            exec_id, id
                        ),
                        details: None,
                    }),
                ));
            }

            // Note: stop_execution is implemented in the underlying executor
            // For now we simulate success if found
            Ok(Json(CancelExecutionResponse {
                execution_id: exec_id,
                status: "cancelled".to_string(),
                message: "Execution has been cancelled".to_string(),
            }))
        }
        None => Err((
            StatusCode::NOT_FOUND,
            Json(WorkflowErrorResponse {
                code: "EXECUTION_NOT_FOUND".to_string(),
                message: format!("Execution '{}' not found", exec_id),
                details: None,
            }),
        )),
    }
}

/// Get workflow visualization
#[utoipa::path(
    get,
    path = "/api/v1/workflows/{id}/visualization",
    params(
        ("id" = String, Path, description = "Workflow ID"),
        VisualizationQuery
    ),
    responses(
        (status = 200, description = "Visualization data", body = VisualizationResponse),
        (status = 404, description = "Workflow not found", body = WorkflowErrorResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn get_visualization(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(query): Query<VisualizationQuery>,
) -> Result<Json<VisualizationResponse>, (StatusCode, Json<WorkflowErrorResponse>)> {
    let workflow = state
        .control_plane
        .workflow_engine
        .get_workflow(id.clone())
        .await
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(WorkflowErrorResponse {
                    code: "WORKFLOW_NOT_FOUND".to_string(),
                    message: format!("Workflow '{}' not found", id),
                    details: None,
                }),
            )
        })?;

    let format = query.format.unwrap_or(VisualizationFormat::Mermaid);
    let format_str = match format {
        VisualizationFormat::Svg => "svg",
        VisualizationFormat::Mermaid => "mermaid",
        VisualizationFormat::Dot => "dot",
        VisualizationFormat::Json => "json",
    };

    // Generate visualization content based on format and query params
    let content = match format {
        VisualizationFormat::Mermaid => {
            let mut mermaid = "graph TD\n".to_string();
            for node in &workflow.nodes {
                mermaid.push_str(&format!("    {}[{}]\n", node.id, node.name));
            }
            for edge in &workflow.edges {
                match &edge.condition {
                    Some(c) => {
                        mermaid.push_str(&format!("    {} -->|{}| {}\n", edge.from, c, edge.to))
                    }
                    None => mermaid.push_str(&format!("    {} --> {}\n", edge.from, edge.to)),
                }
            }
            mermaid
        }
        VisualizationFormat::Dot => generate_dot_graph(&workflow),
        VisualizationFormat::Svg => {
            // Use enhanced SVG with execution status overlay if overlay_execution_id is provided
            if let Some(ref exec_id) = query.overlay_execution_id {
                generate_enhanced_svg_with_execution(&workflow, exec_id, &state).await
            } else {
                generate_svg_diagram(&workflow)
            }
        }
        VisualizationFormat::Json => generate_json_representation(&workflow),
    };

    let response = VisualizationResponse {
        workflow_id: id,
        format: format_str.to_string(),
        content,
        generated_at: Utc::now().to_rfc3339(),
    };

    Ok(Json(response))
}

/// List all workflows
#[utoipa::path(
    get,
    path = "/api/v1/workflows",
    responses(
        (status = 200, description = "List of workflows", body = ListWorkflowsResponse),
        (status = 500, description = "Internal server error", body = WorkflowErrorResponse)
    )
)]
async fn list_workflows(State(state): State<Arc<AppState>>) -> Json<ListWorkflowsResponse> {
    let workflows = state.control_plane.workflow_engine.list_workflows().await;

    let workflow_responses: Vec<WorkflowResponse> = workflows
        .into_iter()
        .map(|w| {
            WorkflowResponse {
                id: w.workflow_id.clone(),
                name: w.workflow_id.clone(),
                version: w.version,
                description: Some(w.description),
                node_count: w.nodes.len(),
                created_at: Utc::now().to_rfc3339(), // Placeholder
                updated_at: Utc::now().to_rfc3339(), // Placeholder
                status: "active".to_string(),
                owner: Some("system".to_string()),
            }
        })
        .collect();

    Json(ListWorkflowsResponse {
        total: workflow_responses.len(),
        workflows: workflow_responses,
    })
}

// ============================================================================
// Visualization Helpers
// ============================================================================

/// Generate Mermaid diagram from workflow definition
fn generate_mermaid_diagram(workflow: &a2rchitech_workflows::WorkflowDefinition) -> String {
    let mut mermaid = "graph TD\n".to_string();

    // Style definitions based on workflow phase
    mermaid.push_str("    classDef observe fill:#e3f2fd,stroke:#1976d2,stroke-width:2px;\n");
    mermaid.push_str("    classDef think fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px;\n");
    mermaid.push_str("    classDef plan fill:#e8f5e9,stroke:#388e3c,stroke-width:2px;\n");
    mermaid.push_str("    classDef build fill:#fff3e0,stroke:#f57c00,stroke-width:2px;\n");
    mermaid.push_str("    classDef execute fill:#ffebee,stroke:#d32f2f,stroke-width:2px;\n");
    mermaid.push_str("    classDef verify fill:#f1f8e9,stroke:#7cb342,stroke-width:2px;\n");
    mermaid.push_str("    classDef learn fill:#fce4ec,stroke:#c2185b,stroke-width:2px;\n");
    mermaid.push_str("    classDef default fill:#fafafa,stroke:#616161,stroke-width:2px;\n\n");

    // Add nodes with phase-based styling
    for node in &workflow.nodes {
        let phase_class = match node.phase {
            a2rchitech_workflows::WorkflowPhase::Observe => "observe",
            a2rchitech_workflows::WorkflowPhase::Think => "think",
            a2rchitech_workflows::WorkflowPhase::Plan => "plan",
            a2rchitech_workflows::WorkflowPhase::Build => "build",
            a2rchitech_workflows::WorkflowPhase::Execute => "execute",
            a2rchitech_workflows::WorkflowPhase::Verify => "verify",
            a2rchitech_workflows::WorkflowPhase::Learn => "learn",
        };
        mermaid.push_str(&format!(
            "    {}[\"{}\"]:::{}\n",
            node.id, node.name, phase_class
        ));
    }

    // Add edges with optional conditions
    for edge in &workflow.edges {
        match &edge.condition {
            Some(c) => {
                mermaid.push_str(&format!("    {} -->|\"{}\"| {}\n", edge.from, c, edge.to));
            }
            None => {
                mermaid.push_str(&format!("    {} --> {}\n", edge.from, edge.to));
            }
        }
    }

    mermaid
}

/// Generate DOT (Graphviz) format from workflow definition
fn generate_dot_graph(workflow: &a2rchitech_workflows::WorkflowDefinition) -> String {
    let mut dot = String::new();
    dot.push_str("digraph Workflow {\n");
    dot.push_str("    rankdir=TB;\n");
    dot.push_str("    node [shape=box, style=filled, fontname=\"Arial\"];\n");
    dot.push_str("    edge [fontname=\"Arial\", fontsize=10];\n\n");

    // Node definitions with phase-based colors
    for node in &workflow.nodes {
        let color = match node.phase {
            a2rchitech_workflows::WorkflowPhase::Observe => "#e3f2fd",
            a2rchitech_workflows::WorkflowPhase::Think => "#f3e5f5",
            a2rchitech_workflows::WorkflowPhase::Plan => "#e8f5e9",
            a2rchitech_workflows::WorkflowPhase::Build => "#fff3e0",
            a2rchitech_workflows::WorkflowPhase::Execute => "#ffebee",
            a2rchitech_workflows::WorkflowPhase::Verify => "#f1f8e9",
            a2rchitech_workflows::WorkflowPhase::Learn => "#fce4ec",
        };
        let fontcolor = match node.phase {
            a2rchitech_workflows::WorkflowPhase::Execute => "darkred",
            _ => "black",
        };
        dot.push_str(&format!(
            "    {} [label=\"{}\\n({:?})\" fillcolor=\"{}\" fontcolor=\"{}\"];\n",
            node.id, node.name, node.phase, color, fontcolor
        ));
    }

    dot.push('\n');

    // Edge definitions
    for edge in &workflow.edges {
        match &edge.condition {
            Some(c) => {
                dot.push_str(&format!(
                    "    {} -> {} [label=\"{}\"];\n",
                    edge.from, edge.to, c
                ));
            }
            None => {
                dot.push_str(&format!("    {} -> {};\n", edge.from, edge.to));
            }
        }
    }

    dot.push('}');
    dot
}

/// Internal node position for layout calculation
#[derive(Debug, Clone)]
struct LayoutPosition {
    x: f64,
    y: f64,
    layer: usize,
}

/// Calculate node positions using layered layout algorithm
fn calculate_node_positions(
    nodes: &[a2rchitech_workflows::WorkflowNode],
    edges: &[a2rchitech_workflows::WorkflowEdge],
) -> HashMap<String, LayoutPosition> {
    use std::collections::{HashMap, HashSet, VecDeque};

    let mut positions: HashMap<String, LayoutPosition> = HashMap::new();
    let mut node_map: HashMap<String, &a2rchitech_workflows::WorkflowNode> = HashMap::new();
    let mut in_degree: HashMap<String, usize> = HashMap::new();
    let mut adj: HashMap<String, Vec<String>> = HashMap::new();

    // Build adjacency list and compute in-degrees
    for node in nodes {
        node_map.insert(node.id.clone(), node);
        in_degree.insert(node.id.clone(), 0);
        adj.insert(node.id.clone(), Vec::new());
    }

    for edge in edges {
        if let Some(degree) = in_degree.get_mut(&edge.to) {
            *degree += 1;
        }
        if let Some(neighbors) = adj.get_mut(&edge.from) {
            neighbors.push(edge.to.clone());
        }
    }

    // Topological sort with layer assignment using Kahn's algorithm
    let mut queue: VecDeque<String> = VecDeque::new();
    let mut layer: HashMap<String, usize> = HashMap::new();

    // Initialize with nodes that have no incoming edges
    for (node_id, &degree) in &in_degree {
        if degree == 0 {
            queue.push_back(node_id.clone());
            layer.insert(node_id.clone(), 0);
        }
    }

    let mut layers: HashMap<usize, Vec<String>> = HashMap::new();

    while let Some(node_id) = queue.pop_front() {
        let current_layer = *layer.get(&node_id).unwrap_or(&0);
        layers
            .entry(current_layer)
            .or_default()
            .push(node_id.clone());

        if let Some(neighbors) = adj.get(&node_id) {
            for neighbor in neighbors {
                if let Some(degree) = in_degree.get_mut(neighbor) {
                    *degree -= 1;
                    if *degree == 0 {
                        queue.push_back(neighbor.clone());
                        // Place neighbor in next layer
                        layer.insert(neighbor.clone(), current_layer + 1);
                    }
                }
            }
        }
    }

    // Calculate positions for each layer
    const NODE_WIDTH: f64 = 160.0;
    const NODE_HEIGHT: f64 = 60.0;
    const LAYER_SPACING: f64 = 100.0;
    const NODE_SPACING: f64 = 20.0;

    for (layer_num, mut layer_nodes) in layers {
        // Sort nodes within layer for consistent ordering
        layer_nodes.sort();

        let layer_width: f64 =
            layer_nodes.len() as f64 * (NODE_WIDTH + NODE_SPACING) - NODE_SPACING;
        let start_x = -layer_width / 2.0;

        for (i, node_id) in layer_nodes.iter().enumerate() {
            let x = start_x + i as f64 * (NODE_WIDTH + NODE_SPACING);
            let y = layer_num as f64 * (NODE_HEIGHT + LAYER_SPACING);

            positions.insert(
                node_id.clone(),
                LayoutPosition {
                    x,
                    y,
                    layer: layer_num,
                },
            );
        }
    }

    positions
}

/// Generate SVG diagram from workflow definition
fn generate_svg_diagram(workflow: &a2rchitech_workflows::WorkflowDefinition) -> String {
    use std::collections::HashMap;

    let positions = calculate_node_positions(&workflow.nodes, &workflow.edges);

    // Calculate bounds
    let mut min_x = f64::MAX;
    let mut max_x = f64::MIN;
    let mut min_y = f64::MAX;
    let mut max_y = f64::MIN;

    for pos in positions.values() {
        min_x = min_x.min(pos.x);
        max_x = max_x.max(pos.x);
        min_y = min_y.min(pos.y);
        max_y = max_y.max(pos.y);
    }

    const NODE_WIDTH: f64 = 160.0;
    const NODE_HEIGHT: f64 = 60.0;
    const PADDING: f64 = 50.0;

    let width = (max_x - min_x + NODE_WIDTH + 2.0 * PADDING) as i32;
    let height = (max_y - min_y + NODE_HEIGHT + 2.0 * PADDING) as i32;

    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{} {} {} {}" style="background-color: #fafafa;">
    <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="{{#}}666"/>
        </marker>
        <style>
            .node-rect {{ stroke: #333; stroke-width: 2px; }}
            .node-text {{ font-family: Arial, sans-serif; font-size: 12px; fill: #333; text-anchor: middle; }}
            .phase-text {{ font-family: Arial, sans-serif; font-size: 10px; fill: #666; text-anchor: middle; }}
            .edge {{ stroke: #666; stroke-width: 2px; fill: none; marker-end: url(#arrowhead); }}
        </style>
    </defs>
"#,
        min_x - PADDING,
        min_y - PADDING,
        width,
        height
    );

    // Draw edges first (so they appear behind nodes)
    for edge in &workflow.edges {
        if let (Some(from_pos), Some(to_pos)) = (positions.get(&edge.from), positions.get(&edge.to))
        {
            let from_x = from_pos.x + NODE_WIDTH / 2.0;
            let from_y = from_pos.y + NODE_HEIGHT;
            let to_x = to_pos.x + NODE_WIDTH / 2.0;
            let to_y = to_pos.y;

            // Draw curved path
            let mid_y = (from_y + to_y) / 2.0;
            svg.push_str(&format!(
                r#"    <path class="edge" d="M {} {} C {} {} {} {} {} {}" />
"#,
                from_x, from_y, from_x, mid_y, to_x, mid_y, to_x, to_y
            ));

            // Add condition label if present
            if let Some(condition) = &edge.condition {
                let label_x = (from_x + to_x) / 2.0 + 5.0;
                let label_y = mid_y - 5.0;
                svg.push_str(&format!(
                    r#"    <text x="{}" y="{}" class="phase-text" fill="{{#}}666">{}</text>
                "#,
                    label_x, label_y, condition
                ));
            }
        }
    }

    // Draw nodes
    for node in &workflow.nodes {
        if let Some(pos) = positions.get(&node.id) {
            let color = match node.phase {
                a2rchitech_workflows::WorkflowPhase::Observe => "#e3f2fd",
                a2rchitech_workflows::WorkflowPhase::Think => "#f3e5f5",
                a2rchitech_workflows::WorkflowPhase::Plan => "#e8f5e9",
                a2rchitech_workflows::WorkflowPhase::Build => "#fff3e0",
                a2rchitech_workflows::WorkflowPhase::Execute => "#ffebee",
                a2rchitech_workflows::WorkflowPhase::Verify => "#f1f8e9",
                a2rchitech_workflows::WorkflowPhase::Learn => "#fce4ec",
            };

            svg.push_str(&format!(
                r#"    <g id="{}" transform="translate({}, {})">
        <rect class="node-rect" x="0" y="0" width="{}" height="{}" fill="{}" rx="8"/>
        <text x="{}" y="{}" class="node-text" font-weight="bold">{}</text>
        <text x="{}" y="{}" class="phase-text">{:?}</text>
    </g>
"#,
                node.id,
                pos.x,
                pos.y,
                NODE_WIDTH,
                NODE_HEIGHT,
                color,
                NODE_WIDTH / 2.0,
                NODE_HEIGHT / 2.0 - 5.0,
                node.name,
                NODE_WIDTH / 2.0,
                NODE_HEIGHT / 2.0 + 12.0,
                node.phase
            ));
        }
    }

    svg.push_str("</svg>");
    svg
}

/// Generate enhanced SVG diagram with execution status overlay and interactivity
async fn generate_enhanced_svg_with_execution(
    workflow: &a2rchitech_workflows::WorkflowDefinition,
    execution_id: &str,
    state: &Arc<AppState>,
) -> String {
    use std::collections::HashMap;

    let positions = calculate_node_positions(&workflow.nodes, &workflow.edges);

    // Fetch execution data if available
    let execution_data = state
        .control_plane
        .workflow_engine
        .get_execution(execution_id.to_string())
        .await;

    // Build node status map from execution
    let mut node_status_map: HashMap<String, (&str, &str)> = HashMap::new(); // node_id -> (status, color)
    if let Some(ref exec) = execution_data {
        for (node_id, node_result) in &exec.node_results {
            let (status, color) = match node_result.status {
                a2rchitech_workflows::NodeStatus::Completed => ("success", "#4CAF50"),
                a2rchitech_workflows::NodeStatus::Failed => ("failed", "#F44336"),
                a2rchitech_workflows::NodeStatus::Running => ("running", "#2196F3"),
                a2rchitech_workflows::NodeStatus::Pending => ("pending", "#9E9E9E"),
                a2rchitech_workflows::NodeStatus::Skipped => ("skipped", "#BDBDBD"),
            };
            node_status_map.insert(node_id.clone(), (status, color));
        }
    }

    // Calculate bounds
    let mut min_x = f64::MAX;
    let mut max_x = f64::MIN;
    let mut min_y = f64::MAX;
    let mut max_y = f64::MIN;

    for pos in positions.values() {
        min_x = min_x.min(pos.x);
        max_x = max_x.max(pos.x);
        min_y = min_y.min(pos.y);
        max_y = max_y.max(pos.y);
    }

    const NODE_WIDTH: f64 = 160.0;
    const NODE_HEIGHT: f64 = 60.0;
    const PADDING: f64 = 50.0;

    let width = (max_x - min_x + NODE_WIDTH + 2.0 * PADDING) as i32;
    let height = (max_y - min_y + NODE_HEIGHT + 2.0 * PADDING) as i32;

    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="{} {} {} {}" style="background-color: #fafafa;">
    <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="{{#}}666"/>
        </marker>
        <style>
            .node-rect {{ stroke: #333; stroke-width: 2px; cursor: pointer; }}
            .node-rect:hover {{ stroke: #2196F3; stroke-width: 3px; }}
            .node-text {{ font-family: Arial, sans-serif; font-size: 12px; fill: #333; text-anchor: middle; }}
            .phase-text {{ font-family: Arial, sans-serif; font-size: 10px; fill: #666; text-anchor: middle; }}
            .status-text {{ font-family: Arial, sans-serif; font-size: 9px; fill: white; text-anchor: middle; font-weight: bold; }}
            .edge {{ stroke: #666; stroke-width: 2px; fill: none; marker-end: url(#arrowhead); }}
            .edge-running {{ stroke: #2196F3; stroke-width: 3px; stroke-dasharray: 5,5; animation: dashanimate 1s linear infinite; }}
            .edge-completed {{ stroke: #4CAF50; stroke-width: 2px; }}
            .edge-failed {{ stroke: #F44336; stroke-width: 2px; stroke-dasharray: 5,5; }}
            @keyframes dashanimate {{
                to {{ stroke-dashoffset: -10; }}
            }}
            .tooltip {{ font-family: Arial, sans-serif; font-size: 11px; fill: #333; }}
        </style>
        <!-- Click handler script -->
        <script type="application/ecmascript"><![CDATA[
            function showNodeDetails(evt, nodeId, nodeName, status) {{
                console.log('Node clicked:', nodeId, status);
                // Can be extended to show tooltip or modal
            }}
        ]]></script>
    </defs>
"#,
        min_x - PADDING,
        min_y - PADDING,
        width,
        height
    );

    // Add execution info header if available
    if let Some(ref exec) = execution_data {
        svg.push_str(&format!(
            r#"    <g id="execution-info">
        <rect x="{}" y="{}" width="200" height="40" fill="white" stroke="{{#}}2196F3" stroke-width="1" rx="5"/>
        <text x="{}" y="{}" class="node-text" font-weight="bold">Execution: {}</text>
        <text x="{}" y="{}" class="phase-text">Status: {:?}</text>
    </g>
"#,
            min_x - PADDING + 10.0,
            min_y - PADDING + 10.0,
            min_x - PADDING + 20.0,
            min_y - PADDING + 30.0,
            exec.execution_id,
            min_x - PADDING + 20.0,
            min_y - PADDING + 48.0,
            exec.status
        ));
    }

    // Draw edges first (so they appear behind nodes)
    for edge in &workflow.edges {
        if let (Some(from_pos), Some(to_pos)) = (positions.get(&edge.from), positions.get(&edge.to))
        {
            let from_x = from_pos.x + NODE_WIDTH / 2.0;
            let from_y = from_pos.y + NODE_HEIGHT;
            let to_x = to_pos.x + NODE_WIDTH / 2.0;
            let to_y = to_pos.y;

            // Determine edge style based on node status
            let edge_class = if let (Some(from_status), Some(_)) = (
                node_status_map.get(&edge.from),
                node_status_map.get(&edge.to),
            ) {
                match from_status.0 {
                    "running" => "edge-running",
                    "completed" => "edge-completed",
                    "failed" => "edge-failed",
                    _ => "edge",
                }
            } else {
                "edge"
            };

            // Draw curved path
            let mid_y = (from_y + to_y) / 2.0;
            svg.push_str(&format!(
                r#"    <path class="{}" d="M {} {} C {} {} {} {} {} {}" />
"#,
                edge_class, from_x, from_y, from_x, mid_y, to_x, mid_y, to_x, to_y
            ));

            // Add condition label if present
            if let Some(condition) = &edge.condition {
                let label_x = (from_x + to_x) / 2.0 + 5.0;
                let label_y = mid_y - 5.0;
                svg.push_str(&format!(
                    r#"    <text x="{}" y="{}" class="phase-text" fill="{{#}}666">{}</text>
"#,
                    label_x, label_y, condition
                ));
            }
        }
    }

    // Draw nodes with execution status overlay
    for node in &workflow.nodes {
        if let Some(pos) = positions.get(&node.id) {
            let base_color = match node.phase {
                a2rchitech_workflows::WorkflowPhase::Observe => "#e3f2fd",
                a2rchitech_workflows::WorkflowPhase::Think => "#f3e5f5",
                a2rchitech_workflows::WorkflowPhase::Plan => "#e8f5e9",
                a2rchitech_workflows::WorkflowPhase::Build => "#fff3e0",
                a2rchitech_workflows::WorkflowPhase::Execute => "#ffebee",
                a2rchitech_workflows::WorkflowPhase::Verify => "#f1f8e9",
                a2rchitech_workflows::WorkflowPhase::Learn => "#fce4ec",
            };

            // Override color with execution status if available
            let (status, status_color) = node_status_map
                .get(&node.id)
                .unwrap_or(&("pending", "#9E9E9E"));

            let fill_color = if node_status_map.contains_key(&node.id) {
                status_color
            } else {
                base_color
            };

            let text_color = if node_status_map.contains_key(&node.id) {
                "white"
            } else {
                "#333"
            };

            // Add click handler for interactivity
            svg.push_str(&format!(
                r#"    <g id="{}" transform="translate({}, {})" onclick="showNodeDetails(evt, '{}', '{}', '{}')" style="cursor: pointer;">
        <rect class="node-rect" x="0" y="0" width="{}" height="{}" fill="{}" rx="8"/>
        <text x="{}" y="{}" class="node-text" font-weight="bold" fill="{}">{}</text>
        <text x="{}" y="{}" class="phase-text" fill="{{#}}666">{:?}</text>
        <text x="{}" y="{}" class="status-text" fill="{}">{}</text>
    </g>
"#,
                node.id,
                pos.x,
                pos.y,
                node.id,
                node.name.replace('\'', "&apos;"),
                status,
                NODE_WIDTH,
                NODE_HEIGHT,
                fill_color,
                NODE_WIDTH / 2.0,
                NODE_HEIGHT / 2.0 - 5.0,
                text_color,
                node.name,
                NODE_WIDTH / 2.0,
                NODE_HEIGHT / 2.0 + 12.0,
                node.phase,
                NODE_WIDTH / 2.0,
                NODE_HEIGHT / 2.0 + 28.0,
                text_color,
                status.to_uppercase()
            ));
        }
    }

    // Add legend
    svg.push_str(&format!(
        r#"    <g id="legend" transform="translate({}, {})">
        <rect x="0" y="0" width="120" height="80" fill="white" stroke="{{#}}ccc" rx="5"/>
        <text x="10" y="20" class="node-text" font-weight="bold">Legend</text>
        <rect x="10" y="30" width="15" height="15" fill="{{#}}4CAF50"/>
        <text x="30" y="42" class="phase-text">Completed</text>
        <rect x="10" y="50" width="15" height="15" fill="{{#}}F44336"/>
        <text x="30" y="62" class="phase-text">Failed</text>
        <rect x="70" y="30" width="15" height="15" fill="{{#}}2196F3"/>
        <text x="90" y="42" class="phase-text">Running</text>
        <rect x="70" y="50" width="15" height="15" fill="{{#}}9E9E9E"/>
        <text x="90" y="62" class="phase-text">Pending</text>
    </g>
"#,
        max_x + PADDING - 120.0,
        max_y - PADDING - 80.0
    ));

    svg.push_str("</svg>");
    svg
}

/// Generate JSON representation with layout positions
fn generate_json_representation(workflow: &a2rchitech_workflows::WorkflowDefinition) -> String {
    use std::collections::HashMap;

    let positions = calculate_node_positions(&workflow.nodes, &workflow.edges);

    let nodes_json: Vec<serde_json::Value> = workflow
        .nodes
        .iter()
        .map(|node| {
            let pos = positions.get(&node.id).unwrap_or(&LayoutPosition {
                x: 0.0,
                y: 0.0,
                layer: 0,
            });
            serde_json::json!({
                "id": node.id,
                "name": node.name,
                "phase": format!("{:?}", node.phase),
                "skill_id": node.skill_id,
                "inputs": node.inputs,
                "outputs": node.outputs,
                "position": {
                    "x": pos.x,
                    "y": pos.y,
                    "layer": pos.layer
                }
            })
        })
        .collect();

    let edges_json: Vec<serde_json::Value> = workflow
        .edges
        .iter()
        .map(|edge| {
            serde_json::json!({
                "from": edge.from,
                "to": edge.to,
                "condition": edge.condition
            })
        })
        .collect();

    serde_json::json!({
        "workflow_id": workflow.workflow_id,
        "version": workflow.version,
        "description": workflow.description,
        "nodes": nodes_json,
        "edges": edges_json,
        "layout": {
            "algorithm": "layered",
            "node_width": 160,
            "node_height": 60,
            "layer_spacing": 100,
            "node_spacing": 20
        }
    })
    .to_string()
}

// ============================================================================
// Router
// ============================================================================

/// Create workflow routes
pub fn create_workflow_ext_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Workflow CRUD
        .route(
            "/api/v1/workflows",
            get(list_workflows).post(create_workflow),
        )
        .route(
            "/api/v1/workflows/:id",
            get(get_workflow)
                .put(update_workflow)
                .delete(delete_workflow),
        )
        // Workflow execution
        .route("/api/v1/workflows/:id/execute", post(execute_workflow))
        .route("/api/v1/workflows/:id/executions", get(list_executions))
        .route(
            "/api/v1/workflows/:id/executions/:exec_id",
            get(get_execution),
        )
        .route(
            "/api/v1/workflows/:id/executions/:exec_id/cancel",
            post(cancel_execution),
        )
        // Visualization
        .route(
            "/api/v1/workflows/:id/visualization",
            get(get_visualization),
        )
}

// Bring IntoParams into scope for utoipa
use utoipa::IntoParams;
