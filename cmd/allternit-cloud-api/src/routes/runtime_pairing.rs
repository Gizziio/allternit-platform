//! First-party device pairing for Allternit desktop and VPS runtimes.
//!
//! The browser approval is authorized by Clerk. The paired runtime proves
//! possession of its Ed25519 private key and receives an independently
//! revocable device credential. Provider credentials are never handled here.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{DateTime, Duration, Utc};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use rand::{Rng, RngCore};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use std::sync::Arc;
use uuid::Uuid;

use crate::{auth::clerk, ApiError, ApiState};

const PAIRING_TTL_MINUTES: i64 = 10;
const CREDENTIAL_TTL_DAYS: i64 = 90;
const DEFAULT_CAPABILITIES: &[&str] = &[
    "runtime:connect",
    "runtime:execute",
    "runtime:files",
    "runtime:terminal",
    "providers:connect",
    "providers:use",
];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePairingRequest {
    name: String,
    runtime_type: String,
    hostname: Option<String>,
    platform: Option<String>,
    version: Option<String>,
    public_key: String,
    #[serde(default)]
    capabilities: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePairingResponse {
    pairing_id: String,
    device_code: String,
    user_code: String,
    challenge: String,
    verification_url: String,
    expires_at: DateTime<Utc>,
    poll_interval_seconds: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExchangePairingRequest {
    pairing_id: String,
    device_code: String,
    signature: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApprovePairingRequest {
    email: Option<String>,
    name: Option<String>,
    image_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSessionResponse {
    runtime_id: String,
    user_id: String,
    user_email: String,
    organization_id: Option<String>,
    device_token: String,
    token_type: &'static str,
    expires_at: DateTime<Utc>,
    capabilities: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PairingInfoResponse {
    pairing_id: String,
    user_code: String,
    name: String,
    runtime_type: String,
    hostname: Option<String>,
    platform: Option<String>,
    public_key_fingerprint: String,
    capabilities: Vec<String>,
    status: String,
    expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
struct RuntimeDeviceView {
    id: String,
    name: String,
    runtime_type: String,
    hostname: Option<String>,
    platform: Option<String>,
    version: Option<String>,
    capabilities: String,
    public_key_fingerprint: String,
    status: String,
    last_seen_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    credential_expires_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct PairingRow {
    id: String,
    user_code: String,
    challenge: String,
    public_key: String,
    public_key_fingerprint: String,
    name: String,
    runtime_type: String,
    hostname: Option<String>,
    platform: Option<String>,
    version: Option<String>,
    capabilities: String,
    status: String,
    user_id: Option<String>,
    organization_id: Option<String>,
    expires_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct RuntimeCredentialRow {
    id: String,
    user_id: String,
    credential_expires_at: DateTime<Utc>,
    status: String,
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route("/api/v1/runtime-pairings", post(create_pairing))
        .route("/api/v1/runtime-pairings/exchange", post(exchange_pairing))
        .route("/api/v1/runtime-pairings/code/:code", get(pairing_info))
        .route(
            "/api/v1/runtime-pairings/code/:code/approve",
            post(approve_pairing),
        )
        .route(
            "/api/v1/runtime-pairings/code/:code/deny",
            post(deny_pairing),
        )
        .route("/api/v1/runtime-devices", get(list_runtime_devices))
        .route("/api/v1/runtime-devices/:id", delete(revoke_runtime_device))
        .route(
            "/api/v1/runtime-devices/:id/heartbeat",
            post(runtime_heartbeat),
        )
        .route(
            "/api/v1/runtime-devices/:id/rotate",
            post(rotate_runtime_credential),
        )
        .route("/api/v1/runtime-devices/:id/revoke-self", post(revoke_self))
}

async fn create_pairing(
    State(state): State<Arc<ApiState>>,
    Json(request): Json<CreatePairingRequest>,
) -> Result<(StatusCode, Json<CreatePairingResponse>), ApiError> {
    validate_pairing_request(&request)?;

    let pairing_id = Uuid::new_v4().to_string();
    let device_code = random_secret(32);
    let user_code = generate_user_code();
    let challenge = random_secret(32);
    let device_code_hash = sha256_hex(device_code.as_bytes());
    let public_key_bytes = decode_public_key(&request.public_key)?;
    let public_key_fingerprint = sha256_hex(&public_key_bytes);
    let capabilities = normalized_capabilities(request.capabilities)?;
    let capabilities_json = serde_json::to_string(&capabilities)?;
    let expires_at = Utc::now() + Duration::minutes(PAIRING_TTL_MINUTES);

    sqlx::query(
        r#"
        INSERT INTO runtime_pairings (
            id, device_code_hash, user_code, challenge, public_key,
            public_key_fingerprint, name, runtime_type, hostname, platform,
            version, capabilities, status, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        "#,
    )
    .bind(&pairing_id)
    .bind(device_code_hash)
    .bind(&user_code)
    .bind(&challenge)
    .bind(&request.public_key)
    .bind(public_key_fingerprint)
    .bind(request.name.trim())
    .bind(&request.runtime_type)
    .bind(request.hostname.as_deref())
    .bind(request.platform.as_deref())
    .bind(request.version.as_deref())
    .bind(capabilities_json)
    .bind(expires_at)
    .execute(&state.db)
    .await?;

    let platform_url = std::env::var("ALLTERNIT_PLATFORM_URL")
        .unwrap_or_else(|_| "https://platform.allternit.com".to_string());
    let verification_url = format!(
        "{}/pair?code={}",
        platform_url.trim_end_matches('/'),
        user_code
    );

    Ok((
        StatusCode::CREATED,
        Json(CreatePairingResponse {
            pairing_id,
            device_code,
            user_code,
            challenge,
            verification_url,
            expires_at,
            poll_interval_seconds: 2,
        }),
    ))
}

async fn pairing_info(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> Result<Json<PairingInfoResponse>, ApiError> {
    let _user = clerk::user_from_headers(&headers).await?;
    let pairing = pairing_by_code(&state, &normalize_user_code(&code)).await?;
    ensure_pairing_live(&state, &pairing).await?;
    Ok(Json(pairing_info_response(pairing)))
}

async fn approve_pairing(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(code): Path<String>,
    profile: Option<Json<ApprovePairingRequest>>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let profile = profile.map(|Json(value)| value).unwrap_or_default();
    let user = clerk::user_from_headers(&headers).await?;
    let pairing = pairing_by_code(&state, &normalize_user_code(&code)).await?;
    ensure_pairing_live(&state, &pairing).await?;
    if pairing.status == "approved" {
        if pairing.user_id.as_deref() != Some(user.id.as_str()) {
            return Err(ApiError::Forbidden(
                "This pairing request was approved by another account".to_string(),
            ));
        }
        let callback_url = format!("allternit://pairing/complete?pairing_id={}", pairing.id);
        return Ok(Json(serde_json::json!({
            "status": "approved",
            "pairingId": pairing.id,
            "runtimeName": pairing.name,
            "desktopCallbackUrl": callback_url,
        })));
    }
    if pairing.status != "pending" {
        return Err(ApiError::BadRequest(
            "This pairing request cannot be approved".to_string(),
        ));
    }

    // Ensure the user has a quota row and enforce guardrails before approval.
    let quota = state.quota_service.ensure_quota(&user.id).await?;
    state
        .quota_service
        .check_spend_cap(&user.id, &quota)
        .await?;
    state
        .quota_service
        .record_pairing_approved(&user.id)
        .await?;

    let email = user
        .email
        .clone()
        .or_else(|| profile.email.filter(|value| value.contains('@')))
        .unwrap_or_else(|| format!("{}@users.allternit.local", user.id));
    let name = user.name.as_deref().or(profile.name.as_deref());
    let image_url = user.image_url.as_deref().or(profile.image_url.as_deref());
    sqlx::query(
        r#"
        INSERT INTO users (id, email, name, avatar_url, status, last_login_at)
        VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            email = excluded.email,
            name = COALESCE(excluded.name, users.name),
            avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
            status = 'active',
            last_login_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(&user.id)
    .bind(&email)
    .bind(name)
    .bind(image_url)
    .execute(&state.db)
    .await?;

    sqlx::query(
        r#"
        UPDATE runtime_pairings
        SET status = 'approved', user_id = ?, organization_id = ?, approved_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'pending'
        "#,
    )
    .bind(&user.id)
    .bind(user.organization_id.as_deref())
    .bind(&pairing.id)
    .execute(&state.db)
    .await?;

    let callback_url = format!("allternit://pairing/complete?pairing_id={}", pairing.id);
    Ok(Json(serde_json::json!({
        "status": "approved",
        "pairingId": pairing.id,
        "runtimeName": pairing.name,
        "desktopCallbackUrl": callback_url,
    })))
}

async fn deny_pairing(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(code): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let _user = clerk::user_from_headers(&headers).await?;
    let code = normalize_user_code(&code);
    let affected = sqlx::query(
        "UPDATE runtime_pairings SET status = 'denied' WHERE user_code = ? AND status = 'pending'",
    )
    .bind(code)
    .execute(&state.db)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(ApiError::NotFound("Pairing request not found".to_string()));
    }
    Ok(Json(serde_json::json!({ "status": "denied" })))
}

async fn exchange_pairing(
    State(state): State<Arc<ApiState>>,
    Json(request): Json<ExchangePairingRequest>,
) -> Result<Response, ApiError> {
    let pairing = sqlx::query_as::<_, PairingRow>(
        r#"
        SELECT id, user_code, challenge, public_key, public_key_fingerprint,
               name, runtime_type, hostname, platform, version, capabilities,
               status, user_id, organization_id, expires_at
        FROM runtime_pairings
        WHERE id = ? AND device_code_hash = ?
        "#,
    )
    .bind(&request.pairing_id)
    .bind(sha256_hex(request.device_code.as_bytes()))
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::Unauthorized("Invalid pairing credentials".to_string()))?;

    if pairing.expires_at <= Utc::now() {
        sqlx::query("UPDATE runtime_pairings SET status = 'expired' WHERE id = ?")
            .bind(&pairing.id)
            .execute(&state.db)
            .await?;
        return Ok((
            StatusCode::GONE,
            Json(serde_json::json!({ "error": "expired_token", "status": "expired" })),
        )
            .into_response());
    }

    match pairing.status.as_str() {
        "pending" => {
            return Ok((
                StatusCode::PRECONDITION_REQUIRED,
                Json(serde_json::json!({
                    "error": "authorization_pending",
                    "status": "pending"
                })),
            )
                .into_response());
        }
        "denied" => {
            return Ok((
                StatusCode::FORBIDDEN,
                Json(serde_json::json!({ "error": "access_denied", "status": "denied" })),
            )
                .into_response());
        }
        "approved" => {}
        _ => {
            return Err(ApiError::BadRequest(
                "Pairing request has already been consumed".to_string(),
            ));
        }
    }

    verify_pairing_signature(&pairing, &request.signature)?;
    let user_id = pairing
        .user_id
        .clone()
        .ok_or_else(|| ApiError::Internal("Approved pairing has no user".to_string()))?;

    // Enforce quotas before creating the device row.
    let quota = state.quota_service.ensure_quota(&user_id).await?;
    state
        .quota_service
        .check_active_device_cap(&user_id, &quota)
        .await?;
    state
        .quota_service
        .record_pairing_created(&user_id, &quota)
        .await?;

    let runtime_id = format!("rt_{}", Uuid::new_v4().simple());
    let device_token = format!("allternit_runtime_{}", random_secret(48));
    let credential_hash = sha256_hex(device_token.as_bytes());
    let credential_expires_at = Utc::now() + Duration::days(CREDENTIAL_TTL_DAYS);

    let mut transaction = state.db.begin().await?;
    sqlx::query(
        r#"
        INSERT INTO runtime_devices (
            id, user_id, organization_id, name, runtime_type, hostname, platform,
            version, capabilities, public_key, public_key_fingerprint,
            credential_hash, credential_expires_at, status, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', CURRENT_TIMESTAMP)
        "#,
    )
    .bind(&runtime_id)
    .bind(&user_id)
    .bind(pairing.organization_id.as_deref())
    .bind(&pairing.name)
    .bind(&pairing.runtime_type)
    .bind(pairing.hostname.as_deref())
    .bind(pairing.platform.as_deref())
    .bind(pairing.version.as_deref())
    .bind(&pairing.capabilities)
    .bind(&pairing.public_key)
    .bind(&pairing.public_key_fingerprint)
    .bind(credential_hash)
    .bind(credential_expires_at)
    .execute(&mut *transaction)
    .await?;
    let consumed = sqlx::query(
        r#"
        UPDATE runtime_pairings
        SET status = 'consumed', runtime_id = ?, consumed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'approved'
        "#,
    )
    .bind(&runtime_id)
    .bind(&pairing.id)
    .execute(&mut *transaction)
    .await?
    .rows_affected();
    if consumed != 1 {
        transaction.rollback().await?;
        return Err(ApiError::BadRequest(
            "Pairing request was already consumed".to_string(),
        ));
    }
    transaction.commit().await?;

    let user_email = sqlx::query_scalar::<_, String>("SELECT email FROM users WHERE id = ?")
        .bind(&user_id)
        .fetch_one(&state.db)
        .await?;
    let capabilities = serde_json::from_str(&pairing.capabilities).unwrap_or_default();
    Ok(Json(RuntimeSessionResponse {
        runtime_id,
        user_id,
        user_email,
        organization_id: pairing.organization_id,
        device_token,
        token_type: "Bearer",
        expires_at: credential_expires_at,
        capabilities,
    })
    .into_response())
}

async fn list_runtime_devices(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let devices = sqlx::query_as::<_, RuntimeDeviceView>(
        r#"
        SELECT id, name, runtime_type, hostname, platform, version, capabilities,
               public_key_fingerprint, status, last_seen_at, created_at,
               credential_expires_at
        FROM runtime_devices
        WHERE user_id = ? AND revoked_at IS NULL
        ORDER BY created_at DESC
        "#,
    )
    .bind(&user.id)
    .fetch_all(&state.db)
    .await?;
    let devices = devices
        .into_iter()
        .map(|device| {
            let effective_status = if device.status == "online"
                && device.last_seen_at
                    .map(|seen| seen < Utc::now() - Duration::minutes(2))
                    .unwrap_or(true)
            {
                "offline".to_string()
            } else {
                device.status.clone()
            };
            serde_json::json!({
                "id": device.id,
                "name": device.name,
                "runtimeType": device.runtime_type,
                "hostname": device.hostname,
                "platform": device.platform,
                "version": device.version,
                "capabilities": serde_json::from_str::<Vec<String>>(&device.capabilities).unwrap_or_default(),
                "publicKeyFingerprint": device.public_key_fingerprint,
                "status": effective_status,
                "lastSeenAt": device.last_seen_at,
                "createdAt": device.created_at,
                "credentialExpiresAt": device.credential_expires_at,
            })
        })
        .collect::<Vec<_>>();
    Ok(Json(serde_json::json!({ "runtimes": devices })))
}

async fn revoke_runtime_device(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user = clerk::user_from_headers(&headers).await?;
    let affected = sqlx::query(
        r#"
        UPDATE runtime_devices
        SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ? AND revoked_at IS NULL
        "#,
    )
    .bind(&id)
    .bind(&user.id)
    .execute(&state.db)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(ApiError::NotFound("Runtime not found".to_string()));
    }
    Ok(Json(serde_json::json!({ "id": id, "status": "revoked" })))
}

async fn runtime_heartbeat(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let runtime = authenticate_runtime(&state, &headers, &id).await?;
    sqlx::query(
        "UPDATE runtime_devices SET status = 'online', last_seen_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&runtime.id)
    .execute(&state.db)
    .await?;
    Ok(Json(serde_json::json!({
        "runtimeId": runtime.id,
        "userId": runtime.user_id,
        "status": "online",
        "serverTime": Utc::now(),
    })))
}

async fn rotate_runtime_credential(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let runtime = authenticate_runtime(&state, &headers, &id).await?;
    let device_token = format!("allternit_runtime_{}", random_secret(48));
    let expires_at = Utc::now() + Duration::days(CREDENTIAL_TTL_DAYS);
    sqlx::query(
        "UPDATE runtime_devices SET credential_hash = ?, credential_expires_at = ?, last_seen_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(sha256_hex(device_token.as_bytes()))
    .bind(expires_at)
    .bind(&runtime.id)
    .execute(&state.db)
    .await?;
    Ok(Json(serde_json::json!({
        "runtimeId": runtime.id,
        "deviceToken": device_token,
        "tokenType": "Bearer",
        "expiresAt": expires_at,
    })))
}

async fn revoke_self(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let runtime = authenticate_runtime(&state, &headers, &id).await?;
    sqlx::query(
        "UPDATE runtime_devices SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
    .bind(&runtime.id)
    .execute(&state.db)
    .await?;
    Ok(Json(
        serde_json::json!({ "runtimeId": runtime.id, "status": "revoked" }),
    ))
}

async fn authenticate_runtime(
    state: &ApiState,
    headers: &HeaderMap,
    expected_id: &str,
) -> Result<RuntimeCredentialRow, ApiError> {
    let token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .filter(|value| value.starts_with("allternit_runtime_"))
        .ok_or_else(|| ApiError::Unauthorized("Runtime credential required".to_string()))?;
    let runtime = sqlx::query_as::<_, RuntimeCredentialRow>(
        r#"
        SELECT id, user_id, credential_expires_at, status
        FROM runtime_devices
        WHERE credential_hash = ? AND id = ? AND revoked_at IS NULL
        "#,
    )
    .bind(sha256_hex(token.as_bytes()))
    .bind(expected_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::Unauthorized("Invalid runtime credential".to_string()))?;
    if runtime.credential_expires_at <= Utc::now() {
        return Err(ApiError::TokenExpired(
            "Runtime credential expired".to_string(),
        ));
    }
    if runtime.status == "revoked" {
        return Err(ApiError::Unauthorized(
            "Runtime has been revoked".to_string(),
        ));
    }
    Ok(runtime)
}

pub(crate) async fn authenticate_runtime_token(
    state: &ApiState,
    token: &str,
    expected_id: &str,
) -> Result<String, ApiError> {
    let mut headers = HeaderMap::new();
    let value = format!("Bearer {token}")
        .parse()
        .map_err(|_| ApiError::Unauthorized("Invalid runtime credential".to_string()))?;
    headers.insert(axum::http::header::AUTHORIZATION, value);
    Ok(authenticate_runtime(state, &headers, expected_id)
        .await?
        .user_id)
}

async fn pairing_by_code(state: &ApiState, code: &str) -> Result<PairingRow, ApiError> {
    sqlx::query_as::<_, PairingRow>(
        r#"
        SELECT id, user_code, challenge, public_key, public_key_fingerprint,
               name, runtime_type, hostname, platform, version, capabilities,
               status, user_id, organization_id, expires_at
        FROM runtime_pairings WHERE user_code = ?
        "#,
    )
    .bind(code)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| ApiError::NotFound("Pairing request not found".to_string()))
}

async fn ensure_pairing_live(state: &ApiState, pairing: &PairingRow) -> Result<(), ApiError> {
    if pairing.expires_at > Utc::now() {
        return Ok(());
    }
    sqlx::query("UPDATE runtime_pairings SET status = 'expired' WHERE id = ?")
        .bind(&pairing.id)
        .execute(&state.db)
        .await?;
    Err(ApiError::TokenExpired(
        "Pairing request expired".to_string(),
    ))
}

fn pairing_info_response(pairing: PairingRow) -> PairingInfoResponse {
    PairingInfoResponse {
        pairing_id: pairing.id,
        user_code: pairing.user_code,
        name: pairing.name,
        runtime_type: pairing.runtime_type,
        hostname: pairing.hostname,
        platform: pairing.platform,
        public_key_fingerprint: pairing.public_key_fingerprint,
        capabilities: serde_json::from_str(&pairing.capabilities).unwrap_or_default(),
        status: pairing.status,
        expires_at: pairing.expires_at,
    }
}

fn verify_pairing_signature(pairing: &PairingRow, signature: &str) -> Result<(), ApiError> {
    let key_bytes = decode_public_key(&pairing.public_key)?;
    let key_array: [u8; 32] = key_bytes
        .try_into()
        .map_err(|_| ApiError::BadRequest("Runtime public key must be 32 bytes".to_string()))?;
    let verifying_key = VerifyingKey::from_bytes(&key_array)
        .map_err(|_| ApiError::BadRequest("Invalid runtime public key".to_string()))?;
    let signature_bytes = URL_SAFE_NO_PAD
        .decode(signature)
        .map_err(|_| ApiError::Unauthorized("Invalid pairing signature".to_string()))?;
    let signature_array: [u8; 64] = signature_bytes
        .try_into()
        .map_err(|_| ApiError::Unauthorized("Invalid pairing signature".to_string()))?;
    let signature = Signature::from_bytes(&signature_array);
    let message = pairing_signature_message(&pairing.id, &pairing.challenge);
    verifying_key
        .verify(message.as_bytes(), &signature)
        .map_err(|_| ApiError::Unauthorized("Runtime proof of possession failed".to_string()))
}

fn validate_pairing_request(request: &CreatePairingRequest) -> Result<(), ApiError> {
    if request.name.trim().is_empty() || request.name.len() > 100 {
        return Err(ApiError::BadRequest(
            "Runtime name must be 1-100 characters".to_string(),
        ));
    }
    if request.runtime_type != "desktop" && request.runtime_type != "vps" {
        return Err(ApiError::BadRequest(
            "runtimeType must be desktop or vps".to_string(),
        ));
    }
    decode_public_key(&request.public_key)?;
    Ok(())
}

fn normalized_capabilities(requested: Vec<String>) -> Result<Vec<String>, ApiError> {
    if requested.is_empty() {
        return Ok(DEFAULT_CAPABILITIES
            .iter()
            .map(|value| value.to_string())
            .collect());
    }
    if requested
        .iter()
        .any(|capability| !DEFAULT_CAPABILITIES.contains(&capability.as_str()))
    {
        return Err(ApiError::BadRequest(
            "Unknown runtime capability requested".to_string(),
        ));
    }
    if !requested
        .iter()
        .any(|capability| capability == "runtime:connect")
    {
        return Err(ApiError::BadRequest(
            "runtime:connect is required for every paired runtime".to_string(),
        ));
    }
    let mut capabilities = requested;
    capabilities.sort();
    capabilities.dedup();
    Ok(capabilities)
}

fn decode_public_key(value: &str) -> Result<Vec<u8>, ApiError> {
    let bytes = URL_SAFE_NO_PAD
        .decode(value)
        .map_err(|_| ApiError::BadRequest("publicKey must use base64url encoding".to_string()))?;
    if bytes.len() != 32 {
        return Err(ApiError::BadRequest(
            "Ed25519 publicKey must be 32 bytes".to_string(),
        ));
    }
    Ok(bytes)
}

fn pairing_signature_message(pairing_id: &str, challenge: &str) -> String {
    format!("allternit-runtime-pairing:{pairing_id}:{challenge}")
}

fn normalize_user_code(value: &str) -> String {
    let compact = value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .map(|character| character.to_ascii_uppercase())
        .take(8)
        .collect::<String>();
    if compact.len() == 8 {
        format!("{}-{}", &compact[..4], &compact[4..])
    } else {
        compact
    }
}

fn generate_user_code() -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    let mut group = || {
        (0..4)
            .map(|_| ALPHABET[rng.gen_range(0..ALPHABET.len())] as char)
            .collect::<String>()
    };
    format!("{}-{}", group(), group())
}

fn random_secret(bytes: usize) -> String {
    let mut data = vec![0_u8; bytes];
    rand::thread_rng().fill_bytes(&mut data);
    URL_SAFE_NO_PAD.encode(data)
}

fn sha256_hex(value: &[u8]) -> String {
    hex::encode(Sha256::digest(value))
}
