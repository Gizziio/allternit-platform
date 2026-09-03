//! Passkey / WebAuthn support for the vault.
//!
//! Endpoints:
//!   POST /beta/vaults/:id/credentials/passkey/challenge/register
//!   POST /beta/vaults/:id/credentials/passkey/register
//!   POST /beta/vaults/:id/credentials/passkey/challenge/authenticate
//!   POST /beta/vaults/:id/credentials/passkey/authenticate
//!
//! The router is mounted under `/api/v1`, so handlers receive the shared
//! `Arc<AppState>` and pull `PasskeyState` from `state.passkey_state`. The
//! router is only mounted when passkey support is configured, so the inner
//! `PasskeyState` is guaranteed to be present at runtime.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Json, Response},
    routing::post,
    Router,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use uuid::Uuid;
use webauthn_rs::prelude::*;

use crate::{
    allternit_vault::{authorize, organization},
    auth::AuthUser,
    db::DbHandle,
    enterprise_auth::CredentialContext,
    AppState,
};

const CHALLENGE_TTL_SECONDS: u64 = 120;

#[derive(Clone)]
pub struct PasskeyState {
    webauthn: Arc<Webauthn>,
    challenges: Arc<Mutex<ChallengeStore>>,
    db: DbHandle,
}

#[derive(Default)]
struct ChallengeStore {
    registrations: std::collections::HashMap<String, (Uuid, PasskeyRegistration, String, Instant)>,
    authentications: std::collections::HashMap<String, (Uuid, PasskeyAuthentication, Instant)>,
}

impl ChallengeStore {
    fn prune(&mut self) {
        let cutoff = Instant::now() - Duration::from_secs(CHALLENGE_TTL_SECONDS);
        self.registrations.retain(|_, (_, _, _, t)| *t > cutoff);
        self.authentications.retain(|_, (_, _, t)| *t > cutoff);
    }
}

impl PasskeyState {
    pub fn new(rp_id: String, rp_origin: url::Url, db: DbHandle) -> Result<Self, WebauthnError> {
        let builder = WebauthnBuilder::new(&rp_id, &rp_origin)?.rp_name("Allternit");
        let webauthn = Arc::new(builder.build()?);
        Ok(Self {
            webauthn,
            challenges: Arc::new(Mutex::new(ChallengeStore::default())),
            db,
        })
    }
}

type ApiError = (StatusCode, Json<serde_json::Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (status, Json(json!({"error": code, "message": message.into()})))
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "passkey operation failed");
    error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

/// Build the passkey router. State is supplied by the caller through the
/// merged `/api/v1` router, so this function does not call `.with_state`.
pub fn passkey_router(_state: PasskeyState) -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/beta/vaults/:id/credentials/passkey/challenge/register",
            post(passkey_register_challenge),
        )
        .route(
            "/beta/vaults/:id/credentials/passkey/register",
            post(passkey_register_finish),
        )
        .route(
            "/beta/vaults/:id/credentials/passkey/challenge/authenticate",
            post(passkey_authenticate_challenge),
        )
        .route(
            "/beta/vaults/:id/credentials/passkey/authenticate",
            post(passkey_authenticate_finish),
        )
}

fn require_passkey_state(state: &AppState) -> Result<&PasskeyState, ApiError> {
    state
        .passkey_state
        .as_ref()
        .ok_or_else(|| error(StatusCode::SERVICE_UNAVAILABLE, "passkeys_unavailable", "Passkey support is not configured on this server."))
}

#[derive(Deserialize)]
struct RegisterChallengeRequest {
    provider: String,
}

#[derive(Serialize)]
struct RegisterChallengeResponse {
    challenge_id: String,
    options: CreationChallengeResponse,
}

#[derive(Serialize)]
struct AuthenticateChallengeResponse {
    challenge_id: String,
    options: RequestChallengeResponse,
}

