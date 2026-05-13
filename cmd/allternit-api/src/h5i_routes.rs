//! H5I routes — Human-in-the-Loop Intelligence context tracing

use axum::{
    extract::State,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn h5i_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/h5i/status", get(h5i_status))
        .route("/h5i/init", post(h5i_init))
        .route("/h5i/summarize", post(h5i_summarize))
        .route("/h5i/summary/list", get(h5i_summary_list))
        .route("/h5i/context/start", post(h5i_context_start))
        .route("/h5i/context/finish", post(h5i_context_finish))
        .route("/h5i/context/diff", post(h5i_context_diff))
        .route("/h5i/context/trace", get(h5i_context_trace))
        .route("/h5i/commit", post(h5i_commit))
        .route("/h5i/claims/list", get(h5i_claims_list))
        .route("/h5i/agent-hooks/install", post(h5i_agent_hooks_install))
        .route("/h5i/mcp/config", get(h5i_mcp_config))
        .route("/h5i/vibe", post(h5i_vibe))
}

macro_rules! stub_post {
    ($name:ident) => {
        async fn $name(
            State(_state): State<Arc<AppState>>,
            Json(_body): Json<serde_json::Value>,
        ) -> impl IntoResponse {
            Json(json!({ "status": "ok", "stub": true }))
        }
    };
}

macro_rules! stub_get {
    ($name:ident) => {
        async fn $name(State(_state): State<Arc<AppState>>) -> impl IntoResponse {
            Json(json!({ "status": "ok", "stub": true, "data": [] }))
        }
    };
}

stub_get!(h5i_status);
stub_post!(h5i_init);
stub_post!(h5i_summarize);
stub_get!(h5i_summary_list);
stub_post!(h5i_context_start);
stub_post!(h5i_context_finish);
stub_post!(h5i_context_diff);
stub_get!(h5i_context_trace);
stub_post!(h5i_commit);
stub_get!(h5i_claims_list);
stub_post!(h5i_agent_hooks_install);
stub_get!(h5i_mcp_config);
stub_post!(h5i_vibe);
