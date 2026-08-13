//! Enterprise admin workspaces — organization-scoped resource containers
//! with an owner/admin/member roster. Distinct from the pre-existing
//! user-owned `workspaces` table (see `workspace_routes.rs`), which has no
//! organization scoping. All endpoints are gated to organization
//! owners/admins, matching the `/admin/*` prefix used elsewhere in
//! `enterprise_auth.rs`.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::net::IpAddr;
use std::str::FromStr;
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/admin/workspaces",
            post(create_workspace).get(list_workspaces),
        )
        .route(
            "/admin/workspaces/:id",
            get(get_workspace)
                .put(update_workspace)
                .delete(delete_workspace),
        )
        .route(
            "/admin/workspaces/:id/members",
            get(list_members).post(add_member),
        )
        .route(
            "/admin/workspaces/:id/members/:member_id",
            axum::routing::put(set_member_role).delete(remove_member),
        )
        .route(
            "/admin/workspaces/:id/ip-allowlist",
            get(list_ip_allowlist).post(add_ip_allowlist_entry),
        )
        .route(
            "/admin/workspaces/:id/ip-allowlist/:entry_id",
            delete(remove_ip_allowlist_entry),
        )
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "admin workspace operation failed");
    error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

fn admin_org(conn: &rusqlite::Connection, user: &AuthUser) -> Result<String, ApiError> {
    let org = user.organization_id.as_deref().ok_or_else(|| {
        error(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })?;
    if !crate::rbac::is_org_admin(conn, org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can manage admin workspaces.",
        ));
    }
    Ok(org.to_string())
}

fn valid_role(role: &str) -> bool {
    matches!(role, "owner" | "admin" | "member")
}

fn workspace_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "name": row.get::<_, String>(1)?,
        "description": row.get::<_, Option<String>>(2)?,
        "created_by": row.get::<_, String>(3)?,
        "created_at": row.get::<_, String>(4)?,
        "updated_at": row.get::<_, String>(5)?,
    }))
}

fn find_workspace(conn: &rusqlite::Connection, id: &str, org: &str) -> Result<Value, ApiError> {
    conn.query_row(
        "SELECT id, name, description, created_by, created_at, updated_at FROM admin_workspaces WHERE id = ?1 AND organization_id = ?2",
        params![id, org],
        workspace_json,
    )
    .optional()
    .map_err(internal)?
    .ok_or_else(|| error(StatusCode::NOT_FOUND, "workspace_not_found", "No such admin workspace."))
}

#[derive(Deserialize)]
struct CreateWorkspace {
    name: String,
    description: Option<String>,
}

fn validate_name(name: &str) -> Result<(), ApiError> {
    if name.trim().is_empty() || name.len() > 128 {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_name",
            "Name must be 1-128 characters.",
        ));
    }
    Ok(())
}

async fn create_workspace(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateWorkspace>,
) -> Response {
    if let Err(e) = validate_name(&body.name) {
        return e.into_response();
    }
    let result = tokio::task::spawn_blocking(move || {
        let mut conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let tx = conn.transaction().map_err(internal)?;
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO admin_workspaces (id, organization_id, name, description, created_by) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, org, body.name.trim(), body.description, user.user_id],
        ).map_err(internal)?;
        tx.execute(
            "INSERT INTO admin_workspace_members (id, workspace_id, user_id, role) VALUES (?1, ?2, ?3, 'owner')",
            params![uuid::Uuid::new_v4().to_string(), id, user.user_id],
        ).map_err(internal)?;
        tx.commit().map_err(internal)?;
        Ok::<_, ApiError>(json!({"id": id, "name": body.name.trim(), "description": body.description}))
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn list_workspaces(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let mut stmt = conn.prepare("SELECT id, name, description, created_by, created_at, updated_at FROM admin_workspaces WHERE organization_id = ?1 ORDER BY created_at DESC").map_err(internal)?;
        let rows = stmt.query_map([org], workspace_json).map_err(internal)?.collect::<rusqlite::Result<Vec<_>>>().map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"workspaces": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_workspace(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_workspace(&conn, &id, &org)
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateWorkspace {
    name: Option<String>,
    description: Option<String>,
}

async fn update_workspace(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateWorkspace>,
) -> Response {
    if let Some(name) = &body.name {
        if let Err(e) = validate_name(name) {
            return e.into_response();
        }
    }
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_workspace(&conn, &id, &org)?;
        conn.execute(
            "UPDATE admin_workspaces SET name = COALESCE(?1, name), description = COALESCE(?2, description), updated_at = CURRENT_TIMESTAMP WHERE id = ?3 AND organization_id = ?4",
            params![body.name.as_deref().map(|n| n.trim()), body.description, id, org],
        ).map_err(internal)?;
        find_workspace(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_workspace(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let changed = conn
            .execute(
                "DELETE FROM admin_workspaces WHERE id = ?1 AND organization_id = ?2",
                params![id, org],
            )
            .map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "workspace_not_found",
                "No such admin workspace.",
            ));
        }
        Ok::<_, ApiError>(())
    })
    .await;
    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

fn member_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "user_id": row.get::<_, String>(1)?,
        "role": row.get::<_, String>(2)?,
        "created_at": row.get::<_, String>(3)?,
    }))
}

