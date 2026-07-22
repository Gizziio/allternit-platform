//! BYOC (Bring Your Own Cloud) credential management — Clerk-authenticated,
//! org-scoped. An org connects its own AWS/GCP/Azure account so the ACU
//! sandbox engine can provision Firecracker-grade isolation into the
//! customer's cloud instead of allternit's. Secrets are sealed at rest with
//! `token_crypto::seal()`, the same primitive already used for OAuth
//! connector tokens (`connector_connections`, V16) — one opaque sealed blob
//! per row rather than per-provider columns, so this stays provider-agnostic.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::auth::AuthUser;
use crate::token_crypto;
use crate::AppState;

pub fn cloud_credentials_router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/cloud-credentials",
            get(list_credentials).post(create_credential),
        )
        .route(
            "/cloud-credentials/:id",
            get(get_credential).delete(revoke_credential),
        )
}

#[derive(Debug, Serialize)]
struct CloudCredentialView {
    id: String,
    provider: String,
    label: String,
    region: Option<String>,
    external_id: Option<String>,
    status: String,
    last_validated_at: Option<String>,
    created_at: String,
}

fn row_to_view(row: &rusqlite::Row) -> rusqlite::Result<CloudCredentialView> {
    Ok(CloudCredentialView {
        id: row.get("id")?,
        provider: row.get("provider")?,
        label: row.get("label")?,
        region: row.get("region")?,
        external_id: row.get("external_id")?,
        status: row.get("status")?,
        last_validated_at: row.get("last_validated_at")?,
        created_at: row.get("created_at")?,
    })
}

/// Require the organization carried by the verified Clerk session. The auth
/// layer synchronizes that signed membership into the local organization
/// registry; never infer request scope from a stale user-table pointer.
fn require_org(organization_id: Option<&str>) -> Result<String, (StatusCode, Json<Value>)> {
    organization_id.map(str::to_owned).ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "error": "no_organization",
                "message": "This account isn't associated with an organization yet. \
                             Cloud credentials are managed at the organization level."
            })),
        )
    })
}

fn require_admin(
    conn: &Connection,
    organization_id: &str,
    user_id: &str,
) -> Result<(), (StatusCode, Json<Value>)> {
    let is_admin = crate::rbac::is_org_admin(conn, organization_id, user_id).map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "db_error", "message": e.to_string()})),
        )
    })?;
    if is_admin {
        Ok(())
    } else {
        Err((
            StatusCode::FORBIDDEN,
            Json(json!({
                "error": "insufficient_role",
                "message": "Only organization owners/admins can manage cloud credentials."
            })),
        ))
    }
}

async fn list_credentials(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let active_organization_id = user.organization_id;

    let result = tokio::task::spawn_blocking(move || -> Result<Vec<CloudCredentialView>, (StatusCode, Json<Value>)> {
        let conn = db.connect().map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "db_error", "message": e.to_string()})))
        })?;
        let organization_id = require_org(active_organization_id.as_deref())?;

        let mut stmt = conn
            .prepare(
                "SELECT id, provider, label, region, external_id, status, last_validated_at, created_at
                 FROM cloud_credentials WHERE organization_id = ?1 ORDER BY created_at DESC",
            )
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "db_error", "message": e.to_string()}))))?;
        let rows = stmt
            .query_map(params![organization_id], row_to_view)
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "db_error", "message": e.to_string()}))))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "db_error", "message": e.to_string()}))))
    })
    .await;

    match result {
        Ok(Ok(items)) => {
            (StatusCode::OK, Json(json!({ "cloud_credentials": items }))).into_response()
        }
        Ok(Err((status, body))) => (status, body).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "task_join_error"})),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct CreateCloudCredentialRequest {
    provider: String, // "aws" | "gcp" | "azure"
    label: String,
    region: Option<String>,
    external_id: Option<String>,
    /// Provider-shaped secret payload (e.g. { "role_arn": "..." } for AWS,
    /// { "service_account_json": {...} } for GCP, { "client_secret": "..." }
    /// for Azure). JSON-serialized once, sealed once — matches how
    /// connector_connections seals a single opaque token value.
    secret: Value,
}

