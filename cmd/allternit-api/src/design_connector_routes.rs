//! Design / Composio connector routes

use axum::{
    extract::State,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn design_connector_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/design/composio/connections", get(list_composio_connections))
        .route("/design/composio/connect", post(connect_composio))
        .route("/design/connectors/slack", post(slack_connector))
        .route("/design/connectors/notion", post(notion_connector))
        .route("/design/connectors/linear", post(linear_connector))
        .route("/design/connectors/github", post(github_connector))
}

async fn list_composio_connections(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
    Json(json!({
        "connections": [],
        "total": 0,
        "stub": true,
    }))
}

async fn connect_composio(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "connected",
        "stub": true,
    }))
}

async fn slack_connector(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}

async fn notion_connector(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}

async fn linear_connector(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}

async fn github_connector(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}
