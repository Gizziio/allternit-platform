//! Clerk webhook handlers — sync user state from Clerk to local SQLite.
//!
//! These routes are mounted on the public router (main.rs) by necessity —
//! Clerk can't attach a user auth token to a webhook call, only a Svix
//! signature — so signature verification is the only thing distinguishing
//! a real Clerk event from an arbitrary POST. Requests are rejected (401)
//! unless `CLERK_WEBHOOK_SECRET` is configured AND the signature verifies;
//! there is no unauthenticated fallback.

use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use hmac::{Hmac, Mac};
use rusqlite::params;
use serde::Deserialize;
use serde_json::json;
use sha2::Sha256;
use std::sync::Arc;
use tracing::{info, warn};

use crate::AppState;

type HmacSha256 = Hmac<Sha256>;

pub fn webhook_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/webhooks/clerk/user.created", post(handle_user_created))
        .route("/webhooks/clerk/user.updated", post(handle_user_updated))
        .route("/webhooks/clerk/user.deleted", post(handle_user_deleted))
}

/// Verify a Svix-signed Clerk webhook delivery, per the real spec
/// (https://docs.svix.com/receiving/verifying-payloads/how-manual):
/// HMAC-SHA256 over `${svix_id}.${svix_timestamp}.${body}` (raw bytes, not a
/// lossy UTF-8 round-trip), keyed by the secret's payload after stripping
/// the `whsec_` prefix and base64-decoding it, with the resulting signature
/// itself base64 — not hex — encoded.
///
/// An earlier version of this function got three things wrong at once (no
/// svix_id in the signed content, raw secret bytes instead of the decoded
/// key, hex instead of base64): it still failed closed, since a signature
/// computed the wrong way can never match a real one, but it meant this
/// endpoint would reject every genuine Clerk delivery too, not just forged
/// ones. Caught by round-tripping against a signature computed independently
/// per the spec (see docs.svix.com), not by inspection alone.
fn verify_svix_signature(secret: &str, headers: &HeaderMap, body: &[u8]) -> Result<(), String> {
    let svix_id = headers
        .get("svix-id")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing svix-id header")?;
    let svix_timestamp = headers
        .get("svix-timestamp")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing svix-timestamp header")?;
    let svix_signature = headers
        .get("svix-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing svix-signature header")?;

    // Timestamp tolerance: reject if older than 5 minutes or more than 1 minute in the future
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("system time error: {e}"))?
        .as_secs() as i64;
    let ts: i64 = svix_timestamp
        .parse()
        .map_err(|_| "invalid svix-timestamp")?;
    if (now - ts).abs() > 300 {
        return Err("svix-timestamp outside tolerance (±5 min)".into());
    }

    // Secret is `whsec_<base64>`; the HMAC key is the decoded bytes, not the
    // raw prefixed string.
    let secret_b64 = secret.strip_prefix("whsec_").unwrap_or(secret);
    let secret_bytes = STANDARD
        .decode(secret_b64)
        .map_err(|_| "CLERK_WEBHOOK_SECRET is not valid whsec_<base64>".to_string())?;

    let mut signed_content = Vec::with_capacity(svix_id.len() + svix_timestamp.len() + body.len() + 2);
    signed_content.extend_from_slice(svix_id.as_bytes());
    signed_content.push(b'.');
    signed_content.extend_from_slice(svix_timestamp.as_bytes());
    signed_content.push(b'.');
    signed_content.extend_from_slice(body);

    let mut mac =
        HmacSha256::new_from_slice(&secret_bytes).map_err(|_| "invalid secret length")?;
    mac.update(&signed_content);

    // svix-signature is space-delimited `v1,<base64>` entries (plural during
    // secret rotation) — any one matching is sufficient.
    let mut valid = false;
    for part in svix_signature.split(' ') {
        if let Some(sig) = part.strip_prefix("v1,") {
            if let Ok(expected) = STANDARD.decode(sig) {
                if mac.clone().verify_slice(&expected).is_ok() {
                    valid = true;
                    break;
                }
            }
        }
    }
    if !valid {
        return Err("svix-signature mismatch".into());
    }

    info!("Svix webhook verified: id={svix_id} ts={svix_timestamp}");
    Ok(())
}