async fn passkey_register_challenge(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path(id): Path<String>,
    Json(body): Json<RegisterChallengeRequest>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        axum::http::Method::POST,
        &format!("/api/v1/beta/vaults/{id}/credentials/passkey/challenge/register"),
    ) {
        return e.into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };

    let user_uuid = user_uuid(&user);
    let display_name = user
        .name
        .clone()
        .or_else(|| user.email.clone())
        .unwrap_or_else(|| user.user_id.clone());

    let result = tokio::task::spawn_blocking(move || {
        let passkey_state = match require_passkey_state(&state) {
            Ok(s) => s.clone(),
            Err(e) => return Err(e),
        };

        let conn = state.db.connect().map_err(internal)?;
        crate::allternit_vault::find_vault(&conn, &id, &org)?;

        let (challenge, reg_state) = passkey_state
            .webauthn
            .start_passkey_registration(user_uuid, &user.user_id, &display_name, None)
            .map_err(internal)?;

        let challenge_id = format!("pkc_{}", Uuid::new_v4().simple());
        {
            let mut store = passkey_state.challenges.lock().unwrap();
            store.prune();
            store.registrations.insert(
                challenge_id.clone(),
                (user_uuid, reg_state, body.provider.clone(), Instant::now()),
            );
        }

        Ok::<_, ApiError>(Json(RegisterChallengeResponse {
            challenge_id,
            options: challenge,
        }))
    })
    .await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct RegisterFinishRequest {
    challenge_id: String,
    provider: String,
    credential: RegisterPublicKeyCredential,
}

