//! HAR-derived API client routes.
//!
//! Accepts browser HAR archives, extracts repeatable API calls, persists
//! capture sessions and contracts, and provides server-side replay plus
//! client-code generation.
//!
//! Business logic lives in `crate::har_api_service`; this module is the
//! thin axum routing layer.

use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::warn;

use crate::auth::get_user;
use crate::db::DbHandle;
use crate::AppState;

pub fn har_api_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/har-derived-api/ingest", post(ingest_har))
        .route("/har-derived-api/sessions", post(create_session).get(list_sessions))
        .route("/har-derived-api/sessions/:id", get(get_session))
        .route("/har-derived-api/sessions/:id/stop", post(stop_session))
        .route("/har-derived-api/contracts", get(list_contracts))
        .route("/har-derived-api/contracts/:id", get(get_contract).delete(delete_contract))
        .route("/har-derived-api/replay", post(replay_endpoint))
        .route("/har-derived-api/client", post(generate_client))
}

fn unauthorized() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({ "error": "Unauthorized" })),
    )
        .into_response()
}

fn bad_request(message: &str) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": message })),
    )
        .into_response()
}

fn internal_error(message: &str) -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": message })),
    )
        .into_response()
}

#[derive(Debug, Deserialize)]
struct IngestHarRequest {
    har: String,
}

#[derive(Debug, Serialize)]
struct IngestResponse {
    endpoints: Vec<crate::har_api_service::ApiEndpoint>,
    stats: IngestStats,
}

#[derive(Debug, Serialize)]
struct IngestStats {
    total_entries: usize,
    api_entries: usize,
    hosts: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CreateSessionRequest {
    #[serde(default)]
    domain: Option<String>,
    #[serde(default)]
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StopSessionRequest {
    #[serde(default)]
    har: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReplayRequest {
    endpoint_id: String,
    #[serde(default)]
    path_params: Option<Value>,
    #[serde(default)]
    query_params: Option<Value>,
    #[serde(default)]
    headers: Option<Value>,
    #[serde(default)]
    body: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct GenerateClientRequest {
    endpoints: Vec<String>,
    language: String,
}

#[derive(Debug, Serialize)]
struct GenerateClientResponse {
    language: String,
    code: String,
    notes: Vec<String>,
}

async fn ingest_har(
    State(_state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<IngestHarRequest>,
) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    let total_entries = match serde_json::from_str::<serde_json::Value>(&req.har) {
        Ok(Value::Object(mut map)) => map
            .remove("log")
            .and_then(|log| match log {
                Value::Object(mut log_map) => log_map
                    .remove("entries")
                    .and_then(|entries| entries.as_array().map(|a| a.len())),
                _ => None,
            })
            .unwrap_or(0),
        _ => 0,
    };

    let endpoints = match crate::har_api_service::extract_endpoints_from_har(&req.har) {
        Ok(eps) => eps,
        Err(err) => {
            warn!(user_id = %user.user_id, error = %err, "Failed to parse HAR JSON");
            return bad_request(&err);
        }
    };

    let mut hosts: Vec<String> = endpoints.iter().filter_map(|e| e.host.clone()).collect();
    hosts.sort();
    hosts.dedup();

    (
        StatusCode::OK,
        Json(IngestResponse {
            stats: IngestStats {
                total_entries,
                api_entries: endpoints.len(),
                hosts,
            },
            endpoints,
        }),
    )
        .into_response()
}

async fn create_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<CreateSessionRequest>,
) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    let session_id = match crate::har_api_service::create_capture_session(
        &state.db,
        &user.user_id,
        req.domain.as_deref(),
        req.source.as_deref(),
    )
    .await
    {
        Ok(id) => id,
        Err(err) => {
            warn!(error = %err, "Failed to create capture session");
            return internal_error(&err);
        }
    };

    match db_blocking(&state.db, move |db| db.get_capture_session(&session_id)).await {
        Ok(Some(session)) => (StatusCode::OK, Json(json!({ "session": session }))).into_response(),
        Ok(None) => internal_error("Session disappeared after creation"),
        Err(err) => {
            warn!(error = %err, "Failed to read created session");
            internal_error(&err)
        }
    }
}

async fn list_sessions(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    match db_blocking(&state.db, move |db| db.list_capture_sessions_for_user(&user.user_id)).await {
        Ok(sessions) => (StatusCode::OK, Json(json!({ "sessions": sessions }))).into_response(),
        Err(err) => {
            warn!(error = %err, "Failed to list capture sessions");
            internal_error(&err)
        }
    }
}

async fn get_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    match db_blocking(&state.db, move |db| db.get_capture_session(&id)).await {
        Ok(Some(session)) => {
            if session.user_id != user.user_id {
                return unauthorized();
            }
            (StatusCode::OK, Json(json!({ "session": session }))).into_response()
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "error": "Session not found" }))).into_response(),
        Err(err) => {
            warn!(error = %err, "Failed to get capture session");
            internal_error(&err)
        }
    }
}

async fn stop_session(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<StopSessionRequest>,
) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    // Verify ownership before stopping.
    let session_id = id.clone();
    match db_blocking(&state.db, move |db| db.get_capture_session(&session_id)).await {
        Ok(Some(session)) if session.user_id != user.user_id => return unauthorized(),
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({ "error": "Session not found" }))).into_response(),
        Ok(_) => {}
        Err(err) => {
            warn!(error = %err, "Failed to get capture session for stop");
            return internal_error(&err);
        }
    }

    match crate::har_api_service::stop_capture_session(&state.db, &id, req.har.as_deref()).await {
        Ok(value) => (StatusCode::OK, Json(value)).into_response(),
        Err(err) => {
            warn!(error = %err, "Failed to stop capture session");
            internal_error(&err)
        }
    }
}

