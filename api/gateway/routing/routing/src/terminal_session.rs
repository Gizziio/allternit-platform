#![allow(dead_code, unused_variables, unused_imports)]
//! Terminal Session Management Module
//!
//! This module provides terminal session management functionality for the A2rchitech API,
//! including session creation, listing, retrieval, and deletion. It integrates with the
//! policy engine for authorization checks and with the messaging system for secure
//! terminal operations.

use allternit_control_plane_service::ControlPlaneService;
use allternit_messaging::MessagingSystem;
use allternit_policy::{PolicyDecision, PolicyEffect, PolicyEngine, PolicyRequest, SafetyTier};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    pub status: SessionStatus,
    pub created_at: u64,
    pub last_activity: u64,
    pub tenant_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthMethod {
    Password {
        password: String,
    },
    PublicKey {
        private_key_path: String,
        passphrase: Option<String>,
    },
    KeyPair {
        private_key: String,
        passphrase: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTerminalSessionRequest {
    pub name: String,
    pub description: Option<String>,
    pub host: String,
    pub port: Option<u16>,
    pub username: String,
    pub auth_method: AuthMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSessionResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    pub status: SessionStatus,
    pub created_at: u64,
    pub last_activity: u64,
    pub tenant_id: String,
}

pub struct TerminalSessionManager {
    sessions: Arc<RwLock<std::collections::HashMap<String, TerminalSession>>>,
    policy_engine: Arc<PolicyEngine>,
    messaging_system: Arc<MessagingSystem>,
}

impl TerminalSessionManager {
    pub fn new(policy_engine: Arc<PolicyEngine>, messaging_system: Arc<MessagingSystem>) -> Self {
        Self {
            sessions: Arc::new(RwLock::new(std::collections::HashMap::new())),
            policy_engine,
            messaging_system,
        }
    }

    pub async fn create_session(
        &self,
        session: TerminalSession,
    ) -> Result<String, TerminalSessionError> {
        let session_id = session.id.clone();

        // Store in memory
        let mut sessions = self.sessions.write().await;
        sessions.insert(session_id.clone(), session);

        Ok(session_id)
    }

    pub async fn get_session(&self, session_id: &str) -> Option<TerminalSession> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).cloned()
    }

    pub async fn list_sessions(&self) -> Vec<String> {
        let sessions = self.sessions.read().await;
        sessions.keys().cloned().collect()
    }

    pub async fn delete_session(&self, session_id: &str) -> Result<(), TerminalSessionError> {
        let mut sessions = self.sessions.write().await;
        sessions.remove(session_id);
        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum TerminalSessionError {
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    #[error("Session already exists: {0}")]
    SessionAlreadyExists(String),
    #[error("Invalid session configuration: {0}")]
    InvalidSessionConfig(String),
    #[error("Policy check failed: {0}")]
    PolicyCheckFailed(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
}

/// List all terminal sessions
#[utoipa::path(
    get,
    path = "/api/v1/terminal/sessions",
    responses(
        (status = 200, description = "List of terminal sessions", body = Vec<TerminalSessionResponse>),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to list sessions", body = serde_json::Value)
    )
)]
pub async fn list_terminal_sessions(
    State(state): State<Arc<crate::AppState>>,
) -> Result<Json<Vec<TerminalSessionResponse>>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/terminal/sessions".to_string(),
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

    let session_ids = state.terminal_session_manager.list_sessions().await;
    let mut sessions = Vec::new();

    for session_id in session_ids {
        if let Some(session) = state
            .terminal_session_manager
            .get_session(&session_id)
            .await
        {
            sessions.push(TerminalSessionResponse {
                id: session.id,
                name: session.name,
                description: session.description,
                host: session.host,
                port: session.port,
                username: session.username,
                auth_method: session.auth_method,
                status: session.status,
                created_at: session.created_at,
                last_activity: session.last_activity,
                tenant_id: session.tenant_id,
            });
        }
    }

    Ok(Json(sessions))
}

