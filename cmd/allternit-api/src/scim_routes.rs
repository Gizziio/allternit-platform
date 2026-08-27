//! SCIM v2 provisioning routes — organization-scoped Users and Groups.
//!
//! Endpoints follow the SCIM v2 core schema shape but are intentionally a
//! scaffold: full IdP protocol details (filtering, patch operations, ETags)
//! are follow-on work. SCIM users/groups are mapped to existing
//! `admin/rbac_roles` and `admin/rbac_groups` by name match where applicable.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post, put},
    Json, Router,
};
use rusqlite::{params, OptionalExtension, Transaction};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{auth::AuthUser, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/scim/v2/Users", get(list_users).post(create_user))
        .route(
            "/scim/v2/Users/:id",
            get(get_user).put(update_user).patch(patch_user).delete(delete_user),
        )
        .route("/scim/v2/Groups", get(list_groups).post(create_group))
        .route(
            "/scim/v2/Groups/:id",
            get(get_group).put(update_group).delete(delete_group),
        )
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"schemas": ["urn:ietf:params:scim:api:messages:2.0:Error"], "status": status.as_u16().to_string(), "scimType": code, "detail": message.into() })),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "scim operation failed");
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
            "Only organization owners/admins can manage SCIM provisioning.",
        ));
    }
    Ok(org.to_string())
}

fn scim_meta(resource_type: &str, created: &str, updated: &str) -> Value {
    json!({
        "resourceType": resource_type,
        "created": created,
        "lastModified": updated,
    })
}

// ─── Helpers: map SCIM roles to rbac_roles and ensure local user record ───────

fn org_tier_role(role_display: Option<&str>) -> &'static str {
    match role_display {
        Some(r) if r.eq_ignore_ascii_case("owner") => "owner",
        Some(r) if r.eq_ignore_ascii_case("admin") || r.eq_ignore_ascii_case("administrator") => "admin",
        _ => "member",
    }
}

fn upsert_local_user(
    tx: &Transaction,
    org_id: &str,
    user_id: &str,
    user_name: &str,
    email: Option<&str>,
    given_name: Option<&str>,
    family_name: Option<&str>,
    org_role: &str,
) -> Result<(), ApiError> {
    tx.execute(
        "INSERT INTO users (id, email, name, status) VALUES (?1, ?2, ?3, 'active')
         ON CONFLICT(id) DO UPDATE SET email = COALESCE(excluded.email, email), name = COALESCE(excluded.name, name)",
        params![user_id, email, given_name.or(family_name).or(Some(user_name))],
    ).map_err(internal)?;
    tx.execute(
        "INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(organization_id, user_id) DO UPDATE SET role = excluded.role",
        params![format!("{}:{}", org_id, user_id), org_id, user_id, org_role],
    ).map_err(internal)?;
    Ok(())
}

fn sync_scim_user_role_mappings(
    tx: &Transaction,
    scim_user_id: &str,
    org_id: &str,
    roles: &[ScimRole],
) -> Result<Vec<String>, ApiError> {
    tx.execute(
        "DELETE FROM scim_user_rbac_role_mappings WHERE scim_user_id = ?1",
        params![scim_user_id],
    ).map_err(internal)?;
    let mut role_ids = Vec::new();
    for role in roles {
        let name = role.display.as_deref().unwrap_or(role.value.as_deref().unwrap_or("")).trim();
        if name.is_empty() {
            continue;
        }
        let role_id: Option<String> = tx
            .query_row(
                "SELECT id FROM rbac_roles WHERE organization_id = ?1 AND name = ?2",
                params![org_id, name],
                |row| row.get(0),
            )
            .optional()
            .map_err(internal)?;
        if let Some(role_id) = role_id {
            tx.execute(
                "INSERT INTO scim_user_rbac_role_mappings (scim_user_id, rbac_role_id) VALUES (?1, ?2)",
                params![scim_user_id, role_id],
            ).map_err(internal)?;
            role_ids.push(role_id);
        }
    }
    Ok(role_ids)
}

fn rbac_role_ids_for_user(conn: &rusqlite::Connection, scim_user_id: &str) -> Result<Vec<String>, rusqlite::Error> {
    let mut stmt = conn.prepare("SELECT rbac_role_id FROM scim_user_rbac_role_mappings WHERE scim_user_id = ?1")?;
    let ids: Vec<String> = stmt.query_map([scim_user_id], |row| row.get(0))?.collect::<rusqlite::Result<Vec<String>>>()?;
    Ok(ids)
}