async fn create_credential(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateCloudCredentialRequest>,
) -> impl IntoResponse {
    if !matches!(body.provider.as_str(), "aws" | "gcp" | "azure") {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"error": "invalid_provider", "message": "provider must be one of: aws, gcp, azure"})),
        )
            .into_response();
    }

    let db = state.db.clone();
    let user_id = user.user_id;
    let active_organization_id = user.organization_id;
    let secret_json = body.secret.to_string();
    let secret_sealed = token_crypto::seal(&secret_json);
    let id = uuid::Uuid::new_v4().to_string();

    let result = tokio::task::spawn_blocking(move || -> Result<CloudCredentialView, (StatusCode, Json<Value>)> {
        let conn = db.connect().map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "db_error", "message": e.to_string()})))
        })?;
        let organization_id = require_org(active_organization_id.as_deref())?;
        require_admin(&conn, &organization_id, &user_id)?;

        conn.execute(
            "INSERT INTO cloud_credentials
                (id, organization_id, provider, label, region, external_id, secret_sealed, created_by)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id, organization_id, body.provider, body.label, body.region,
                body.external_id, secret_sealed, user_id,
            ],
        )
        .map_err(|e| {
            let message = if e.to_string().contains("UNIQUE") {
                "A credential with this label already exists for your organization.".to_string()
            } else {
                e.to_string()
            };
            (StatusCode::BAD_REQUEST, Json(json!({"error": "create_failed", "message": message})))
        })?;

        conn.query_row(
            "SELECT id, provider, label, region, external_id, status, last_validated_at, created_at
             FROM cloud_credentials WHERE id = ?1",
            params![id],
            row_to_view,
        )
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "db_error", "message": e.to_string()}))))
    })
    .await;

    match result {
        Ok(Ok(view)) => (StatusCode::CREATED, Json(json!(view))).into_response(),
        Ok(Err((status, body))) => (status, body).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "task_join_error"})),
        )
            .into_response(),
    }
}

async fn get_credential(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let active_organization_id = user.organization_id;

    let result = tokio::task::spawn_blocking(move || -> Result<CloudCredentialView, (StatusCode, Json<Value>)> {
        let conn = db.connect().map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "db_error", "message": e.to_string()})))
        })?;
        let organization_id = require_org(active_organization_id.as_deref())?;

        conn.query_row(
            "SELECT id, provider, label, region, external_id, status, last_validated_at, created_at
             FROM cloud_credentials WHERE id = ?1 AND organization_id = ?2",
            params![id, organization_id],
            row_to_view,
        )
        .map_err(|_| {
            (StatusCode::NOT_FOUND, Json(json!({"error": "not_found", "message": "No such cloud credential."})))
        })
    })
    .await;

    match result {
        Ok(Ok(view)) => (StatusCode::OK, Json(json!(view))).into_response(),
        Ok(Err((status, body))) => (status, body).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "task_join_error"})),
        )
            .into_response(),
    }
}

async fn revoke_credential(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id;
    let active_organization_id = user.organization_id;

    let result = tokio::task::spawn_blocking(move || -> Result<(), (StatusCode, Json<Value>)> {
        let conn = db.connect().map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "db_error", "message": e.to_string()})),
            )
        })?;
        let organization_id = require_org(active_organization_id.as_deref())?;
        require_admin(&conn, &organization_id, &user_id)?;

        // Soft-revoke only -- never hard-delete, so there's an audit trail of
        // what an org once had access to.
        let updated = conn
            .execute(
                "UPDATE cloud_credentials SET status = 'revoked', updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?1 AND organization_id = ?2",
                params![id, organization_id],
            )
            .map_err(|e| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "db_error", "message": e.to_string()})),
                )
            })?;

        if updated == 0 {
            return Err((
                StatusCode::NOT_FOUND,
                Json(json!({"error": "not_found", "message": "No such cloud credential."})),
            ));
        }
        Ok(())
    })
    .await;

    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err((status, body))) => (status, body).into_response(),
        Err(_) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "task_join_error"})),
        )
            .into_response(),
    }
}
