//! Current user profile routes.

use axum::extract::Extension;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::AppState;

pub fn me_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/me", get(get_current_user))
        .route("/me/usage", get(get_my_usage))
        .route("/me/organization", post(create_personal_organization))
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
    /// The organization this request resolves to. Null until either a real
    /// Clerk organization is selected, or (self-hosted/no-Clerk-key builds
    /// only) the user explicitly creates a personal one via
    /// POST /me/organization -- auth_middleware does not auto-synthesize
    /// one, see auth.rs::ensure_user_in_db.
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
    // A live Clerk claim always wins (it reflects the org the caller has
    // actively selected *right now*, which can change session to session);
    // otherwise fall back to whatever is durably stored on the users row --
    // needed for self-hosted/no-Clerk-key builds, where Clerk never asserts
    // an organization_id at all but POST /me/organization may have already
    // persisted one.
    let claimed_organization_id = user.organization_id.clone();
    let claimed_organization_id_for_task = claimed_organization_id.clone();

    let profile = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;

        let mut stmt = conn.prepare(
            "SELECT id, clerk_id, email, name, avatar_url, role, status, created_at, organization_id
             FROM users WHERE id = ?1",
        )?;
        let (mut row_out, stored_organization_id): (UserProfile, Option<String>) = stmt.query_row(params![user_id2], |row| {
            let stored_organization_id: Option<String> = row.get(8)?;
            Ok((
                UserProfile {
                    id: row.get(0)?,
                    clerk_id: row.get(1)?,
                    email: row.get(2)?,
                    name: row.get(3)?,
                    avatar_url: row.get(4)?,
                    role: row.get(5)?,
                    status: row.get(6)?,
                    created_at: row.get(7)?,
                    organization_id: None,
                    organization_role: None,
                },
                stored_organization_id,
            ))
        })?;

        let organization_id = claimed_organization_id_for_task.or(stored_organization_id);
        let organization_role: Option<String> = organization_id.as_ref().and_then(|org_id| {
            conn.query_row(
                "SELECT role FROM organization_members WHERE organization_id = ?1 AND user_id = ?2",
                params![org_id, user_id2],
                |row| row.get(0),
            )
            .ok()
        });
        row_out.organization_id = organization_id;
        row_out.organization_role = organization_role;
        Ok::<_, rusqlite::Error>(row_out)
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
                    "organization_id": claimed_organization_id,
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

/// Shape read from the cloud API's usage endpoint (the quota/entitlements
/// service in cmd/allternit-cloud-api — quota_service.rs /
/// hosted_entitlements.rs). Every field defaults so a partial upstream
/// payload still yields a complete client-facing response.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct CloudUsageResponse {
    plan: String,
    weekly_used: f64,
    weekly_limit: f64,
    resets_at: Option<String>,
    credits: Option<f64>,
}

impl Default for CloudUsageResponse {
    fn default() -> Self {
        Self {
            plan: "free".to_string(),
            weekly_used: 0.0,
            weekly_limit: 0.0,
            resets_at: None,
            credits: None,
        }
    }
}

