//! Encrypted OAuth credential storage scoped to an agent and/or session.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::{auth::AuthUser, db::DbHandle, AppState};

#[derive(Clone)]
pub struct AllternitVault {
    db: DbHandle,
}

impl AllternitVault {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    pub fn put(
        &self,
        user: &AuthUser,
        provider: &str,
        agent_id: Option<&str>,
        session_id: Option<&str>,
        oauth_value: &str,
        expires_at: Option<&str>,
    ) -> rusqlite::Result<String> {
        let conn = self.db.connect()?;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO allternit_vault_credentials (id, user_id, organization_id, provider, agent_id, session_id, encrypted_value, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(user_id, provider, IFNULL(agent_id, ''), IFNULL(session_id, '')) DO UPDATE SET organization_id = excluded.organization_id, encrypted_value = excluded.encrypted_value, expires_at = excluded.expires_at, revoked_at = NULL, updated_at = CURRENT_TIMESTAMP",
            params![id, user.user_id, user.organization_id, provider, agent_id, session_id, crate::token_crypto::seal(oauth_value), expires_at],
        )?;
        conn.query_row(
            "SELECT id FROM allternit_vault_credentials WHERE user_id = ?1 AND provider = ?2 AND agent_id IS ?3 AND session_id IS ?4",
            params![user.user_id, provider, agent_id, session_id],
            |row| row.get(0),
        )
    }

    pub fn get(
        &self,
        user_id: &str,
        provider: &str,
        agent_id: Option<&str>,
        session_id: Option<&str>,
    ) -> rusqlite::Result<Option<String>> {
        let conn = self.db.connect()?;
        let sealed: Option<String> = conn.query_row(
            "SELECT encrypted_value FROM allternit_vault_credentials WHERE user_id = ?1 AND provider = ?2 AND agent_id IS ?3 AND session_id IS ?4 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
            params![user_id, provider, agent_id, session_id], |row| row.get(0),
        ).optional()?;
        Ok(sealed
            .map(|value| crate::token_crypto::open(&value))
            .filter(|value| !value.is_empty()))
    }

    pub fn revoke(&self, user_id: &str, id: &str) -> rusqlite::Result<bool> {
        let conn = self.db.connect()?;
        Ok(conn.execute("UPDATE allternit_vault_credentials SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND user_id = ?2 AND revoked_at IS NULL", params![id, user_id])? > 0)
    }
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/vault/credentials", post(put_credential))
        .route("/vault/credentials/:id", delete(revoke_credential))
}

#[derive(Deserialize)]
struct PutCredential {
    provider: String,
    agent_id: Option<String>,
    session_id: Option<String>,
    oauth_value: String,
    expires_at: Option<String>,
}

async fn put_credential(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<crate::enterprise_auth::CredentialContext>>,
    Json(body): Json<PutCredential>,
) -> Response {
    if let Some(Extension(ctx)) = credential {
        if !ctx.allows("vault:write") {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({"error": "insufficient_scope"})),
            )
                .into_response();
        }
    }
    if body.provider.trim().is_empty()
        || body.oauth_value.is_empty()
        || (body.agent_id.is_none() && body.session_id.is_none())
    {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid_request", "message": "provider, oauth_value, and an agent_id or session_id are required"}))).into_response();
    }
    let vault = AllternitVault::new(state.db.clone());
    let result = tokio::task::spawn_blocking(move || {
        let id = vault.put(&user, &body.provider, body.agent_id.as_deref(), body.session_id.as_deref(), &body.oauth_value, body.expires_at.as_deref())?;
        Ok::<_, rusqlite::Error>(json!({"id": id, "provider": body.provider, "agent_id": body.agent_id, "session_id": body.session_id, "expires_at": body.expires_at}))
    }).await;
    match result {
        Ok(Ok(value)) => (StatusCode::CREATED, Json(value)).into_response(),
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "vault_error", "message": e.to_string()})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "vault_error", "message": e.to_string()})),
        )
            .into_response(),
    }
}

async fn revoke_credential(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<crate::enterprise_auth::CredentialContext>>,
    Path(id): Path<String>,
) -> Response {
    if let Some(Extension(ctx)) = credential {
        if !ctx.allows("vault:write") {
            return (
                StatusCode::FORBIDDEN,
                Json(json!({"error": "insufficient_scope"})),
            )
                .into_response();
        }
    }
    let result = tokio::task::spawn_blocking(move || {
        AllternitVault::new(state.db.clone()).revoke(&user.user_id, &id)
    })
    .await;
    match result {
        Ok(Ok(true)) => StatusCode::NO_CONTENT.into_response(),
        Ok(Ok(false)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "credential_not_found"})),
        )
            .into_response(),
        Ok(Err(e)) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "vault_error", "message": e.to_string()})),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "vault_error", "message": e.to_string()})),
        )
            .into_response(),
    }
}
