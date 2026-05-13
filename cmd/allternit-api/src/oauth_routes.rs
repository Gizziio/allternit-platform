//! OAuth routes — authorization flow endpoints

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

use crate::AppState;
use crate::auth::get_user;

pub fn oauth_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/oauth/authorize", post(oauth_authorize))
        .route("/oauth/revoke-user", post(oauth_revoke_user))
}

#[derive(Deserialize)]
struct AuthorizeBody {
    client_id: String,
    redirect_uri: String,
    state: Option<String>,
    user_email: Option<String>,
    code_challenge: Option<String>,
    code_challenge_method: Option<String>,
}

async fn oauth_authorize(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(body): Json<AuthorizeBody>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))),
    };

    let code = uuid::Uuid::new_v4().to_string();
    let code2 = code.clone();
    let user_id = user.user_id;
    let client_id = body.client_id;
    let redirect_uri = body.redirect_uri;
    let state_val = body.state.unwrap_or_default();
    let state_val2 = state_val.clone();

    // Store authorization code in DB
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect()?;
        conn.execute(
            "INSERT INTO mcp_oauth_sessions (id, mcp_connector_id, state, code_verifier, client_info, tokens, metadata, is_authenticated)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)",
            rusqlite::params![
                &code2,
                &client_id,
                &state_val2,
                body.code_challenge,
                &user_id,
                "",
                serde_json::json!({
                    "redirect_uri": redirect_uri,
                    "user_email": body.user_email,
                    "code_challenge_method": body.code_challenge_method,
                    "created_at": chrono::Utc::now().to_rfc3339(),
                }).to_string(),
            ],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({
            "code": code,
            "state": state_val,
        }))),
        Ok(Err(e)) => {
            tracing::warn!("DB error storing OAuth code: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to generate authorization code"})))
        }
        Err(e) => {
            tracing::warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

#[derive(Deserialize)]
struct RevokeBody {
    #[serde(alias = "userId")]
    user_id: Option<String>,
}

async fn oauth_revoke_user(
    State(state): State<Arc<AppState>>,
    headers: axum::http::HeaderMap,
    Json(body): Json<RevokeBody>,
) -> impl IntoResponse {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return (StatusCode::UNAUTHORIZED, Json(json!({"error": "Unauthorized"}))),
    };

    let user_id = body.user_id.unwrap_or_else(|| user.user_id.clone());
    let target_user = user_id.clone();

    // Delete OAuth sessions for the user
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect()?;
        conn.execute(
            "DELETE FROM mcp_oauth_sessions WHERE client_info = ?1",
            [&target_user],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({"status": "ok", "revoked": true}))),
        Ok(Err(e)) => {
            tracing::warn!("DB error revoking OAuth sessions: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to revoke sessions"})))
        }
        Err(e) => {
            tracing::warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}
