//! Clerk-protected mirror for Gizzi remote-control session endpoints.
//!
//! The frontend/PWA calls `/api/v1/remote-control/*` with a Clerk bearer token.
//! This module proxies those requests to the local paired Gizzi runtime at
//! `/v1/remote-control/*`, translating auth and SSE streams transparently.

use axum::{
    body::Body,
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::warn;

use crate::agent_session_routes::{gizzi_base, gizzi_client};
use crate::AppState;

pub fn remote_control_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/remote-control/sessions", get(list_sessions))
        .route("/remote-control/sessions/:id", get(get_session))
        .route(
            "/remote-control/sessions/:id/messages",
            post(send_message),
        )
        .route("/remote-control/sessions/:id/abort", post(abort_session))
        .route("/remote-control/sessions/:id/events", get(stream_events))
}

fn upstream_url(path: &str) -> String {
    format!("{}{}", gizzi_base(), path)
}

async fn proxy_json(
    headers: &HeaderMap,
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
) -> impl IntoResponse {
    let client = gizzi_client(headers);
    let mut request = client.request(method, upstream_url(path));
    if let Some(payload) = body {
        request = request.json(&payload);
    }

    let upstream = match request.send().await {
        Ok(r) => r,
        Err(error) => {
            warn!("remote-control upstream request failed: {}", error);
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": format!("Upstream request failed: {}", error) })),
            )
                .into_response();
        }
    };

    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let body = match upstream.text().await {
        Ok(text) => text,
        Err(error) => {
            warn!("remote-control upstream body read failed: {}", error);
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": format!("Upstream body read failed: {}", error) })),
            )
                .into_response();
        }
    };

    let mut response = Response::new(Body::from(body));
    *response.status_mut() = status;
    response.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    response
}

async fn list_sessions(headers: HeaderMap) -> impl IntoResponse {
    proxy_json(&headers, reqwest::Method::GET, "/v1/remote-control/sessions", None).await
}

async fn get_session(headers: HeaderMap, Path(id): Path<String>) -> impl IntoResponse {
    proxy_json(
        &headers,
        reqwest::Method::GET,
        &format!("/v1/remote-control/sessions/{}", id),
        None,
    )
    .await
}

async fn send_message(
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(body): Json<Value>,
) -> impl IntoResponse {
    proxy_json(
        &headers,
        reqwest::Method::POST,
        &format!("/v1/remote-control/sessions/{}/messages", id),
        Some(body),
    )
    .await
}

async fn abort_session(headers: HeaderMap, Path(id): Path<String>) -> impl IntoResponse {
    proxy_json(
        &headers,
        reqwest::Method::POST,
        &format!("/v1/remote-control/sessions/{}/abort", id),
        None,
    )
    .await
}

async fn stream_events(headers: HeaderMap, Path(id): Path<String>) -> impl IntoResponse {
    let client = gizzi_client(&headers);
    let url = upstream_url(&format!("/v1/remote-control/sessions/{}/events", id));

    let upstream = match client.get(url).send().await {
        Ok(r) => r,
        Err(error) => {
            warn!("remote-control events upstream request failed: {}", error);
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": format!("Upstream request failed: {}", error) })),
            )
                .into_response();
        }
    };

    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let stream = upstream.bytes_stream();
    let body = Body::from_stream(stream);

    let mut response = Response::new(body);
    *response.status_mut() = status;
    response.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("text/event-stream"),
    );
    response.headers_mut().insert(
        axum::http::header::CACHE_CONTROL,
        HeaderValue::from_static("no-cache"),
    );
    response
}