async fn passkey_register_finish(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path(id): Path<String>,
    Json(body): Json<RegisterFinishRequest>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        axum::http::Method::POST,
        &format!("/api/v1/beta/vaults/{id}/credentials/passkey/register"),
    ) {
        return e.into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };

    let challenge_id = body.challenge_id.clone();
    let (reg_state, provider) = {
        let passkey_state = match require_passkey_state(&state) {
            Ok(s) => s.clone(),
            Err(e) => return e.into_response(),
        };
        let mut store = passkey_state.challenges.lock().unwrap();
        store.prune();
        match store.registrations.remove(&challenge_id) {
            Some((_, reg, provider, _)) => (reg, provider),
            None => {
                return error(StatusCode::BAD_REQUEST, "challenge_not_found", "Challenge expired or invalid.").into_response();
            }
        }
    };

    let result = tokio::task::spawn_blocking(move || {
        let passkey_state = match require_passkey_state(&state) {
            Ok(s) => s.clone(),
            Err(e) => return Err(e),
        };

        let passkey = passkey_state
            .webauthn
            .finish_passkey_registration(&body.credential, &reg_state)
            .map_err(internal)?;

        let conn = state.db.connect().map_err(internal)?;
        crate::allternit_vault::find_vault(&conn, &id, &org)?;

        let credential_id = BASE64.encode(passkey.cred_id().to_vec());
        let passkey_json = serde_json::to_string(&passkey).map_err(internal)?;
        let vault_credential_id = format!("vc_{}", Uuid::new_v4().simple());

        // The legacy V37 CHECK constraint requires agent_id or session_id to be
        // non-NULL. Passkeys are vault-scoped, so we set session_id to the
        // unique credential_id to satisfy the constraint without changing the
        // table shape here.
        conn.execute(
            "INSERT INTO allternit_vault_credentials (id, vault_id, user_id, organization_id, credential_type, provider, credential_id, passkey_json, sign_count, session_id) VALUES (?1, ?2, ?3, ?4, 'passkey', ?5, ?6, ?7, 0, ?8)",
            rusqlite::params![
                vault_credential_id,
                id,
                user.user_id,
                org,
                provider,
                credential_id,
                passkey_json,
                credential_id,
            ],
        ).map_err(internal)?;

        Ok::<_, ApiError>(Json(json!({"id": vault_credential_id, "credential_id": credential_id, "provider": provider})))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct AuthenticateChallengeRequest {
    credential_id: Option<String>,
}

async fn passkey_authenticate_challenge(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path(id): Path<String>,
    Json(body): Json<AuthenticateChallengeRequest>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        axum::http::Method::POST,
        &format!("/api/v1/beta/vaults/{id}/credentials/passkey/challenge/authenticate"),
    ) {
        return e.into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };

    let result = tokio::task::spawn_blocking(move || {
        let passkey_state = match require_passkey_state(&state) {
            Ok(s) => s.clone(),
            Err(e) => return Err(e),
        };

        let conn = state.db.connect().map_err(internal)?;
        crate::allternit_vault::find_vault(&conn, &id, &org)?;

        let mut stmt = conn.prepare(
            "SELECT credential_id, passkey_json FROM allternit_vault_credentials WHERE vault_id = ?1 AND credential_type = 'passkey' AND revoked_at IS NULL ORDER BY created_at DESC"
        ).map_err(internal)?;
        let rows = stmt.query_map(rusqlite::params![id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).map_err(internal)?.collect::<rusqlite::Result<Vec<_>>>().map_err(internal)?;

        let passkeys: Vec<Passkey> = rows
            .iter()
            .filter_map(|(_, json)| serde_json::from_str::<Passkey>(json).ok())
            .collect();

        let allowed: Vec<Passkey> = if let Some(ref cid) = body.credential_id {
            passkeys
                .into_iter()
                .filter(|p| BASE64.encode(p.cred_id().to_vec()) == *cid)
                .collect()
        } else {
            passkeys
        };

        if allowed.is_empty() {
            return Err(error(StatusCode::NOT_FOUND, "no_passkeys", "No passkeys registered in this vault."));
        }

        let (challenge, auth_state) = passkey_state
            .webauthn
            .start_passkey_authentication(&allowed)
            .map_err(internal)?;

        let challenge_id = format!("pkc_{}", Uuid::new_v4().simple());
        {
            let mut store = passkey_state.challenges.lock().unwrap();
            store.prune();
            store.authentications.insert(challenge_id.clone(), (Uuid::nil(), auth_state, Instant::now()));
        }

        Ok::<_, ApiError>(Json(AuthenticateChallengeResponse {
            challenge_id,
            options: challenge,
        }))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct AuthenticateFinishRequest {
    challenge_id: String,
    credential: PublicKeyCredential,
}

async fn passkey_authenticate_finish(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    credential: Option<Extension<CredentialContext>>,
    Path(id): Path<String>,
    Json(body): Json<AuthenticateFinishRequest>,
) -> Response {
    if let Err(e) = authorize(
        credential.as_ref().map(|e| &e.0),
        axum::http::Method::POST,
        &format!("/api/v1/beta/vaults/{id}/credentials/passkey/authenticate"),
    ) {
        return e.into_response();
    }
    let org = match organization(&user) {
        Ok(org) => org,
        Err(e) => return e.into_response(),
    };

    let challenge_id = body.challenge_id.clone();
    let auth_state = {
        let passkey_state = match require_passkey_state(&state) {
            Ok(s) => s.clone(),
            Err(e) => return e.into_response(),
        };
        let mut store = passkey_state.challenges.lock().unwrap();
        store.prune();
        match store.authentications.remove(&challenge_id) {
            Some((_, auth, _)) => auth,
            None => {
                return error(StatusCode::BAD_REQUEST, "challenge_not_found", "Challenge expired or invalid.").into_response();
            }
        }
    };

    let result = tokio::task::spawn_blocking(move || {
        let passkey_state = match require_passkey_state(&state) {
            Ok(s) => s.clone(),
            Err(e) => return Err(e),
        };

        let conn = state.db.connect().map_err(internal)?;
        crate::allternit_vault::find_vault(&conn, &id, &org)?;

        let _auth_result = passkey_state
            .webauthn
            .finish_passkey_authentication(&body.credential, &auth_state)
            .map_err(internal)?;

        conn.execute(
            "UPDATE allternit_vault_credentials SET use_count = use_count + 1, last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE vault_id = ?1 AND credential_type = 'passkey'",
            rusqlite::params![id],
        ).map_err(internal)?;

        Ok::<_, ApiError>(Json(json!({"authenticated": true, "credential_id": body.credential.id})))
    }).await;

    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

/// Derive a stable UUID for WebAuthn from the Clerk user id. WebAuthn requires
/// a 16-byte user handle; if the user id is not already a UUID we hash it with
/// MD5 and embed the digest as a UUID.
fn user_uuid(user: &AuthUser) -> Uuid {
    match Uuid::parse_str(&user.user_id) {
        Ok(u) => u,
        Err(_) => {
            let digest = md5::compute(&user.user_id);
            Uuid::from_bytes(digest.into())
        }
    }
}
