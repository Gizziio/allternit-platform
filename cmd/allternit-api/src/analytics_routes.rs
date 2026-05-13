//! Analytics routes

use axum::{
    extract::State,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn analytics_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/analytics/csp-violation", post(analytics_csp_violation))
}

async fn analytics_csp_violation(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "stub": true,
    }))
}
