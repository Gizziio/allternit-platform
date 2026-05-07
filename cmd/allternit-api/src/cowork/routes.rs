use axum::{
    extract::{Query, State},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::Deserialize;
use std::sync::Arc;

use super::background_service::{BackgroundServiceHandle, BackgroundSettings};

#[derive(Clone)]
pub struct CoworkBgState {
    pub handle: BackgroundServiceHandle,
}

pub fn background_router(state: Arc<CoworkBgState>) -> Router {
    Router::new()
        .route("/cowork/brain/summary", get(get_summary))
        .route("/cowork/brain/runs", get(get_runs))
        .route("/cowork/brain/settings", get(get_settings).put(put_settings))
        .with_state(state)
}

async fn get_summary(State(s): State<Arc<CoworkBgState>>) -> impl axum::response::IntoResponse {
    match s.handle.summary().await {
        Ok(summary) => axum::Json(serde_json::to_value(summary).unwrap_or_default()).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

#[derive(Deserialize)]
struct RunsQuery {
    limit: Option<u32>,
}

async fn get_runs(
    State(s): State<Arc<CoworkBgState>>,
    Query(q): Query<RunsQuery>,
) -> impl axum::response::IntoResponse {
    match s.handle.recent_runs(q.limit.unwrap_or(20)).await {
        Ok(runs) => axum::Json(serde_json::to_value(runs).unwrap_or_default()).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn get_settings(State(s): State<Arc<CoworkBgState>>) -> impl axum::response::IntoResponse {
    match s.handle.get_settings().await {
        Ok(settings) => axum::Json(serde_json::to_value(settings).unwrap_or_default()).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

async fn put_settings(
    State(s): State<Arc<CoworkBgState>>,
    Json(body): Json<BackgroundSettings>,
) -> impl axum::response::IntoResponse {
    match s.handle.update_settings(body).await {
        Ok(()) => axum::Json(serde_json::json!({ "ok": true })).into_response(),
        Err(e) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            axum::Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}
