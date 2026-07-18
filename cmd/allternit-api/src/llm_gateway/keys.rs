//! Virtual-key management API (Clerk-authenticated).
//!
//! Handlers for `/api/v1/gateway/keys*`. Plaintext keys are generated here,
//! shown exactly once in the create response, and never stored — only the
//! SHA-256 hex digest is persisted (same pattern as `api_keys`, V9).
//! List/update responses expose only the key prefix, never the hash.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Deserializer};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::AppState;

use super::auth::hash_key;

/// Characters of the plaintext key retained for identification ("ak-" + 9).
const KEY_PREFIX_LEN: usize = 12;

/// Generate `ak-` + 32 url-safe random chars. Entropy comes from two UUIDv4s
/// (CSPRNG-backed), keeping the dependency footprint to crates already in
/// this crate's tree.
fn generate_virtual_key() -> String {
    let mut bytes = [0u8; 24];
    bytes[..16].copy_from_slice(uuid::Uuid::new_v4().as_bytes());
    bytes[16..].copy_from_slice(&uuid::Uuid::new_v4().as_bytes()[..8]);
    format!("ak-{}", URL_SAFE_NO_PAD.encode(bytes))
}

fn bad_request(message: &str) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({"error": "invalid_request", "message": message})),
    )
}

fn internal_error(err: impl std::fmt::Display) -> (StatusCode, Json<serde_json::Value>) {
    warn!(error = %err, "gateway keys handler failed");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"error": "internal_error", "message": err.to_string()})),
    )
}

fn key_not_found() -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::NOT_FOUND,
        Json(json!({"error": "key_not_found", "message": "No such gateway key."})),
    )
}

/// Key row fields needed for ownership checks and updates.
struct KeyRow {
    user_id: String,
    tenant_id: Option<String>,
    name: Option<String>,
    monthly_budget_cents: Option<i64>,
    rate_limit_rpm: Option<i64>,
    allowed_models: Option<String>,
}

fn load_key(conn: &Connection, key_id: &str) -> rusqlite::Result<Option<KeyRow>> {
    conn.query_row(
        "SELECT user_id, tenant_id, name, monthly_budget_cents, rate_limit_rpm, allowed_models
         FROM llm_virtual_keys WHERE id = ?1",
        params![key_id],
        |row| {
            Ok(KeyRow {
                user_id: row.get(0)?,
                tenant_id: row.get(1)?,
                name: row.get(2)?,
                monthly_budget_cents: row.get(3)?,
                rate_limit_rpm: row.get(4)?,
                allowed_models: row.get(5)?,
            })
        },
    )
    .optional()
}

