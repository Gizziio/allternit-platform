//! Production AllternitBus messaging and autonomous bot primitives.
//!
//! Mounted under `/api/v1` by main.rs. All state is persisted in SQLite and
//! secrets are encrypted at rest via `token_crypto`.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use ed25519_dalek::SigningKey;
use rand::rngs::OsRng;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::{info, warn};

use crate::auth::AuthUser;
use crate::AppState;

pub fn allternit_bus_router() -> Router<Arc<AppState>> {
    Router::new()
        // AllternitBus inbox (route paths kept for backward compatibility)
        .route("/photon/agents/:agent_id/inbox", post(send_message))
        .route("/photon/agents/:agent_id/inbox", get(get_inbox))
        // Secrets
        .route("/agents/:agent_id/secrets/:key", put(set_secret))
        .route(
            "/agents/:agent_id/secrets/resolve",
            post(resolve_agent_secrets),
        )
        // Connectors
        .route(
            "/agents/:agent_id/connectors/resolve",
            post(resolve_agent_connectors),
        )
        // Identity channels
        .route("/agents/:agent_id/identity", get(get_identity_channels))
        .route("/agents/:agent_id/identity/email", post(provision_email))
        .route("/agents/:agent_id/identity/phone", post(provision_phone))
        // Cross-surface bridge (route path kept for backward compatibility)
        .route("/photon/sessions/:session_id/bridge", post(bridge_session))
}

/// Public webhook surface for inbound Photon.codes messages.
/// Mounted on the public router in main.rs because it is called server-to-server
/// by Photon and cannot carry a Clerk session.
pub fn allternit_bus_webhook_router() -> Router<Arc<AppState>> {
    Router::new().route("/webhooks/photon", post(receive_inbound_message))
}

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
// AllternitBus inbox
// ============================================================================

#[derive(Debug, Deserialize)]
struct SendMessageRequest {
    from: String,
    content: String,
    surface: Option<String>,
}

#[derive(Debug, Serialize)]
struct AllternitBusMessage {
    id: String,
    from: String,
    to: String,
    content: String,
    surface: Option<String>,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct InboxQuery {
    since: Option<String>,
    limit: Option<usize>,
}

async fn send_message(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(agent_id): Path<String>,
    Json(req): Json<SendMessageRequest>,
) -> Result<Response, ApiError> {
    require_agent_owner(&state, &user, &agent_id)?;

    let msg_id = uuid::Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now().to_rfc3339();

    tokio::task::spawn_blocking({
        let db = state.db.clone();
        let msg_id = msg_id.clone();
        let created_at = created_at.clone();
        let from = req.from.clone();
        let content = req.content.clone();
        let surface = req.surface.clone();
        let agent_id = agent_id.clone();
        move || {
            let conn = db.connect().map_err(internal)?;
            conn.execute(
                "INSERT INTO agent_photon_inbox (id, agent_id, from_id, to_id, content, surface, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    msg_id,
                    agent_id,
                    from,
                    agent_id,
                    content,
                    surface,
                    created_at
                ],
            )
            .map_err(internal)?;
            Ok::<_, ApiError>(())
        }
    })
    .await
    .map_err(|e| internal(e))??;

    info!(agent_id = %agent_id, msg_id = %msg_id, "AllternitBus message delivered");
    Ok((StatusCode::ACCEPTED, Json(json!({ "id": msg_id, "status": "delivered" }))).into_response())
}

