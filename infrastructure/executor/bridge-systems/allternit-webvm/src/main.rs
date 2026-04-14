use axum::{
    extract::{Path, State},
    response::{Html, IntoResponse, Json},
    routing::{delete, get, post, Router},
};
use serde::Deserialize;
use std::sync::Arc;
use tracing::{info, Level};
use tracing_subscriber;
use tower_http::services::ServeDir;

use crate::session::SessionManager;
use crate::types::{SessionCreateRequest, ServiceStatus};

mod session;
mod types;

#[derive(Clone)]
struct AppState {
    session_manager: Arc<SessionManager>,
}

#[derive(Deserialize)]
struct SessionIdParams {
    session_id: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    let base_url = std::env::var("WEBVM_BASE_URL").unwrap_or_else(|_| "http://localhost:8002".to_string());

    info!("Starting WebVM Service...");
    info!("Base URL: {}", base_url);

    let session_manager = Arc::new(SessionManager::new(base_url.clone()));
    let state = AppState { session_manager };

    let app = Router::new()
        .route("/", get(serve_webvm))
        .route("/health", get(health_check))
        .route("/api/v1/status", get(service_status))
        .route("/api/v1/sessions", post(create_session))
        .route("/api/v1/sessions", get(list_sessions))
        .route("/api/v1/sessions/:session_id", get(get_session))
        .route("/api/v1/sessions/:session_id", post(session_input))
        .route("/api/v1/sessions/:session_id", delete(stop_session))
        .nest_service("/static", ServeDir::new("static"))
        .with_state(state);

    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "8002".to_string());
    let addr = format!("{}:{}", host, port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    info!("WebVM Service listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn serve_webvm() -> impl IntoResponse {
    Html(include_str!("../static/index.html"))
}

async fn health_check() -> impl IntoResponse {
    let json = serde_json::json!({
        "status": "ok",
        "service": "webvm-service"
    });
    Json(json)
}

async fn service_status(State(state): State<AppState>) -> impl IntoResponse {
    let sessions = state.session_manager.list_sessions().await.unwrap_or_default();
    let json = serde_json::json!({
        "status": "running",
        "version": "1.0.0",
        "active_sessions": sessions.len(),
        "uptime_seconds": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
    });
    Json(json)
}

async fn create_session(
    State(state): State<AppState>,
    Json(req): Json<SessionCreateRequest>,
) -> impl IntoResponse {
    match state.session_manager.create_session(req.disk_image).await {
        Ok(response) => Json(response).into_response(),
        Err(e) => {
            tracing::error!("Failed to create session: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

async fn list_sessions(State(state): State<AppState>) -> impl IntoResponse {
    match state.session_manager.list_sessions().await {
        Ok(sessions) => Json(sessions).into_response(),
        Err(e) => {
            tracing::error!("Failed to list sessions: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

async fn get_session(
    Path(params): Path<SessionIdParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.session_manager.get_session(&params.session_id).await {
        Ok(Some(session)) => Json(session).into_response(),
        Ok(None) => axum::http::StatusCode::NOT_FOUND.into_response(),
        Err(e) => {
            tracing::error!("Failed to get session: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

async fn session_input(
    Path(params): Path<SessionIdParams>,
    State(state): State<AppState>,
    Json(input): Json<serde_json::Value>,
) -> impl IntoResponse {
    if let Some(text) = input["input"].as_str() {
        state.session_manager.add_terminal_output(&params.session_id, text.to_string()).await;
        Json(serde_json::json!({ "status": "ok" })).into_response()
    } else {
        axum::http::StatusCode::BAD_REQUEST.into_response()
    }
}

async fn stop_session(
    Path(params): Path<SessionIdParams>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    match state.session_manager.stop_session(&params.session_id).await {
        Ok(()) => Json(serde_json::json!({ "status": "stopped" })).into_response(),
        Err(e) => {
            tracing::error!("Failed to stop session: {}", e);
            axum::http::StatusCode::NOT_FOUND.into_response()
        }
    }
}
