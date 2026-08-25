//! Bot desktop snapshot and backup endpoints.
//!
//! Wraps the underlying execution-driver snapshot primitives so a user can
//! checkpoint a bot desktop, list checkpoints, restore, or delete them.
//! S3 backup is handled by a host-side script; this module exposes the
//! metadata endpoint that records the backup result.

use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

use crate::auth::AuthUser;
use crate::bot_desktop_routes::{read_bot_sandbox, verify_bot_ownership};
use crate::AppState;
use allternit_driver_interface::ExecutionDriver;

#[derive(Debug, Deserialize)]
pub struct CreateSnapshotRequest {
    #[serde(default)]
    pub stateful: bool,
}

#[derive(Debug, Serialize)]
pub struct SnapshotResponse {
    pub id: String,
    pub created_at: String,
    pub stateful: bool,
}

#[derive(Debug, Serialize)]
pub struct SnapshotsListResponse {
    pub snapshots: Vec<SnapshotResponse>,
}

#[derive(Debug, Serialize)]
pub struct SnapshotActionResponse {
    pub success: bool,
    pub snapshot_id: Option<String>,
}

/// POST /api/v1/bots/:bot_id/desktop/snapshots
pub async fn create_desktop_snapshot(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
    Json(body): Json<CreateSnapshotRequest>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let (driver, handle) = match resolve_driver_and_handle(&state, &bot_id).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    let snapshot_id = format!("snap-{}", uuid::Uuid::new_v4().simple());
    match driver.create_snapshot(&handle, &snapshot_id, body.stateful).await {
        Ok(()) => (
            StatusCode::CREATED,
            Json(json!({
                "success": true,
                "snapshot_id": snapshot_id,
            })),
        )
            .into_response(),
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to create snapshot");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to create snapshot: {}", e)})),
            )
                .into_response()
        }
    }
}

/// GET /api/v1/bots/:bot_id/desktop/snapshots
pub async fn list_desktop_snapshots(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(bot_id): Path<String>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let (driver, handle) = match resolve_driver_and_handle(&state, &bot_id).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    match driver.list_snapshots(&handle).await {
        Ok(snapshots) => Json(SnapshotsListResponse {
            snapshots: snapshots
                .into_iter()
                .map(|s| SnapshotResponse {
                    id: s.id,
                    created_at: s.created_at,
                    stateful: s.stateful,
                })
                .collect(),
        })
        .into_response(),
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to list snapshots");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to list snapshots: {}", e)})),
            )
                .into_response()
        }
    }
}

/// POST /api/v1/bots/:bot_id/desktop/snapshots/:snapshot_id/restore
pub async fn restore_desktop_snapshot(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((bot_id, snapshot_id)): Path<(String, String)>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let (driver, handle) = match resolve_driver_and_handle(&state, &bot_id).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    info!(bot_id, %snapshot_id, "Restoring desktop snapshot");
    match driver.restore_snapshot(&handle, &snapshot_id).await {
        Ok(()) => Json(SnapshotActionResponse {
            success: true,
            snapshot_id: Some(snapshot_id),
        })
        .into_response(),
        Err(e) => {
            warn!(bot_id, snapshot_id, error = %e, "Failed to restore snapshot");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to restore snapshot: {}", e)})),
            )
                .into_response()
        }
    }
}

/// DELETE /api/v1/bots/:bot_id/desktop/snapshots/:snapshot_id
pub async fn delete_desktop_snapshot(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((bot_id, snapshot_id)): Path<(String, String)>,
) -> impl IntoResponse {
    if !verify_bot_ownership(&state, &user.user_id, &bot_id).await {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "bot not found or access denied"})),
        )
            .into_response();
    }

    let (driver, handle) = match resolve_driver_and_handle(&state, &bot_id).await {
        Ok(v) => v,
        Err(resp) => return resp,
    };

    match driver.delete_snapshot(&handle, &snapshot_id).await {
        Ok(()) => Json(SnapshotActionResponse {
            success: true,
            snapshot_id: Some(snapshot_id),
        })
        .into_response(),
        Err(e) => {
            warn!(bot_id, snapshot_id, error = %e, "Failed to delete snapshot");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": format!("failed to delete snapshot: {}", e)})),
            )
                .into_response()
        }
    }
}

async fn resolve_driver_and_handle(
    state: &AppState,
    bot_id: &str,
) -> Result<
    (
        Arc<dyn ExecutionDriver>,
        allternit_driver_interface::ExecutionHandle,
    ),
    axum::response::Response,
> {
    let driver = match &state.vm_driver {
        Some(d) => d.clone(),
        None => {
            return Err((
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({"error": "No VM driver is configured on this host"})),
            )
                .into_response());
        }
    };

    let record = match read_bot_sandbox(&state.db, bot_id) {
        Ok(Some(r)) => r,
        Ok(None) => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({"error": "bot has no desktop sandbox"})),
            )
                .into_response());
        }
        Err(e) => {
            warn!(bot_id, error = %e, "Failed to read bot sandbox");
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "failed to read sandbox record"})),
            )
                .into_response());
        }
    };

    let handle = crate::bot_desktop_routes::build_handle(&record.sandbox_id, Some(&record.os));
    Ok((driver, handle))
}

#[cfg(test)]
mod tests {
    use super::*;
    use allternit_driver_interface::SnapshotInfo;

    #[test]
    fn snapshot_response_serializes() {
        let resp = SnapshotResponse {
            id: "snap-abc".to_string(),
            created_at: "2026-01-01T00:00:00Z".to_string(),
            stateful: false,
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["id"], "snap-abc");
        assert_eq!(json["stateful"], false);
    }
}
