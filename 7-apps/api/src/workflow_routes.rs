#![allow(dead_code, unused_variables, unused_imports)]
//! Workflow Execution API Routes (N7)
//!
//! Provides REST API for:
//! - Workflow CRUD operations
//! - Workflow execution and monitoring
//! - Execution status and results

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::AppState;
use a2r_driver_interface::DriverType;
use a2rchitech_workflows::{
    engine::WorkflowExecutor, NodeConstraints, NodeStatus, WorkflowDefinition, WorkflowEdge,
    WorkflowExecution, WorkflowNode, WorkflowPhase, WorkflowStatus,
};

// ============================================================================
// Execution Record for persistence
// ============================================================================

/// Execution record stored in memory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionRecord {
    pub execution_id: String,
    pub workflow_id: String,
    pub status: String,
    pub current_phase: Option<String>,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub node_results: Vec<NodeResultDto>,
    pub tenant_id: String,
    pub session_id: String,
}

// ============================================================================
// Request/Response Types
// ============================================================================

/// Create workflow request
#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateWorkflowRequest {
    /// Workflow unique identifier
    pub workflow_id: String,
    /// Workflow version
    pub version: String,
    /// Description
    pub description: String,
    /// Workflow nodes
    pub nodes: Vec<WorkflowNodeDto>,
    /// Workflow edges (dependencies)
    pub edges: Vec<WorkflowEdgeDto>,
}

/// Workflow node DTO
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct WorkflowNodeDto {
    pub id: String,
    pub name: String,
    pub phase: String,
    pub skill_id: String,
    pub inputs: Vec<String>,
    pub outputs: Vec<String>,
    pub constraints: Option<NodeConstraintsDto>,
}

/// Node constraints DTO
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct NodeConstraintsDto {
    pub time_budget_seconds: Option<u64>,
    pub allowed_tools: Vec<String>,
}

/// Workflow edge DTO
#[derive(Debug, Deserialize, Serialize, ToSchema)]
pub struct WorkflowEdgeDto {
    pub from: String,
    pub to: String,
    pub condition: Option<String>,
}

/// Create workflow response
#[derive(Debug, Serialize, ToSchema)]
pub struct CreateWorkflowResponse {
    pub workflow_id: String,
    pub status: String,
    pub node_count: usize,
}

/// Execute workflow request
#[derive(Debug, Deserialize, ToSchema)]
pub struct ExecuteWorkflowRequest {
    /// Tenant ID
    pub tenant_id: Option<String>,
    /// Session ID
    pub session_id: Option<String>,
}

/// Execute workflow response
#[derive(Debug, Serialize, ToSchema)]
pub struct ExecuteWorkflowResponse {
    pub execution_id: String,
    pub workflow_id: String,
    pub status: String,
    pub start_time: u64,
}

/// Workflow execution status response
#[derive(Debug, Serialize, ToSchema)]
pub struct ExecutionStatusResponse {
    pub execution_id: String,
    pub workflow_id: String,
    pub status: String,
    pub current_phase: Option<String>,
    pub start_time: u64,
    pub end_time: Option<u64>,
    pub node_results: Vec<NodeResultDto>,
}

/// Node result DTO
#[derive(Debug, Serialize, Deserialize, ToSchema, Clone)]
pub struct NodeResultDto {
    pub node_id: String,
    pub status: String,
    pub execution_time_ms: u64,
    pub error: Option<String>,
}

/// List workflows response
#[derive(Debug, Serialize, ToSchema)]
pub struct ListWorkflowsResponse {
    pub workflows: Vec<WorkflowSummary>,
    pub total: usize,
}

/// Workflow summary
#[derive(Debug, Serialize, ToSchema)]
pub struct WorkflowSummary {
    pub workflow_id: String,
    pub version: String,
    pub description: String,
    pub node_count: usize,
}

/// List executions response
#[derive(Debug, Serialize, ToSchema)]
pub struct ListExecutionsResponse {
    pub executions: Vec<ExecutionSummary>,
    pub total: usize,
}

