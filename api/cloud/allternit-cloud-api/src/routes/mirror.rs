//! Mirror API Routes - Remote Control for Allternit Sessions
//!
//! Endpoints for session mirroring and mobile device pairing.
//! Integrates with Cowork Controller for real-time terminal streaming.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post, delete},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use chrono::{Duration, Utc};
use std::sync::Arc;

use crate::ApiState;

// Re-export WebSocket handler
pub use super::mirror_ws::mirror_session_ws;

// ============================================================================
// Types
// ============================================================================

/// Mirror session from database
#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct MirrorSession {
    pub id: String,
    pub run_id: String,
    pub user_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: chrono::DateTime<chrono::Utc>,
    pub status: String,
    pub client_count: i64,
    pub access_token: String,
    pub pairing_code: Option<String>,
}

/// Request to create a mirror session
#[derive(Debug, Deserialize)]
pub struct CreateMirrorRequest {
    pub run_id: String,
    #[serde(default = "default_ttl_minutes")]
    pub ttl_minutes: u32,
}

fn default_ttl_minutes() -> u32 {
    60
}

/// Request to pair mobile device
#[derive(Debug, Deserialize)]
pub struct PairMobileRequest {
    pub pairing_code: String,
}

// ============================================================================
// Route Registration
// ============================================================================

pub fn create_mirror_routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/mirror", post(create_mirror_session))
        .route("/api/v1/mirror", get(list_mirror_sessions))
        .route("/api/v1/mirror/:session_id", get(get_mirror_session))
        .route("/api/v1/mirror/:session_id", delete(delete_mirror_session))
        .route("/api/v1/mirror/pair", post(pair_mobile_device))
        .route("/api/v1/mirror/pair/:code", get(get_pairing_info))
        .route("/api/v1/mirror/:session_id/stream", get(mirror_session_ws))
}

// ============================================================================
// API Handlers
// ============================================================================

/// POST /api/v1/mirror
/// Create a new mirror session for remote control
async fn create_mirror_session(
    State(state): State<Arc<ApiState>>,
    Json(req): Json<CreateMirrorRequest>,
) -> impl IntoResponse {
    let user_id = "anonymous";
    let session_id = Uuid::new_v4().to_string();
    let access_token = Uuid::new_v4().to_string();
    let pairing_code = generate_pairing_code();
    let now = Utc::now();
    let expires_at = now + Duration::minutes(req.ttl_minutes as i64);

    let pairing_url = format!(
        "{}/shell/pair/{}",
        get_base_url(),
        pairing_code
    );

    let result = sqlx::query(
        r#"
        INSERT INTO mirror_sessions (id, run_id, user_id, expires_at, status, access_token, pairing_code)
        VALUES (?, ?, ?, ?, 'active', ?, ?)
        "#,
    )
    .bind(&session_id)
    .bind(&req.run_id)
    .bind(user_id)
    .bind(expires_at)
    .bind(&access_token)
    .bind(&pairing_code)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            tracing::info!("Mirror session created: {} for run: {}", session_id, req.run_id);
            (
                StatusCode::CREATED,
                Json(serde_json::json!({
                    "id": session_id,
                    "run_id": req.run_id,
                    "access_token": access_token,
                    "pairing_code": pairing_code,
                    "pairing_url": pairing_url,
                    "expires_at": expires_at,
                    "qr_code_data": pairing_url,
                })),
            ).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to create mirror session: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to create mirror session"
                })),
            ).into_response()
        }
    }
}

/// GET /api/v1/mirror
/// List all active mirror sessions
async fn list_mirror_sessions(
    State(state): State<Arc<ApiState>>,
) -> impl IntoResponse {
    let user_id = "anonymous";

    let sessions = sqlx::query_as::<_, MirrorSession>(
        r#"
        SELECT id, run_id, user_id, created_at, expires_at, status, client_count, access_token, pairing_code
        FROM mirror_sessions
        WHERE user_id = ? AND status = 'active' AND expires_at > datetime('now')
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await;

    match sessions {
        Ok(sessions) => (StatusCode::OK, Json(sessions)).into_response(),
        Err(e) => {
            tracing::error!("Failed to list mirror sessions: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to list sessions"
                })),
            ).into_response()
        }
    }
}

