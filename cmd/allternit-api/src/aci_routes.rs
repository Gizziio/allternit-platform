//! ACI (Agent-Computer Interface) routes

use axum::{
    extract::State,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn aci_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/aci/run", post(aci_run))
}

async fn aci_run(
    State(_state): State<Arc<AppState>>,
    Json(_body): Json<serde_json::Value>,
) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "result": null,
        "stub": true,
    }))
}
