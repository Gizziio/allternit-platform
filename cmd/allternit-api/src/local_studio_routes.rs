//! Local Studio controller proxy routes.
//!
//! Proxies `/api/local-studio/*` to a Local Studio controller running at
//! `LOCAL_STUDIO_URL` (default `http://127.0.0.1:8080`).

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use bytes::Bytes;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::auth::get_user;
use crate::AppState;

fn local_studio_url() -> String {
    std::env::var("LOCAL_STUDIO_URL")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "http://127.0.0.1:8080".to_string())
        .trim_end_matches('/')
        .to_string()
}

fn unauthorized() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": "Unauthorized" })),
    )
        .into_response()
}

pub fn local_studio_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/local-studio/health", get(proxy_health))
        .route("/local-studio/status", get(proxy_status))
        .route("/local-studio/gpus", get(proxy_gpus))
        .route("/local-studio/v1/models", get(proxy_models))
        .route("/local-studio/v1/models/:id", get(proxy_model_detail))
        .route("/local-studio/usage", get(proxy_usage))
        .route("/local-studio/logs", get(proxy_logs))
}

// ─── GET proxies ──────────────────────────────────────────────────────────────

async fn proxy_health(headers: HeaderMap) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    proxy_get("/health").await
}

async fn proxy_status(headers: HeaderMap) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    proxy_get("/status").await
}

async fn proxy_gpus(headers: HeaderMap) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    proxy_get("/gpus").await
}

async fn proxy_models(headers: HeaderMap) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    proxy_get("/v1/models").await
}

async fn proxy_model_detail(Path(id): Path<String>, headers: HeaderMap) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    proxy_get(&format!("/v1/models/{}", id)).await
}

#[derive(Deserialize)]
struct UsageQuery {
    window: Option<String>,
}

async fn proxy_usage(Query(query): Query<UsageQuery>, headers: HeaderMap) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    let path = match query.window {
        Some(window) => format!("/api/usage?window={}", urlencoding::encode(&window)),
        None => "/api/usage".to_string(),
    };
    proxy_get(&path).await
}

#[derive(Deserialize)]
struct LogsQuery {
    limit: Option<u32>,
    level: Option<String>,
}

async fn proxy_logs(Query(query): Query<LogsQuery>, headers: HeaderMap) -> Response {
    if get_user(&headers).is_none() {
        return unauthorized();
    }
    let mut params = vec![];
    if let Some(limit) = query.limit {
        params.push(("limit", limit.to_string()));
    }
    if let Some(level) = query.level {
        params.push(("level", level));
    }
    let path = if params.is_empty() {
        "/api/logs".to_string()
    } else {
        format!(
            "/api/logs?{}",
            params
                .iter()
                .map(|(k, v)| format!("{}={}", k, urlencoding::encode(v)))
                .collect::<Vec<_>>()
                .join("&")
        )
    };
    proxy_get(&path).await
}

// ─── Generic proxy helpers ────────────────────────────────────────────────────

async fn proxy_get(path: &str) -> Response {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap_or_default();

    let url = format!("{}{}", local_studio_url(), path);
    match client.get(&url).send().await {
        Ok(res) => forward_response(res).await,
        Err(err) => {
            warn!(error = %err, url = %url, "Local Studio proxy GET failed");
            studio_unavailable(err)
        }
    }
}

async fn forward_response(res: reqwest::Response) -> Response {
    let status = StatusCode::from_u16(res.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let headers = res.headers().clone();
    let body = match res.bytes().await {
        Ok(bytes) => bytes,
        Err(err) => {
            warn!(error = %err, "Failed to read Local Studio response body");
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "failed to read upstream response" })),
            )
                .into_response();
        }
    };

    let mut builder = Response::builder().status(status);
    for (name, value) in headers.iter() {
        if is_hop_by_hop_header(name.as_str()) {
            continue;
        }
        builder = builder.header(name.as_str(), value.as_bytes());
    }

    builder
        .body(Body::from(body))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

fn studio_unavailable(err: reqwest::Error) -> Response {
    (
        StatusCode::BAD_GATEWAY,
        Json(json!({
            "error": "local_studio_unavailable",
            "message": err.to_string(),
            "note": "Ensure the Local Studio controller is running."
        })),
    )
        .into_response()
}

fn is_hop_by_hop_header(name: &str) -> bool {
    let name = name.to_ascii_lowercase();
    matches!(
        name.as_str(),
        "connection"
            | "keep-alive"
            | "proxy-authenticate"
            | "proxy-authorization"
            | "te"
            | "trailers"
            | "transfer-encoding"
            | "upgrade"
    )
}
