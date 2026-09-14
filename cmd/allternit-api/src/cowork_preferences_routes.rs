//! Cowork Preference API routes
//!
//! Per-user Cowork preferences (`/cowork-preferences`): folders Cowork
//! agents may read/write, and free-form instructions applied to every
//! Cowork session. Mirrors agent_preferences_routes.rs's storage pattern.

use axum::{
    extract::{Extension, Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::AppState;

const MAX_TRUSTED_FOLDERS: usize = 50;
const MAX_INSTRUCTIONS_LEN: usize = 20_000;

pub fn cowork_preferences_router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/cowork-preferences",
        get(get_cowork_preferences).put(set_cowork_preferences),
    )
}

#[derive(Serialize)]
struct CoworkPreferencesPayload {
    trusted_folders: Vec<String>,
    global_instructions: String,
    cloud_continuation: bool,
    continuation_api_url: Option<String>,
    updated_at: String,
}

/// Whether the user opted into cloud continuation (laptop-closed handoff).
pub fn cloud_continuation_enabled(conn: &rusqlite::Connection, user_id: &str) -> bool {
    conn.query_row(
        "SELECT cloud_continuation FROM user_cowork_preferences WHERE user_id = ?1",
        params![user_id],
        |row| row.get::<_, i64>(0),
    )
    .ok()
    .map(|v| v != 0)
    .unwrap_or(false)
}

fn parse_trusted_folders(raw: &str) -> Vec<String> {
    serde_json::from_str(raw).unwrap_or_default()
}

// ─── GET /cowork-preferences ───────────────────────────────────────────────

