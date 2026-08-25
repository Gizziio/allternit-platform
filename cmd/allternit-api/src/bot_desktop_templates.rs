//! Desktop template registry and presets.
//!
//! Provides CRUD for curated desktop environments and resolves templates at
//! provisioning time so callers can pass `?template_id=` instead of raw image
//! aliases.

use axum::extract::{Extension, Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};

use crate::auth::AuthUser;
use crate::AppState;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/desktop-templates", get(list_templates))
        .route("/desktop-templates", post(create_template))
        .route("/desktop-templates/:id", get(get_template))
        .route("/desktop-templates/:id", delete(delete_template))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesktopTemplate {
    pub id: String,
    pub org_id: Option<String>,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub os: String,
    pub image: String,
    pub cpu_millis: u32,
    pub memory_mib: u32,
    pub disk_mib: u32,
    pub network_enabled: bool,
    pub env: HashMap<String, String>,
    pub packages: Vec<String>,
    pub tags: Vec<String>,
    pub public: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    pub name: String,
    pub description: Option<String>,
    pub os: String,
    pub image: String,
    #[serde(default = "default_cpu")]
    pub cpu_millis: u32,
    #[serde(default = "default_memory")]
    pub memory_mib: u32,
    #[serde(default = "default_disk")]
    pub disk_mib: u32,
    #[serde(default = "default_true")]
    pub network_enabled: bool,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub packages: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub public: bool,
}

fn default_cpu() -> u32 { 2000 }
fn default_memory() -> u32 { 4096 }
fn default_disk() -> u32 { 20480 }
fn default_true() -> bool { true }

#[derive(Debug, Deserialize)]
pub struct ListTemplatesQuery {
    pub os: Option<String>,
    pub tag: Option<String>,
}

fn json_map(s: &str) -> HashMap<String, String> {
    serde_json::from_str(s).unwrap_or_default()
}

fn json_vec(s: &str) -> Vec<String> {
    serde_json::from_str(s).unwrap_or_default()
}

fn row_to_template(row: &rusqlite::Row<'_>) -> rusqlite::Result<DesktopTemplate> {
    Ok(DesktopTemplate {
        id: row.get(0)?,
        org_id: row.get(1)?,
        user_id: row.get(2)?,
        name: row.get(3)?,
        description: row.get(4)?,
        os: row.get(5)?,
        image: row.get(6)?,
        cpu_millis: row.get::<_, i64>(7)? as u32,
        memory_mib: row.get::<_, i64>(8)? as u32,
        disk_mib: row.get::<_, i64>(9)? as u32,
        network_enabled: row.get::<_, i64>(10)? == 1,
        env: json_map(&row.get::<_, String>(11)?),
        packages: json_vec(&row.get::<_, String>(12)?),
        tags: json_vec(&row.get::<_, String>(13)?),
        public: row.get::<_, i64>(14)? == 1,
    })
}

