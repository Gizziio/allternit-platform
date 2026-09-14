//! Cloud continuation control plane: pick an always-on node (never the
//! laptop) and relay ingest/routines there.

use axum::{
    extract::State,
    http::HeaderMap,
    response::Response,
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use bytes::Bytes;
use serde::Serialize;
use std::sync::Arc;

use super::runtime_relay::{relay_headers_from_http, RelayRequest};
use crate::services::{
    resolve_continuation_node, NodeKind, PgNodeStore,
};
use crate::{ApiError, ApiState};

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/continuation/ensure", get(ensure_continuation).post(ensure_continuation))
        .route(
            "/api/v1/fabric/transport/continuation/ingest",
            post(ingest),
        )
        .route("/api/v1/cowork/routines", post(create_routine))
}

#[derive(Debug, Serialize)]
struct EnsureResponse {
    device_id: String,
    kind: String,
    name: String,
}

async fn ensure_continuation(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<EnsureResponse>, ApiError> {
    let user = crate::auth::resolve_user_scoped(&state.db, &headers, "compute").await?;
    let store = PgNodeStore::new(&state.db);
    let node = match resolve_continuation_node(&store, &user.id).await {
        Ok(node) => node,
        Err(_) => {
            // Last resort: a healthy default node that is not local.
            let fallback = state
                .data_plane_gateway
                .resolve_default_node(&user.id)
                .await?;
            if fallback.kind.0 == NodeKind::LOCAL {
                return Err(ApiError::PreconditionRequired(
                    "Only a laptop node is online. Start a hosted runtime or pair a box that stays on, then retry.".to_string(),
                ));
            }
            fallback
        }
    };
    Ok(Json(EnsureResponse {
        device_id: node.device_id,
        kind: node.kind.0,
        name: node.name,
    }))
}

async fn ingest(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_to_continuation(&state, &headers, "POST", "/api/v1/fabric/transport/continuation/ingest", &body).await
}

async fn create_routine(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_to_continuation(&state, &headers, "POST", "/api/v1/cowork/routines", &body).await
}

async fn relay_to_continuation(
    state: &ApiState,
    headers: &HeaderMap,
    method: &str,
    path: &str,
    body: &[u8],
) -> Result<Response, ApiError> {
    let user = crate::auth::resolve_user_scoped(&state.db, headers, "compute").await?;
    let store = PgNodeStore::new(&state.db);
    let node = resolve_continuation_node(&store, &user.id).await?;
    let request = RelayRequest {
        method: method.to_string(),
        path: path.to_string(),
        headers: relay_headers_from_http(headers),
        body: STANDARD.encode(body),
        body_encoding: "base64".to_string(),
    };
    state
        .data_plane_gateway
        .relay(&user.id, &node.device_id, request)
        .await
}