async fn list_contracts(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    match db_blocking(&state.db, move |db| db.list_contracts_for_user(&user.user_id)).await {
        Ok(contracts) => (StatusCode::OK, Json(json!({ "contracts": contracts }))).into_response(),
        Err(err) => {
            warn!(error = %err, "Failed to list contracts");
            internal_error(&err)
        }
    }
}

async fn get_contract(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    match db_blocking(&state.db, move |db| db.get_contract_with_endpoints(&id)).await {
        Ok(Some((contract, endpoints))) => {
            if contract.user_id != user.user_id {
                return unauthorized();
            }
            (
                StatusCode::OK,
                Json(json!({
                    "contract": contract,
                    "endpoints": endpoints,
                })),
            )
                .into_response()
        }
        Ok(None) => (StatusCode::NOT_FOUND, Json(json!({ "error": "Contract not found" }))).into_response(),
        Err(err) => {
            warn!(error = %err, "Failed to get contract");
            internal_error(&err)
        }
    }
}

async fn delete_contract(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    let contract_id = id.clone();
    match db_blocking(&state.db, move |db| db.get_contract_with_endpoints(&contract_id)).await {
        Ok(Some((contract, _))) if contract.user_id != user.user_id => return unauthorized(),
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({ "error": "Contract not found" }))).into_response(),
        Ok(_) => {}
        Err(err) => {
            warn!(error = %err, "Failed to get contract for delete");
            return internal_error(&err);
        }
    }

    match db_blocking(&state.db, move |db| db.delete_contract(&id)).await {
        Ok(true) => (StatusCode::NO_CONTENT, ()).into_response(),
        Ok(false) => (StatusCode::NOT_FOUND, Json(json!({ "error": "Contract not found" }))).into_response(),
        Err(err) => {
            warn!(error = %err, "Failed to delete contract");
            internal_error(&err)
        }
    }
}

async fn replay_endpoint(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<ReplayRequest>,
) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    let endpoint_id = req.endpoint_id.clone();
    let endpoint = match db_blocking(&state.db, move |db| db.get_endpoint_by_id(&endpoint_id)).await {
        Ok(Some(ep)) => ep,
        Ok(None) => {
            return (StatusCode::NOT_FOUND, Json(json!({ "error": "Endpoint not found" }))).into_response();
        }
        Err(err) => {
            warn!(error = %err, "Failed to get endpoint for replay");
            return internal_error(&err);
        }
    };

    // Ownership check via contract.
    let contract_id = endpoint.contract_id.clone();
    match db_blocking(&state.db, move |db| db.get_contract_with_endpoints(&contract_id)).await {
        Ok(Some((contract, _))) if contract.user_id != user.user_id => return unauthorized(),
        Ok(None) => return (StatusCode::NOT_FOUND, Json(json!({ "error": "Contract not found" }))).into_response(),
        Ok(_) => {}
        Err(err) => {
            warn!(error = %err, "Failed to get contract for replay");
            return internal_error(&err);
        }
    }

    match crate::har_api_service::replay_endpoint(
        &state.db,
        &endpoint.contract_id,
        &req.endpoint_id,
        req.path_params.as_ref(),
        req.query_params.as_ref(),
        req.headers.as_ref(),
        req.body.as_ref(),
    )
    .await
    {
        Ok(value) => (StatusCode::OK, Json(value)).into_response(),
        Err(err) => {
            warn!(error = %err, "Replay request failed");
            internal_error(&err)
        }
    }
}

async fn generate_client(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<GenerateClientRequest>,
) -> Response {
    let Some(user) = get_user(&headers) else {
        return unauthorized();
    };

    // Ownership check: every endpoint must belong to a contract owned by the user.
    let endpoint_ids = req.endpoints.clone();
    let endpoints = match db_blocking(&state.db, move |db| db.get_endpoints_by_ids(&endpoint_ids)).await {
        Ok(eps) => eps,
        Err(err) => {
            warn!(error = %err, "Failed to fetch endpoints for client generation");
            return internal_error(&err);
        }
    };

    for ep in &endpoints {
        let contract_id = ep.contract_id.clone();
        let authorized = match db_blocking(&state.db, move |db| db.get_contract_with_endpoints(&contract_id)).await {
            Ok(Some((contract, _))) => contract.user_id == user.user_id,
            _ => false,
        };
        if !authorized {
            return unauthorized();
        }
    }

    match crate::har_api_service::generate_client_for_endpoints(&state.db, &req.endpoints, &req.language).await {
        Ok(code) => (
            StatusCode::OK,
            Json(GenerateClientResponse {
                language: req.language,
                code,
                notes: vec![
                    "Review extracted parameters and secrets before committing.".to_string(),
                    "Replace hard-coded auth values with environment variables.".to_string(),
                ],
            }),
        )
            .into_response(),
        Err(err) => {
            warn!(error = %err, "Failed to generate client");
            internal_error(&err)
        }
    }
}

async fn db_blocking<T, F>(db: &DbHandle, f: F) -> Result<T, String>
where
    F: FnOnce(&DbHandle) -> rusqlite::Result<T> + Send + 'static,
    T: Send + 'static,
{
    let db = db.clone();
    tokio::task::spawn_blocking(move || f(&db).map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}