/// Create a new terminal session
#[utoipa::path(
    post,
    path = "/api/v1/terminal/sessions",
    request_body = CreateTerminalSessionRequest,
    responses(
        (status = 201, description = "Terminal session created successfully", body = TerminalSessionResponse),
        (status = 400, description = "Invalid session configuration", body = serde_json::Value),
        (status = 403, description = "Creation denied by policy", body = serde_json::Value),
        (status = 500, description = "Failed to create session", body = serde_json::Value)
    )
)]
pub async fn create_terminal_session(
    State(state): State<Arc<crate::AppState>>,
    Json(request): Json<CreateTerminalSessionRequest>,
) -> Result<Json<TerminalSessionResponse>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: "/api/terminal/sessions".to_string(),
        action: "create".to_string(),
        context: serde_json::json!({
            "session_config": &request
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

    // Validate the request
    if request.host.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    if request.username.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    // Sanitize inputs to prevent injection attacks
    if request
        .host
        .contains([';', '&', '|', '`', '$', '(', ')', '<', '>', '|'])
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    if request
        .username
        .contains([';', '&', '|', '`', '$', '(', ')', '<', '>', '|'])
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    let session = TerminalSession {
        id: Uuid::new_v4().to_string(),
        name: request.name,
        description: request.description,
        host: request.host,
        port: request.port.unwrap_or(22), // Default SSH port
        username: request.username,
        auth_method: request.auth_method,
        status: SessionStatus::Disconnected, // Initially disconnected
        created_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        last_activity: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        tenant_id: state.policy_tenant_id.clone(), // Use the authenticated tenant ID
    };

    state
        .terminal_session_manager
        .create_session(session.clone())
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = TerminalSessionResponse {
        id: session.id,
        name: session.name,
        description: session.description,
        host: session.host,
        port: session.port,
        username: session.username,
        auth_method: session.auth_method,
        status: session.status,
        created_at: session.created_at,
        last_activity: session.last_activity,
        tenant_id: session.tenant_id,
    };

    Ok(Json(response))
}

/// Get a specific terminal session by ID
#[utoipa::path(
    get,
    path = "/api/v1/terminal/sessions/{id}",
    params(
        ("id" = String, Path, description = "Terminal session ID")
    ),
    responses(
        (status = 200, description = "Terminal session retrieved successfully", body = TerminalSessionResponse),
        (status = 403, description = "Access denied by policy", body = serde_json::Value),
        (status = 404, description = "Session not found", body = serde_json::Value),
        (status = 500, description = "Failed to retrieve session", body = serde_json::Value)
    )
)]
pub async fn get_terminal_session(
    State(state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<TerminalSessionResponse>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/terminal/sessions/{}", session_id),
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

    let session_option = state
        .terminal_session_manager
        .get_session(&session_id)
        .await;
    let session = session_option.ok_or_else(|| StatusCode::NOT_FOUND)?;

    let response = TerminalSessionResponse {
        id: session.id,
        name: session.name,
        description: session.description,
        host: session.host,
        port: session.port,
        username: session.username,
        auth_method: session.auth_method,
        status: session.status,
        created_at: session.created_at,
        last_activity: session.last_activity,
        tenant_id: session.tenant_id,
    };

    Ok(Json(response))
}

/// Delete a terminal session
#[utoipa::path(
    delete,
    path = "/api/v1/terminal/sessions/{id}",
    params(
        ("id" = String, Path, description = "Terminal session ID")
    ),
    responses(
        (status = 200, description = "Terminal session deleted successfully"),
        (status = 403, description = "Deletion denied by policy", body = serde_json::Value),
        (status = 404, description = "Session not found", body = serde_json::Value),
        (status = 500, description = "Failed to delete session", body = serde_json::Value)
    )
)]
pub async fn delete_terminal_session(
    State(state): State<Arc<crate::AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Apply policy check
    let policy_request = PolicyRequest {
        identity_id: state.policy_identity_id.clone(),
        resource: format!("/api/terminal/sessions/{}", session_id),
        action: "delete".to_string(),
        context: serde_json::json!({}),
        requested_tier: SafetyTier::T3,
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

    state
        .terminal_session_manager
        .delete_session(&session_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(serde_json::json!({
        "message": "Terminal session deleted successfully",
        "session_id": session_id
    })))
}

/// Sanitize terminal commands to prevent injection attacks
pub fn sanitize_command(command: &str) -> String {
    // Remove potentially dangerous characters/sequences
    let sanitized = command
        .replace('\0', "") // Null bytes
        .replace('\r', "") // Carriage returns (unless part of CRLF)
        .replace('\x1B', "") // Escape sequences
        .replace('\x00', "") // Additional null byte variants
        .replace("%00", "") // URL encoded null
        .replace("%0d", "") // URL encoded carriage return
        .replace("%0a", "") // URL encoded line feed
        .replace("..", "") // Prevent path traversal
        .replace("/", "") // Prevent absolute path access
        .replace("~", ""); // Prevent home directory access

    // Only allow alphanumeric characters and safe symbols
    sanitized
        .chars()
        .filter(|c| {
            c.is_alphanumeric() || c.is_whitespace() || "()[]{}.,!?@#$%^&*-_=+|;:,.<>".contains(*c)
        })
        .collect()
}

/// Validate that a command is safe to execute
pub fn is_safe_command(command: &str) -> bool {
    // Check for potentially dangerous patterns
    let dangerous_patterns = [
        "rm -rf",
        "mv ",
        "dd ",
        "mkfs ",
        "> /dev/",
        ">> /dev/",
        "&",
        "&&",
        "|",
        "||",
        ";",
        "$(",
        "`",
        "eval",
        "exec",
        "sh -c",
        "bash -c",
        "chmod",
        "chown",
        "sudo",
        "su",
        "mount",
        "umount",
        "reboot",
        "shutdown",
        "poweroff",
        "halt",
        "kill",
        "killall",
        "pkill",
        "/etc/",
        "/usr/bin/",
        "/usr/sbin/",
        "/sbin/",
        "/root/",
        "/proc/",
        "/sys/",
        "/dev/",
    ];

    let lower_command = command.to_lowercase();
    for pattern in &dangerous_patterns {
        if lower_command.contains(pattern) {
            return false;
        }
    }

    true
}
