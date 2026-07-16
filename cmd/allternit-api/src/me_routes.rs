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

use crate::auth::AuthUser;
use crate::AppState;

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
    /// The organization this request resolves to -- always present after
    /// auth_middleware runs (synthesized personal org when Clerk reports
    /// none, see auth.rs::ensure_user_in_db). The frontend should read
    /// organization scope from here, never from Clerk's own org state
    /// directly, since Clerk Organizations may not be configured at all.
    organization_id: Option<String>,
    organization_role: Option<String>,
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
    let organization_id = user.organization_id.clone();
    let organization_id2 = organization_id.clone();

    let profile = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        let organization_role: Option<String> = organization_id2.as_ref().and_then(|org_id| {
            conn.query_row(
                "SELECT role FROM organization_members WHERE organization_id = ?1 AND user_id = ?2",
                params![org_id, user_id2],
                |row| row.get(0),
            )
            .ok()
        });

        let mut stmt = conn.prepare(
            "SELECT id, clerk_id, email, name, avatar_url, role, status, created_at
             FROM users WHERE id = ?1",
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
                organization_id: organization_id2.clone(),
                organization_role: organization_role.clone(),
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
                    "organization_id": organization_id,
                    "organization_role": serde_json::Value::Null,
                }
            }))
            .into_response()
        }
        Ok(Err(e)) => {
            warn!("DB error getting user profile: {}", e);
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