async fn list_members(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_workspace(&conn, &id, &org)?;
        let mut stmt = conn.prepare("SELECT id, user_id, role, created_at FROM admin_workspace_members WHERE workspace_id = ?1 ORDER BY created_at ASC").map_err(internal)?;
        let rows = stmt.query_map([&id], member_json).map_err(internal)?.collect::<rusqlite::Result<Vec<_>>>().map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"members": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct AddMember {
    user_id: String,
    #[serde(default = "default_role")]
    role: String,
}
fn default_role() -> String {
    "member".to_string()
}

async fn add_member(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<AddMember>,
) -> Response {
    if !valid_role(&body.role) {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_role",
            "role must be one of owner, admin, member.",
        )
        .into_response();
    }
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_workspace(&conn, &id, &org)?;
        let member_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO admin_workspace_members (id, workspace_id, user_id, role) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role",
            params![member_id, id, body.user_id, body.role],
        ).map_err(internal)?;
        Ok::<_, ApiError>(json!({"workspace_id": id, "user_id": body.user_id, "role": body.role}))
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct SetRole {
    role: String,
}

async fn set_member_role(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, member_id)): Path<(String, String)>,
    Json(body): Json<SetRole>,
) -> Response {
    if !valid_role(&body.role) {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_role",
            "role must be one of owner, admin, member.",
        )
        .into_response();
    }
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_workspace(&conn, &id, &org)?;
        let changed = conn.execute(
            "UPDATE admin_workspace_members SET role = ?1 WHERE workspace_id = ?2 AND user_id = ?3",
            params![body.role, id, member_id],
        ).map_err(internal)?;
        if changed == 0 {
            return Err(error(StatusCode::NOT_FOUND, "member_not_found", "No such workspace member."));
        }
        Ok::<_, ApiError>(())
    }).await;
    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn remove_member(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, member_id)): Path<(String, String)>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_workspace(&conn, &id, &org)?;
        let changed = conn
            .execute(
                "DELETE FROM admin_workspace_members WHERE workspace_id = ?1 AND user_id = ?2",
                params![id, member_id],
            )
            .map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "member_not_found",
                "No such workspace member.",
            ));
        }
        Ok::<_, ApiError>(())
    })
    .await;
    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ─── Workspace IP allowlisting ──────────────────────────────────────────────

fn valid_cidr(ip_range: &str) -> bool {
    let parts: Vec<&str> = ip_range.split('/').collect();
    if parts.len() != 2 {
        return false;
    }
    let addr = parts[0].parse::<std::net::IpAddr>();
    let prefix = parts[1].parse::<u8>();
    match (addr, prefix) {
        (Ok(_), Ok(p)) => p <= 32,
        _ => false,
    }
}

fn ip_allowlist_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "workspace_id": row.get::<_, String>(1)?,
        "org_id": row.get::<_, String>(2)?,
        "ip_range": row.get::<_, String>(3)?,
        "description": row.get::<_, Option<String>>(4)?,
        "enabled": row.get::<_, i64>(5)? != 0,
        "created_at": row.get::<_, String>(6)?,
        "updated_at": row.get::<_, String>(7)?,
    }))
}

