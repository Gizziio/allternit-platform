//! WebVM Bridge Client
//!
//! Provides integration with the WebVM Bridge for browser-based
//! Linux virtual machines via WebAssembly.
//!
//! Environment:
//!   - Allternit_WEBVM_URL: URL of the WebVM service (default: http://127.0.0.1:8002)

use axum::{
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// WebVM service configuration
#[derive(Clone)]
pub struct WebVmClient {
    base_url: String,
    http_client: reqwest::Client,
}

impl WebVmClient {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            http_client: reqwest::Client::new(),
        }
    }

    pub fn from_env() -> Self {
        let base_url =
            std::env::var("Allternit_WEBVM_URL").unwrap_or_else(|_| "http://127.0.0.1:8002".to_string());
        Self::new(base_url)
    }

    /// Check WebVM service health
    pub async fn health_check(&self) -> Result<bool, reqwest::Error> {
        let response = self
            .http_client
            .get(format!("{}/health", self.base_url))
            .send()
            .await?;
        Ok(response.status().is_success())
    }

    /// Get service status
    pub async fn service_status(&self) -> Result<WebVmStatus, reqwest::Error> {
        let response = self
            .http_client
            .get(format!("{}/api/v1/status", self.base_url))
            .send()
            .await?;
        response.json().await
    }

    /// Create a new WebVM session
    pub async fn create_session(
        &self,
        disk_image: Option<String>,
    ) -> Result<SessionCreateResponse, WebVmError> {
        let request = SessionCreateRequest { disk_image };
        let response = self
            .http_client
            .post(format!("{}/api/v1/sessions", self.base_url))
            .json(&request)
            .send()
            .await
            .map_err(|e| WebVmError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| WebVmError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(WebVmError::Service(format!("{}: {}", status, text)))
        }
    }

    /// List all active sessions
    pub async fn list_sessions(&self) -> Result<Vec<SessionInfo>, WebVmError> {
        let response = self
            .http_client
            .get(format!("{}/api/v1/sessions", self.base_url))
            .send()
            .await
            .map_err(|e| WebVmError::Http(e.to_string()))?;

        if response.status().is_success() {
            response
                .json()
                .await
                .map_err(|e| WebVmError::Parse(e.to_string()))
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(WebVmError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Get session details
    pub async fn get_session(&self, session_id: &str) -> Result<Option<SessionInfo>, WebVmError> {
        let response = self
            .http_client
            .get(format!("{}/api/v1/sessions/{}", self.base_url, session_id))
            .send()
            .await
            .map_err(|e| WebVmError::Http(e.to_string()))?;

        match response.status() {
            reqwest::StatusCode::OK => response
                .json()
                .await
                .map(Some)
                .map_err(|e| WebVmError::Parse(e.to_string())),
            reqwest::StatusCode::NOT_FOUND => Ok(None),
            _ => {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                Err(WebVmError::Service(format!("{}: {}", status, text)))
            }
        }
    }

    /// Send input to a session
    pub async fn send_input(&self, session_id: &str, input: String) -> Result<(), WebVmError> {
        let payload = serde_json::json!({ "input": input });
        let response = self
            .http_client
            .post(format!("{}/api/v1/sessions/{}", self.base_url, session_id))
            .json(&payload)
            .send()
            .await
            .map_err(|e| WebVmError::Http(e.to_string()))?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(WebVmError::Service(format!("{}: {}", status, text)))
        }
    }

    /// Stop/delete a session
    pub async fn stop_session(&self, session_id: &str) -> Result<(), WebVmError> {
        let response = self
            .http_client
            .delete(format!("{}/api/v1/sessions/{}", self.base_url, session_id))
            .send()
            .await
            .map_err(|e| WebVmError::Http(e.to_string()))?;

        if response.status().is_success() {
            Ok(())
        } else {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            Err(WebVmError::Service(format!("{}: {}", status, text)))
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum WebVmError {
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Service error: {0}")]
    Service(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebVmStatus {
    pub status: String,
    pub version: String,
    pub active_sessions: usize,
    pub uptime_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionCreateRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_image: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionCreateResponse {
    pub session_id: String,
    pub url: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_image: Option<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_activity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInputRequest {
    pub input: String,
}

// API Routes

pub fn create_webvm_routes() -> Router<Arc<crate::AppState>> {
    Router::new()
        .route("/api/v1/webvm/health", get(webvm_health))
        .route("/api/v1/webvm/status", get(webvm_status))
        .route(
            "/api/v1/webvm/sessions",
            get(list_sessions).post(create_session),
        )
        .route(
            "/api/v1/webvm/sessions/:session_id",
            get(get_session).post(send_input).delete(stop_session),
        )
}

async fn webvm_health() -> impl IntoResponse {
    let client = WebVmClient::from_env();
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

async fn webvm_status() -> Result<impl IntoResponse, StatusCode> {
    let client = WebVmClient::from_env();
    match client.service_status().await {
        Ok(status) => Ok((StatusCode::OK, Json(status))),
        Err(_) => Err(StatusCode::SERVICE_UNAVAILABLE),
    }
}

async fn list_sessions() -> Result<impl IntoResponse, StatusCode> {
    let client = WebVmClient::from_env();
    match client.list_sessions().await {
        Ok(sessions) => Ok((StatusCode::OK, Json(sessions))),
        Err(_) => Err(StatusCode::SERVICE_UNAVAILABLE),
    }
}

async fn create_session(
    Json(request): Json<SessionCreateRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = WebVmClient::from_env();
    match client.create_session(request.disk_image).await {
        Ok(response) => Ok((StatusCode::CREATED, Json(response))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_session(Path(session_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let client = WebVmClient::from_env();
    match client.get_session(&session_id).await {
        Ok(Some(session)) => Ok((StatusCode::OK, Json(session))),
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn send_input(
    Path(session_id): Path<String>,
    Json(request): Json<SessionInputRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let client = WebVmClient::from_env();
    match client.send_input(&session_id, request.input).await {
        Ok(_) => Ok((StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn stop_session(Path(session_id): Path<String>) -> Result<impl IntoResponse, StatusCode> {
    let client = WebVmClient::from_env();
    match client.stop_session(&session_id).await {
        Ok(_) => Ok((
            StatusCode::OK,
            Json(serde_json::json!({ "status": "stopped" })),
        )),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}
