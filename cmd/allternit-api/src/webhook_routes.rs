//! Clerk webhook handlers — sync user state from Clerk to local SQLite.
//!
//! Verifies Svix webhook signatures when `CLERK_WEBHOOK_SECRET` is configured.

use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Json, Router,
};
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

/// Verify Svix webhook signature.
/// Format: `v1,<base64_hmac>` where HMAC is computed over `${timestamp}.${body}`.
fn verify_svix_signature(
    secret: &str,
    headers: &HeaderMap,
    body: &[u8],
) -> Result<(), String> {
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
    let ts: i64 = svix_timestamp.parse().map_err(|_| "invalid svix-timestamp")?;
    if (now - ts).abs() > 300 {
        return Err("svix-timestamp outside tolerance (±5 min)".into());
    }

    // Compute HMAC-SHA256 over `${timestamp}.${body}`
    let signed_payload = format!("{svix_timestamp}.{}", String::from_utf8_lossy(body));
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| "invalid secret length")?;
    mac.update(signed_payload.as_bytes());
    let expected_sig = hex::encode(mac.finalize().into_bytes());

    // Svix sends signatures as `v1,<hex>` (can have multiple `v1,` entries for rolling secrets)
    let mut valid = false;
    for part in svix_signature.split(' ') {
        if let Some(sig) = part.strip_prefix("v1,") {
            if sig == expected_sig {
                valid = true;
                break;
            }
        }
    }
    if !valid {
        return Err("svix-signature mismatch".into());
    }

    // Prevent simple replays by checking svix-id (optional but recommended)
    // In a full implementation you'd cache seen svix-ids for ~5 minutes.
    // For now we just log it.
    info!("Svix webhook verified: id={svix_id} ts={svix_timestamp}");
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
    if let Some(ref secret) = state.webhook_secret {
        if let Err(e) = verify_svix_signature(secret, &headers, &body) {
            warn!("Clerk webhook signature verification failed: {e}");
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid_signature"})));
        }
    } else {
        warn!("Clerk webhook received without signature verification (CLERK_WEBHOOK_SECRET not set)");
    }

    let event: ClerkWebhookEvent = match serde_json::from_slice(&body) {
        Ok(e) => e,
        Err(e) => {
            warn!("Clerk webhook JSON parse error: {e}");
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid_json"})));
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("Clerk webhook task panicked: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
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
    if let Some(ref secret) = state.webhook_secret {
        if let Err(e) = verify_svix_signature(secret, &headers, &body) {
            warn!("Clerk webhook signature verification failed: {e}");
            return (StatusCode::UNAUTHORIZED, Json(json!({"error": "invalid_signature"})));
        }
    } else {
        warn!("Clerk webhook received without signature verification (CLERK_WEBHOOK_SECRET not set)");
    }

    let event: ClerkDeleteEvent = match serde_json::from_slice(&body) {
        Ok(e) => e,
        Err(e) => {
            warn!("Clerk webhook JSON parse error: {e}");
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "invalid_json"})));
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
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("Clerk webhook task panicked: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}