#[derive(Deserialize)]
struct AddIpAllowlistEntry {
    ip_range: String,
    description: Option<String>,
    #[serde(default = "default_enabled")]
    enabled: bool,
}

fn default_enabled() -> bool {
    true
}

async fn list_ip_allowlist(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_workspace(&conn, &id, &org)?;
        let mut stmt = conn.prepare(
            "SELECT id, workspace_id, org_id, ip_range, description, enabled, created_at, updated_at FROM workspace_ip_allowlists WHERE workspace_id = ?1 ORDER BY created_at DESC"
        ).map_err(internal)?;
        let rows = stmt
            .query_map([&id], ip_allowlist_json)
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"ip_allowlist": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn add_ip_allowlist_entry(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<AddIpAllowlistEntry>,
) -> Response {
    if !valid_cidr(&body.ip_range) {
        return error(
            StatusCode::BAD_REQUEST,
            "invalid_cidr",
            "ip_range must be a valid CIDR such as 203.0.113.0/24.",
        )
        .into_response();
    }
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_workspace(&conn, &id, &org)?;
        let entry_id = uuid::Uuid::new_v4().to_string();
        let enabled = if body.enabled { 1 } else { 0 };
        conn.execute(
            "INSERT INTO workspace_ip_allowlists (id, workspace_id, org_id, ip_range, description, enabled) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![entry_id, id, org, body.ip_range, body.description, enabled],
        ).map_err(internal)?;
        conn.query_row(
            "SELECT id, workspace_id, org_id, ip_range, description, enabled, created_at, updated_at FROM workspace_ip_allowlists WHERE id = ?1",
            [&entry_id],
            ip_allowlist_json,
        )
        .map_err(internal)
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn remove_ip_allowlist_entry(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, entry_id)): Path<(String, String)>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<(), ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_workspace(&conn, &id, &org)?;
        let changed = conn.execute(
            "DELETE FROM workspace_ip_allowlists WHERE id = ?1 AND workspace_id = ?2 AND org_id = ?3",
            params![entry_id, id, org],
        ).map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "entry_not_found",
                "No such IP allowlist entry.",
            ));
        }
        Ok(())
    }).await;
    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

