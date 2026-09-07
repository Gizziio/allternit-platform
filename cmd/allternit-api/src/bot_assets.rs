//! Bot avatar asset endpoints
//!
//! Stores per-bot avatar assets (the surface `BotAvatar` zod union:
//! `{type: geometric|pet|image, data: {...}}`) as JSON on disk so mail/inbox
//! surfaces can show real bot profile pictures. Files live under
//! `~/.allternit/bot-assets/<bot_id>.json`.
//!
//! Mounted at `/api` (routes: `POST /api/bots/:id/avatar`,
//! `GET /api/bots/:id/avatar`).

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;

const VALID_AVATAR_TYPES: [&str; 3] = ["geometric", "pet", "image"];

pub fn bot_assets_router() -> Router<Arc<AppState>> {
    Router::new().route("/bots/:id/avatar", get(get_bot_avatar).post(save_bot_avatar))
}

#[derive(Deserialize)]
struct AvatarUpsertPayload {
    #[serde(rename = "type")]
    kind: String,
    data: Value,
}

#[derive(Serialize)]
struct AvatarStoredPayload {
    #[serde(rename = "type")]
    kind: String,
    data: Value,
}

fn avatar_store_path(id: &str) -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".allternit")
        .join("bot-assets")
        .join(format!("{id}.json"))
}

fn is_safe_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && !id.contains('/')
        && !id.contains('\\')
        && !id.contains("..")
}

async fn save_bot_avatar(
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<AvatarUpsertPayload>,
) -> impl IntoResponse {
    if !is_safe_id(&id) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid bot id" })),
        );
    }
    if !VALID_AVATAR_TYPES.contains(&payload.kind.as_str()) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "type must be one of geometric, pet, image" })),
        );
    }
    if !payload.data.is_object() {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "data must be an object" })),
        );
    }

    let path = avatar_store_path(&id);
    if let Some(parent) = path.parent() {
        if let Err(err) = std::fs::create_dir_all(parent) {
            warn!(bot_id = %id, err = %err, "bot avatar: failed to create store dir");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to create avatar store" })),
            );
        }
    }

    let body = match serde_json::to_vec(&AvatarStoredPayload {
        kind: payload.kind,
        data: payload.data,
    }) {
        Ok(body) => body,
        Err(err) => {
            warn!(bot_id = %id, err = %err, "bot avatar: failed to encode avatar");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "failed to encode avatar" })),
            );
        }
    };

    // Atomic-ish write: temp file + rename so readers never see a partial JSON.
    let tmp_path = path.with_extension("json.tmp");
    if let Err(err) = std::fs::write(&tmp_path, &body) {
        warn!(bot_id = %id, err = %err, "bot avatar: failed to write avatar");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to write avatar" })),
        );
    }
    if let Err(err) = std::fs::rename(&tmp_path, &path) {
        warn!(bot_id = %id, err = %err, "bot avatar: failed to commit avatar");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "error": "failed to store avatar" })),
        );
    }

    (StatusCode::OK, Json(json!({ "saved": true })))
}

async fn get_bot_avatar(
    State(_state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    if !is_safe_id(&id) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid bot id" })),
        );
    }
    let path = avatar_store_path(&id);
    let raw = match std::fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "no avatar stored for bot" })),
            );
        }
    };
    match serde_json::from_str::<Value>(&raw) {
        Ok(value) => (StatusCode::OK, Json(value)),
        Err(err) => {
            warn!(bot_id = %id, err = %err, "bot avatar: stored avatar is corrupt");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": "stored avatar is corrupt" })),
            )
        }
    }
}
