//! Stateless gateway for Gizzi's canonical vendor-neutral orchestrator.
//!
//! Live executor sessions belong to the Gizzi Node process. This router only
//! preserves the HTTP method, suffix, query, status, and JSON body so the
//! platform API never becomes a second source of orchestration state.

use axum::{
    body::Bytes,
    extract::{OriginalUri, State},
    http::{header, HeaderMap, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::any,
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;

pub fn orchestrator_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/orchestrator", any(proxy_orchestrator))
        .route("/orchestrator/*path", any(proxy_orchestrator))
}

async fn proxy_orchestrator(
    State(state): State<Arc<AppState>>,
    OriginalUri(uri): OriginalUri,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let incoming_path = uri.path();
    let suffix = match incoming_path.find("/orchestrator") {
        Some(index) => &incoming_path[index + "/orchestrator".len()..],
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid orchestrator proxy path" })),
            )
                .into_response();
        }
    };
    let query = uri
        .query()
        .map(|value| format!("?{value}"))
        .unwrap_or_default();
    let target = format!(
        "{}/v1/orchestrator{}{}",
        state.config.terminal_server_url().trim_end_matches('/'),
        suffix,
        query,
    );

    let client = reqwest::Client::new();
    let mut request = client.request(method, &target);
    if let Some(content_type) = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
    {
        request = request.header(reqwest::header::CONTENT_TYPE, content_type);
    }
    if let Ok(password) = std::env::var("GIZZI_SERVER_PASSWORD") {
        if !password.is_empty() {
            let username =
                std::env::var("GIZZI_SERVER_USERNAME").unwrap_or_else(|_| "gizzi".to_string());
            request = request.basic_auth(username, Some(password));
        }
    }
    if !body.is_empty() {
        request = request.body(body.to_vec());
    }

    let upstream = match request.send().await {
        Ok(response) => response,
        Err(error) => {
            warn!(target = %target, error = %error, "Gizzi orchestrator proxy failed");
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": "orchestrator_unavailable",
                    "message": format!("Cannot reach the canonical Gizzi orchestrator: {error}"),
                })),
            )
                .into_response();
        }
    };

    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let content_type = upstream
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .cloned();
    let is_event_stream = content_type
        .as_ref()
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("text/event-stream"));
    if is_event_stream {
        let mut response = Response::new(axum::body::Body::from_stream(upstream.bytes_stream()));
        *response.status_mut() = status;
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            axum::http::HeaderValue::from_static("text/event-stream"),
        );
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            axum::http::HeaderValue::from_static("no-cache"),
        );
        return response;
    }
    let bytes = match upstream.bytes().await {
        Ok(bytes) => bytes,
        Err(error) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "invalid_orchestrator_response", "message": error.to_string() })),
            )
                .into_response();
        }
    };

    let mut response = (status, bytes).into_response();
    if let Some(value) =
        content_type.and_then(|value| value.to_str().ok().and_then(|text| text.parse().ok()))
    {
        response.headers_mut().insert(header::CONTENT_TYPE, value);
    }
    response
}
