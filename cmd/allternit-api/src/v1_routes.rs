use axum::{
    body::Body,
    extract::Request,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{any, get, post},
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;
use tracing::{info, warn};

use crate::AppState;

fn gizzi_base() -> String {
    std::env::var("TERMINAL_SERVER_URL")
        .unwrap_or_else(|_| "http://127.0.0.1:4096".to_string())
        .trim_end_matches('/')
        .to_string()
}


pub fn v1_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/ai/chat", post(agent_chat_proxy))
        .route("/health", get(health))
}

pub fn agent_chat_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/agent-chat", any(agent_chat_proxy))
}


async fn agent_chat_proxy(headers: HeaderMap, req: Request) -> impl IntoResponse {
    let gizzi = gizzi_base();
    let user_id = headers.get("x-allternit-user-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("anonymous");
    forward_to_gizzi(req, &gizzi, None, user_id).await
}

async fn health() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

async fn forward_to_gizzi(req: Request, gizzi_base: &str, override_path: Option<&str>, user_id: &str) -> Response {
    let client = reqwest::Client::new();
    let (parts, body) = req.into_parts();

    let path_and_query = override_path
        .map(|p| p.to_string())
        .unwrap_or_else(|| parts.uri.path_and_query().map(|p| p.as_str().to_string()).unwrap_or_default());

    let target_url = format!("{}{}", gizzi_base.trim_end_matches('/'), path_and_query);
    info!("Gizzi proxy -> {}", target_url);

    let body_bytes = match body_to_bytes(body).await {
        Ok(b) => b,
        Err(e) => {
            warn!("Failed to read request body: {}", e);
            return (StatusCode::BAD_REQUEST, "Failed to read request body").into_response();
        }
    };

    let method_str = parts.method.as_str();
    let reqwest_method = reqwest::Method::from_bytes(method_str.as_bytes()).unwrap_or(reqwest::Method::GET);
    let mut req_builder = client.request(reqwest_method, &target_url);

    for (name, value) in parts.headers.iter() {
        let name_str = name.as_str();
        if name_str.eq_ignore_ascii_case("host")
            || name_str.eq_ignore_ascii_case("connection")
            || name_str.eq_ignore_ascii_case("transfer-encoding")
        {
            continue;
        }
        if let Ok(value_str) = value.to_str() {
            req_builder = req_builder.header(name_str, value_str);
        }
    }

    // Ensure user_id header is forwarded
    req_builder = req_builder.header("x-allternit-user-id", user_id);

    if !body_bytes.is_empty() {
        req_builder = req_builder.body(body_bytes.to_vec());
    }

    let upstream = match req_builder.send().await {
        Ok(r) => r,
        Err(e) => {
            warn!("Gizzi proxy error: {}", e);
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": format!("Gizzi proxy failed: {}", e) })),
            ).into_response();
        }
    };

    let status = StatusCode::from_u16(upstream.status().as_u16())
        .unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    let mut response = Response::builder().status(status);

    for (name, value) in upstream.headers().iter() {
        let name_str = name.as_str();
        if name_str.eq_ignore_ascii_case("connection")
            || name_str.eq_ignore_ascii_case("transfer-encoding")
        {
            continue;
        }
        if let Ok(value_str) = value.to_str() {
            response = response.header(name_str, value_str);
        }
    }

    response = response.header("access-control-allow-origin", "*");
    response = response.header("access-control-allow-headers", "*");
    response = response.header("access-control-allow-methods", "*");

    let body_bytes = upstream.bytes().await.unwrap_or_default();
    match response.body(Body::from(body_bytes)) {
        Ok(r) => r,
        Err(e) => {
            warn!("Failed to build response: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, "Failed to build response").into_response()
        }
    }
}

async fn body_to_bytes(body: Body) -> Result<axum::body::Bytes, Box<dyn std::error::Error + Send + Sync>> {
    use http_body_util::BodyExt;
    let collected = body.collect().await?;
    Ok(collected.to_bytes())
}