async fn list_templates(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Query(query): Query<ListTemplatesQuery>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let org_id = user.organization_id.clone();
    let os_filter = query.os.as_deref().map(|s| s.to_lowercase());
    let tag_filter = query.tag.as_deref().map(|s| s.to_lowercase());

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut sql = String::from(
            "SELECT id, org_id, user_id, name, description, os, image, cpu_millis, \
             memory_mib, disk_mib, network_enabled, env_json, packages_json, tags_json, public \
             FROM desktop_templates \
             WHERE (public = 1 OR user_id = ?1"
        );
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(user_id.clone())];
        if let Some(ref org) = org_id {
            sql.push_str(" OR org_id = ?2");
            params.push(Box::new(org.clone()));
        }
        sql.push(')');

        if let Some(ref os) = os_filter {
            sql.push_str(&format!(" AND lower(os) = ?{}", params.len() + 1));
            params.push(Box::new(os.clone()));
        }
        if tag_filter.is_some() {
            sql.push_str(&format!(" AND lower(tags_json) LIKE ?{}", params.len() + 1));
            params.push(Box::new(format!("%{}%", tag_filter.unwrap())));
        }
        sql.push_str(" ORDER BY name");

        let mut stmt = conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), row_to_template)?;
        let mut templates = Vec::new();
        for row in rows {
            templates.push(row?);
        }
        Ok::<_, rusqlite::Error>(templates)
    })
    .await;

    match result {
        Ok(Ok(templates)) => (StatusCode::OK, Json(json!({ "templates": templates }))).into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to list desktop templates");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("database error: {}", e)}))).into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked listing desktop templates");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn create_template(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateTemplateRequest>,
) -> impl IntoResponse {
    let id = format!("dtpl-{}", uuid::Uuid::new_v4().simple());
    let db = state.db.clone();
    let org_id = user.organization_id.clone();
    let user_id = user.user_id.clone();
    let created_by = user_id.clone();
    let public = if req.public { 1 } else { 0 };
    let network = if req.network_enabled { 1 } else { 0 };

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO desktop_templates \
             (id, org_id, user_id, name, description, os, image, cpu_millis, memory_mib, disk_mib, \
              network_enabled, env_json, packages_json, tags_json, public) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            rusqlite::params![
                &id,
                &org_id,
                &user_id,
                &req.name,
                &req.description,
                req.os.to_lowercase(),
                req.image,
                req.cpu_millis as i64,
                req.memory_mib as i64,
                req.disk_mib as i64,
                network,
                serde_json::to_string(&req.env).unwrap_or_default(),
                serde_json::to_string(&req.packages).unwrap_or_default(),
                serde_json::to_string(&req.tags).unwrap_or_default(),
                public,
            ],
        )?;
        Ok::<_, rusqlite::Error>(id)
    })
    .await;

    match result {
        Ok(Ok(id)) => {
            info!(template_id = %id, user_id = %created_by, "created desktop template");
            (StatusCode::CREATED, Json(json!({ "id": id }))).into_response()
        }
        Ok(Err(e)) => {
            warn!(error = %e, "failed to create desktop template");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("database error: {}", e)}))).into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked creating desktop template");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

async fn get_template(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match resolve_template(&state.db, &user, &id).await {
        Some(t) => (StatusCode::OK, Json(json!(t))).into_response(),
        None => (StatusCode::NOT_FOUND, Json(json!({"error": "template not found"}))).into_response(),
    }
}

async fn delete_template(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let user_id = user.user_id.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let rows = conn.execute(
            "DELETE FROM desktop_templates WHERE id = ?1 AND (user_id = ?2 OR (?3 = 'system' AND user_id = 'system'))",
            rusqlite::params![&id, &user_id, &user_id],
        )?;
        Ok::<_, rusqlite::Error>(rows)
    })
    .await;

    match result {
        Ok(Ok(0)) => (StatusCode::NOT_FOUND, Json(json!({"error": "template not found or access denied"}))).into_response(),
        Ok(Ok(_)) => (StatusCode::NO_CONTENT, ()).into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to delete desktop template");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": format!("database error: {}", e)}))).into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked deleting desktop template");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))).into_response()
        }
    }
}

/// Raw provisioning request used by the desktop router.
#[derive(Debug, Clone, Default)]
pub struct ProvisionRequest {
    pub os: Option<String>,
    pub template_id: Option<String>,
}

/// Resolved provisioning parameters after applying an optional template.
#[derive(Debug, Clone)]
pub struct ProvisionSpec {
    pub os: String,
    pub image: String,
    pub cpu_millis: u32,
    pub memory_mib: u32,
    pub disk_mib: Option<u32>,
    pub network_enabled: bool,
    pub env: HashMap<String, String>,
}

/// Resolve the final provisioning spec from a raw request and optional template.
pub async fn resolve_provision_spec(
    state: &Arc<AppState>,
    user: &AuthUser,
    req: &ProvisionRequest,
) -> Result<ProvisionSpec, (StatusCode, Json<serde_json::Value>)> {
    let mut os = req.os.as_deref().unwrap_or("linux").to_lowercase();
    let mut image = std::env::var("BOT_DESKTOP_IMAGE")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| match os.as_str() {
            "windows" => "allternit-desktop-windows".to_string(),
            _ => "allternit-desktop".to_string(),
        });
    let mut cpu_millis = 2000;
    let mut memory_mib = 4096;
    let mut disk_mib = Some(20480u32);
    let mut network_enabled = true;
    let mut env = HashMap::new();

    if let Some(ref template_id) = req.template_id {
        match resolve_template(&state.db, user, template_id).await {
            Some(t) => {
                os = t.os;
                image = t.image;
                cpu_millis = t.cpu_millis;
                memory_mib = t.memory_mib;
                disk_mib = Some(t.disk_mib);
                network_enabled = t.network_enabled;
                env = t.env;
            }
            None => {
                return Err((
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "desktop template not found"})),
                ));
            }
        }
    }

    Ok(ProvisionSpec {
        os,
        image,
        cpu_millis,
        memory_mib,
        disk_mib,
        network_enabled,
        env,
    })
}