/// GET /api/v1/mirror/:id
/// Get details of a specific mirror session
async fn get_mirror_session(
    State(state): State<Arc<ApiState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let session = sqlx::query_as::<_, MirrorSession>(
        r#"
        SELECT id, run_id, user_id, created_at, expires_at, status, client_count, access_token, pairing_code
        FROM mirror_sessions
        WHERE id = ?
        "#,
    )
    .bind(&session_id)
    .fetch_optional(&state.db)
    .await;

    match session {
        Ok(Some(s)) => (StatusCode::OK, Json(s)).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Session not found"
            })),
        ).into_response(),
        Err(e) => {
            tracing::error!("Failed to get mirror session: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to get session"
                })),
            ).into_response()
        }
    }
}

/// DELETE /api/v1/mirror/:id
/// End a mirror session
async fn delete_mirror_session(
    State(state): State<Arc<ApiState>>,
    Path(session_id): Path<String>,
) -> impl IntoResponse {
    let result = sqlx::query(
        "UPDATE mirror_sessions SET status = 'ended' WHERE id = ?",
    )
    .bind(&session_id)
    .execute(&state.db)
    .await;

    match result {
        Ok(rows) => {
            if rows.rows_affected() > 0 {
                tracing::info!("Mirror session ended: {}", session_id);
                (
                    StatusCode::OK,
                    Json(serde_json::json!({
                        "success": true,
                        "message": "Session ended"
                    })),
                ).into_response()
            } else {
                (
                    StatusCode::NOT_FOUND,
                    Json(serde_json::json!({
                        "error": "Session not found"
                    })),
                ).into_response()
            }
        }
        Err(e) => {
            tracing::error!("Failed to end mirror session: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to end session"
                })),
            ).into_response()
        }
    }
}

/// POST /api/v1/mirror/pair
/// Pair mobile device with desktop session
async fn pair_mobile_device(
    State(state): State<Arc<ApiState>>,
    Json(req): Json<PairMobileRequest>,
) -> impl IntoResponse {
    let session = sqlx::query_as::<_, MirrorSession>(
        r#"
        SELECT id, run_id, user_id, created_at, expires_at, status, client_count, access_token, pairing_code
        FROM mirror_sessions
        WHERE pairing_code = ? AND status = 'active' AND expires_at > datetime('now')
        "#,
    )
    .bind(&req.pairing_code)
    .fetch_optional(&state.db)
    .await;

    match session {
        Ok(Some(s)) => {
            sqlx::query(
                "UPDATE mirror_sessions SET status = 'paired' WHERE id = ?",
            )
            .bind(&s.id)
            .execute(&state.db)
            .await
            .ok();

            tracing::info!("Mobile device paired with session: {}", s.id);

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "session_id": s.id,
                    "status": "paired",
                    "message": "Successfully paired with desktop session"
                })),
            ).into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Invalid or expired pairing code"
            })),
        ).into_response(),
        Err(e) => {
            tracing::error!("Failed to pair mobile device: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to pair device"
                })),
            ).into_response()
        }
    }
}

/// GET /api/v1/mirror/pair/:code
/// Get pairing info for a specific code
async fn get_pairing_info(
    State(state): State<Arc<ApiState>>,
    Path(code): Path<String>,
) -> impl IntoResponse {
    let session = sqlx::query_as::<_, MirrorSession>(
        r#"
        SELECT id, run_id, user_id, created_at, expires_at, status, client_count, access_token, pairing_code
        FROM mirror_sessions
        WHERE pairing_code = ? AND status IN ('active', 'paired') AND expires_at > datetime('now')
        "#,
    )
    .bind(&code)
    .fetch_optional(&state.db)
    .await;

    match session {
        Ok(Some(s)) => {
            let pairing_url = format!("{}/shell/session/{}", get_base_url(), s.id);

            (
                StatusCode::OK,
                Json(serde_json::json!({
                    "session_id": s.id,
                    "run_id": s.run_id,
                    "status": s.status,
                    "pairing_url": pairing_url,
                    "expires_at": s.expires_at,
                })),
            ).into_response()
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Invalid or expired pairing code"
            })),
        ).into_response(),
        Err(e) => {
            tracing::error!("Failed to get pairing info: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({
                    "error": "Failed to get pairing info"
                })),
            ).into_response()
        }
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

fn generate_pairing_code() -> String {
    let letters: String = (0..3)
        .map(|_| (b'A' + rand::random::<u8>() % 26) as char)
        .collect();
    let numbers: String = (0..3)
        .map(|_| (b'0' + rand::random::<u8>() % 10) as char)
        .collect();
    format!("{}-{}", letters, numbers)
}

fn get_base_url() -> String {
    std::env::var("ALLTERNIT_BASE_URL").unwrap_or_else(|_| "http://localhost:5177".to_string())
}