/// Execution summary
#[derive(Debug, Serialize, ToSchema)]
pub struct ExecutionSummary {
    pub execution_id: String,
    pub workflow_id: String,
    pub status: String,
    pub start_time: u64,
    pub end_time: Option<u64>,
}

// ============================================================================
// Routes
// ============================================================================

/// Create workflow routes
pub fn create_workflow_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Workflow management
        .route(
            "/api/v1/workflows",
            get(list_workflows).post(create_workflow),
        )
        .route(
            "/api/v1/workflows/:id",
            get(get_workflow).delete(delete_workflow),
        )
        // Workflow execution
        .route("/api/v1/workflows/:id/execute", post(execute_workflow))
        .route("/api/v1/workflows/executions", get(list_executions))
        .route(
            "/api/v1/workflows/executions/:id",
            get(get_execution_status),
        )
        .route(
            "/api/v1/workflows/executions/:id/stop",
            post(stop_execution),
        )
}

// ============================================================================
// Route Handlers
// ============================================================================

/// List all workflows
#[utoipa::path(
    get,
    path = "/api/v1/workflows",
    responses(
        (status = 200, description = "List of workflows", body = ListWorkflowsResponse)
    )
)]
async fn list_workflows(State(state): State<Arc<AppState>>) -> Json<ListWorkflowsResponse> {
    // Read workflows from storage
    let store = state.workflow_store.read().await;

    let workflows: Vec<WorkflowSummary> = store
        .values()
        .map(|w| WorkflowSummary {
            workflow_id: w.workflow_id.clone(),
            version: w.version.clone(),
            description: w.description.clone(),
            node_count: w.nodes.len(),
        })
        .collect();

    let total = workflows.len();

    Json(ListWorkflowsResponse { workflows, total })
}

/// Create a new workflow
#[utoipa::path(
    post,
    path = "/api/v1/workflows",
    request_body = CreateWorkflowRequest,
    responses(
        (status = 201, description = "Workflow created", body = CreateWorkflowResponse),
        (status = 400, description = "Invalid request"),
        (status = 409, description = "Workflow already exists")
    )
)]
async fn create_workflow(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateWorkflowRequest>,
) -> Result<Json<CreateWorkflowResponse>, StatusCode> {
    info!(workflow_id = %request.workflow_id, "Creating new workflow");

    // Check if workflow already exists
    {
        let store = state.workflow_store.read().await;
        if store.contains_key(&request.workflow_id) {
            warn!(workflow_id = %request.workflow_id, "Workflow already exists");
            return Err(StatusCode::CONFLICT);
        }
    }

    // Convert DTOs to domain types
    let nodes: Vec<WorkflowNode> = request
        .nodes
        .into_iter()
        .map(|n| WorkflowNode {
            id: n.id,
            name: n.name,
            phase: parse_phase(&n.phase).unwrap_or(WorkflowPhase::Execute),
            skill_id: n.skill_id,
            inputs: n.inputs,
            outputs: n.outputs,
            constraints: n
                .constraints
                .map(|c| NodeConstraints {
                    time_budget: c.time_budget_seconds,
                    resource_limits: None,
                    allowed_tools: c.allowed_tools,
                    required_permissions: vec![],
                })
                .unwrap_or_else(|| NodeConstraints {
                    time_budget: None,
                    resource_limits: None,
                    allowed_tools: vec![],
                    required_permissions: vec![],
                }),
        })
        .collect();

    let edges: Vec<WorkflowEdge> = request
        .edges
        .into_iter()
        .map(|e| WorkflowEdge {
            from: e.from,
            to: e.to,
            condition: e.condition,
        })
        .collect();

    let workflow = WorkflowDefinition {
        workflow_id: request.workflow_id.clone(),
        version: request.version,
        description: request.description,
        required_roles: vec![],
        allowed_skill_tiers: vec![],
        phases_used: vec![WorkflowPhase::Execute],
        success_criteria: "All nodes complete".to_string(),
        failure_modes: vec![],
        nodes,
        edges,
    };

    // Store workflow in persistent storage
    let mut store = state.workflow_store.write().await;
    store.insert(request.workflow_id.clone(), workflow);

    info!(
        workflow_id = %request.workflow_id,
        node_count = store.get(&request.workflow_id).map(|w| w.nodes.len()).unwrap_or(0),
        "Workflow created and stored"
    );

    Ok(Json(CreateWorkflowResponse {
        workflow_id: request.workflow_id.clone(),
        status: "created".to_string(),
        node_count: store
            .get(&request.workflow_id)
            .map(|w| w.nodes.len())
            .unwrap_or(0),
    }))
}

