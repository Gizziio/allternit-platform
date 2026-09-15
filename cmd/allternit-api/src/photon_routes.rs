//! Production Photon messaging and autonomous bot primitives.
//!
//! Mounted under `/api/v1` by main.rs. All state is persisted in SQLite and
//! secrets are encrypted at rest via `token_crypto`.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::info;

use crate::auth::AuthUser;
use crate::AppState;

pub fn photon_router() -> Router<Arc<AppState>> {
    // NOTE (2026-09-14 de-duplication): this router used to also register
    // /photon/agents/:agent_id/inbox (GET+POST),
    // /agents/:agent_id/connectors/resolve, and
    // /agents/:agent_id/identity/email. Those paths are still served, but
    // from allternit_bus_routes::allternit_bus_router, which holds the
    // maintained variants (mailflare provisioning, backend-aware connector
    // resolution, and the connector-resolution test mounts that router).
    // Registering them in both routers made axum panic with "Overlapping
    // method route" at startup.
    Router::new()
        // Secrets
        .route("/agents/:agent_id/secrets/:key", put(set_secret))
        .route(
            "/agents/:agent_id/secrets/resolve",
            post(resolve_agent_secrets),
        )
        // Identity channels
        .route("/agents/:agent_id/identity", get(get_identity_channels))
        .route("/agents/:agent_id/identity/phone", post(provision_phone))
        // Cross-surface bridge
        .route("/photon/sessions/:session_id/bridge", post(bridge_session))
}
// NOTE (2026-09-14 de-duplication): /agents/:agent_id/identity/wallet used to
// be registered here (post(provision_wallet)), conflicting with
// /agents/:id/identity/wallet (post(provision_agent_wallet)) in
// agent_routes.rs — axum rejects the two param spellings as overlapping. The
// agent_routes registration is canonical: the ai.allternit.com wallet factory
// POSTs {kind, chainId, allowedMethods} and reads {wallet: {id, address,
// keyVaultRef}}, which matches provision_agent_wallet's response shape (and
// the repo ships the services/etrid sidecar it proxies to). The local
// self-contained fallback implementation provision_wallet was removed in the
// 2026-09-14 dead-code sweep (unregistered and unreferenced).

type ApiError = (StatusCode, Json<Value>);

fn err(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(error: impl std::fmt::Display) -> ApiError {
    err(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        error.to_string(),
    )
}

/// Verify the agent exists and is owned by the requesting user.
fn require_agent_owner(
    state: &AppState,
    user: &AuthUser,
    agent_id: &str,
) -> Result<(), ApiError> {
    let conn = state.db.connect().map_err(internal)?;
    let owner: Option<String> = conn
        .query_row(
            "SELECT user_id FROM agents WHERE id = ?1",
            params![agent_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(internal)?;
    match owner {
        Some(owner_id) if owner_id == user.user_id => Ok(()),
        Some(_) => Err(err(StatusCode::FORBIDDEN, "forbidden", "Agent does not belong to user")),
        None => Err(err(StatusCode::NOT_FOUND, "not_found", "Agent not found")),
    }
}

// ============================================================================
// Secrets
// ============================================================================

#[derive(Debug, Deserialize)]
struct SetSecretRequest {
    value: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    required: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
struct SecretRefInput {
    name: String,
    key: String,
    #[serde(default)]
    required: bool,
}

#[derive(Debug, Deserialize)]
struct ResolveSecretsRequest {
    #[serde(default)]
    refs: Vec<SecretRefInput>,
}

#[derive(Debug, Serialize)]
struct ResolvedSecret {
    key: String,
    value: String,
    source: &'static str,
}

#[derive(Debug, Serialize)]
struct ResolveSecretsResponse {
    secrets: Vec<ResolvedSecret>,
    missing: Vec<String>,
    errors: Vec<String>,
}

async fn set_secret(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((agent_id, key)): Path<(String, String)>,
    Json(req): Json<SetSecretRequest>,
) -> Result<Response, ApiError> {
    require_agent_owner(&state, &user, &agent_id)?;

    if key.trim().is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "invalid_key", "Secret key cannot be empty"));
    }

    let sealed = crate::token_crypto::seal(&req.value);
    if sealed.is_empty() {
        return Err(err(StatusCode::BAD_REQUEST, "empty_value", "Secret value cannot be empty"));
    }

    tokio::task::spawn_blocking({
        let db = state.db.clone();
        let agent_id = agent_id.clone();
        let key = key.clone();
        let name = req.name.unwrap_or_else(|| key.clone());
        let description = req.description.clone();
        let required = req.required.unwrap_or(false);
        let user_id = user.user_id.clone();
        move || {
            let conn = db.connect().map_err(internal)?;
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO agent_secrets (id, agent_id, user_id, name, key, encrypted_value, required, description, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, CURRENT_TIMESTAMP)
                 ON CONFLICT(agent_id, key) DO UPDATE SET
                     name = excluded.name,
                     encrypted_value = excluded.encrypted_value,
                     required = excluded.required,
                     description = excluded.description,
                     updated_at = CURRENT_TIMESTAMP",
                params![id, agent_id, user_id, name, key, sealed, required as i32, description],
            )
            .map_err(internal)?;
            Ok::<_, ApiError>(())
        }
    })
    .await
    .map_err(|e| internal(e))??;

    Ok((StatusCode::NO_CONTENT, ()).into_response())
}

