//! Encrypted OAuth credentials and first-class organization vault resources.

use axum::{
    extract::{Extension, Path, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, db::DbHandle, enterprise_auth::CredentialContext, AppState};

#[derive(Clone)]
pub struct AllternitVault {
    db: DbHandle,
}

impl AllternitVault {
    pub fn new(db: DbHandle) -> Self {
        Self { db }
    }

    /// Legacy agent/session credential storage retained for existing callers.
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
            "INSERT INTO allternit_vault_credentials (id, user_id, organization_id, provider, agent_id, session_id, encrypted_value, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(user_id, provider, IFNULL(agent_id, ''), IFNULL(session_id, '')) WHERE vault_id IS NULL DO UPDATE SET organization_id = excluded.organization_id, encrypted_value = excluded.encrypted_value, expires_at = excluded.expires_at, revoked_at = NULL, updated_at = CURRENT_TIMESTAMP",
            params![id, user.user_id, user.organization_id, provider, agent_id, session_id, crate::token_crypto::seal(oauth_value), expires_at],
        )?;
        conn.query_row("SELECT id FROM allternit_vault_credentials WHERE vault_id IS NULL AND user_id = ?1 AND provider = ?2 AND agent_id IS ?3 AND session_id IS ?4", params![user.user_id, provider, agent_id, session_id], |row| row.get(0))
    }

    pub fn get(
        &self,
        user_id: &str,
        provider: &str,
        agent_id: Option<&str>,
        session_id: Option<&str>,
    ) -> rusqlite::Result<Option<String>> {
        let conn = self.db.connect()?;
        let sealed: Option<String> = conn.query_row("SELECT encrypted_value FROM allternit_vault_credentials WHERE vault_id IS NULL AND user_id = ?1 AND provider = ?2 AND agent_id IS ?3 AND session_id IS ?4 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)", params![user_id, provider, agent_id, session_id], |row| row.get(0)).optional()?;
        Ok(sealed
            .map(|value| crate::token_crypto::open(&value))
            .filter(|value| !value.is_empty()))
    }

    pub fn revoke(&self, user_id: &str, id: &str) -> rusqlite::Result<bool> {
        Ok(self.db.connect()?.execute("UPDATE allternit_vault_credentials SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND user_id = ?2 AND revoked_at IS NULL", params![id, user_id])? > 0)
    }
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/vault/credentials", post(put_legacy_credential))
        .route("/vault/credentials/:id", delete(revoke_legacy_credential))
        .route("/beta/vaults", post(create_vault).get(list_vaults))
        .route("/beta/vaults/:id", get(get_vault).delete(delete_vault))
        .route(
            "/beta/vaults/:id/credentials",
            post(put_vault_credential).get(list_vault_credentials),
        )
        .route(
            "/beta/vaults/:id/credentials/:credential_id",
            delete(delete_vault_credential),
        )
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
        "vault_error",
        error.to_string(),
    )
}

fn authorize(
    credential: Option<&CredentialContext>,
    method: Method,
    path: &str,
) -> Result<(), ApiError> {
    if credential.is_some_and(|ctx| !ctx.allows_request(&method, path)) {
        return Err(err(
            StatusCode::FORBIDDEN,
            "insufficient_scope",
            "Credential does not grant the required vault scope.",
        ));
    }
    Ok(())
}

fn organization(user: &AuthUser) -> Result<String, ApiError> {
    user.organization_id.clone().ok_or_else(|| {
        err(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })
}

fn vault_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(
        json!({"id": row.get::<_, String>(0)?, "name": row.get::<_, String>(1)?, "description": row.get::<_, Option<String>>(2)?, "created_by": row.get::<_, String>(3)?, "created_at": row.get::<_, String>(4)?, "updated_at": row.get::<_, String>(5)?}),
    )
}

