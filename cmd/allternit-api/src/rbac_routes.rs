//! RBAC roles and groups API — organization-scoped, admin-gated CRUD for
//! `rbac_roles` (name + permission list) and `rbac_groups` (name + role
//! bundle), plus group membership management. Layered on top of the coarse
//! owner/admin/member tier checked by `rbac::is_org_admin`.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::post,
    Json, Router,
};
use rusqlite::{params, OptionalExtension};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route(
            "/admin/rbac_roles",
            post(create_role).get(list_roles),
        )
        .route(
            "/admin/rbac_roles/:id",
            axum::routing::get(get_role)
                .put(update_role)
                .delete(delete_role),
        )
        .route(
            "/admin/rbac_groups",
            post(create_group).get(list_groups),
        )
        .route(
            "/admin/rbac_groups/:id",
            axum::routing::get(get_group)
                .put(update_group)
                .delete(delete_group),
        )
        .route(
            "/admin/rbac_groups/:id/members",
            axum::routing::get(list_group_members).post(add_group_member),
        )
        .route(
            "/admin/rbac_groups/:id/members/:user_id",
            axum::routing::delete(remove_group_member),
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
    tracing::warn!(error = %err, "rbac operation failed");
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
            "Only organization owners/admins can manage RBAC roles and groups.",
        ));
    }
    Ok(org.to_string())
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

fn validate_permissions(permissions: &[String]) -> Result<(), ApiError> {
    if permissions.iter().any(|p| p.trim().is_empty()) {
        return Err(error(
            StatusCode::BAD_REQUEST,
            "invalid_permissions",
            "Permissions must not be empty strings.",
        ));
    }
    Ok(())
}

// ─── Roles ──────────────────────────────────────────────────────────────────

fn role_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    Ok(json!({
        "id": row.get::<_, String>(0)?,
        "name": row.get::<_, String>(1)?,
        "permissions": serde_json::from_str::<Value>(&row.get::<_, String>(2)?).unwrap_or(json!([])),
        "created_by": row.get::<_, String>(3)?,
        "created_at": row.get::<_, String>(4)?,
        "updated_at": row.get::<_, String>(5)?,
    }))
}

fn find_role(conn: &rusqlite::Connection, id: &str, org: &str) -> Result<Value, ApiError> {
    conn.query_row(
        "SELECT id, name, permissions, created_by, created_at, updated_at FROM rbac_roles WHERE id = ?1 AND organization_id = ?2",
        params![id, org],
        role_json,
    ).optional().map_err(internal)?.ok_or_else(|| error(StatusCode::NOT_FOUND, "role_not_found", "No such RBAC role."))
}

#[derive(Deserialize)]
struct CreateRole {
    name: String,
    #[serde(default)]
    permissions: Vec<String>,
}

