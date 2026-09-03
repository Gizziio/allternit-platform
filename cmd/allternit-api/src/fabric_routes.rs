//! Clerk-protected mirror for Gizzi Fabric session-worker endpoints.
//!
//! The iOS app (and any other authenticated client) calls
//! `/api/v1/fabric/*` and `/api/v1/session-worker/*` with a Clerk bearer token.
//! This module proxies those requests to the active runtime backend at
//! `/v1/fabric/*` and `/v1/session-worker/*`, translating auth and SSE streams
//! transparently.
//!
//! This is the gateway transport layer for capability-native harness access:
//! clients do not reach the runtime directly; they use the platform gateway and
//! let it forward to the active runtime backend. For local/desktop mode the
//! active backend falls back to the local terminal server URL (`gizzi_base()`).

use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::warn;

use crate::agent_session_routes::{gizzi_base, gizzi_client};
use crate::AppState;

pub fn fabric_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/fabric/peers", get(list_peers))
        .route("/fabric/peers/local", get(get_local_peer))
        .route("/fabric/directory", get(get_directory))
        .route("/fabric/workers/self", get(get_worker_manifest))
        .route("/fabric/leases", post(issue_lease))
        .route("/session-worker/invoke", post(invoke_capability))
        .route(
            "/session-worker/sessions/:id/events",
            get(stream_session_events),
        )
}

/// Resolve the base URL of the runtime backend for this user.
///
/// Reads the active remote backend target from `user_backend_preferences` /
/// `remote_backend_targets`. If a remote backend is selected and has a
/// `backend_url`, that URL is used. Otherwise the local terminal server URL
/// (`gizzi_base()`) is returned.
///
/// NOTE: remote backends currently store their runtime URL in
/// `remote_backend_targets.backend_url`. The local default is the gizzi terminal
/// server, not the gateway itself, to avoid a proxy loop.
async fn resolve_runtime_base(state: &AppState, user_id: &str) -> String {
    let db = state.db.clone();
    let user_id = user_id.to_string();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        let target_id: Option<String> = conn
            .query_row(
                "SELECT active_remote_backend_target_id
                 FROM user_backend_preferences WHERE user_id = ?1",
                params![user_id],
                |row| row.get(0),
            )
            .unwrap_or(None);

        let backend_url: Option<String> = if let Some(id) = target_id {
            conn.query_row(
                "SELECT backend_url FROM remote_backend_targets
                 WHERE user_id = ?1 AND id = ?2 AND status = 'ready'
                 ORDER BY updated_at DESC LIMIT 1",
                params![user_id, id],
                |row| row.get(0),
            )
            .unwrap_or(None)
        } else {
            None
        };

        Ok::<_, rusqlite::Error>(backend_url)
    })
    .await;

    match result {
        Ok(Ok(Some(url))) if !url.is_empty() => url.trim_end_matches('/').to_string(),
        _ => gizzi_base(),
    }
}

fn upstream_url(base: &str, path: &str) -> String {
    format!("{}{}", base, path)
}

fn user_id_from_headers(headers: &HeaderMap) -> String {
    headers
        .get("x-allternit-user-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous")
        .to_string()
}