async fn get_cowork_preferences(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let pref: (String, String, i64, Option<String>, String) = conn
            .query_row(
                "SELECT trusted_folders, global_instructions, cloud_continuation, continuation_api_url, updated_at
                 FROM user_cowork_preferences WHERE user_id = ?1",
                params![user_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .unwrap_or_else(|_| {
                (
                    "[]".to_string(),
                    String::new(),
                    0,
                    None,
                    chrono::Utc::now().to_rfc3339(),
                )
            });
        Ok::<_, rusqlite::Error>(pref)
    })
    .await;

    match result {
        Ok(Ok((trusted_folders_raw, global_instructions, cloud_continuation, continuation_api_url, updated_at))) => Json(
            CoworkPreferencesPayload {
                trusted_folders: parse_trusted_folders(&trusted_folders_raw),
                global_instructions,
                cloud_continuation: cloud_continuation != 0,
                continuation_api_url,
                updated_at,
            },
        )
        .into_response(),
        Ok(Err(e)) => {
            warn!("DB error reading cowork preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ─── PUT /cowork-preferences ────────────────────────────────────────────────

#[derive(Deserialize)]
struct SetCoworkPreferencesBody {
    trusted_folders: Option<Vec<String>>,
    global_instructions: Option<String>,
    cloud_continuation: Option<bool>,
    continuation_api_url: Option<String>,
}

fn validate_trusted_folders(folders: &[String]) -> Result<Vec<String>, String> {
    if folders.len() > MAX_TRUSTED_FOLDERS {
        return Err(format!("A maximum of {MAX_TRUSTED_FOLDERS} trusted folders is supported."));
    }
    let mut cleaned: Vec<String> = Vec::with_capacity(folders.len());
    for folder in folders {
        let trimmed = folder.trim();
        if trimmed.is_empty() {
            continue;
        }
        // Cowork agents run locally with the working directory passed straight
        // to the process spawner (see cowork.runtime.ts) — require an absolute
        // path so a relative entry can't silently resolve outside what the
        // user intended to trust.
        if !trimmed.starts_with('/') && !trimmed.get(1..3).is_some_and(|s| s == ":\\") {
            return Err(format!("\"{trimmed}\" is not an absolute path."));
        }
        if !cleaned.iter().any(|existing: &String| existing == trimmed) {
            cleaned.push(trimmed.to_string());
        }
    }
    Ok(cleaned)
}

async fn set_cowork_preferences(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<SetCoworkPreferencesBody>,
) -> impl IntoResponse {
    let trusted_folders = match body.trusted_folders {
        Some(folders) => match validate_trusted_folders(&folders) {
            Ok(cleaned) => Some(cleaned),
            Err(message) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "invalid_trusted_folders", "message": message })),
                )
                    .into_response();
            }
        },
        None => None,
    };

    if let Some(ref instructions) = body.global_instructions {
        if instructions.len() > MAX_INSTRUCTIONS_LEN {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({
                    "error": "instructions_too_long",
                    "message": format!("Global instructions must be under {MAX_INSTRUCTIONS_LEN} characters."),
                })),
            )
                .into_response();
        }
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let env_url = state.config.continuation_api_url();
    let env_token = state.config.continuation_token();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        // Merge with the existing row so omitted fields keep their values.
        let current: (String, String, i64, Option<String>) = conn
            .query_row(
                "SELECT trusted_folders, global_instructions, cloud_continuation, continuation_api_url
                 FROM user_cowork_preferences WHERE user_id = ?1",
                params![user_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap_or(("[]".to_string(), String::new(), 0, None));

        let trusted_folders = trusted_folders.unwrap_or_else(|| parse_trusted_folders(&current.0));
        let global_instructions = body.global_instructions.unwrap_or(current.1);
        let cloud_continuation = body
            .cloud_continuation
            .map(|v| if v { 1 } else { 0 })
            .unwrap_or(current.2);
        let continuation_api_url = body
            .continuation_api_url
            .map(|s| {
                let t = s.trim().trim_end_matches('/').to_string();
                if t.is_empty() { None } else { Some(t) }
            })
            .unwrap_or(current.3);
        let trusted_folders_raw =
            serde_json::to_string(&trusted_folders).unwrap_or_else(|_| "[]".to_string());

        if cloud_continuation != 0 {
            let has_url = env_url.is_some() || continuation_api_url.as_ref().is_some();
            let has_cloud_relay = std::env::var("ALLTERNIT_CLOUD_API_URL")
                .ok()
                .filter(|s| !s.is_empty())
                .is_some();
            if !has_url && !has_cloud_relay {
                return Err(rusqlite::Error::InvalidParameterName(
                    "cloud continuation needs a hosted/paired always-on node (api.allternit.com continuation/ensure) or ALLTERNIT_CONTINUATION_API_URL".into(),
                ));
            }
            let _ = env_token;
        }

        conn.execute(
            "INSERT INTO user_cowork_preferences (user_id, trusted_folders, global_instructions, cloud_continuation, continuation_api_url)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(user_id) DO UPDATE SET
                trusted_folders = excluded.trusted_folders,
                global_instructions = excluded.global_instructions,
                cloud_continuation = excluded.cloud_continuation,
                continuation_api_url = excluded.continuation_api_url,
                updated_at = CURRENT_TIMESTAMP",
            params![user_id, trusted_folders_raw, global_instructions, cloud_continuation, continuation_api_url],
        )?;

        let updated_at: String = conn.query_row(
            "SELECT updated_at FROM user_cowork_preferences WHERE user_id = ?1",
            params![user_id],
            |row| row.get(0),
        )?;

        Ok::<_, rusqlite::Error>(CoworkPreferencesPayload {
            trusted_folders,
            global_instructions,
            cloud_continuation: cloud_continuation != 0,
            continuation_api_url,
            updated_at,
        })
    })
    .await;

    match result {
        Ok(Ok(pref)) => Json(pref).into_response(),
        Ok(Err(e)) => {
            let message = e.to_string();
            if message.contains("cloud continuation needs") {
                return (
                    StatusCode::CONFLICT,
                    Json(json!({ "error": "continuation_unconfigured", "message": message })),
                )
                    .into_response();
            }
            warn!("DB error setting cowork preferences: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": message})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}