#[derive(Deserialize)]
struct CreateVault {
    name: String,
    description: Option<String>,
}
async fn create_vault(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Json(body): Json<CreateVault>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        Method::POST,
        "/api/v1/beta/vaults",
    ) {
        return e.into_response();
    }
    if body.name.trim().is_empty() || body.name.len() > 128 {
        return err(
            StatusCode::BAD_REQUEST,
            "invalid_name",
            "Name must be 1-128 characters.",
        )
        .into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute("INSERT INTO allternit_vaults (id, organization_id, created_by, name, description) VALUES (?1, ?2, ?3, ?4, ?5)", params![id, org, user.user_id, body.name.trim(), body.description]).map_err(internal)?;
        Ok::<_, ApiError>(json!({"id": id, "name": body.name.trim(), "description": body.description}))
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn list_vaults(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        Method::GET,
        "/api/v1/beta/vaults",
    ) {
        return e.into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let mut stmt = conn.prepare("SELECT id, name, description, created_by, created_at, updated_at FROM allternit_vaults WHERE organization_id = ?1 ORDER BY created_at DESC").map_err(internal)?;
        let rows = stmt
            .query_map([org], vault_json)
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"vaults": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

fn find_vault(conn: &rusqlite::Connection, id: &str, org: &str) -> Result<Value, ApiError> {
    conn.query_row("SELECT id, name, description, created_by, created_at, updated_at FROM allternit_vaults WHERE id = ?1 AND organization_id = ?2", params![id, org], vault_json).optional().map_err(internal)?.ok_or_else(|| err(StatusCode::NOT_FOUND, "vault_not_found", "No such vault."))
}

async fn get_vault(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path(id): Path<String>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        Method::GET,
        &format!("/api/v1/beta/vaults/{id}"),
    ) {
        return e.into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };
    match tokio::task::spawn_blocking(move || {
        find_vault(&state.db.connect().map_err(internal)?, &id, &org)
    })
    .await
    {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_vault(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path(id): Path<String>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        Method::DELETE,
        &format!("/api/v1/beta/vaults/{id}"),
    ) {
        return e.into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };
    let result = tokio::task::spawn_blocking(move || {
        state
            .db
            .connect()
            .map_err(internal)?
            .execute(
                "DELETE FROM allternit_vaults WHERE id = ?1 AND organization_id = ?2",
                params![id, org],
            )
            .map_err(internal)
    })
    .await;
    match result {
        Ok(Ok(0)) => {
            err(StatusCode::NOT_FOUND, "vault_not_found", "No such vault.").into_response()
        }
        Ok(Ok(_)) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct PutCredential {
    provider: String,
    agent_id: Option<String>,
    session_id: Option<String>,
    oauth_value: String,
    expires_at: Option<String>,
}
fn valid_credential(body: &PutCredential) -> bool {
    !body.provider.trim().is_empty() && !body.oauth_value.is_empty()
}

async fn put_vault_credential(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path(id): Path<String>,
    Json(body): Json<PutCredential>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        Method::POST,
        &format!("/api/v1/beta/vaults/{id}/credentials"),
    ) {
        return e.into_response();
    }
    if !valid_credential(&body) {
        return err(
            StatusCode::BAD_REQUEST,
            "invalid_request",
            "provider and oauth_value are required.",
        )
        .into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?; find_vault(&conn, &id, &org)?;
        let credential_id = uuid::Uuid::new_v4().to_string();
        conn.execute("INSERT INTO allternit_vault_credentials (id, vault_id, user_id, organization_id, provider, agent_id, session_id, encrypted_value, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT(vault_id, provider, IFNULL(agent_id, ''), IFNULL(session_id, '')) WHERE vault_id IS NOT NULL DO UPDATE SET user_id = excluded.user_id, encrypted_value = excluded.encrypted_value, expires_at = excluded.expires_at, revoked_at = NULL, updated_at = CURRENT_TIMESTAMP", params![credential_id, id, user.user_id, org, body.provider.trim(), body.agent_id, body.session_id, crate::token_crypto::seal(&body.oauth_value), body.expires_at]).map_err(internal)?;
        let stored_id: String = conn.query_row("SELECT id FROM allternit_vault_credentials WHERE vault_id = ?1 AND provider = ?2 AND agent_id IS ?3 AND session_id IS ?4", params![id, body.provider.trim(), body.agent_id, body.session_id], |row| row.get(0)).map_err(internal)?;
        Ok::<_, ApiError>(json!({"id": stored_id, "vault_id": id, "provider": body.provider, "agent_id": body.agent_id, "session_id": body.session_id, "expires_at": body.expires_at}))
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn list_vault_credentials(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path(id): Path<String>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        Method::GET,
        &format!("/api/v1/beta/vaults/{id}/credentials"),
    ) {
        return e.into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?; find_vault(&conn, &id, &org)?;
        let mut stmt = conn.prepare("SELECT id, provider, agent_id, session_id, expires_at, created_at, updated_at FROM allternit_vault_credentials WHERE vault_id = ?1 AND revoked_at IS NULL ORDER BY created_at DESC").map_err(internal)?;
        let rows = stmt
            .query_map([id], |row| Ok(json!({"id": row.get::<_, String>(0)?, "provider": row.get::<_, String>(1)?, "agent_id": row.get::<_, Option<String>>(2)?, "session_id": row.get::<_, Option<String>>(3)?, "expires_at": row.get::<_, Option<String>>(4)?, "created_at": row.get::<_, String>(5)?, "updated_at": row.get::<_, String>(6)?})))
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"credentials": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_vault_credential(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path((id, credential_id)): Path<(String, String)>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        Method::DELETE,
        &format!("/api/v1/beta/vaults/{id}/credentials/{credential_id}"),
    ) {
        return e.into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?; find_vault(&conn, &id, &org)?;
        conn.execute("UPDATE allternit_vault_credentials SET revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND vault_id = ?2 AND revoked_at IS NULL", params![credential_id, id]).map_err(internal)
    }).await;
    match result {
        Ok(Ok(0)) => err(
            StatusCode::NOT_FOUND,
            "credential_not_found",
            "No such credential.",
        )
        .into_response(),
        Ok(Ok(_)) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn put_legacy_credential(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Json(body): Json<PutCredential>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        Method::POST,
        "/api/v1/vault/credentials",
    ) {
        return e.into_response();
    }
    if !valid_credential(&body) || (body.agent_id.is_none() && body.session_id.is_none()) {
        return err(
            StatusCode::BAD_REQUEST,
            "invalid_request",
            "provider, oauth_value, and an agent_id or session_id are required.",
        )
        .into_response();
    }
    let result = tokio::task::spawn_blocking(move || {
        let id = AllternitVault::new(state.db.clone()).put(&user, &body.provider, body.agent_id.as_deref(), body.session_id.as_deref(), &body.oauth_value, body.expires_at.as_deref())?;
        Ok::<_, rusqlite::Error>(json!({"id": id, "provider": body.provider, "agent_id": body.agent_id, "session_id": body.session_id, "expires_at": body.expires_at}))
    }).await;
    match result {
        Ok(Ok(value)) => (StatusCode::CREATED, Json(value)).into_response(),
        Ok(Err(e)) => internal(e).into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn revoke_legacy_credential(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path(id): Path<String>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        Method::DELETE,
        &format!("/api/v1/vault/credentials/{id}"),
    ) {
        return e.into_response();
    }
    match tokio::task::spawn_blocking(move || {
        AllternitVault::new(state.db.clone()).revoke(&user.user_id, &id)
    })
    .await
    {
        Ok(Ok(true)) => StatusCode::NO_CONTENT.into_response(),
        Ok(Ok(false)) => err(
            StatusCode::NOT_FOUND,
            "credential_not_found",
            "No such credential.",
        )
        .into_response(),
        Ok(Err(e)) => internal(e).into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn enterprise_vault_paths_require_vault_scopes() {
        let ctx = CredentialContext {
            credential_id: "1".into(),
            kind: "test",
            scopes: vec!["api:write".into()],
        };
        assert!(authorize(Some(&ctx), Method::POST, "/api/v1/beta/vaults").is_err());
    }
}