async fn create_role(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateRole>,
) -> Response {
    if let Err(e) = validate_name(&body.name).and_then(|_| validate_permissions(&body.permissions)) {
        return e.into_response();
    }
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO rbac_roles (id, organization_id, name, permissions, created_by) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, org, body.name.trim(), serde_json::to_string(&body.permissions).unwrap(), user.user_id],
        ).map_err(internal)?;
        find_role(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn list_roles(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let mut stmt = conn.prepare("SELECT id, name, permissions, created_by, created_at, updated_at FROM rbac_roles WHERE organization_id = ?1 ORDER BY created_at DESC").map_err(internal)?;
        let rows = stmt.query_map([org], role_json).map_err(internal)?.collect::<rusqlite::Result<Vec<_>>>().map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"roles": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_role(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_role(&conn, &id, &org)
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateRole {
    name: Option<String>,
    permissions: Option<Vec<String>>,
}

async fn update_role(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRole>,
) -> Response {
    if let Some(name) = &body.name {
        if let Err(e) = validate_name(name) {
            return e.into_response();
        }
    }
    if let Some(permissions) = &body.permissions {
        if let Err(e) = validate_permissions(permissions) {
            return e.into_response();
        }
    }
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_role(&conn, &id, &org)?;
        conn.execute(
            "UPDATE rbac_roles SET name = COALESCE(?1, name), permissions = COALESCE(?2, permissions), updated_at = CURRENT_TIMESTAMP WHERE id = ?3 AND organization_id = ?4",
            params![
                body.name.as_deref().map(|n| n.trim()),
                body.permissions.as_ref().map(|p| serde_json::to_string(p).unwrap()),
                id,
                org
            ],
        ).map_err(internal)?;
        find_role(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_role(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let changed = conn
            .execute(
                "DELETE FROM rbac_roles WHERE id = ?1 AND organization_id = ?2",
                params![id, org],
            )
            .map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "role_not_found",
                "No such RBAC role.",
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

// ─── Groups ─────────────────────────────────────────────────────────────────

fn group_role_ids(conn: &rusqlite::Connection, group_id: &str) -> rusqlite::Result<Vec<String>> {
    let mut stmt =
        conn.prepare("SELECT role_id FROM rbac_group_roles WHERE group_id = ?1")?;
    let ids = stmt
        .query_map([group_id], |r| r.get::<_, String>(0))?
        .collect();
    ids
}

fn find_group(conn: &rusqlite::Connection, id: &str, org: &str) -> Result<Value, ApiError> {
    let row = conn
        .query_row(
            "SELECT id, name, created_by, created_at, updated_at FROM rbac_groups WHERE id = ?1 AND organization_id = ?2",
            params![id, org],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, String>(3)?, r.get::<_, String>(4)?)),
        )
        .optional()
        .map_err(internal)?
        .ok_or_else(|| error(StatusCode::NOT_FOUND, "group_not_found", "No such RBAC group."))?;
    let role_ids = group_role_ids(conn, &row.0).map_err(internal)?;
    Ok(json!({"id": row.0, "name": row.1, "role_ids": role_ids, "created_by": row.2, "created_at": row.3, "updated_at": row.4}))
}

fn replace_group_roles(
    conn: &rusqlite::Connection,
    group_id: &str,
    org: &str,
    role_ids: &[String],
) -> Result<(), ApiError> {
    for role_id in role_ids {
        let exists: bool = conn
            .query_row(
                "SELECT 1 FROM rbac_roles WHERE id = ?1 AND organization_id = ?2",
                params![role_id, org],
                |_| Ok(true),
            )
            .optional()
            .map_err(internal)?
            .unwrap_or(false);
        if !exists {
            return Err(error(
                StatusCode::BAD_REQUEST,
                "invalid_role_id",
                format!("Role {role_id} does not exist in this organization."),
            ));
        }
    }
    conn.execute(
        "DELETE FROM rbac_group_roles WHERE group_id = ?1",
        params![group_id],
    )
    .map_err(internal)?;
    for role_id in role_ids {
        conn.execute(
            "INSERT INTO rbac_group_roles (group_id, role_id) VALUES (?1, ?2)",
            params![group_id, role_id],
        )
        .map_err(internal)?;
    }
    Ok(())
}

#[derive(Deserialize)]
struct CreateGroup {
    name: String,
    #[serde(default)]
    role_ids: Vec<String>,
}

async fn create_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateGroup>,
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
            "INSERT INTO rbac_groups (id, organization_id, name, created_by) VALUES (?1, ?2, ?3, ?4)",
            params![id, org, body.name.trim(), user.user_id],
        ).map_err(internal)?;
        replace_group_roles(&tx, &id, &org, &body.role_ids)?;
        tx.commit().map_err(internal)?;
        find_group(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn list_groups(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let mut stmt = conn.prepare("SELECT id, name, created_by, created_at, updated_at FROM rbac_groups WHERE organization_id = ?1 ORDER BY created_at DESC").map_err(internal)?;
        let ids = stmt.query_map([&org], |r| r.get::<_, String>(0)).map_err(internal)?.collect::<rusqlite::Result<Vec<_>>>().map_err(internal)?;
        ids.into_iter().map(|id| find_group(&conn, &id, &org)).collect()
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"groups": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_group(&conn, &id, &org)
    })
    .await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateGroup {
    name: Option<String>,
    role_ids: Option<Vec<String>>,
}

async fn update_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateGroup>,
) -> Response {
    if let Some(name) = &body.name {
        if let Err(e) = validate_name(name) {
            return e.into_response();
        }
    }
    let result = tokio::task::spawn_blocking(move || {
        let mut conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_group(&conn, &id, &org)?;
        let tx = conn.transaction().map_err(internal)?;
        if let Some(name) = &body.name {
            tx.execute(
                "UPDATE rbac_groups SET name = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND organization_id = ?3",
                params![name.trim(), id, org],
            ).map_err(internal)?;
        }
        if let Some(role_ids) = &body.role_ids {
            replace_group_roles(&tx, &id, &org, role_ids)?;
            tx.execute(
                "UPDATE rbac_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND organization_id = ?2",
                params![id, org],
            ).map_err(internal)?;
        }
        tx.commit().map_err(internal)?;
        find_group(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let changed = conn
            .execute(
                "DELETE FROM rbac_groups WHERE id = ?1 AND organization_id = ?2",
                params![id, org],
            )
            .map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "group_not_found",
                "No such RBAC group.",
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

async fn list_group_members(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_group(&conn, &id, &org)?;
        let mut stmt = conn.prepare("SELECT id, user_id, created_at FROM rbac_group_members WHERE group_id = ?1 ORDER BY created_at ASC").map_err(internal)?;
        let rows = stmt.query_map([&id], |r| Ok(json!({"id": r.get::<_, String>(0)?, "user_id": r.get::<_, String>(1)?, "created_at": r.get::<_, String>(2)?}))).map_err(internal)?.collect::<rusqlite::Result<Vec<_>>>().map_err(internal)?;
        Ok(rows)
    }).await;
    match result {
        Ok(Ok(v)) => Json(json!({"members": v})).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct AddGroupMember {
    user_id: String,
}

async fn add_group_member(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<AddGroupMember>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_group(&conn, &id, &org)?;
        conn.execute(
            "INSERT INTO rbac_group_members (id, group_id, user_id) VALUES (?1, ?2, ?3) ON CONFLICT(group_id, user_id) DO NOTHING",
            params![uuid::Uuid::new_v4().to_string(), id, body.user_id],
        ).map_err(internal)?;
        Ok::<_, ApiError>(json!({"group_id": id, "user_id": body.user_id}))
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn remove_group_member(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path((id, user_id)): Path<(String, String)>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_group(&conn, &id, &org)?;
        let changed = conn
            .execute(
                "DELETE FROM rbac_group_members WHERE group_id = ?1 AND user_id = ?2",
                params![id, user_id],
            )
            .map_err(internal)?;
        if changed == 0 {
            return Err(error(
                StatusCode::NOT_FOUND,
                "member_not_found",
                "No such group member.",
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permission_validation_rejects_blank_entries() {
        assert!(validate_permissions(&["read:agents".to_string()]).is_ok());
        assert!(validate_permissions(&[]).is_ok());
        assert!(validate_permissions(&["".to_string()]).is_err());
        assert!(validate_permissions(&["  ".to_string()]).is_err());
    }

    #[test]
    fn name_validation_rejects_blank_and_oversized_names() {
        assert!(validate_name("Engineers").is_ok());
        assert!(validate_name("").is_err());
        assert!(validate_name(&"x".repeat(129)).is_err());
    }

    use crate::db::DbHandle;

    fn test_db() -> (String, DbHandle) {
        let id = uuid::Uuid::new_v4().to_string();
        let path = std::env::temp_dir().join(format!("allternit-rbac-routes-test-{}.db", id));
        let db = DbHandle::new(path.clone()).unwrap();
        (path.to_string_lossy().to_string(), db)
    }

    fn seed_org_user(conn: &rusqlite::Connection, org_id: &str, user_id: &str, role: &str) {
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
    fn admin_org_gates_non_admins() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");
        seed_org_user(&conn, "org-1", "member-1", "member");

        assert_eq!(admin_org(&conn, &auth_user(Some("org-1"), "admin-1")).unwrap(), "org-1");
        assert_eq!(admin_org(&conn, &auth_user(Some("org-1"), "member-1")).unwrap_err().0, StatusCode::FORBIDDEN);
        assert_eq!(admin_org(&conn, &auth_user(None, "admin-1")).unwrap_err().0, StatusCode::FORBIDDEN);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn role_and_group_roundtrip() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");

        let role_id = "role-1";
        conn.execute(
            "INSERT INTO rbac_roles (id, organization_id, name, permissions, created_by) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![role_id, "org-1", "Agent Reader", "[\"read:agents\"]", "admin-1"],
        )
        .unwrap();
        let role = find_role(&conn, role_id, "org-1").unwrap();
        assert_eq!(role["name"], "Agent Reader");
        assert_eq!(role["permissions"], json!(["read:agents"]));

        let group_id = "group-1";
        conn.execute(
            "INSERT INTO rbac_groups (id, organization_id, name, created_by) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![group_id, "org-1", "Engineering", "admin-1"],
        )
        .unwrap();
        replace_group_roles(&conn, group_id, "org-1", &[role_id.to_string()]).unwrap();
        let group = find_group(&conn, group_id, "org-1").unwrap();
        assert_eq!(group["name"], "Engineering");
        assert_eq!(group["role_ids"], json!([role_id]));

        let _ = std::fs::remove_file(&path);
    }
}