async fn resolve_agent_secrets(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(agent_id): Path<String>,
    Json(req): Json<ResolveSecretsRequest>,
) -> Result<Response, ApiError> {
    require_agent_owner(&state, &user, &agent_id)?;

    if req.refs.is_empty() {
        return Ok(Json(ResolveSecretsResponse {
            secrets: Vec::new(),
            missing: Vec::new(),
            errors: Vec::new(),
        })
        .into_response());
    }

    let result = tokio::task::spawn_blocking({
        let db = state.db.clone();
        let agent_id = agent_id.clone();
        let refs = req.refs.clone();
        move || {
            let conn = db.connect().map_err(internal)?;
            let mut secrets = Vec::new();
            let mut missing = Vec::new();
            let mut errors = Vec::new();

            for r in refs {
                let sealed: Option<String> = conn
                    .query_row(
                        "SELECT encrypted_value FROM agent_secrets WHERE agent_id = ?1 AND key = ?2",
                        params![agent_id, r.key],
                        |row| row.get(0),
                    )
                    .optional()
                    .map_err(internal)?;

                match sealed {
                    Some(value) => {
                        let plain = crate::token_crypto::open(&value);
                        if plain.is_empty() {
                            if r.required {
                                missing.push(r.key.clone());
                            }
                            errors.push(format!("{}: could not decrypt", r.key));
                        } else {
                            secrets.push(ResolvedSecret {
                                key: r.key,
                                value: plain,
                                source: "vault",
                            });
                        }
                    }
                    None => {
                        if r.required {
                            missing.push(r.key.clone());
                        }
                    }
                }
            }
            Ok::<_, ApiError>(ResolveSecretsResponse {
                secrets,
                missing,
                errors,
            })
        }
    })
    .await
    .map_err(|e| internal(e))??;

    Ok(Json(result).into_response())
}

// ============================================================================
// Identity channels
// ============================================================================

#[derive(Debug, Serialize)]
struct IdentityChannelsResponse {
    agent_id: String,
    email: Option<Value>,
    phone: Option<Value>,
    wallet: Option<Value>,
}

async fn get_identity_channels(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(agent_id): Path<String>,
) -> Result<Response, ApiError> {
    require_agent_owner(&state, &user, &agent_id)?;

    let row = tokio::task::spawn_blocking({
        let db = state.db.clone();
        let agent_id = agent_id.clone();
        move || {
            let conn = db.connect().map_err(internal)?;
            let row = conn
                .query_row(
                    "SELECT email_address, email_provider, email_send_enabled, email_receive_enabled,
                            phone_number, phone_provider, phone_voice_enabled, phone_sms_enabled,
                            wallet_address, wallet_provider, wallet_chain_id, wallet_allowed_methods
                     FROM agent_identity_channels
                     WHERE agent_id = ?1",
                    params![agent_id],
                    |row| {
                        Ok(IdentityChannelsResponse {
                            agent_id: agent_id.clone(),
                            email: if row.get::<_, Option<String>>(0)?.is_some() {
                                Some(json!({
                                    "address": row.get::<_, Option<String>>(0)?,
                                    "provider": row.get::<_, Option<String>>(1)?,
                                    "sendEnabled": row.get::<_, i32>(2)? != 0,
                                    "receiveEnabled": row.get::<_, i32>(3)? != 0,
                                }))
                            } else {
                                None
                            },
                            phone: if row.get::<_, Option<String>>(4)?.is_some() {
                                Some(json!({
                                    "number": row.get::<_, Option<String>>(4)?,
                                    "provider": row.get::<_, Option<String>>(5)?,
                                    "voiceEnabled": row.get::<_, i32>(6)? != 0,
                                    "smsEnabled": row.get::<_, i32>(7)? != 0,
                                }))
                            } else {
                                None
                            },
                            wallet: if row.get::<_, Option<String>>(8)?.is_some() {
                                Some(json!({
                                    "address": row.get::<_, Option<String>>(8)?,
                                    "provider": row.get::<_, Option<String>>(9)?,
                                    "chainId": row.get::<_, Option<String>>(10)?,
                                    "allowedMethods": row.get::<_, Option<String>>(11)?,
                                }))
                            } else {
                                None
                            },
                        })
                    },
                )
                .optional()
                .map_err(internal)?;
            Ok::<_, ApiError>(row)
        }
    })
    .await
    .map_err(|e| internal(e))??;

    match row {
        Some(r) => Ok(Json(r).into_response()),
        None => Ok(Json(IdentityChannelsResponse {
            agent_id,
            email: None,
            phone: None,
            wallet: None,
        })
        .into_response()),
    }
}

