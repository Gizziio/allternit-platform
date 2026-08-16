//! OpenAI-compatible chat completions proxy.
//!
//! Routes `/v1/chat/completions` to a healthy local runtime serving the
//! requested model.

use crate::runtime::backends::llamacpp::chat_completions_url;
use crate::AppState;
use axum::{
    body::Body,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use bytes::Bytes;
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

/// Minimal extraction of the model field so we can route to the right runtime.
#[derive(Debug, Deserialize)]
struct ChatCompletionRequest {
    model: String,
}

/// Create the OpenAI-compatible chat router.
pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/v1/chat/completions", post(proxy_chat_completions))
        .with_state(state)
}

async fn proxy_chat_completions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
    let model_id = match serde_json::from_slice::<ChatCompletionRequest>(&body) {
        Ok(req) => req.model,
        Err(err) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": format!("invalid request body: {}", err) })),
            )
                .into_response();
        }
    };

    let runtime = match state.manager.find_running_runtime_by_model_id(&model_id).await {
        Some(rt) => rt,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({
                    "error": "no_running_runtime",
                    "message": format!("No healthy runtime is serving model '{}'", model_id)
                })),
            )
                .into_response();
        }
    };

    let url = chat_completions_url(runtime.port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .unwrap_or_default();

    // Forward relevant headers.
    let mut upstream_req = client.post(&url).body(body);
    for name in ["content-type", "accept", "authorization"] {
        if let Some(value) = headers.get(name) {
            upstream_req = upstream_req.header(name, value);
        }
    }

    match upstream_req.send().await {
        Ok(res) => forward_response(res).await,
        Err(err) => {
            warn!(error = %err, %url, "chat completions proxy failed");
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": "runtime_unavailable",
                    "message": err.to_string()
                })),
            )
                .into_response()
        }
    }
}

async fn forward_response(res: reqwest::Response) -> Response {
    let status = StatusCode::from_u16(res.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let headers = res.headers().clone();
    let body_bytes = match res.bytes().await {
        Ok(bytes) => bytes,
        Err(err) => {
            warn!(error = %err, "failed to read runtime response body");
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": "failed to read runtime response" })),
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
        .body(Body::from(body_bytes))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
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