/// Resolve a template if the user is allowed to see it.
pub async fn resolve_template(
    db: &crate::db::DbHandle,
    user: &AuthUser,
    id: &str,
) -> Option<DesktopTemplate> {
    let db = db.clone();
    let id = id.to_string();
    let user_id = user.user_id.clone();
    let org_id = user.organization_id.clone();

    tokio::task::spawn_blocking(move || {
        let conn = db.connect().ok()?;
        conn.query_row(
            "SELECT id, org_id, user_id, name, description, os, image, cpu_millis, \
             memory_mib, disk_mib, network_enabled, env_json, packages_json, tags_json, public \
             FROM desktop_templates \
             WHERE id = ?1 AND (public = 1 OR user_id = ?2 OR org_id = ?3)",
            rusqlite::params![id, user_id, org_id],
            row_to_template,
        )
        .optional()
        .ok()
        .flatten()
    })
    .await
    .ok()
    .flatten()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::AuthUser;
    use crate::db::DbHandle;

    fn test_user(user_id: &str, org_id: Option<&str>) -> AuthUser {
        AuthUser {
            user_id: user_id.to_string(),
            email: None,
            name: None,
            avatar_url: None,
            tenant_id: None,
            organization_id: org_id.map(|s| s.to_string()),
            organization_role: None,
            organization_slug: None,
        }
    }

    fn test_db() -> DbHandle {
        let path = std::env::temp_dir().join(format!(
            "allternit-desktop-templates-test-{}.db",
            uuid::Uuid::new_v4()
        ));
        DbHandle::new(path).expect("test db")
    }

    #[tokio::test]
    async fn public_presets_are_visible_to_all_users() {
        let db = test_db();
        let user = test_user("random-user", None);
        let resp = resolve_template(&db, &user, "preset-linux-ubuntu").await;
        assert!(resp.is_some());
        let t = resp.unwrap();
        assert_eq!(t.os, "linux");
        assert_eq!(t.image, "allternit-desktop");
    }

    #[tokio::test]
    async fn unknown_template_returns_none() {
        let db = test_db();
        let user = test_user("random-user", None);
        let resp = resolve_template(&db, &user, "does-not-exist").await;
        assert!(resp.is_none());
    }

    #[tokio::test]
    async fn user_created_template_is_resolvable_by_owner() {
        let db = test_db();
        let user = test_user("owner-1", None);
        let req = CreateTemplateRequest {
            name: "My Dev Desktop".to_string(),
            description: None,
            os: "linux".to_string(),
            image: "custom-image".to_string(),
            cpu_millis: 4000,
            memory_mib: 8192,
            disk_mib: 40960,
            network_enabled: false,
            env: {
                let mut m = HashMap::new();
                m.insert("FOO".to_string(), "bar".to_string());
                m
            },
            packages: vec!["neovim".to_string()],
            tags: vec!["dev".to_string()],
            public: false,
        };

        let db2 = db.clone();
        let user_id = user.user_id.clone();
        let id = tokio::task::spawn_blocking(move || {
            let conn = db2.connect()?;
            let id = format!("dtpl-{}", uuid::Uuid::new_v4().simple());
            conn.execute(
                "INSERT INTO desktop_templates \
                 (id, org_id, user_id, name, description, os, image, cpu_millis, memory_mib, disk_mib, \
                  network_enabled, env_json, packages_json, tags_json, public) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                rusqlite::params![
                    &id, None::<String>, &user_id, &req.name, &req.description,
                    req.os, req.image, req.cpu_millis as i64, req.memory_mib as i64,
                    req.disk_mib as i64, 0i32,
                    serde_json::to_string(&req.env).unwrap(),
                    serde_json::to_string(&req.packages).unwrap(),
                    serde_json::to_string(&req.tags).unwrap(),
                    0i32,
                ],
            )?;
            Ok::<_, rusqlite::Error>(id)
        })
        .await
        .unwrap()
        .unwrap();

        let resolved = resolve_template(&db, &user, &id).await;
        assert!(resolved.is_some());
        let t = resolved.unwrap();
        assert_eq!(t.image, "custom-image");
        assert_eq!(t.cpu_millis, 4000);
        assert_eq!(t.env.get("FOO"), Some(&"bar".to_string()));

        let other = test_user("other-user", None);
        assert!(resolve_template(&db, &other, &id).await.is_none());
    }
}