// ─── SCIM User payloads ─────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct ScimName {
    #[serde(default)]
    given_name: Option<String>,
    #[serde(default)]
    family_name: Option<String>,
}

#[derive(Deserialize, Debug)]
struct ScimEmail {
    value: String,
    #[serde(default)]
    primary: Option<bool>,
}

#[derive(Deserialize, Debug, Default)]
struct ScimRole {
    #[serde(default)]
    value: Option<String>,
    #[serde(default)]
    display: Option<String>,
}

#[derive(Deserialize, Debug)]
struct CreateUser {
    #[serde(default)]
    external_id: Option<String>,
    user_name: String,
    #[serde(default)]
    name: Option<ScimName>,
    #[serde(default)]
    emails: Vec<ScimEmail>,
    #[serde(default)]
    active: Option<bool>,
    #[serde(default)]
    roles: Vec<ScimRole>,
}

fn primary_email(emails: &[ScimEmail]) -> Option<String> {
    emails
        .iter()
        .find(|e| e.primary.unwrap_or(false))
        .or_else(|| emails.first())
        .map(|e| e.value.trim().to_lowercase())
        .filter(|e| !e.is_empty())
}

fn user_json(conn: &rusqlite::Connection, row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let id: String = row.get(0)?;
    let external_id: Option<String> = row.get(1)?;
    let user_name: String = row.get(2)?;
    let given_name: Option<String> = row.get(3)?;
    let family_name: Option<String> = row.get(4)?;
    let email: Option<String> = row.get(5)?;
    let active: bool = row.get::<_, i32>(6)? != 0;
    let created_at: String = row.get(7)?;
    let updated_at: String = row.get(8)?;
    let rbac_role_ids = rbac_role_ids_for_user(conn, &id).unwrap_or_default();
    Ok(json!({
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
        "id": id,
        "externalId": external_id,
        "userName": user_name,
        "name": { "givenName": given_name, "familyName": family_name },
        "emails": email.map(|e| vec![json!({"value": e, "primary": true, "type": "work"})]).unwrap_or_default(),
        "active": active,
        "roles": rbac_role_ids.iter().map(|id| json!({"value": id})).collect::<Vec<_>>(),
        "meta": scim_meta("User", &created_at, &updated_at),
    }))
}

fn find_user(conn: &rusqlite::Connection, id: &str, org: &str) -> Result<Value, ApiError> {
    conn.query_row(
        "SELECT id, external_id, user_name, given_name, family_name, email, active, created_at, updated_at FROM scim_users WHERE id = ?1 AND organization_id = ?2",
        params![id, org],
        |row| user_json(conn, row),
    )
    .optional()
    .map_err(internal)?
    .ok_or_else(|| error(StatusCode::NOT_FOUND, "not_found", "No such SCIM user."))
}