/// Owner check: the key's creator, or an owner/admin of the key's tenant
/// (mirrors the organization role check in usage_routes.rs). Invisible keys
/// report 404 rather than leaking existence.
fn authorize_key(
    conn: &Connection,
    user: &AuthUser,
    key_id: &str,
) -> Result<KeyRow, (StatusCode, Json<serde_json::Value>)> {
    let row = load_key(conn, key_id)
        .map_err(internal_error)?
        .ok_or_else(key_not_found)?;

    if row.user_id == user.user_id {
        return Ok(row);
    }

    if let (Some(tenant_id), Some(active_org)) = (&row.tenant_id, &user.organization_id) {
        if tenant_id == active_org {
            let role: Option<String> = conn
                .query_row(
                    "SELECT role FROM organization_members
                     WHERE organization_id = ?1 AND user_id = ?2",
                    params![tenant_id, user.user_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(internal_error)?;
            if matches!(role.as_deref(), Some("owner") | Some("admin")) {
                return Ok(row);
            }
        }
    }

    Err(key_not_found())
}

// ─── Create ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateKeyRequest {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub monthly_budget_cents: Option<i64>,
    #[serde(default)]
    pub rate_limit_rpm: Option<i64>,
    #[serde(default)]
    pub allowed_models: Option<Vec<String>>,
}

/// `POST /gateway/keys` — create a virtual key. The plaintext key is
/// returned once; only its SHA-256 hash is stored.
pub async fn create_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(payload): Json<CreateKeyRequest>,
) -> impl IntoResponse {
    if let Some(name) = &payload.name {
        if name.len() > 128 {
            return bad_request("`name` must be at most 128 characters.").into_response();
        }
    }
    if let Some(cents) = payload.monthly_budget_cents {
        if cents < 0 {
            return bad_request("`monthly_budget_cents` must be >= 0.").into_response();
        }
    }
    if let Some(rpm) = payload.rate_limit_rpm {
        if rpm < 1 {
            return bad_request("`rate_limit_rpm` must be >= 1.").into_response();
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let plaintext = generate_virtual_key();
    let key_prefix: String = plaintext.chars().take(KEY_PREFIX_LEN).collect();
    let key_hash = hash_key(&plaintext);
    let tenant_id = user.organization_id.clone().or(user.tenant_id.clone());
    let allowed_models_json = payload
        .allowed_models
        .as_ref()
        .and_then(|models| serde_json::to_string(models).ok());

    let db = state.db.clone();
    let row = (
        id.clone(),
        user.user_id.clone(),
        tenant_id.clone(),
        key_hash,
        key_prefix.clone(),
        payload.name.clone(),
        payload.monthly_budget_cents,
        payload.rate_limit_rpm,
        allowed_models_json,
    );
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO llm_virtual_keys
                 (id, user_id, tenant_id, key_hash, key_prefix, name,
                  monthly_budget_cents, rate_limit_rpm, allowed_models)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                row.0, row.1, row.2, row.3, row.4, row.5, row.6, row.7, row.8
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => (
            StatusCode::CREATED,
            Json(json!({
                "id": id,
                "name": payload.name,
                "key_prefix": key_prefix,
                "key": plaintext,
                "warning": "This is the only time the full key is shown. Store it securely; it cannot be recovered.",
                "monthly_budget_cents": payload.monthly_budget_cents,
                "rate_limit_rpm": payload.rate_limit_rpm,
                "allowed_models": payload.allowed_models,
                "created_at": chrono::Utc::now().to_rfc3339(),
            })),
        )
            .into_response(),
        Ok(Err(err)) => internal_error(err).into_response(),
        Err(err) => internal_error(err).into_response(),
    }
}

// ─── List ───────────────────────────────────────────────────────────────────

/// `GET /gateway/keys` — list the caller's keys (prefix only, never hashes).
pub async fn list_keys(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || -> rusqlite::Result<Vec<serde_json::Value>> {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, key_prefix, name, revoked, expires_at, last_used_at,
                    monthly_budget_cents, rate_limit_rpm, allowed_models, created_at
             FROM llm_virtual_keys
             WHERE user_id = ?1
             ORDER BY created_at DESC",
        )?;
        let rows = stmt
            .query_map(params![user.user_id], |row| {
                let allowed_models: Option<String> = row.get(8)?;
                Ok(json!({
                    "id": row.get::<_, String>(0)?,
                    "key_prefix": row.get::<_, Option<String>>(1)?,
                    "name": row.get::<_, Option<String>>(2)?,
                    "revoked": row.get::<_, i64>(3)? != 0,
                    "expires_at": row.get::<_, Option<String>>(4)?,
                    "last_used_at": row.get::<_, Option<String>>(5)?,
                    "monthly_budget_cents": row.get::<_, Option<i64>>(6)?,
                    "rate_limit_rpm": row.get::<_, Option<i64>>(7)?,
                    "allowed_models": allowed_models
                        .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok()),
                    "created_at": row.get::<_, Option<String>>(9)?,
                }))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    })
    .await;

    match result {
        Ok(Ok(keys)) => Json(json!({ "keys": keys })).into_response(),
        Ok(Err(err)) => internal_error(err).into_response(),
        Err(err) => internal_error(err).into_response(),
    }
}

