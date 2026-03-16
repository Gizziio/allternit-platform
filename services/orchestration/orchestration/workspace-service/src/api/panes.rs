//! Pane API routes

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
};
use serde::Deserialize;

use crate::state::AppState;
use crate::tmux::TmuxClient;
use crate::types::{ErrorResponse, Pane, PaneConfig};

/// List panes in a session
pub async fn list_panes(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
) -> Result<Json<Vec<Pane>>, (StatusCode, Json<ErrorResponse>)> {
    let client = TmuxClient::new();

    match client.list_panes(&session_id).await {
        Ok(panes) => {
            // Update state
            for pane in &panes {
                state.register_pane(pane.clone()).await;
            }
            Ok(Json(panes))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(e))),
    }
}

/// Get a specific pane
pub async fn get_pane(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Pane>, (StatusCode, Json<ErrorResponse>)> {
    // Check state first
    if let Some(pane) = state.get_pane(&id).await {
        return Ok(Json(pane));
    }

    // Fallback to searching
    let client = TmuxClient::new();
    match client.get_pane(&id).await {
        Ok(Some(pane)) => {
            state.register_pane(pane.clone()).await;
            Ok(Json(pane))
        }
        Ok(None) => Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse::new("PANE_NOT_FOUND", "Pane not found")),
        )),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(e))),
    }
}

/// Create a new pane in a session
pub async fn create_pane(
    State(state): State<AppState>,
    Path(session_id): Path<String>,
    Json(config): Json<PaneConfig>,
) -> Result<Json<Pane>, (StatusCode, Json<ErrorResponse>)> {
    let client = TmuxClient::new();

    match client.create_pane(&session_id, &config).await {
        Ok(pane) => {
            state.register_pane(pane.clone()).await;
            Ok(Json(pane))
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(e))),
    }
}

/// Delete a pane
pub async fn delete_pane(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    let client = TmuxClient::new();

    match client.kill_pane(&id).await {
        Ok(_) => {
            state.remove_pane(&id).await;
            Ok(StatusCode::NO_CONTENT)
        }
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(e))),
    }
}

/// Capture pane output
pub async fn capture_pane(
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    let client = TmuxClient::new();

    match client.capture_pane(&id, Some(100)).await {
        Ok(output) => Ok(Json(serde_json::json!({
            "pane_id": id,
            "output": output,
        }))),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(e))),
    }
}

/// Send keys to a pane
#[derive(Deserialize)]
pub struct SendKeysRequest {
    keys: String,
}

pub async fn send_keys(
    Path(id): Path<String>,
    Json(req): Json<SendKeysRequest>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    match crate::tmux::send_keys(&id, &req.keys).await {
        Ok(_) => Ok(StatusCode::NO_CONTENT),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, Json(e))),
    }
}