#[derive(Debug, Serialize)]
struct ProvisionPhoneResponse {
    number: String,
    provider: &'static str,
}

async fn provision_phone(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(agent_id): Path<String>,
) -> Result<Response, ApiError> {
    require_agent_owner(&state, &user, &agent_id)?;

    let pool = std::env::var("ALLTERNIT_BOT_PHONE_POOL")
        .ok()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            err(
                StatusCode::NOT_IMPLEMENTED,
                "phone_pool_not_configured",
                "ALLTERNIT_BOT_PHONE_POOL is not configured.",
            )
        })?;

    let numbers: Vec<String> = pool.split(',').map(|s| s.trim().to_string()).collect();
    if numbers.is_empty() {
        return Err(err(
            StatusCode::NOT_IMPLEMENTED,
            "phone_pool_empty",
            "ALLTERNIT_BOT_PHONE_POOL is empty.",
        ));
    }

    let number = tokio::task::spawn_blocking({
        let db = state.db.clone();
        let agent_id = agent_id.clone();
        let user_id = user.user_id.clone();
        let numbers = numbers.clone();
        move || {
            let conn = db.connect().map_err(internal)?;
            // Allocate the first number in the pool not already assigned to another agent.
            let mut stmt = conn
                .prepare("SELECT phone_number FROM agent_identity_channels WHERE phone_number IS NOT NULL")
                .map_err(internal)?;
            let assigned: std::collections::HashSet<String> = stmt
                .query_map([], |row| row.get::<_, String>(0))
                .map_err(internal)?
                .collect::<rusqlite::Result<_>>()
                .map_err(internal)?;

            let chosen = numbers
                .into_iter()
                .find(|n| !assigned.contains(n))
                .ok_or_else(|| err(StatusCode::CONFLICT, "phone_pool_exhausted", "Phone number pool is exhausted"))?;

            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO agent_identity_channels (id, agent_id, user_id, phone_number, phone_provider, phone_voice_enabled, phone_sms_enabled, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 'vapi', 1, 1, CURRENT_TIMESTAMP)
                 ON CONFLICT(agent_id) DO UPDATE SET
                     phone_number = excluded.phone_number,
                     phone_provider = excluded.phone_provider,
                     phone_voice_enabled = excluded.phone_voice_enabled,
                     phone_sms_enabled = excluded.phone_sms_enabled,
                     updated_at = CURRENT_TIMESTAMP",
                params![id, agent_id, user_id, chosen],
            )
            .map_err(internal)?;
            Ok::<_, ApiError>(chosen)
        }
    })
    .await
    .map_err(|e| internal(e))??;

    Ok(Json(ProvisionPhoneResponse { number, provider: "vapi" }).into_response())
}

// ============================================================================
// Cross-surface bridge
// ============================================================================

#[derive(Debug, Deserialize)]
struct BridgeSessionRequest {
    target_surface: String,
    payload: Value,
}

async fn bridge_session(
    Extension(_user): Extension<AuthUser>,
    Path(session_id): Path<String>,
    Json(req): Json<BridgeSessionRequest>,
) -> impl IntoResponse {
    info!(
        session_id = %session_id,
        target_surface = %req.target_surface,
        "Cross-surface bridge requested"
    );

    (
        StatusCode::ACCEPTED,
        Json(json!({
            "session_id": session_id,
            "target_surface": req.target_surface,
            "status": "bridged",
            "payload": req.payload,
        })),
    )
}