// ─── Update ─────────────────────────────────────────────────────────────────

/// Distinguishes "field absent" (`None`) from "explicitly null"
/// (`Some(None)`) so nullable columns can be cleared via PATCH.
fn de_nullable<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Ok(Some(Option::<T>::deserialize(deserializer)?))
}

#[derive(Debug, Deserialize)]
pub struct UpdateKeyRequest {
    #[serde(default, deserialize_with = "de_nullable")]
    pub name: Option<Option<String>>,
    #[serde(default, deserialize_with = "de_nullable")]
    pub monthly_budget_cents: Option<Option<i64>>,
    #[serde(default, deserialize_with = "de_nullable")]
    pub rate_limit_rpm: Option<Option<i64>>,
    #[serde(default, deserialize_with = "de_nullable")]
    pub allowed_models: Option<Option<Vec<String>>>,
}

/// `PATCH /gateway/keys/:id` — update name, budget, rate limit, allowlist.
pub async fn update_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(key_id): Path<String>,
    Json(payload): Json<UpdateKeyRequest>,
) -> impl IntoResponse {
    if let Some(Some(name)) = &payload.name {
        if name.len() > 128 {
            return bad_request("`name` must be at most 128 characters.").into_response();
        }
    }
    if let Some(Some(cents)) = payload.monthly_budget_cents {
        if cents < 0 {
            return bad_request("`monthly_budget_cents` must be >= 0.").into_response();
        }
    }
    if let Some(Some(rpm)) = payload.rate_limit_rpm {
        if rpm < 1 {
            return bad_request("`rate_limit_rpm` must be >= 1.").into_response();
        }
    }

    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        let mut row = authorize_key(&conn, &user, &key_id)?;

        if let Some(name) = payload.name {
            row.name = name;
        }
        if let Some(cents) = payload.monthly_budget_cents {
            row.monthly_budget_cents = cents;
        }
        if let Some(rpm) = payload.rate_limit_rpm {
            row.rate_limit_rpm = rpm;
        }
        if let Some(models) = payload.allowed_models {
            row.allowed_models = models
                .as_ref()
                .and_then(|m| serde_json::to_string(m).ok());
        }

        conn.execute(
            "UPDATE llm_virtual_keys
             SET name = ?2, monthly_budget_cents = ?3, rate_limit_rpm = ?4,
                 allowed_models = ?5, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            params![
                key_id,
                row.name,
                row.monthly_budget_cents,
                row.rate_limit_rpm,
                row.allowed_models
            ],
        )
        .map_err(internal_error)?;

        Ok::<_, (StatusCode, Json<serde_json::Value>)>(json!({
            "id": key_id,
            "name": row.name,
            "monthly_budget_cents": row.monthly_budget_cents,
            "rate_limit_rpm": row.rate_limit_rpm,
            "allowed_models": row.allowed_models
                .and_then(|json| serde_json::from_str::<Vec<String>>(&json).ok()),
        }))
    })
    .await;

    match result {
        Ok(Ok(body)) => Json(body).into_response(),
        Ok(Err((status, body))) => (status, body).into_response(),
        Err(err) => internal_error(err).into_response(),
    }
}

// ─── Revoke ─────────────────────────────────────────────────────────────────

/// `DELETE /gateway/keys/:id` — revoke a key (idempotent).
pub async fn revoke_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(key_id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let key_id_for_task = key_id.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(internal_error)?;
        authorize_key(&conn, &user, &key_id_for_task)?;
        conn.execute(
            "UPDATE llm_virtual_keys
             SET revoked = 1, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            params![key_id_for_task],
        )
        .map_err(internal_error)?;
        Ok::<_, (StatusCode, Json<serde_json::Value>)>(())
    })
    .await;

    match result {
        Ok(Ok(())) => Json(json!({ "id": key_id, "revoked": true })).into_response(),
        Ok(Err((status, body))) => (status, body).into_response(),
        Err(err) => internal_error(err).into_response(),
    }
}
