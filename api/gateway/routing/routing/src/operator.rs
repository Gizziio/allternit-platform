//! Allternit Operator Service Client
//!
//! Provides integration with the Allternit Operator for browser automation,
//! computer-use, desktop automation, and parallel execution.
//!
//! Environment:
//!   - ALLTERNIT_OPERATOR_URL: URL of the operator service (default: http://127.0.0.1:3010)
//!   - ALLTERNIT_OPERATOR_API_KEY: API key for authentication (default: allternit-operator-key)

use axum::{
    extract::{Path, State, Query},
    http::StatusCode,
    response::{IntoResponse, sse::{Event, Sse}},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::info;
use futures::stream::StreamExt;
use std::convert::Infallible;

// Re-add missing types used by the client and routes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserHealthResponse {
    pub available: bool,
    pub service: String,
    pub modes: Vec<String>,
    pub chromium: bool,
    pub cdp_protocol: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserTaskRequest {
    pub goal: String,
    pub url: Option<String>,
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserTaskResponse {
    pub task_id: String,
    pub status: String,
    pub mode: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserTaskResult {
    pub task_id: String,
    pub status: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserSearchRequest {
    pub query: String,
    pub search_engine: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserRetrieveRequest {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionProposeRequest {
    pub session_id: String,
    pub task: String,
    pub screenshot: String,
    pub viewport: Viewport,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewport {
    pub w: i32,
    pub h: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionProposeResponse {
    pub proposals: Vec<serde_json::Value>,
    pub model: String,
    pub latency_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopExecuteRequest {
    pub app: String,
    pub instruction: String,
    pub use_vision: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelRunRequest {
    pub job_id: String,
    pub goal: String,
    pub variants: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelRunResponse {
    pub run_id: String,
    pub status: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ReceiptQueryParams {
    pub session_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub user_id: Option<String>,
    pub tenant_id: Option<String>,
    pub target_system: Option<String>,
    pub status: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}


/// Allternit Operator service configuration
#[derive(Clone)]
pub struct OperatorClient {
    base_url: String,
    api_key: String,
    http_client: reqwest::Client,
}

impl OperatorClient {
    pub fn new(base_url: String, api_key: String) -> Self {
        Self {
            base_url,
            api_key,
            http_client: reqwest::Client::new(),
        }
    }

    pub fn from_env() -> Self {
        let base_url = std::env::var("ALLTERNIT_OPERATOR_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:3010".to_string());
        let api_key = std::env::var("ALLTERNIT_OPERATOR_API_KEY")
            .unwrap_or_else(|_| "allternit-operator-key".to_string());
        Self::new(base_url, api_key)
    }

    /// Check operator service health
    pub async fn health_check(&self) -> Result<bool, reqwest::Error> {
        let response = self
            .http_client
            .get(format!("{}/health", self.base_url))
            .send()
            .await?;
        Ok(response.status().is_success())
    }

    /// Check browser service health
    pub async fn browser_health(&self) -> Result<BrowserHealthResponse, OperatorError> {
        let response = self
            .http_client
            .get(format!("{}/v1/browser/health", self.base_url))
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Create a browser automation task
    pub async fn create_browser_task(
        &self,
        request: BrowserTaskRequest,
    ) -> Result<BrowserTaskResponse, OperatorError> {
        let response = self
            .http_client
            .post(format!("{}/v1/browser/tasks", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Execute a browser task
    pub async fn execute_browser_task(
        &self,
        task_id: &str,
    ) -> Result<BrowserTaskResult, OperatorError> {
        let response = self
            .http_client
            .post(format!(
                "{}/v1/browser/tasks/{}/execute",
                self.base_url, task_id
            ))
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Get browser task status
    pub async fn get_browser_task(
        &self,
        task_id: &str,
    ) -> Result<BrowserTaskResponse, OperatorError> {
        let response = self
            .http_client
            .get(format!("{}/v1/browser/tasks/{}", self.base_url, task_id))
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Search using browser automation
    pub async fn browser_search(
        &self,
        request: BrowserSearchRequest,
    ) -> Result<serde_json::Value, OperatorError> {
        let response = self
            .http_client
            .post(format!("{}/v1/browser/search", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Retrieve URL content using browser automation
    pub async fn browser_retrieve(
        &self,
        request: BrowserRetrieveRequest,
    ) -> Result<serde_json::Value, OperatorError> {
        let response = self
            .http_client
            .post(format!("{}/v1/browser/retrieve", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Propose vision-based actions (Desktop/Computer-Use)
    pub async fn vision_propose(
        &self,
        request: VisionProposeRequest,
    ) -> Result<VisionProposeResponse, OperatorError> {
        let response = self
            .http_client
            .post(format!("{}/v1/vision/propose", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Execute desktop automation task
    pub async fn execute_desktop_task(
        &self,
        session_id: &str,
        request: DesktopExecuteRequest,
    ) -> Result<serde_json::Value, OperatorError> {
        let response = self
            .http_client
            .post(format!(
                "{}/v1/sessions/{}/desktop/execute",
                self.base_url, session_id
            ))
            .json(&request)
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Execute computer-use task (vision-based)
    pub async fn execute_computer_task(
        &self,
        session_id: &str,
        request: DesktopExecuteRequest,
    ) -> Result<serde_json::Value, OperatorError> {
        let response = self
            .http_client
            .post(format!(
                "{}/v1/sessions/{}/computer/execute",
                self.base_url, session_id
            ))
            .json(&request)
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Create parallel execution run
    pub async fn create_parallel_run(
        &self,
        request: ParallelRunRequest,
    ) -> Result<ParallelRunResponse, OperatorError> {
        let response = self
            .http_client
            .post(format!("{}/v1/parallel/runs", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Get parallel run status
    pub async fn get_parallel_run_status(
        &self,
        run_id: &str,
    ) -> Result<serde_json::Value, OperatorError> {
        let response = self
            .http_client
            .get(format!(
                "{}/v1/parallel/runs/{}/status",
                self.base_url, run_id
            ))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Retrieve the proof of work events for an autoland run
    pub async fn get_proof_of_work(&self, run_id: &str) -> Result<serde_json::Value, OperatorError> {
        let response = self
            .http_client
            .get(format!(
                "{}/v1/operator/autoland/{}/proof_of_work",
                self.base_url, run_id
            ))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
            .map_err(|e| OperatorError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| OperatorError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(OperatorError::Service(format!("{}: {}", status, text)))
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum OperatorError {
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Service error: {0}")]
    Service(String),
}

// Request/Response Types

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperatorExecuteRequest {
    pub requestId: String,
    pub sessionId: String,
    pub actor: OperatorActor,
    pub intent: String,
    pub mode: String,
    pub context: OperatorContext,
    pub preferences: OperatorPreferences,
    pub policy: OperatorPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperatorActor {
    pub userId: String,
    pub tenantId: Option<String>,
    pub role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperatorContext {
    pub targetType: String,
    pub targetApp: Option<String>,
    pub targetDomain: Option<String>,
    pub pageTitle: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperatorPreferences {
    pub preferConnector: bool,
    pub allowBrowserAutomation: bool,
    pub allowDesktopFallback: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperatorPolicy {
    pub requirePrivateModel: Option<bool>,
    pub requireApprovalForWrites: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OperatorEvent {
    PlanningStarted { requestId: String },
    PlanReady { requestId: String, plan: serde_json::Value },
    ExecutionStarted { requestId: String, backend: String },
    StepStarted { requestId: String, stepId: String, title: String },
    StepFinished { requestId: String, stepId: String, status: String },
    VerificationResult { requestId: String, status: String, detail: String },
    ReceiptReady { requestId: String, receiptId: String },
    RunFailed { requestId: String, error: String },
    RunFinished { requestId: String, status: String },
}

// API Routes

pub fn create_operator_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        // Health
        .route("/api/v1/operator/health", get(operator_health))
        // Browser
        .route("/api/v1/operator/browser/health", get(browser_health))
        .route("/api/v1/operator/browser/tasks", post(create_browser_task))
        .route("/api/v1/operator/browser/search", post(browser_search))
        .route("/api/v1/operator/browser/retrieve", post(browser_retrieve))
        // Vision/Desktop
        .route("/api/v1/operator/vision/propose", post(vision_propose))
        // Parallel
        .route("/api/v1/operator/parallel/runs", post(create_parallel_run))
        // Autoland
        .route("/api/v1/operator/autoland/:run_id/proof_of_work", get(get_proof_of_work))
        // DIRECT OPERATOR EXECUTION (Epic D)
        .route("/api/v1/operator/execute", post(operator_execute))
        .route("/api/v1/operator/events/:request_id", get(operator_events_stream))
        // RECEIPTS AND AUDIT (Epic 8)
        .route("/api/v1/operator/receipts", get(list_receipts))
        .route("/api/v1/operator/receipts", post(create_receipt))
        .route("/api/v1/operator/receipts/:receipt_id", get(get_receipt))
        .route("/api/v1/operator/receipts/request/:request_id", get(get_receipt_by_request))
        .route("/api/v1/operator/receipts/export", post(export_receipts))
}

async fn operator_execute(
    State(state): State<Arc<crate::AppState>>,
    Json(request): Json<OperatorExecuteRequest>,
) -> impl IntoResponse {
    info!("[Operator] Received execute request: {}", request.requestId);
    
    // In a real implementation, this would spawn the allternit-dak-runner process
    // and pipe the request to its stdin. For MVP, we'll proxy to the Kernel.
    
    let kernel_url = format!("{}/api/v1/operator/execute", state.kernel_url);
    let client = reqwest::Client::new();
    
    match client.post(kernel_url).json(&request).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                (StatusCode::ACCEPTED, Json(serde_json::json!({ "status": "accepted", "requestId": request.requestId })))
            } else {
                let err = resp.text().await.unwrap_or_default();
                (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": err })))
            }
        },
        Err(e) => (StatusCode::SERVICE_UNAVAILABLE, Json(serde_json::json!({ "error": e.to_string() })))
    }
}

async fn operator_events_stream(
    State(state): State<Arc<crate::AppState>>,
    Path(request_id): Path<String>,
) -> impl IntoResponse {
    info!("[Operator] Opening live event proxy for: {}", request_id);

    // REAL: Connect to the Kernel's event stream for this request
    let kernel_stream_url = format!("{}/api/v1/operator/events/{}", state.kernel_url, request_id);
    
    let client = reqwest::Client::new();
    let stream = async_stream::stream! {
        let resp_res = client.get(kernel_stream_url).send().await;
        if let Ok(resp) = resp_res {
            let mut byte_stream = resp.bytes_stream();
            while let Some(chunk_res) = byte_stream.next().await {
                if let Ok(chunk) = chunk_res {
                    yield Ok::<Event, Infallible>(Event::default().data(String::from_utf8_lossy(&chunk).to_string()));
                }
            }
        }
    };

    Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::default())
}

async fn operator_health() -> impl IntoResponse {
    let client = OperatorClient::from_env();
    match client.health_check().await {
        Ok(true) => (
            StatusCode::OK,
            Json(serde_json::json!({ "status": "healthy" })),
        ),
        Ok(false) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "status": "unhealthy" })),
        ),
        Err(e) => (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(serde_json::json!({ "status": "error", "message": e.to_string() })),
        ),
    }
}

async fn browser_health() -> Result<impl IntoResponse, StatusCode> {
    let client = OperatorClient::from_env();
    match client.browser_health().await {
        Ok(health) => Ok((StatusCode::OK, Json(health))),
        Err(_) => Err(StatusCode::SERVICE_UNAVAILABLE),
    }
}

async fn create_browser_task(
    Json(request): Json<BrowserTaskRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = OperatorClient::from_env();
    match client.create_browser_task(request).await {
        Ok(response) => Ok((StatusCode::CREATED, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn browser_search(
    Json(request): Json<BrowserSearchRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = OperatorClient::from_env();
    match client.browser_search(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn browser_retrieve(
    Json(request): Json<BrowserRetrieveRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = OperatorClient::from_env();
    match client.browser_retrieve(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn vision_propose(
    Json(request): Json<VisionProposeRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = OperatorClient::from_env();
    match client.vision_propose(request).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn create_parallel_run(
    Json(request): Json<ParallelRunRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = OperatorClient::from_env();
    match client.create_parallel_run(request).await {
        Ok(response) => Ok((StatusCode::CREATED, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_proof_of_work(
    Path(run_id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = OperatorClient::from_env();
    match client.get_proof_of_work(&run_id).await {
        Ok(response) => Ok((StatusCode::OK, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

// ============================================================================
// RECEIPTS AND AUDIT HANDLERS
// ============================================================================

// In-memory receipt store (production would use database)
use std::sync::RwLock;
use lazy_static::lazy_static;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct StoredReceipt {
    id: String,
    request_id: String,
    user_id: String,
    user_intent: String,
    target_system: String,
    status: String,
    created_objects: Vec<serde_json::Value>,
    actions: Vec<serde_json::Value>,
    verification: serde_json::Value,
    privacy: serde_json::Value,
    hash: String,
    created_at: String,
}

lazy_static! {
    static ref RECEIPT_STORE: RwLock<Vec<StoredReceipt>> = RwLock::new(Vec::new());
}

#[derive(serde::Serialize)]
struct ReceiptListResponse {
    receipts: Vec<serde_json::Value>,
    total: u32,
    limit: u32,
    offset: u32,
}

#[derive(serde::Deserialize)]
struct CreateReceiptRequest {
    request_id: String,
    user_id: Option<String>,
    user_intent: String,
    target_system: String,
    status: String,
    created_objects: Option<Vec<serde_json::Value>>,
    actions: Option<Vec<serde_json::Value>>,
    verification: Option<serde_json::Value>,
    privacy: Option<serde_json::Value>,
}

async fn list_receipts(
    State(_state): State<Arc<crate::AppState>>,
    Query(params): Query<ReceiptQueryParams>,
) -> Result<impl IntoResponse, StatusCode> {
    let store = RECEIPT_STORE.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let receipts: Vec<serde_json::Value> = store
        .iter()
        .map(|r| serde_json::to_value(r).unwrap_or(serde_json::Value::Null))
        .collect();
    
    let total = receipts.len() as u32;
    let limit = params.limit.unwrap_or(100) as u32;
    let offset = params.offset.unwrap_or(0) as u32;
    
    Ok((
        StatusCode::OK,
        Json(ReceiptListResponse {
            receipts,
            total,
            limit,
            offset,
        }),
    ))
}

async fn get_receipt(
    State(_state): State<Arc<crate::AppState>>,
    Path(receipt_id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let store = RECEIPT_STORE.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    for receipt in store.iter() {
        if receipt.id == receipt_id {
            return Ok((StatusCode::OK, Json(serde_json::to_value(receipt).unwrap())));
        }
    }
    
    Err(StatusCode::NOT_FOUND)
}

async fn get_receipt_by_request(
    State(_state): State<Arc<crate::AppState>>,
    Path(request_id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let store = RECEIPT_STORE.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    for receipt in store.iter() {
        if receipt.request_id == request_id {
            return Ok((StatusCode::OK, Json(serde_json::to_value(receipt).unwrap())));
        }
    }
    
    Err(StatusCode::NOT_FOUND)
}

async fn create_receipt(
    State(_state): State<Arc<crate::AppState>>,
    Json(request): Json<CreateReceiptRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    let receipt_id = format!("receipt_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis());
    
    let receipt = StoredReceipt {
        id: receipt_id.clone(),
        request_id: request.request_id,
        user_id: request.user_id.unwrap_or_else(|| "anonymous".to_string()),
        user_intent: request.user_intent,
        target_system: request.target_system,
        status: request.status,
        created_objects: request.created_objects.unwrap_or_default(),
        actions: request.actions.unwrap_or_default(),
        verification: request.verification.unwrap_or(serde_json::json!({"overallPassed": true, "checks": []})),
        privacy: request.privacy.unwrap_or(serde_json::json!({
            "modelRouting": "private_cloud",
            "dataClassification": "internal",
            "piiDetected": false,
            "studentDataFlagged": false
        })),
        hash: format!("sha256:{}", receipt_id),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    
    let mut store = RECEIPT_STORE.write().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    store.push(receipt.clone());
    
    Ok((StatusCode::CREATED, Json(serde_json::to_value(&receipt).unwrap())))
}

#[derive(serde::Deserialize)]
struct ExportReceiptsRequest {
    receipt_ids: Vec<String>,
    format: Option<String>, // json, csv
}

#[derive(serde::Serialize)]
struct ExportReceiptsResponse {
    format: String,
    data: String,
    count: u32,
}

async fn export_receipts(
    State(_state): State<Arc<crate::AppState>>,
    Json(request): Json<ExportReceiptsRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let store = RECEIPT_STORE.read().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let receipts: Vec<&StoredReceipt> = if request.receipt_ids.is_empty() {
        store.iter().collect()
    } else {
        store.iter().filter(|r| request.receipt_ids.contains(&r.id)).collect()
    };
    
    let data = if request.format.as_deref() == Some("csv") {
        // Simple CSV export
        let mut csv = String::from("id,request_id,status,created_at\n");
        for r in &receipts {
            csv.push_str(&format!("{},{},{},{}\n", r.id, r.request_id, r.status, r.created_at));
        }
        csv
    } else {
        serde_json::to_string_pretty(&receipts).unwrap_or_else(|_| "[]".to_string())
    };
    
    Ok((
        StatusCode::OK,
        Json(ExportReceiptsResponse {
            format: request.format.unwrap_or_else(|| "json".to_string()),
            data,
            count: receipts.len() as u32,
        }),
    ))
}