/// Check whether `ip` is allowed by the workspace IP allowlist. An empty
/// allowlist means "allow all".
pub fn ip_allowed(conn: &rusqlite::Connection, workspace_id: &str, ip: &str) -> bool {
    let client_ip = match IpAddr::from_str(ip) {
        Ok(ip) => ip,
        Err(_) => return false,
    };
    let entries: Vec<String> = conn
        .prepare("SELECT ip_range FROM workspace_ip_allowlists WHERE workspace_id = ?1 AND enabled = 1")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([workspace_id], |row| row.get(0))
                .ok()?
                .collect::<Result<Vec<_>, _>>()
                .ok()
        })
        .unwrap_or_default();
    if entries.is_empty() {
        return true;
    }
    for entry in entries {
        if let Ok(allowed) = IpAddr::from_str(&entry) {
            if allowed == client_ip {
                return true;
            }
        } else if let Some((prefix, _)) = entry.split_once('/') {
            if IpAddr::from_str(prefix).map(|allowed| allowed == client_ip).unwrap_or(false) {
                return true;
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_validation_accepts_only_known_roles() {
        assert!(valid_role("owner"));
        assert!(valid_role("admin"));
        assert!(valid_role("member"));
        assert!(!valid_role("superuser"));
        assert!(!valid_role(""));
    }

    #[test]
    fn name_validation_rejects_blank_and_oversized_names() {
        assert!(validate_name("Engineering").is_ok());
        assert!(validate_name("   ").is_err());
        assert!(validate_name(&"x".repeat(129)).is_err());
    }

    use crate::db::DbHandle;

    fn test_db() -> (String, DbHandle) {
        let id = uuid::Uuid::new_v4().to_string();
        let path = std::env::temp_dir().join(format!("allternit-admin-workspace-test-{}.db", id));
        let db = DbHandle::new(path.clone()).unwrap();
        (path.to_string_lossy().to_string(), db)
    }

    fn seed_org_admin(conn: &rusqlite::Connection, org_id: &str, user_id: &str, role: &str) {
        conn.execute(
            "INSERT OR IGNORE INTO organizations (id, name) VALUES (?1, 'Test Org')",
            rusqlite::params![org_id],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO users (id, email) VALUES (?1, ?2)",
            rusqlite::params![user_id, format!("{}@test.local", user_id)],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![format!("{}:{}", org_id, user_id), org_id, user_id, role],
        )
        .unwrap();
    }

    fn auth_user(org_id: Option<&str>, user_id: &str) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: Some(format!("{}@test.local", user_id)),
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: org_id.map(|s| s.to_string()),
            organization_role: None,
            organization_slug: None,
        }
    }

    #[test]
    fn admin_org_accepts_owner_and_rejects_member() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_admin(&conn, "org-1", "owner-1", "owner");
        seed_org_admin(&conn, "org-1", "member-1", "member");

        assert_eq!(admin_org(&conn, &auth_user(Some("org-1"), "owner-1")).unwrap(), "org-1");
        let err = admin_org(&conn, &auth_user(Some("org-1"), "member-1")).unwrap_err();
        assert_eq!(err.0, StatusCode::FORBIDDEN);
        let err = admin_org(&conn, &auth_user(None, "owner-1")).unwrap_err();
        assert_eq!(err.0, StatusCode::FORBIDDEN);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn workspace_roundtrip_and_members() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_admin(&conn, "org-1", "owner-1", "owner");
        seed_org_admin(&conn, "org-1", "member-1", "member");

        let ws_id = "ws-1";
        conn.execute(
            "INSERT INTO admin_workspaces (id, organization_id, name, description, created_by) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![ws_id, "org-1", "Engineering", "desc", "owner-1"],
        )
        .unwrap();

        let ws = find_workspace(&conn, ws_id, "org-1").unwrap();
        assert_eq!(ws["name"], "Engineering");

        conn.execute(
            "INSERT INTO admin_workspace_members (id, workspace_id, user_id, role) VALUES (?1, ?2, ?3, 'member')",
            rusqlite::params!["mem-1", ws_id, "member-1"],
        )
        .unwrap();

        let mut stmt = conn.prepare("SELECT id, user_id, role, created_at FROM admin_workspace_members WHERE workspace_id = ?1").unwrap();
        let rows: Vec<_> = stmt.query_map([ws_id], member_json).unwrap().collect::<Result<_, _>>().unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["user_id"], "member-1");

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn cidr_validation_accepts_valid_ranges() {
        assert!(valid_cidr("203.0.113.0/24"));
        assert!(valid_cidr("10.0.0.0/8"));
        assert!(!valid_cidr("not-a-cidr"));
        assert!(!valid_cidr("203.0.113.0"));
        assert!(!valid_cidr("203.0.113.0/99"));
    }

    #[test]
    fn ip_allowlist_roundtrip() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_admin(&conn, "org-1", "owner-1", "owner");

        let ws_id = "ws-1";
        conn.execute(
            "INSERT INTO admin_workspaces (id, organization_id, name, description, created_by) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![ws_id, "org-1", "Engineering", "desc", "owner-1"],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO workspace_ip_allowlists (id, workspace_id, org_id, ip_range, description, enabled) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params!["entry-1", ws_id, "org-1", "203.0.113.0/24", "Office", 1],
        )
        .unwrap();

        let mut stmt = conn.prepare("SELECT id, workspace_id, org_id, ip_range, description, enabled, created_at, updated_at FROM workspace_ip_allowlists WHERE workspace_id = ?1").unwrap();
        let rows: Vec<_> = stmt.query_map([ws_id], ip_allowlist_json).unwrap().collect::<Result<_, _>>().unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["ip_range"], "203.0.113.0/24");
        assert_eq!(rows[0]["enabled"], true);

        let _ = std::fs::remove_file(&path);
    }
}
