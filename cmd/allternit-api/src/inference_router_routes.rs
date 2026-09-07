//! Inference router API routes — local CLI provider discovery and execution.
//!
//! This surface exposes which local provider CLIs are available so the chat
//! model picker can render an OMB-style "Pick a Brain" rail. Execution still
//! flows through the existing agent-chat bridge / Gizzi runtime; the router
//! itself is discovery-first.

use axum::{
    extract::{Extension, State},
    http::HeaderMap,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::cli_provider_detector::detect_cli_providers;
use crate::AppState;

pub fn inference_router_router() -> Router<Arc<AppState>> {
    Router::new().route("/inference-router/cli-status", get(cli_status))
}

/// GET /api/v1/inference-router/cli-status
///
/// Returns the installed/available state of local CLI providers and their
/// advertised models. Best-effort: a probe failure is reported as
/// `available: false` rather than an HTTP error.
async fn cli_status(
    _state: State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {
    let providers = detect_cli_providers().await;
    Json(json!({ "providers": providers }))
}

// NOTE: A future `POST /inference-router/execute` would accept a provider + model
// selection plus a message and proxy to the existing `/api/agent-chat` bridge so
// turns continue to flow through Gizzi and the Rails ledger. It is intentionally
// omitted from this slice to keep the deliverable focused on discovery.