/// GET /me/usage — weekly usage metering for the calling user
/// (`{plan, weeklyUsed, weeklyLimit, resetsAt, credits}`), proxied from the
/// cloud API's quota/entitlements service. The cloud base URL comes from
/// `ALLTERNIT_CLOUD_API_URL` / company config `cloudApiUrl`, mirroring how
/// `terminal_server_url` resolves (config.rs). When no cloud API is
/// configured — or it is unreachable or answers non-2xx — the route answers
/// 503 with a clear error instead of inventing usage numbers; clients treat
/// 404/503 as "metering unavailable on this backend".
async fn get_my_usage(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let Some(base_url) = state.config.cloud_api_url() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "usage_metering_unavailable",
                "message": "Usage metering is not configured on this backend (no cloud API URL).",
            })),
        )
            .into_response();
    };

    let url = format!("{}/api/v1/me/usage", base_url.trim_end_matches('/'));
    let mut request = reqwest::Client::new()
        .get(&url)
        .header("x-allternit-user-id", &user.user_id);
    // Forward the caller's Bearer so the cloud API resolves the same user.
    if let Some(authorization) = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
    {
        request = request.header(axum::http::header::AUTHORIZATION, authorization);
    }

    let response = match request.send().await {
        Ok(response) => response,
        Err(e) => {
            warn!("Usage metering proxy unreachable: {}", e);
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "error": "usage_metering_unreachable",
                    "message": format!("The usage metering service could not be reached: {e}"),
                })),
            )
                .into_response();
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        warn!("Usage metering upstream returned {}", status);
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "error": "usage_metering_upstream_error",
                "message": format!("The usage metering service returned {status}."),
            })),
        )
            .into_response();
    }

    match response.json::<CloudUsageResponse>().await {
        Ok(usage) => Json(json!({
            "plan": usage.plan,
            "weeklyUsed": usage.weekly_used,
            "weeklyLimit": usage.weekly_limit,
            "resetsAt": usage.resets_at,
            "credits": usage.credits,
        }))
        .into_response(),
        Err(e) => {
            warn!("Usage metering upstream undecodable: {}", e);
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "error": "usage_metering_bad_response",
                    "message": format!("The usage metering service returned an unreadable payload: {e}"),
                })),
            )
                .into_response()
        }
    }
}

/// Creates a personal organization for the calling user and makes them its
/// owner. Only meaningful for self-hosted/no-Clerk-key builds: real Clerk
/// deployments get organization scope from Clerk's own org-creation flow
/// (see PlatformOrganizationSwitcher in the frontend), and auth_middleware
/// deliberately does not auto-synthesize an organization for them (see
/// auth.rs::ensure_user_in_db). Without this endpoint, a self-hosted user
/// with no Clerk key configured at all would have no path to ever reach an
/// organization-scoped feature (BYOC cloud credentials, metered billing).
/// A no-op (200, unchanged) if the caller already has one.
async fn create_personal_organization(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    if let Some(existing) = user.organization_id.clone() {
        return Json(json!({ "organization_id": existing, "created": false })).into_response();
    }

    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let user_name = user.name.clone();
    let user_email = user.email.clone();

    let result = tokio::task::spawn_blocking(move || -> Result<(String, bool), rusqlite::Error> {
        let conn = db.connect()?;

        // Re-check under the DB's own view (not the ephemeral per-request
        // AuthUser field, which is never populated for self-hosted/no-Clerk
        // users): a prior call may have already persisted one, and this must
        // stay idempotent rather than creating a duplicate organization
        // every time the button is clicked.
        let existing: Option<String> = conn
            .query_row(
                "SELECT organization_id FROM users WHERE id = ?1",
                params![user_id],
                |row| row.get(0),
            )
            .ok()
            .flatten();
        if let Some(existing) = existing {
            return Ok((existing, false));
        }

        let organization_id = format!("personal-{}", Uuid::new_v4());
        let organization_name = user_name
            .as_deref()
            .filter(|s| !s.is_empty())
            .map(|n| format!("{n}'s Organization"))
            .unwrap_or_else(|| "Personal".to_string());
        let member_id = format!("{organization_id}:{user_id}");

        conn.execute(
            "INSERT INTO organizations (id, name, billing_email, created_at, updated_at)
             VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![organization_id, organization_name, user_email.as_deref()],
        )?;
        conn.execute(
            "INSERT INTO organization_members (id, organization_id, user_id, role, joined_at)
             VALUES (?1, ?2, ?3, 'owner', CURRENT_TIMESTAMP)",
            params![member_id, organization_id, user_id],
        )?;
        conn.execute(
            "UPDATE users SET organization_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![organization_id, user_id],
        )?;
        Ok((organization_id, true))
    })
    .await;

    match result {
        Ok(Ok((organization_id, created))) => {
            Json(json!({ "organization_id": organization_id, "created": created })).into_response()
        }
        Ok(Err(e)) => {
            warn!("Failed to create personal organization: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "db_error", "message": e.to_string()})),
            )
                .into_response()
        }
        Err(e) => {
            warn!("DB task panicked creating personal organization: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}
