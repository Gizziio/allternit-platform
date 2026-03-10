//! A2R Operator Service Client
//!
//! Provides integration with the A2R Operator for browser automation,
//! computer-use, desktop automation, and parallel execution.
//!
//! Environment:
//!   - A2R_OPERATOR_URL: URL of the operator service (default: http://127.0.0.1:3010)
//!   - A2R_OPERATOR_API_KEY: API key for authentication (default: a2r-operator-key)

use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// A2R Operator service configuration
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
        let base_url = std::env::var("A2R_OPERATOR_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:3010".to_string());
        let api_key = std::env::var("A2R_OPERATOR_API_KEY")
            .unwrap_or_else(|_| "a2r-operator-key".to_string());
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default = "default_browser_mode")]
    pub mode: String,
}

fn default_browser_mode() -> String {
    "browser-use".to_string()
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserSearchRequest {
    pub query: String,
    #[serde(default = "default_search_engine")]
    pub search_engine: String,
}

fn default_search_engine() -> String {
    "duckduckgo".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserRetrieveRequest {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Viewport {
    pub w: i32,
    pub h: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionProposeRequest {
    pub session_id: String,
    pub task: String,
    pub screenshot: String,
    pub viewport: Viewport,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraints: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionProposal {
    #[serde(rename = "type")]
    pub action_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub x: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub y: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    pub confidence: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thought: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VisionProposeResponse {
    pub proposals: Vec<ActionProposal>,
    pub model: String,
    pub latency_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopExecuteRequest {
    pub app: String,
    pub instruction: String,
    #[serde(default)]
    pub use_vision: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelVariant {
    pub variant_id: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub agent_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelRunRequest {
    pub job_id: String,
    pub goal: String,
    pub variants: Vec<ParallelVariant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParallelRunResponse {
    pub run_id: String,
    pub status: String,
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