/// Get workflow details
#[utoipa::path(
    get,
    path = "/api/v1/workflows/{id}",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    responses(
        (status = 200, description = "Workflow details"),
        (status = 404, description = "Workflow not found")
    )
)]
async fn get_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Retrieve workflow from storage
    let store = state.workflow_store.read().await;

    match store.get(&id) {
        Some(workflow) => {
            let response = serde_json::json!({
                "workflow_id": workflow.workflow_id,
                "version": workflow.version,
                "description": workflow.description,
                "node_count": workflow.nodes.len(),
                "edge_count": workflow.edges.len(),
                "nodes": workflow.nodes,
                "edges": workflow.edges,
            });
            Ok(Json(response))
        }
        None => {
            warn!(workflow_id = %id, "Workflow not found");
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Delete a workflow
#[utoipa::path(
    delete,
    path = "/api/v1/workflows/{id}",
    params(
        ("id" = String, Path, description = "Workflow ID")
    ),
    responses(
        (status = 204, description = "Workflow deleted"),
        (status = 404, description = "Workflow not found")
    )
)]
async fn delete_workflow(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> StatusCode {
    info!(workflow_id = %id, "Deleting workflow");

    // Delete workflow from storage
    let mut store = state.workflow_store.write().await;

    match store.remove(&id) {
        Some(_) => {
            info!(workflow_id = %id, "Workflow deleted successfully");
            StatusCode::NO_CONTENT
        }
        None => {
            warn!(workflow_id = %id, "Workflow not found for deletion");
            StatusCode::NOT_FOUND
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
        (status = 202, description = "Workflow execution started", body = ExecuteWorkflowResponse),
        (status = 404, description = "Workflow not found"),
        (status = 500, description = "Execution failed")
    )
)]
async fn execute_workflow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<ExecuteWorkflowRequest>,
) -> Result<Json<ExecuteWorkflowResponse>, StatusCode> {
    info!(workflow_id = %id, "Starting workflow execution");

    // Load workflow from storage
    let workflow = {
        let store = state.workflow_store.read().await;
        match store.get(&id) {
            Some(w) => w.clone(),
            None => {
                warn!(workflow_id = %id, "Workflow not found for execution");
                return Err(StatusCode::NOT_FOUND);
            }
        }
    };

    let tenant_id = request.tenant_id.unwrap_or_else(|| "default".to_string());
    let session_id = request.session_id.unwrap_or_else(|| "default".to_string());
    let execution_id = Uuid::new_v4().to_string();
    let start_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Create execution record
    let execution_record = ExecutionRecord {
        execution_id: execution_id.clone(),
        workflow_id: id.clone(),
        status: "Running".to_string(),
        current_phase: Some("Execute".to_string()),
        start_time,
        end_time: None,
        node_results: vec![],
        tenant_id: tenant_id.clone(),
        session_id: session_id.clone(),
    };

    // Store execution record
    {
        let mut exec_store = state.execution_store.write().await;
        exec_store.insert(execution_id.clone(), execution_record);
    }

    // Create executor and run workflow
    let driver_registry = state.driver_registry.read().await;
    let driver = driver_registry
        .get_driver_arc(DriverType::Process)
        .ok_or_else(|| {
            error!("Process driver not found");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    let executor = WorkflowExecutor::new(driver.clone());
    drop(driver_registry); // Release the read lock

    match executor.execute(&workflow, &tenant_id, &session_id).await {
        Ok(execution) => {
            info!(
                execution_id = %execution.execution_id,
                "Workflow execution started"
            );

            // Update execution record with actual execution ID from engine
            let mut exec_store = state.execution_store.write().await;
            if let Some(record) = exec_store.get_mut(&execution_id) {
                record.status = format!("{:?}", execution.status);
            }

            Ok(Json(ExecuteWorkflowResponse {
                execution_id,
                workflow_id: execution.workflow_id,
                status: format!("{:?}", execution.status),
                start_time: execution.start_time,
            }))
        }
        Err(e) => {
            error!(error = %e, "Workflow execution failed");

            // Update execution record with failure status
            let mut exec_store = state.execution_store.write().await;
            if let Some(record) = exec_store.get_mut(&execution_id) {
                record.status = "Failed".to_string();
                record.end_time = Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs(),
                );
            }

            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

/// List workflow executions
#[utoipa::path(
    get,
    path = "/api/v1/workflows/executions",
    responses(
        (status = 200, description = "List of executions", body = ListExecutionsResponse)
    )
)]
async fn list_executions(State(state): State<Arc<AppState>>) -> Json<ListExecutionsResponse> {
    // Read executions from storage
    let store = state.execution_store.read().await;

    let executions: Vec<ExecutionSummary> = store
        .values()
        .map(|e| ExecutionSummary {
            execution_id: e.execution_id.clone(),
            workflow_id: e.workflow_id.clone(),
            status: e.status.clone(),
            start_time: e.start_time,
            end_time: e.end_time,
        })
        .collect();

    let total = executions.len();

    Json(ListExecutionsResponse { executions, total })
}

/// Get execution status
#[utoipa::path(
    get,
    path = "/api/v1/workflows/executions/{id}",
    params(
        ("id" = String, Path, description = "Execution ID")
    ),
    responses(
        (status = 200, description = "Execution status", body = ExecutionStatusResponse),
        (status = 404, description = "Execution not found")
    )
)]
async fn get_execution_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<ExecutionStatusResponse>, StatusCode> {
    // Retrieve execution from storage
    let store = state.execution_store.read().await;

    match store.get(&id) {
        Some(record) => Ok(Json(ExecutionStatusResponse {
            execution_id: record.execution_id.clone(),
            workflow_id: record.workflow_id.clone(),
            status: record.status.clone(),
            current_phase: record.current_phase.clone(),
            start_time: record.start_time,
            end_time: record.end_time,
            node_results: record.node_results.clone(),
        })),
        None => {
            warn!(execution_id = %id, "Execution not found");
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Stop an execution
#[utoipa::path(
    post,
    path = "/api/v1/workflows/executions/{id}/stop",
    params(
        ("id" = String, Path, description = "Execution ID")
    ),
    responses(
        (status = 200, description = "Execution stopped"),
        (status = 404, description = "Execution not found")
    )
)]
async fn stop_execution(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> StatusCode {
    info!(execution_id = %id, "Stopping workflow execution");

    // Update execution record to mark as stopped
    let mut store = state.execution_store.write().await;

    match store.get_mut(&id) {
        Some(record) => {
            // Only allow stopping running executions
            if record.status == "Running" || record.status == "Pending" {
                record.status = "Stopped".to_string();
                record.end_time = Some(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs(),
                );
                info!(execution_id = %id, "Execution stopped successfully");
                StatusCode::OK
            } else {
                warn!(
                    execution_id = %id,
                    status = %record.status,
                    "Cannot stop execution - not in running state"
                );
                StatusCode::CONFLICT
            }
        }
        None => {
            warn!(execution_id = %id, "Execution not found for stopping");
            StatusCode::NOT_FOUND
        }
    }
}

// ============================================================================
// Helpers
// ============================================================================

fn parse_phase(phase: &str) -> Option<WorkflowPhase> {
    match phase.to_lowercase().as_str() {
        "observe" => Some(WorkflowPhase::Observe),
        "think" => Some(WorkflowPhase::Think),
        "plan" => Some(WorkflowPhase::Plan),
        "build" => Some(WorkflowPhase::Build),
        "execute" => Some(WorkflowPhase::Execute),
        "verify" => Some(WorkflowPhase::Verify),
        "learn" => Some(WorkflowPhase::Learn),
        _ => None,
    }
}