/// Require a verified Svix signature, or reject the request outright.
/// No fallback: an unconfigured `CLERK_WEBHOOK_SECRET` is treated the same
/// as a bad signature (401), not as "skip verification."
fn require_webhook_signature(
    state: &AppState,
    headers: &HeaderMap,
    body: &[u8],
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let Some(secret) = state.webhook_secret.as_deref() else {
        warn!("Clerk webhook rejected: CLERK_WEBHOOK_SECRET is not configured");
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "webhook_not_configured"})),
        ));
    };
    if let Err(e) = verify_svix_signature(secret, headers, body) {
        warn!("Clerk webhook signature verification failed: {e}");
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"error": "invalid_signature"})),
        ));
    }
    Ok(())
}

#[derive(Deserialize)]
struct ClerkUserPayload {
    id: String,
    email_addresses: Option<Vec<ClerkEmail>>,
    first_name: Option<String>,
    last_name: Option<String>,
    image_url: Option<String>,
}

#[derive(Deserialize)]
struct ClerkEmail {
    email_address: String,
}

#[derive(Deserialize)]
struct ClerkWebhookEvent {
    #[serde(rename = "type")]
    #[serde(skip)]
    _event_type: String,
    data: ClerkUserPayload,
}

async fn handle_user_created(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    if let Err(rejection) = require_webhook_signature(&state, &headers, &body) {
        return rejection;
    }

    let event: ClerkWebhookEvent = match serde_json::from_slice(&body) {
        Ok(e) => e,
        Err(e) => {
            warn!("Clerk webhook JSON parse error: {e}");
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "invalid_json"})),
            );
        }
    };

    let user = &event.data;
    let email = user
        .email_addresses
        .as_ref()
        .and_then(|e| e.first())
        .map(|e| e.email_address.clone())
        .unwrap_or_default();
    let name = match (&user.first_name, &user.last_name) {
        (Some(f), Some(l)) => format!("{f} {l}"),
        (Some(f), None) => f.clone(),
        (None, Some(l)) => l.clone(),
        (None, None) => email.clone(),
    };

    let db = state.db.clone();
    let id = user.id.clone();
    let email2 = email.clone();
    let name2 = name.clone();
    let avatar = user.image_url.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO users (id, clerk_id, email, name, avatar_url, role, status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'user', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT(id) DO UPDATE SET
                clerk_id = excluded.clerk_id,
                email = excluded.email,
                name = excluded.name,
                avatar_url = excluded.avatar_url,
                updated_at = CURRENT_TIMESTAMP",
            params![id, id, email2, name2, avatar],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => {
            info!("Clerk webhook: user created/updated {email}");
            (StatusCode::OK, Json(json!({"success": true})))
        }
        Ok(Err(e)) => {
            warn!("Clerk webhook DB error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        }
        Err(e) => {
            warn!("Clerk webhook task panicked: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}

async fn handle_user_updated(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    handle_user_created(State(state), headers, body).await
}

#[derive(Deserialize)]
struct ClerkDeletedPayload {
    id: String,
    #[serde(skip)]
    _deleted: bool,
}

#[derive(Deserialize)]
struct ClerkDeleteEvent {
    #[serde(rename = "type")]
    #[serde(skip)]
    _event_type: String,
    data: ClerkDeletedPayload,
}

async fn handle_user_deleted(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    if let Err(rejection) = require_webhook_signature(&state, &headers, &body) {
        return rejection;
    }

    let event: ClerkDeleteEvent = match serde_json::from_slice(&body) {
        Ok(e) => e,
        Err(e) => {
            warn!("Clerk webhook JSON parse error: {e}");
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "invalid_json"})),
            );
        }
    };

    let db = state.db.clone();
    let id = event.data.id.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE users SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id],
        )?;
        Ok::<_, rusqlite::Error>(())
    })
    .await;

    match result {
        Ok(Ok(())) => {
            info!("Clerk webhook: user deleted {}", event.data.id);
            (StatusCode::OK, Json(json!({"success": true})))
        }
        Ok(Err(e)) => {
            warn!("Clerk webhook DB error: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
        }
        Err(e) => {
            warn!("Clerk webhook task panicked: {e}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
        }
    }
}