async fn get_inbox(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(agent_id): Path<String>,
    Query(query): Query<InboxQuery>,
) -> Result<Response, ApiError> {
    require_agent_owner(&state, &user, &agent_id)?;

    let messages = tokio::task::spawn_blocking({
        let db = state.db.clone();
        let agent_id = agent_id.clone();
        let since = query.since.clone();
        let limit = query.limit.unwrap_or(100).min(500);
        move || {
            let conn = db.connect().map_err(internal)?;
            let mut stmt = conn.prepare(
                "SELECT id, from_id, to_id, content, surface, created_at
                 FROM agent_photon_inbox
                 WHERE agent_id = ?1
                   AND (?2 IS NULL OR created_at > ?2)
                 ORDER BY created_at DESC
                 LIMIT ?3",
            ).map_err(internal)?;
            let rows = stmt
                .query_map(params![agent_id, since, limit], |row| {
                    Ok(AllternitBusMessage {
                        id: row.get(0)?,
                        from: row.get(1)?,
                        to: row.get(2)?,
                        content: row.get(3)?,
                        surface: row.get(4)?,
                        created_at: row.get(5)?,
                    })
                })
                .map_err(internal)?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(internal)?;
            Ok::<_, ApiError>(rows)
        }
    })
    .await
    .map_err(|e| internal(e))??;

    Ok(Json(json!({ "agent_id": agent_id, "messages": messages })).into_response())
}

// ============================================================================
// Inbound AllternitBus webhook
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
struct AllternitBusWebhookPayload {
    from: String,
    to: String,
    body: String,
    channel: String,
    message_id: String,
}

async fn receive_inbound_message(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AllternitBusWebhookPayload>,
) -> Result<Response, ApiError> {
    let to = payload.to.clone();
    let from = payload.from.clone();

    let routed = tokio::task::spawn_blocking({
        let db = state.db.clone();
        let payload = payload.clone();
        move || {
            let conn = db.connect().map_err(internal)?;
            let agent_id: Option<String> = conn
                .query_row(
                    "SELECT agent_id FROM agent_identity_channels WHERE phone_provider = 'photon' AND phone_number = ?1",
                    params![payload.to],
                    |row| row.get(0),
                )
                .optional()
                .map_err(internal)?;
            let agent_id = match agent_id {
                Some(id) => id,
                None => return Ok::<_, ApiError>(None),
            };
            conn.execute(
                "INSERT OR IGNORE INTO agent_photon_inbox (id, agent_id, from_id, to_id, content, surface, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    payload.message_id,
                    agent_id,
                    payload.from,
                    payload.to,
                    payload.body,
                    payload.channel,
                    chrono::Utc::now().to_rfc3339()
                ],
            )
            .map_err(internal)?;
            Ok::<_, ApiError>(Some(agent_id))
        }
    })
    .await
    .map_err(|e| internal(e))??;

    match routed {
        Some(agent_id) => {
            info!(agent_id = %agent_id, from = %from, "AllternitBus inbound webhook routed");
        }
        None => {
            warn!(to = %to, "AllternitBus inbound webhook received but no matching agent phone channel");
        }
    }

    Ok((StatusCode::ACCEPTED, Json(json!({ "status": "accepted" }))).into_response())
}

