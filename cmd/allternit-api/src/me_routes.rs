
//! Current user profile routes.

use axum::extract::Extension;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use rusqlite::params;
use serde::Serialize;
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;

pub fn me_router() -> Router<Arc<AppState>> {
    Router::new().route("/me", get(get_current_user))
}

#[derive(Serialize)]
struct UserProfile {
    id: String,
    clerk_id: Option<String>,
    email: String,
    name: Option<String>,
    avatar_url: Option<String>,
    role: String,
    status: String,
    created_at: String,
}

async fn get_current_user(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let user_email = user.email.clone();
    let user_name = user.name.clone();
    let user_id2 = user_id.clone();

    let profile = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, clerk_id, email, name, avatar_url, role, status, created_at
             FROM users WHERE id = ?1"
        )?;
        let row = stmt.query_row(params![user_id2], |row| {
            Ok(UserProfile {
                id: row.get(0)?,
                clerk_id: row.get(1)?,
                email: row.get(2)?,
                name: row.get(3)?,
                avatar_url: row.get(4)?,
                role: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;
        Ok::<_, rusqlite::Error>(row)
    })
    .await;

    match profile {
        Ok(Ok(p)) => Json(json!({ "user": p })).into_response(),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            // User was created by middleware but not found — return basic info
            Json(json!({
                "user": {
                    "id": user_id,
                    "email": user_email,
                    "name": user_name,
                    "role": "user",
                    "status": "active",
                }
            })).into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting user profile: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))).into_response()
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}