async fn create_user(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateUser>,
) -> Response {
    let user_name = body.user_name.trim().to_string();
    if user_name.is_empty() {
        return error(StatusCode::BAD_REQUEST, "invalid_value", "userName is required.").into_response();
    }
    let external_id = body.external_id;
    let email = primary_email(&body.emails);
    let given = body.name.as_ref().and_then(|n| n.given_name.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from));
    let family = body.name.as_ref().and_then(|n| n.family_name.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from));
    let active = body.active.unwrap_or(true);
    let org_role = org_tier_role(body.roles.first().and_then(|r| r.display.as_deref().or(r.value.as_deref())));
    let roles = body.roles;
    let result = tokio::task::spawn_blocking(move || {
        let mut conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let tx = conn.transaction().map_err(internal)?;
        let id = uuid::Uuid::new_v4().to_string();

        tx.execute(
            "INSERT INTO scim_users (id, organization_id, external_id, user_name, given_name, family_name, email, active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, org, external_id, user_name, given, family, email, if active { 1 } else { 0 }],
        ).map_err(internal)?;

        upsert_local_user(&tx, &org, &id, &user_name, email.as_deref(), given.as_deref(), family.as_deref(), org_role)?;
        sync_scim_user_role_mappings(&tx, &id, &org, &roles)?;

        tx.commit().map_err(internal)?;
        find_user(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => (StatusCode::CREATED, Json(v)).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(default)]
    start_index: Option<usize>,
    #[serde(default)]
    count: Option<usize>,
}

async fn list_users(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListQuery>,
) -> Response {
    let start = query.start_index.unwrap_or(1).saturating_sub(1);
    let count = query.count.unwrap_or(100).min(100);
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM scim_users WHERE organization_id = ?1",
            params![org],
            |row| row.get(0),
        ).map_err(internal)?;
        let mut stmt = conn.prepare(
            "SELECT id, external_id, user_name, given_name, family_name, email, active, created_at, updated_at FROM scim_users WHERE organization_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
        ).map_err(internal)?;
        let rows = stmt
            .query_map(params![org, count, start], |row| user_json(&conn, row))
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(json!({
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": total,
            "startIndex": start + 1,
            "itemsPerPage": rows.len(),
            "Resources": rows,
        }))
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn get_user(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_user(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateUser {
    #[serde(default)]
    external_id: Option<String>,
    #[serde(default)]
    user_name: Option<String>,
    #[serde(default)]
    name: Option<ScimName>,
    #[serde(default)]
    emails: Option<Vec<ScimEmail>>,
    #[serde(default)]
    active: Option<bool>,
    #[serde(default)]
    roles: Option<Vec<ScimRole>>,
}

async fn update_user(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateUser>,
) -> Response {
    let email = body.emails.map(|e| primary_email(&e)).flatten();
    let given = body.name.as_ref().and_then(|n| n.given_name.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from));
    let family = body.name.as_ref().and_then(|n| n.family_name.as_deref().map(str::trim).filter(|s| !s.is_empty()).map(String::from));
    let active = body.active.map(|a| if a { 1 } else { 0 });
    let external_id = body.external_id;
    let user_name = body.user_name.map(|n| n.trim().to_string());
    let roles = body.roles;
    let result = tokio::task::spawn_blocking(move || {
        let mut conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_user(&conn, &id, &org)?;
        let tx = conn.transaction().map_err(internal)?;
        tx.execute(
            "UPDATE scim_users SET external_id = COALESCE(?1, external_id), user_name = COALESCE(?2, user_name), given_name = COALESCE(?3, given_name), family_name = COALESCE(?4, family_name), email = COALESCE(?5, email), active = COALESCE(?6, active), updated_at = CURRENT_TIMESTAMP WHERE id = ?7 AND organization_id = ?8",
            params![external_id, user_name.as_deref(), given, family, email, active, id, org],
        ).map_err(internal)?;

        if let Some(ref roles) = roles {
            let org_role = org_tier_role(roles.first().and_then(|r| r.display.as_deref().or(r.value.as_deref())));
            let name = user_name.as_deref().unwrap_or("");
            upsert_local_user(&tx, &org, &id, name, email.as_deref(), given.as_deref(), family.as_deref(), org_role)?;
            sync_scim_user_role_mappings(&tx, &id, &org, roles)?;
        }

        tx.commit().map_err(internal)?;
        find_user(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct PatchUser {
    active: Option<bool>,
}

async fn patch_user(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<PatchUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_user(&conn, &id, &org)?;
        if let Some(active) = body.active {
            conn.execute(
                "UPDATE scim_users SET active = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2 AND organization_id = ?3",
                params![if active { 1 } else { 0 }, id, org],
            ).map_err(internal)?;
        }
        find_user(&conn, &id, &org)
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

async fn delete_user(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let changed = conn.execute(
            "DELETE FROM scim_users WHERE id = ?1 AND organization_id = ?2",
            params![id, org],
        ).map_err(internal)?;
        if changed == 0 {
            return Err(error(StatusCode::NOT_FOUND, "not_found", "No such SCIM user."));
        }
        Ok::<_, ApiError>(())
    }).await;
    match result {
        Ok(Ok(())) => StatusCode::NO_CONTENT.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

// ─── SCIM Groups ────────────────────────────────────────────────────────────

#[derive(Deserialize, Debug)]
struct ScimMember {
    value: String,
    #[serde(default)]
    #[allow(dead_code)]
    display: Option<String>,
}

#[derive(Deserialize, Debug)]
struct CreateGroup {
    #[serde(default)]
    external_id: Option<String>,
    display_name: String,
    #[serde(default)]
    members: Vec<ScimMember>,
}

fn sync_group_members(
    tx: &Transaction,
    group_id: &str,
    members: &[ScimMember],
) -> Result<(), ApiError> {
    tx.execute(
        "DELETE FROM scim_group_members WHERE group_id = ?1",
        params![group_id],
    ).map_err(internal)?;
    for member in members {
        tx.execute(
            "INSERT INTO scim_group_members (id, group_id, user_id) VALUES (?1, ?2, ?3) ON CONFLICT(group_id, user_id) DO NOTHING",
            params![uuid::Uuid::new_v4().to_string(), group_id, member.value.trim()],
        ).map_err(internal)?;
    }
    Ok(())
}

fn sync_group_rbac_mapping(
    tx: &Transaction,
    group_id: &str,
    org_id: &str,
    display_name: &str,
) -> Result<Vec<String>, ApiError> {
    tx.execute(
        "DELETE FROM scim_group_rbac_group_mappings WHERE scim_group_id = ?1",
        params![group_id],
    ).map_err(internal)?;
    let rbac_group_id: Option<String> = tx
        .query_row(
            "SELECT id FROM rbac_groups WHERE organization_id = ?1 AND name = ?2",
            params![org_id, display_name],
            |row| row.get(0),
        )
        .optional()
        .map_err(internal)?;
    if let Some(rbac_group_id) = rbac_group_id {
        tx.execute(
            "INSERT INTO scim_group_rbac_group_mappings (scim_group_id, rbac_group_id) VALUES (?1, ?2)",
            params![group_id, rbac_group_id],
        ).map_err(internal)?;
        Ok(vec![rbac_group_id])
    } else {
        Ok(vec![])
    }
}

fn group_members_json(conn: &rusqlite::Connection, group_id: &str) -> Result<Vec<Value>, ApiError> {
    let mut stmt = conn
        .prepare("SELECT user_id FROM scim_group_members WHERE group_id = ?1")
        .map_err(internal)?;
    let rows = stmt
        .query_map([group_id], |row| Ok(json!({"value": row.get::<_, String>(0)?, "type": "User"})))
        .map_err(internal)?
        .collect::<rusqlite::Result<Vec<_>>>()
        .map_err(internal)?;
    Ok(rows)
}

fn group_json(conn: &rusqlite::Connection, row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let id: String = row.get(0)?;
    let external_id: Option<String> = row.get(1)?;
    let display_name: String = row.get(2)?;
    let created_at: String = row.get(3)?;
    let updated_at: String = row.get(4)?;
    let members = group_members_json(conn, &id).unwrap_or_default();
    Ok(json!({
        "schemas": ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        "id": id,
        "externalId": external_id,
        "displayName": display_name,
        "members": members,
        "meta": scim_meta("Group", &created_at, &updated_at),
    }))
}

fn find_group(conn: &rusqlite::Connection, id: &str, org: &str) -> Result<Value, ApiError> {
    conn.query_row(
        "SELECT id, external_id, display_name, created_at, updated_at FROM scim_groups WHERE id = ?1 AND organization_id = ?2",
        params![id, org],
        |row| group_json(conn, row),
    )
    .optional()
    .map_err(internal)?
    .ok_or_else(|| error(StatusCode::NOT_FOUND, "not_found", "No such SCIM group."))
}

async fn create_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<CreateGroup>,
) -> Response {
    let display_name = body.display_name.trim().to_string();
    if display_name.is_empty() {
        return error(StatusCode::BAD_REQUEST, "invalid_value", "displayName is required.").into_response();
    }
    let external_id = body.external_id;
    let members = body.members;
    let result = tokio::task::spawn_blocking(move || {
        let mut conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let tx = conn.transaction().map_err(internal)?;
        let id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO scim_groups (id, organization_id, external_id, display_name) VALUES (?1, ?2, ?3, ?4)",
            params![id, org, external_id, display_name],
        ).map_err(internal)?;
        sync_group_members(&tx, &id, &members)?;
        sync_group_rbac_mapping(&tx, &id, &org, &display_name)?;
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
    Query(query): Query<ListQuery>,
) -> Response {
    let start = query.start_index.unwrap_or(1).saturating_sub(1);
    let count = query.count.unwrap_or(100).min(100);
    let result = tokio::task::spawn_blocking(move || -> Result<Value, ApiError> {
        let conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        let total: i64 = conn.query_row(
            "SELECT COUNT(*) FROM scim_groups WHERE organization_id = ?1",
            params![org],
            |row| row.get(0),
        ).map_err(internal)?;
        let mut stmt = conn.prepare(
            "SELECT id, external_id, display_name, created_at, updated_at FROM scim_groups WHERE organization_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3"
        ).map_err(internal)?;
        let rows = stmt
            .query_map(params![org, count, start], |row| group_json(&conn, row))
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;
        Ok(json!({
            "schemas": ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
            "totalResults": total,
            "startIndex": start + 1,
            "itemsPerPage": rows.len(),
            "Resources": rows,
        }))
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
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
    }).await;
    match result {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Deserialize)]
struct UpdateGroup {
    #[serde(default)]
    external_id: Option<String>,
    #[serde(default)]
    display_name: Option<String>,
    #[serde(default)]
    members: Option<Vec<ScimMember>>,
}

async fn update_group(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Json(body): Json<UpdateGroup>,
) -> Response {
    if let Some(name) = &body.display_name {
        if name.trim().is_empty() {
            return error(StatusCode::BAD_REQUEST, "invalid_value", "displayName must not be empty.").into_response();
        }
    }
    let external_id = body.external_id;
    let display_name = body.display_name.map(|n| n.trim().to_string());
    let members = body.members;
    let result = tokio::task::spawn_blocking(move || {
        let mut conn = state.db.connect().map_err(internal)?;
        let org = admin_org(&conn, &user)?;
        find_group(&conn, &id, &org)?;
        let tx = conn.transaction().map_err(internal)?;
        tx.execute(
            "UPDATE scim_groups SET external_id = COALESCE(?1, external_id), display_name = COALESCE(?2, display_name), updated_at = CURRENT_TIMESTAMP WHERE id = ?3 AND organization_id = ?4",
            params![external_id, display_name.as_deref(), id, org],
        ).map_err(internal)?;
        if let Some(ref members) = members {
            sync_group_members(&tx, &id, members)?;
        }
        if let Some(ref display_name) = display_name {
            sync_group_rbac_mapping(&tx, &id, &org, display_name)?;
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
        let changed = conn.execute(
            "DELETE FROM scim_groups WHERE id = ?1 AND organization_id = ?2",
            params![id, org],
        ).map_err(internal)?;
        if changed == 0 {
            return Err(error(StatusCode::NOT_FOUND, "not_found", "No such SCIM group."));
        }
        Ok::<_, ApiError>(())
    }).await;
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
    fn org_tier_role_derives_from_scim_role() {
        assert_eq!(org_tier_role(Some("owner")), "owner");
        assert_eq!(org_tier_role(Some("Admin")), "admin");
        assert_eq!(org_tier_role(Some("user")), "member");
        assert_eq!(org_tier_role(None), "member");
    }

    #[test]
    fn primary_email_prefers_primary_flag() {
        let emails = vec![
            ScimEmail { value: "a@example.com".into(), primary: Some(false) },
            ScimEmail { value: "b@example.com".into(), primary: Some(true) },
        ];
        assert_eq!(primary_email(&emails), Some("b@example.com".to_string()));
    }

    use crate::db::DbHandle;

    fn test_db() -> (String, DbHandle) {
        let id = uuid::Uuid::new_v4().to_string();
        let path = std::env::temp_dir().join(format!("allternit-scim-test-{}.db", id));
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
    fn scim_user_roundtrip_and_rbac_mapping() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");
        conn.execute(
            "INSERT INTO rbac_roles (id, organization_id, name, permissions, created_by) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params!["role-1", "org-1", "Engineering", "[]", "admin-1"],
        ).unwrap();

        let user_id = "scim-user-1";
        conn.execute(
            "INSERT INTO scim_users (id, organization_id, external_id, user_name, given_name, family_name, email, active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![user_id, "org-1", "ext-1", "alice", "Alice", "A", "alice@example.com", 1],
        ).unwrap();
        conn.execute(
            "INSERT INTO scim_user_rbac_role_mappings (scim_user_id, rbac_role_id) VALUES (?1, ?2)",
            rusqlite::params![user_id, "role-1"],
        ).unwrap();

        let user = find_user(&conn, user_id, "org-1").unwrap();
        assert_eq!(user["userName"], "alice");
        assert_eq!(user["active"], true);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn scim_group_roundtrip_and_members() {
        let (path, db) = test_db();
        let conn = db.connect().unwrap();
        seed_org_user(&conn, "org-1", "admin-1", "admin");

        let user_id = "scim-user-1";
        conn.execute(
            "INSERT INTO scim_users (id, organization_id, external_id, user_name, given_name, family_name, email, active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![user_id, "org-1", "ext-u1", "alice", "Alice", "A", "alice@example.com", 1],
        ).unwrap();

        let group_id = "scim-group-1";
        conn.execute(
            "INSERT INTO scim_groups (id, organization_id, external_id, display_name) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![group_id, "org-1", "ext-g1", "Engineering"],
        ).unwrap();
        conn.execute(
            "INSERT INTO scim_group_members (id, group_id, user_id) VALUES (?1, ?2, ?3)",
            rusqlite::params!["gm-1", group_id, user_id],
        ).unwrap();

        let group = find_group(&conn, group_id, "org-1").unwrap();
        assert_eq!(group["displayName"], "Engineering");
        assert_eq!(group["members"].as_array().unwrap().len(), 1);

        let _ = std::fs::remove_file(&path);
    }
}