async fn proxy_json(
    state: &AppState,
    headers: &HeaderMap,
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
    lease_header: Option<&str>,
) -> impl IntoResponse {
    let user_id = user_id_from_headers(headers);
    let base = resolve_runtime_base(state, &user_id).await;
    let client = gizzi_client(headers);
    let mut request = client.request(method, upstream_url(&base, path));
    if let Some(payload) = body {
        request = request.json(&payload);
    }
    if let Some(lease) = lease_header {
        request = request.header("X-Allternit-Lease", lease);
    }

    let upstream = match request.send().await {
        Ok(r) => r,
        Err(error) => {
            warn!("fabric upstream request failed: {}", error);
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
            warn!("fabric upstream body read failed: {}", error);
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

async fn list_peers(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let mut path = "/v1/fabric/peers".to_string();
    if !query.is_empty() {
        let params: Vec<String> = query
            .iter()
            .map(|(k, v)| format!("{}={}", k, v))
            .collect();
        path = format!("{}?{}", path, params.join("&"));
    }
    proxy_json(&state, &headers, reqwest::Method::GET, &path, None, None).await
}

async fn get_local_peer(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let mut path = "/v1/fabric/peers/local".to_string();
    if let Some(format) = query.get("format") {
        path = format!("{}?format={}", path, urlencoding::encode(format));
    }
    proxy_json(&state, &headers, reqwest::Method::GET, &path, None, None).await
}

async fn get_directory(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    proxy_json(
        &state,
        &headers,
        reqwest::Method::GET,
        "/v1/fabric/directory",
        None,
        None,
    )
    .await
}

async fn get_worker_manifest(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> impl IntoResponse {
    proxy_json(
        &state,
        &headers,
        reqwest::Method::GET,
        "/v1/fabric/workers/self",
        None,
        None,
    )
    .await
}

async fn issue_lease(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> impl IntoResponse {
    let config = crate::config::AppConfig::load();
    if let Some(authority_url) = config.allternitos_lease_authority_url() {
        return proxy_to_canonical_lease_authority(&state, &headers, authority_url, body).await;
    }
    warn!("lease authority not configured; returning 503");
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({
            "error": "lease_authority_not_configured",
            "message": "Canonical AllternitOS lease authority is not configured. Set ALLTERNITOS_LEASE_AUTHORITY_URL for production, or use the gizzi runtime dev issuer directly (local dev only)."
        })),
    )
        .into_response()
}

async fn proxy_to_canonical_lease_authority(
    _state: &AppState,
    headers: &HeaderMap,
    authority_url: String,
    body: Value,
) -> Response {
    let client = gizzi_client(headers);
    let url = format!("{}/v1/leases", authority_url.trim_end_matches('/'));
    let upstream = match client.post(url).json(&body).send().await {
        Ok(r) => r,
        Err(error) => {
            warn!("canonical lease authority request failed: {}", error);
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": format!("Lease authority request failed: {}", error) })),
            )
                .into_response();
        }
    };

    let status =
        StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let body = match upstream.text().await {
        Ok(text) => text,
        Err(error) => {
            warn!("canonical lease authority body read failed: {}", error);
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": format!("Lease authority body read failed: {}", error) })),
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

async fn invoke_capability(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> impl IntoResponse {
    // The lease rides in the JSON body as `lease` from some clients, or as the
    // X-Allternit-Lease header from others. Forward whichever is present.
    let lease_from_body = body.get("lease").and_then(|v| v.as_str()).map(String::from);
    let lease_header = headers
        .get("X-Allternit-Lease")
        .and_then(|v| v.to_str().ok())
        .map(String::from)
        .or(lease_from_body);

    // Strip the lease wrapper from the body if it was embedded; the runtime
    // expects `{ capability, inputs }` plus the lease header.
    let upstream_body = if body.get("lease").is_some() {
        let mut clone = body.clone();
        clone.as_object_mut().map(|m| m.remove("lease"));
        clone
    } else {
        body
    };

    proxy_json(
        &state,
        &headers,
        reqwest::Method::POST,
        "/v1/session-worker/invoke",
        Some(upstream_body),
        lease_header.as_deref(),
    )
    .await
}

async fn stream_session_events(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let user_id = user_id_from_headers(&headers);
    let base = resolve_runtime_base(&state, &user_id).await;
    let client = gizzi_client(&headers);
    let url = upstream_url(&base, &format!("/v1/session-worker/sessions/{}/events", id));

    let upstream = match client.get(url).send().await {
        Ok(r) => r,
        Err(error) => {
            warn!("fabric session events upstream request failed: {}", error);
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": format!("Upstream request failed: {}", error) })),
            )
                .into_response();
        }
    };

    let status = StatusCode::from_u16(upstream.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
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