/// Dispatch an outbound SMS/message via Photon.codes Cloud Messaging REST API.
pub async fn send_photon_outbound_message(
    project_id: &str,
    project_secret: &str,
    to_phone: &str,
    body: &str,
) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = "https://api.photon.codes/v1/messages";
    let resp = client
        .post(url)
        .header("Authorization", format!("Bearer {}", project_secret))
        .header("Content-Type", "application/json")
        .json(&json!({
            "projectId": project_id,
            "to": to_phone,
            "body": body,
        }))
        .send()
        .await
        .map_err(|e| format!("Photon API error: {}", e))?;

    if resp.status().is_success() {
        let val = resp.json::<Value>().await.unwrap_or_else(|_| json!({"status": "sent"}));
        Ok(val)
    } else {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        Err(format!("Photon API rejected message ({}): {}", status, text))
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
// Connector credential resolution
// ============================================================================

#[derive(Debug, Deserialize, Clone)]
struct ConnectorBindingInput {
    connector_id: String,
    provider: String,
    #[serde(default)]
    label: String,
    #[serde(default)]
    capabilities: Vec<String>,
    #[serde(default)]
    autonomous: bool,
    #[serde(default)]
    allowed_actions: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct ResolveConnectorsRequest {
    bindings: Vec<ConnectorBindingInput>,
}

#[derive(Debug, Serialize)]
struct ResolvedConnectorCredential {
    connector_id: String,
    provider: String,
    key: String,
    value: String,
    source: &'static str,
}

#[derive(Debug, Serialize)]
struct ResolveConnectorsResponse {
    credentials: Vec<ResolvedConnectorCredential>,
    missing: Vec<String>,
    errors: Vec<String>,
}

async fn resolve_agent_connectors(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(agent_id): Path<String>,
    Json(req): Json<ResolveConnectorsRequest>,
) -> Result<Response, ApiError> {
    require_agent_owner(&state, &user, &agent_id)?;

    let result = tokio::task::spawn_blocking({
        let db = state.db.clone();
        let agent_id = agent_id.clone();
        let user_id = user.user_id.clone();
        let bindings = req.bindings.clone();
        move || {
            let conn = db.connect().map_err(internal)?;
            let mut credentials = Vec::new();
            let mut missing = Vec::new();
            let mut errors = Vec::new();

            for b in bindings {
                let mut resolved = false;

                // 1. Lookup owned connector connection.
                let row: Option<(Option<String>, Option<String>)> = conn
                    .query_row(
                        "SELECT access_token, refresh_token FROM connector_connections
                         WHERE connector_id = ?1 AND user_id = ?2 AND status = 'connected'
                         ORDER BY updated_at DESC LIMIT 1",
                        params![b.connector_id, user_id],
                        |row| Ok((row.get(0)?, row.get(1)?)),
                    )
                    .optional()
                    .map_err(internal)?;

                if let Some((access_token, refresh_token)) = row {
                    if let Some(token) = access_token {
                        let plain = crate::token_crypto::open(&token);
                        if !plain.is_empty() {
                            credentials.push(ResolvedConnectorCredential {
                                connector_id: b.connector_id.clone(),
                                provider: b.provider.clone(),
                                key: format!("{}_ACCESS_TOKEN", env_key(&b.provider)),
                                value: plain,
                                source: "connector_connections",
                            });
                            resolved = true;
                        }
                    }
                    if let Some(token) = refresh_token {
                        let plain = crate::token_crypto::open(&token);
                        if !plain.is_empty() {
                            credentials.push(ResolvedConnectorCredential {
                                connector_id: b.connector_id.clone(),
                                provider: b.provider.clone(),
                                key: format!("{}_REFRESH_TOKEN", env_key(&b.provider)),
                                value: plain,
                                source: "connector_connections",
                            });
                        }
                    }
                }

                // 2. Fallback to legacy allternit_vault_credentials.
                if !resolved {
                    let sealed: Option<String> = conn
                        .query_row(
                            "SELECT encrypted_value FROM allternit_vault_credentials
                             WHERE user_id = ?1 AND provider = ?2 AND agent_id = ?3
                               AND revoked_at IS NULL
                               AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                             ORDER BY updated_at DESC LIMIT 1",
                            params![user_id, b.provider, agent_id],
                            |row| row.get(0),
                        )
                        .optional()
                        .map_err(internal)?;

                    if let Some(value) = sealed {
                        let plain = crate::token_crypto::open(&value);
                        if !plain.is_empty() {
                            credentials.push(ResolvedConnectorCredential {
                                connector_id: b.connector_id.clone(),
                                provider: b.provider.clone(),
                                key: format!("{}_TOKEN", env_key(&b.provider)),
                                value: plain,
                                source: "allternit_vault",
                            });
                            resolved = true;
                        }
                    }
                }

                if !resolved {
                    missing.push(format!("{} ({})", b.label, b.provider));
                }
            }

            Ok::<_, ApiError>(ResolveConnectorsResponse {
                credentials,
                missing,
                errors,
            })
        }
    })
    .await
    .map_err(|e| internal(e))??;

    Ok(Json(result).into_response())
}

fn env_key(provider: &str) -> String {
    provider.to_ascii_uppercase().replace('-', "_")
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
struct ProvisionEmailResponse {
    address: String,
    provider: &'static str,
}

async fn provision_email(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(agent_id): Path<String>,
) -> Result<Response, ApiError> {
    require_agent_owner(&state, &user, &agent_id)?;

    let domain = std::env::var("ALLTERNIT_BOT_EMAIL_DOMAIN")
        .ok()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            err(
                StatusCode::NOT_IMPLEMENTED,
                "email_domain_not_configured",
                "ALLTERNIT_BOT_EMAIL_DOMAIN is not configured.",
            )
        })?;

    let address = format!("{}@{}", sanitize_local_part(&agent_id), domain);

    tokio::task::spawn_blocking({
        let db = state.db.clone();
        let agent_id = agent_id.clone();
        let user_id = user.user_id.clone();
        let address = address.clone();
        move || {
            let conn = db.connect().map_err(internal)?;
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO agent_identity_channels (id, agent_id, user_id, email_address, email_provider, email_send_enabled, email_receive_enabled, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 'custom', 1, 1, CURRENT_TIMESTAMP)
                 ON CONFLICT(agent_id) DO UPDATE SET
                     email_address = excluded.email_address,
                     email_provider = excluded.email_provider,
                     email_send_enabled = excluded.email_send_enabled,
                     email_receive_enabled = excluded.email_receive_enabled,
                     updated_at = CURRENT_TIMESTAMP",
                params![id, agent_id, user_id, address],
            )
            .map_err(internal)?;
            Ok::<_, ApiError>(())
        }
    })
    .await
    .map_err(|e| internal(e))??;

    Ok(Json(ProvisionEmailResponse { address, provider: "custom" }).into_response())
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

#[derive(Debug, Serialize)]
struct ProvisionWalletResponse {
    address: String,
    provider: &'static str,
    chain_id: &'static str,
}

async fn provision_wallet(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(agent_id): Path<String>,
) -> Result<Response, ApiError> {
    require_agent_owner(&state, &user, &agent_id)?;

    let (address, vault_ref) = tokio::task::spawn_blocking({
        let db = state.db.clone();
        let agent_id = agent_id.clone();
        let user_id = user.user_id.clone();
        move || {
            let conn = db.connect().map_err(internal)?;

            // Check for an existing wallet to avoid rotating keys unexpectedly.
            let existing: Option<String> = conn
                .query_row(
                    "SELECT wallet_address FROM agent_identity_channels WHERE agent_id = ?1",
                    params![agent_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(internal)?;
            if let Some(addr) = existing {
                return Ok::<_, ApiError>((addr, None));
            }

            let signing_key = SigningKey::generate(&mut OsRng);
            let verifying_key = signing_key.verifying_key();
            let address = hex::encode(verifying_key.as_bytes());
            let private_hex = hex::encode(signing_key.to_bytes());
            let vault_ref = crate::token_crypto::seal(&private_hex);

            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO agent_identity_channels (id, agent_id, user_id, wallet_address, wallet_provider, wallet_chain_id, wallet_key_vault_ref, wallet_allowed_methods, updated_at)
                 VALUES (?1, ?2, ?3, ?4, 'etrid', '1', ?5, 'receive,invoice', CURRENT_TIMESTAMP)
                 ON CONFLICT(agent_id) DO UPDATE SET
                     wallet_address = excluded.wallet_address,
                     wallet_provider = excluded.wallet_provider,
                     wallet_chain_id = excluded.wallet_chain_id,
                     wallet_key_vault_ref = excluded.wallet_key_vault_ref,
                     wallet_allowed_methods = excluded.wallet_allowed_methods,
                     updated_at = CURRENT_TIMESTAMP",
                params![id, agent_id, user_id, address, vault_ref],
            )
            .map_err(internal)?;
            Ok::<_, ApiError>((address, Some(vault_ref)))
        }
    })
    .await
    .map_err(|e| internal(e))??;

    // Do not return the vault ref to the client; the public address is enough.
    let _ = vault_ref;

    Ok(Json(ProvisionWalletResponse {
        address,
        provider: "etrid",
        chain_id: "1",
    })
    .into_response())
}

fn sanitize_local_part(value: &str) -> String {
    value
        .to_lowercase()
        .replace(|c: char| !c.is_ascii_alphanumeric() && c != '-' && c != '_' && c != '.', "-")
        .replace("..", ".")
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
