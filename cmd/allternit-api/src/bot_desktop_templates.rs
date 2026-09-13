//! Desktop template registry and presets.
//!
//! Provides CRUD for curated desktop environments and resolves templates at
//! provisioning time so callers can pass `?template_id=` instead of raw image
//! aliases.

use axum::body::Bytes;
use axum::extract::{Extension, Path, Query, State};
use axum::http::{header, StatusCode};
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
        .route("/desktop-templates/import", post(import_template))
        .route("/desktop-templates/by-ref/*ref", get(get_template_by_ref))
        .route("/desktop-templates/:id", get(get_template))
        .route("/desktop-templates/:id", delete(delete_template))
        .route("/desktop-templates/:id/export", get(export_template))
        .route("/desktop-templates/:id/build", post(build_template))
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
    /// Canonical `apiVersion: allternit.ai/v1` `ComputerTemplate` doc (YAML).
    /// Source of truth on write; the columns above are the resolved view.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spec_yaml: Option<String>,
    /// Curated `system/...` ref. Seeded by migration; never user-writable.
    #[serde(rename = "ref", skip_serializing_if = "Option::is_none")]
    pub ref_: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub golden_snapshot_id: Option<String>,
    /// NULL = never built, otherwise pending|building|ready|failed.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub build_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub build_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub built_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTemplateRequest {
    /// Instantiate a private copy of a curated `system/...` catalog entry
    /// instead of specifying fields inline. When set, all other fields are
    /// ignored (the catalog spec doc is the source of truth).
    #[serde(default)]
    pub catalog_ref: Option<String>,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub os: String,
    #[serde(default)]
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

fn default_cpu() -> u32 {
    2000
}
fn default_memory() -> u32 {
    4096
}
fn default_disk() -> u32 {
    20480
}
fn default_true() -> bool {
    true
}

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
        spec_yaml: row.get(15)?,
        ref_: row.get(16)?,
        golden_snapshot_id: row.get(17)?,
        build_status: row.get(18)?,
        build_error: row.get(19)?,
        built_at: row.get(20)?,
    })
}

const TEMPLATE_COLUMNS: &str = "id, org_id, user_id, name, description, os, image, cpu_millis, \
     memory_mib, disk_mib, network_enabled, env_json, packages_json, tags_json, public, \
     spec_yaml, ref, golden_snapshot_id, build_status, build_error, built_at";

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
             memory_mib, disk_mib, network_enabled, env_json, packages_json, tags_json, public, \
             spec_yaml, ref, golden_snapshot_id, build_status, build_error, built_at \
             FROM desktop_templates \
             WHERE (public = 1 OR user_id = ?1",
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
        Ok(Ok(templates)) => {
            (StatusCode::OK, Json(json!({ "templates": templates }))).into_response()
        }
        Ok(Err(e)) => {
            warn!(error = %e, "failed to list desktop templates");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("database error: {}", e)})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked listing desktop templates");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

async fn create_template(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(req): Json<CreateTemplateRequest>,
) -> impl IntoResponse {
    // Catalog-ref path: instantiate a caller-owned copy of a curated
    // `system/...` entry. The spec doc is the source of truth.
    if let Some(reference) = req.catalog_ref.as_deref() {
        let Some(entry) = crate::template_catalog::get_catalog_entry(reference) else {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": format!("unknown catalog ref {reference:?}")})),
            )
                .into_response();
        };
        let spec_yaml = match entry.spec.to_yaml() {
            Ok(y) => y,
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": e})),
                )
                    .into_response()
            }
        };
        let db = state.db.clone();
        let org_id = user.organization_id.clone();
        let user_id = user.user_id.clone();
        let user_id_for_log = user_id.clone();
        let name = entry.spec.metadata.name.clone();
        let result = tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            let outcome = upsert_template_from_spec(
                &conn,
                org_id.as_deref(),
                &user_id,
                &entry.spec,
                &spec_yaml,
            )?;
            conn.query_row(
                &format!("SELECT {TEMPLATE_COLUMNS} FROM desktop_templates WHERE id = ?1"),
                rusqlite::params![outcome.id],
                row_to_template,
            )
            .map(|t| (outcome, t))
        })
        .await;
        return match result {
            Ok(Ok((outcome, template))) => {
                info!(template_id = %outcome.id, user_id = %user_id_for_log, name = %name, catalog_ref = %reference, "created desktop template from catalog");
                let status = if outcome.changed {
                    StatusCode::CREATED
                } else {
                    StatusCode::OK
                };
                (status, Json(json!(template))).into_response()
            }
            Ok(Err(e)) => {
                warn!(error = %e, "failed to create desktop template from catalog");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": format!("database error: {}", e)})),
                )
                    .into_response()
            }
            Err(e) => {
                warn!(error = %e, "task panicked creating desktop template from catalog");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({"error": "internal error"})),
                )
                    .into_response()
            }
        };
    }

    let id = format!("dtpl-{}", uuid::Uuid::new_v4().simple());
    if req.name.trim().is_empty() || req.os.trim().is_empty() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error": "name and os must be non-empty"})),
        )
            .into_response();
    }
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
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("database error: {}", e)})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked creating desktop template");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
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
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "template not found"})),
        )
            .into_response(),
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
        Ok(Ok(0)) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "template not found or access denied"})),
        )
            .into_response(),
        Ok(Ok(_)) => (StatusCode::NO_CONTENT, ()).into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to delete desktop template");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("database error: {}", e)})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked deleting desktop template");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Templates as code: the `apiVersion: allternit.ai/v1` `ComputerTemplate` doc.
// ---------------------------------------------------------------------------

pub const TEMPLATE_API_VERSION: &str = "allternit.ai/v1";
pub const TEMPLATE_KIND: &str = "ComputerTemplate";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TemplateMetadata {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TemplateOs {
    #[serde(default = "default_template_os_name")]
    pub name: String,
    /// "" means "the default image for this os" (resolved at provision time).
    #[serde(default)]
    pub image: String,
}

impl Default for TemplateOs {
    fn default() -> Self {
        Self {
            name: default_template_os_name(),
            image: String::new(),
        }
    }
}

fn default_template_os_name() -> String {
    "linux".to_string()
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TemplateHardware {
    #[serde(default = "default_cpu_cores")]
    pub cpu_cores: i64,
    #[serde(default = "default_memory_mb")]
    pub memory_mb: i64,
    #[serde(default = "default_disk_mb")]
    pub disk_mb: i64,
    /// [width, height]; validated against VALIDATED_RESOLUTIONS.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolution: Option<[i64; 2]>,
}

impl Default for TemplateHardware {
    fn default() -> Self {
        Self {
            cpu_cores: default_cpu_cores(),
            memory_mb: default_memory_mb(),
            disk_mb: default_disk_mb(),
            resolution: None,
        }
    }
}

fn default_cpu_cores() -> i64 {
    2
}
fn default_memory_mb() -> i64 {
    4096
}
fn default_disk_mb() -> i64 {
    20480
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TemplateService {
    pub name: String,
    pub command: String,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub autostart: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TemplateSecret {
    /// Env var name injected into services/hooks at build time.
    pub name: String,
    /// Only `vault://org/{org_id}/{cred_name}` in v1. Value never stored.
    #[serde(rename = "ref")]
    pub ref_: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct TemplateHooks {
    /// Run inside the build guest BEFORE package installation.
    #[serde(default, rename = "preBuild")]
    pub pre_build: Vec<String>,
    /// Run inside the build guest AFTER packages/services (post-build).
    #[serde(default, rename = "postCreate")]
    pub post_create: Vec<String>,
}

/// Declarative template doc (YAML; JSON is a subset so serde_yaml parses both).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ComputerTemplateSpec {
    #[serde(rename = "apiVersion")]
    pub api_version: String,
    pub kind: String,
    pub metadata: TemplateMetadata,
    #[serde(default)]
    pub os: TemplateOs,
    #[serde(default)]
    pub hardware: TemplateHardware,
    #[serde(default)]
    pub packages: Vec<String>,
    /// Arbitrary install scripts (shell) run as root after apt packages and
    /// before services/hooks during the golden build.
    #[serde(default, rename = "installScripts")]
    pub install_scripts: Vec<String>,
    #[serde(default)]
    pub services: Vec<TemplateService>,
    #[serde(default)]
    pub secrets: Vec<TemplateSecret>,
    #[serde(default)]
    pub hooks: TemplateHooks,
}

/// A parsed `vault://org/{org_id}/{cred_name}` secret reference.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultSecretRef {
    pub org_id: String,
    pub name: String,
}

pub fn parse_vault_secret_ref(reference: &str) -> Result<VaultSecretRef, String> {
    let rest = reference
        .strip_prefix("vault://org/")
        .ok_or_else(|| format!("secret ref must start with vault://org/: {reference}"))?;
    let (org_id, name) = rest
        .split_once('/')
        .ok_or_else(|| format!("secret ref must be vault://org/{{org_id}}/{{name}}: {reference}"))?;
    if org_id.is_empty() || name.is_empty() || name.contains('/') {
        return Err(format!("secret ref must be vault://org/{{org_id}}/{{name}}: {reference}"));
    }
    Ok(VaultSecretRef {
        org_id: org_id.to_string(),
        name: name.to_string(),
    })
}

fn valid_env_name(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
}

fn valid_unit_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 128
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
}

/// High-signal detector for pasted credential material (PEM/private-key
/// blocks) in template files. Template docs carry vault refs by name only;
/// anything that looks like an actual secret value is rejected at the gate.
/// Deliberately conservative — one unambiguous marker — to avoid false
/// positives on ordinary env values and shell commands.
fn looks_like_literal_secret(value: &str) -> bool {
    value.contains("-----BEGIN")
}

impl ComputerTemplateSpec {
    /// Structural validation. Returns the first problem found; handlers map it
    /// to 422.
    pub fn validate(&self) -> Result<(), String> {
        if self.api_version != TEMPLATE_API_VERSION {
            return Err(format!(
                "unknown apiVersion {:?}; expected {TEMPLATE_API_VERSION:?}",
                self.api_version
            ));
        }
        if self.kind != TEMPLATE_KIND {
            return Err(format!(
                "unknown kind {:?}; expected {TEMPLATE_KIND:?}",
                self.kind
            ));
        }
        let name = self.metadata.name.trim();
        if name.is_empty() || name.len() > 128 {
            return Err("metadata.name must be 1-128 characters".to_string());
        }
        match self.os.name.as_str() {
            "linux" | "windows" | "macos" => {}
            other => return Err(format!("unknown os {other:?}; expected linux, windows, or macos")),
        }
        let hw = &self.hardware;
        if !VALIDATED_CPU_CORES.contains(&hw.cpu_cores) {
            return Err(format!(
                "hardware.cpu_cores must be one of {VALIDATED_CPU_CORES:?}"
            ));
        }
        if !VALIDATED_MEMORY_MB.contains(&hw.memory_mb) {
            return Err(format!(
                "hardware.memory_mb must be one of {VALIDATED_MEMORY_MB:?}"
            ));
        }
        if !VALIDATED_DISK_MB.contains(&hw.disk_mb) {
            return Err(format!(
                "hardware.disk_mb must be one of {VALIDATED_DISK_MB:?}"
            ));
        }
        if let Some([w, h]) = hw.resolution {
            let resolution = format!("{w}x{h}");
            if !VALIDATED_RESOLUTIONS.contains(&resolution.as_str()) {
                return Err(format!(
                    "hardware.resolution must be one of {VALIDATED_RESOLUTIONS:?}"
                ));
            }
        }
        for package in &self.packages {
            if package.trim().is_empty()
                || package
                    .chars()
                    .any(|c| c.is_whitespace() || c == ';' || c == '|' || c == '&')
            {
                return Err(format!("invalid package name {package:?}"));
            }
        }
        for script in &self.install_scripts {
            if script.trim().is_empty() {
                return Err("installScripts entries must be non-empty".to_string());
            }
            if looks_like_literal_secret(script) {
                return Err(
                    "installScripts entry looks like it contains a literal secret \
                     (PEM/private-key material); use a vault://org/... secret ref instead"
                        .to_string(),
                );
            }
        }
        for service in &self.services {
            if !valid_unit_name(&service.name) {
                return Err(format!("invalid service name {:?}", service.name));
            }
            if service.command.trim().is_empty() {
                return Err(format!("service {:?} has an empty command", service.name));
            }
            for key in service.env.keys() {
                if !valid_env_name(key) {
                    return Err(format!("invalid env var name {key:?} on service {:?}", service.name));
                }
            }
            for (key, value) in &service.env {
                if looks_like_literal_secret(value) {
                    return Err(format!(
                        "service {:?} env {key:?} looks like a literal secret (PEM/private-key \
                         material); use a vault://org/... secret ref instead",
                        service.name
                    ));
                }
            }
        }
        for secret in &self.secrets {
            if !valid_env_name(&secret.name) {
                return Err(format!("invalid secret env var name {:?}", secret.name));
            }
            parse_vault_secret_ref(&secret.ref_)?;
        }
        for hook in self
            .hooks
            .pre_build
            .iter()
            .chain(self.hooks.post_create.iter())
        {
            if hook.trim().is_empty() {
                return Err("hooks entries must be non-empty".to_string());
            }
            if looks_like_literal_secret(hook) {
                return Err(
                    "hook looks like it contains a literal secret (PEM/private-key material); \
                     use a vault://org/... secret ref instead"
                        .to_string(),
                );
            }
        }
        Ok(())
    }

    /// The resolved/effective view persisted into the legacy columns. The spec
    /// doc stays the source of truth; these columns are what provisioning reads.
    pub fn effective_view(&self) -> TemplateEffectiveView {
        let mut env = HashMap::new();
        if let Some([w, h]) = self.hardware.resolution {
            env.insert(
                "ALLTERNIT_DESKTOP_RESOLUTION".to_string(),
                format!("{w}x{h}"),
            );
        }
        TemplateEffectiveView {
            name: self.metadata.name.trim().to_string(),
            description: self
                .metadata
                .description
                .as_ref()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
            os: self.os.name.to_lowercase(),
            image: self.os.image.trim().to_string(),
            cpu_millis: (self.hardware.cpu_cores * 1000) as u32,
            memory_mib: self.hardware.memory_mb as u32,
            disk_mib: self.hardware.disk_mb as u32,
            env,
            packages: self.packages.clone(),
            tags: self.metadata.tags.clone(),
        }
    }

    /// Serialize to the canonical YAML form stored in `spec_yaml`.
    pub fn to_yaml(&self) -> Result<String, String> {
        serde_yaml::to_string(self).map_err(|e| format!("failed to serialize template doc: {e}"))
    }
}

/// Reconstruct a canonical doc from a stored row (used by export when the row
/// predates spec_yaml — e.g. the seeded system presets).
pub fn spec_doc_from_template(t: &DesktopTemplate) -> ComputerTemplateSpec {
    let resolution = t
        .env
        .get("ALLTERNIT_DESKTOP_RESOLUTION")
        .and_then(|v| v.split_once('x'))
        .and_then(|(w, h)| {
            let w: i64 = w.parse().ok()?;
            let h: i64 = h.parse().ok()?;
            Some([w, h])
        });
    ComputerTemplateSpec {
        api_version: TEMPLATE_API_VERSION.to_string(),
        kind: TEMPLATE_KIND.to_string(),
        metadata: TemplateMetadata {
            name: t.name.clone(),
            description: t.description.clone(),
            tags: t.tags.clone(),
        },
        os: TemplateOs {
            name: t.os.clone(),
            image: t.image.clone(),
        },
        hardware: TemplateHardware {
            cpu_cores: (t.cpu_millis / 1000) as i64,
            memory_mb: t.memory_mib as i64,
            disk_mb: t.disk_mib as i64,
            resolution,
        },
        packages: t.packages.clone(),
        install_scripts: vec![],
        services: vec![],
        secrets: vec![],
        hooks: TemplateHooks::default(),
    }
}

pub struct TemplateEffectiveView {
    pub name: String,
    pub description: Option<String>,
    pub os: String,
    pub image: String,
    pub cpu_millis: u32,
    pub memory_mib: u32,
    pub disk_mib: u32,
    pub env: HashMap<String, String>,
    pub packages: Vec<String>,
    pub tags: Vec<String>,
}

// ---------------------------------------------------------------------------
// Golden builds: state machine + provision-source selection.
// ---------------------------------------------------------------------------

pub const BUILD_STATUS_PENDING: &str = "pending";
pub const BUILD_STATUS_BUILDING: &str = "building";
pub const BUILD_STATUS_READY: &str = "ready";
pub const BUILD_STATUS_FAILED: &str = "failed";

/// Allowed `build_status` transitions. `None` = never built.
/// Rebuild (→ building) is allowed from any terminal-or-never state; the build
/// pipeline deletes the old golden holder first.
pub fn build_transition_allowed(from: Option<&str>, to: &str) -> bool {
    match (from, to) {
        (Some(BUILD_STATUS_BUILDING), BUILD_STATUS_BUILDING) => false,
        (_, BUILD_STATUS_BUILDING) => true,
        (Some(BUILD_STATUS_BUILDING), BUILD_STATUS_READY) => true,
        (Some(BUILD_STATUS_BUILDING), BUILD_STATUS_FAILED) => true,
        (None, BUILD_STATUS_PENDING) => true,
        _ => false,
    }
}

/// A ready golden snapshot plus its (stopped) holder VM, ready to be cloned.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GoldenSource {
    pub snapshot_id: String,
    pub holder_native_id: String,
    pub holder_provider: String,
    pub holder_os: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProvisionSource {
    /// Clone the golden snapshot (fast boot).
    Golden(GoldenSource),
    /// Spawn from the base image (today's behavior).
    Image,
}

/// Decide how a computer for this template should come into being. Pure so the
/// state machine is unit-testable without a driver.
pub fn select_provision_source(
    build_status: Option<&str>,
    golden_snapshot_id: Option<&str>,
    holder: Option<GoldenSource>,
) -> ProvisionSource {
    if build_status == Some(BUILD_STATUS_READY)
        && golden_snapshot_id.is_some()
        && holder.is_some()
    {
        return ProvisionSource::Golden(holder.expect("checked above"));
    }
    ProvisionSource::Image
}

/// POST /api/v1/desktop-templates/import — create/replace-by-name for the
/// caller from a canonical template doc. YAML or JSON body (YAML is a JSON
/// superset; one serde_yaml deserializer handles both).
async fn import_template(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    body: Bytes,
) -> impl IntoResponse {
    // Reject curated-ref writes before deserialization: `ref` is seeded-only.
    let raw: serde_yaml::Value = match serde_yaml::from_slice(&body) {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({"error": format!("invalid template doc: {e}")})),
            )
                .into_response()
        }
    };
    let has_ref = raw.get("ref").is_some()
        || raw
            .get("metadata")
            .and_then(|m| m.get("ref"))
            .is_some();
    if has_ref {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "ref is curated-only and cannot be set via import"})),
        )
            .into_response();
    }
    let spec: ComputerTemplateSpec = match serde_yaml::from_value(raw) {
        Ok(s) => s,
        Err(e) => {
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({"error": format!("invalid template doc: {e}")})),
            )
                .into_response()
        }
    };
    if let Err(e) = spec.validate() {
        return (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(json!({"error": e})),
        )
            .into_response();
    }
    let spec_yaml = match spec.to_yaml() {
        Ok(y) => y,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": e})),
            )
                .into_response()
        }
    };
    let db = state.db.clone();
    let org_id = user.organization_id.clone();
    let user_id = user.user_id.clone();
    let user_id_for_log = user_id.clone();
    let name = spec.metadata.name.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let outcome = upsert_template_from_spec(&conn, org_id.as_deref(), &user_id, &spec, &spec_yaml)?;
        conn.query_row(
            &format!("SELECT {TEMPLATE_COLUMNS} FROM desktop_templates WHERE id = ?1"),
            rusqlite::params![outcome.id],
            row_to_template,
        )
        .map(|t| (outcome, t))
    })
    .await;

    match result {
        Ok(Ok((outcome, template))) => {
            info!(template_id = %outcome.id, user_id = %user_id_for_log, name = %name, changed = outcome.changed, "imported desktop template");
            // Flatten the row and add the idempotency flag: existing clients
            // read the same top-level fields; `unchanged: true` means the doc
            // matched the stored one and no write (or build-state reset) ran.
            let mut body = serde_json::to_value(&template).unwrap_or_else(|_| json!({}));
            if let Some(obj) = body.as_object_mut() {
                obj.insert("unchanged".to_string(), json!(!outcome.changed));
            }
            (StatusCode::OK, Json(body)).into_response()
        }
        Ok(Err(e)) => {
            warn!(error = %e, "failed to import desktop template");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("database error: {}", e)})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked importing desktop template");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

/// GET /api/v1/desktop-templates/by-ref/*ref — resolve a curated
/// `system/...` template ref to its row.
async fn get_template_by_ref(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(reference): Path<String>,
) -> impl IntoResponse {
    match resolve_template_by_ref(&state.db, &user, &reference).await {
        Some(t) => (StatusCode::OK, Json(json!(t))).into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "template ref not found"})),
        )
            .into_response(),
    }
}

/// GET /api/v1/desktop-templates/:id/export — the canonical YAML doc. Rows
/// that predate spec docs (system presets) are exported as a synthesized doc
/// built from their resolved view.
async fn export_template(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    match resolve_template(&state.db, &user, &id).await {
        Some(t) => {
            let yaml = match t.spec_yaml.clone() {
                Some(yaml) => yaml,
                None => match spec_doc_from_template(&t).to_yaml() {
                    Ok(y) => y,
                    Err(e) => {
                        return (
                            StatusCode::INTERNAL_SERVER_ERROR,
                            Json(json!({"error": e})),
                        )
                            .into_response()
                    }
                },
            };
            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "application/yaml")],
                yaml,
            )
                .into_response()
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "template not found"})),
        )
            .into_response(),
    }
}

/// POST /api/v1/desktop-templates/:id/build — build the template into a golden
/// snapshot (async; 202 immediately, progress via build_status/build_error).
/// Build start is ACI-approval-gated like other risky computer control actions.
async fn build_template(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Path(id): Path<String>,
    Query(approval): Query<crate::computer_routes::ApprovalQuery>,
) -> impl IntoResponse {
    let template = match resolve_template(&state.db, &user, &id).await {
        Some(t) => t,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(json!({"error": "template not found"})),
            )
                .into_response()
        }
    };
    if template.user_id != user.user_id && user.user_id != "system" {
        return (
            StatusCode::FORBIDDEN,
            Json(json!({"error": "only the template owner can build it"})),
        )
            .into_response();
    }
    let descriptor = json!({
        "route": "desktop_templates.build",
        "template_id": template.id,
    });
    if let Err(denial) = crate::aci_safety::enforce_confirmation(
        &state.approval_store,
        &user.user_id,
        "desktop_templates.build",
        crate::aci_safety::ConfirmationClass::Risky,
        &descriptor,
        approval.approval_id.as_deref(),
    ) {
        return (denial.status, Json(denial.body)).into_response();
    }

    let db = state.db.clone();
    let template_id = template.id.clone();
    let row_template_id = template_id.clone();
    let set = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        // `optional()` wraps ROW-ABSENCE as None; the NULL build_status of a
        // never-built template must be handled by the column getter itself
        // (`Option<String>`), otherwise a fresh template 500s on
        // `Invalid column type Null` and can never start its first build.
        let current: Option<Option<String>> = conn
            .query_row(
                "SELECT build_status FROM desktop_templates WHERE id = ?1",
                rusqlite::params![row_template_id],
                |row| row.get::<_, Option<String>>(0),
            )
            .optional()?;
        let current = current.flatten();
        if !build_transition_allowed(current.as_deref(), BUILD_STATUS_BUILDING) {
            return Ok::<bool, rusqlite::Error>(false);
        }
        conn.execute(
            "UPDATE desktop_templates SET build_status = ?1, build_error = NULL, \
             golden_snapshot_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            rusqlite::params![BUILD_STATUS_BUILDING, row_template_id],
        )?;
        Ok::<bool, rusqlite::Error>(true)
    })
    .await;

    match set {
        Ok(Ok(true)) => {
            crate::computer_audit::log_computer_access(
                &state.db,
                &template.id,
                &user.user_id,
                crate::desktop_template_build::KIND_BUILD_START,
                "template build started",
            );
            crate::desktop_template_build::start_build(state, user, template);
            (
                StatusCode::ACCEPTED,
                Json(json!({"id": template_id, "build_status": BUILD_STATUS_BUILDING})),
            )
                .into_response()
        }
        Ok(Ok(false)) => (
            StatusCode::CONFLICT,
            Json(json!({"error": "a build is already running for this template"})),
        )
            .into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to mark template building");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("database error: {}", e)})),
            )
                .into_response()
        }
        Err(e) => {
            warn!(error = %e, "task panicked marking template building");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal error"})),
            )
                .into_response()
        }
    }
}

/// Raw provisioning request used by the desktop router.
#[derive(Debug, Clone, Default)]
pub struct ProvisionRequest {
    pub os: Option<String>,
    pub template_id: Option<String>,
    pub cpu_cores: Option<i64>,
    pub memory_mb: Option<i64>,
    pub disk_mb: Option<i64>,
    pub resolution: Option<String>,
}

pub(crate) const VALIDATED_CPU_CORES: &[i64] = &[2, 4, 8];
pub(crate) const VALIDATED_MEMORY_MB: &[i64] = &[4096, 8192, 16384, 32768, 65536];
pub(crate) const VALIDATED_DISK_MB: &[i64] = &[20480, 40960, 81920];
pub(crate) const VALIDATED_RESOLUTIONS: &[&str] = &["1280x720", "1920x1080", "2560x1440"];

pub(crate) fn validate_provision_request(req: &ProvisionRequest) -> Result<(), String> {
    for (name, value, allowed) in [
        ("cpu_cores", req.cpu_cores, VALIDATED_CPU_CORES),
        ("memory_mb", req.memory_mb, VALIDATED_MEMORY_MB),
        ("disk_mb", req.disk_mb, VALIDATED_DISK_MB),
    ] {
        if value.is_some_and(|v| !allowed.contains(&v)) {
            return Err(format!("{name} must be one of {allowed:?}"));
        }
    }
    if req
        .resolution
        .as_deref()
        .is_some_and(|v| !VALIDATED_RESOLUTIONS.contains(&v))
    {
        return Err(format!(
            "resolution must be one of {VALIDATED_RESOLUTIONS:?}"
        ));
    }
    Ok(())
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
    /// Ready golden build for the resolved template, if one exists. When set,
    /// create paths clone the golden snapshot instead of spawning from `image`.
    pub golden: Option<GoldenSource>,
}

/// Look up the golden holder VM for a template, if the template has a ready
/// golden build.
fn find_golden_holder(
    conn: &rusqlite::Connection,
    template_id: &str,
    golden_snapshot_id: Option<&str>,
    build_status: Option<&str>,
) -> Option<GoldenSource> {
    // Gate on the recorded build state only. The holder row is what we are
    // about to look up — passing `None` into `select_provision_source` here
    // always yields `ProvisionSource::Image`, which made this function return
    // None unconditionally and every provision fell back to a base-image
    // spawn (live-smoke defect, rq-20260909-004: build ready, golden snapshot
    // present, and computers still booted the stock image).
    if build_status != Some(BUILD_STATUS_READY) || golden_snapshot_id.is_none() {
        return None;
    }
    let holder = conn
        .query_row(
            "SELECT native_id, provider, os FROM computers \
             WHERE template_id = ?1 AND role = 'golden' AND status != 'deleted' \
             ORDER BY created_at DESC LIMIT 1",
            rusqlite::params![template_id],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .optional()
        .ok()
        .flatten()?;
    let (native_id, provider, os) = holder;
    let snapshot_id = golden_snapshot_id?.to_string();
    let source = GoldenSource {
        snapshot_id,
        holder_native_id: native_id?,
        holder_provider: provider,
        holder_os: os.unwrap_or_else(|| "linux".to_string()),
    };
    // Final selection through the pure state machine: ready + snapshot id +
    // holder must all hold, otherwise the honest image-spawn fallback.
    let snapshot_id_for_check = source.snapshot_id.clone();
    match select_provision_source(
        Some(BUILD_STATUS_READY),
        Some(&snapshot_id_for_check),
        Some(source),
    ) {
        ProvisionSource::Golden(g) => Some(g),
        ProvisionSource::Image => None,
    }
}

/// Default desktop OS when the caller does not specify one. Match the
/// substrate that is actually configured: on a Tart-only host the old
/// implicit "linux" default routed to a missing Incus substrate and failed
/// with a dead "Feature not supported" error.
fn pick_default_os(incus_configured: bool, tart_configured: bool) -> &'static str {
    if !incus_configured && tart_configured {
        "macos"
    } else {
        "linux"
    }
}

fn default_provision_os() -> String {
    let set = |name: &str| std::env::var(name).map(|v| !v.is_empty()).unwrap_or(false);
    let incus_configured = set("INCUS_URL") || set("INCUS_URLS");
    let tart_configured = set("TART_HOST_URL") || set("TART_HOST_URLS");
    pick_default_os(incus_configured, tart_configured).to_string()
}

/// Resolve the final provisioning spec from a raw request and optional template.
pub async fn resolve_provision_spec(
    state: &Arc<AppState>,
    user: &AuthUser,
    req: &ProvisionRequest,
) -> Result<ProvisionSpec, (StatusCode, Json<serde_json::Value>)> {
    validate_provision_request(req)
        .map_err(|e| (StatusCode::BAD_REQUEST, Json(json!({"error": e}))))?;
    let mut os = req
        .os
        .as_deref()
        .map(str::to_lowercase)
        .unwrap_or_else(default_provision_os);
    let mut image = std::env::var("BOT_DESKTOP_IMAGE")
        .ok()
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| match os.as_str() {
            "windows" => "allternit-desktop-windows".to_string(),
            // The golden desktop image every Computer Cloud host carries. An
            // earlier default named a dev-only VM ("tart-ubuntu-test") that
            // does not exist on real tart hosts, so macOS provisioning failed
            // with "the specified VM does not exist" out of the box.
            "macos" => "allternit-desktop".to_string(),
            _ => "allternit-desktop".to_string(),
        });
    let mut cpu_millis = 2000;
    let mut memory_mib = 4096;
    let mut disk_mib = Some(20480u32);
    let mut network_enabled = true;
    let mut env = HashMap::new();
    let mut golden = None;

    if let Some(ref template_id) = req.template_id {
        match resolve_template(&state.db, user, template_id).await {
            Some(t) => {
                os = t.os;
                // Spec docs may leave the image empty = "default for this os".
                if !t.image.is_empty() {
                    image = t.image;
                }
                cpu_millis = t.cpu_millis;
                memory_mib = t.memory_mib;
                disk_mib = Some(t.disk_mib);
                network_enabled = t.network_enabled;
                env = t.env;
                let db = state.db.clone();
                let template_id = t.id.clone();
                let golden_snapshot_id = t.golden_snapshot_id.clone();
                let build_status = t.build_status.clone();
                golden = tokio::task::spawn_blocking(move || {
                    let conn = db.connect().ok()?;
                    find_golden_holder(
                        &conn,
                        &template_id,
                        golden_snapshot_id.as_deref(),
                        build_status.as_deref(),
                    )
                })
                .await
                .ok()
                .flatten();
            }
            None => {
                return Err((
                    StatusCode::NOT_FOUND,
                    Json(json!({"error": "desktop template not found"})),
                ));
            }
        }
    }

    if let Some(v) = req.cpu_cores {
        cpu_millis = (v * 1000) as u32;
    }
    if let Some(v) = req.memory_mb {
        memory_mib = v as u32;
    }
    if let Some(v) = req.disk_mb {
        disk_mib = Some(v as u32);
    }
    if let Some(v) = &req.resolution {
        env.insert("ALLTERNIT_DESKTOP_RESOLUTION".into(), v.clone());
    }

    Ok(ProvisionSpec {
        os,
        image,
        cpu_millis,
        memory_mib,
        disk_mib,
        network_enabled,
        env,
        golden,
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
             memory_mib, disk_mib, network_enabled, env_json, packages_json, tags_json, public, \
             spec_yaml, ref, golden_snapshot_id, build_status, build_error, built_at \
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

/// Resolve a template by its curated `system/...` ref (same visibility rules as
/// id resolution).
pub async fn resolve_template_by_ref(
    db: &crate::db::DbHandle,
    user: &AuthUser,
    reference: &str,
) -> Option<DesktopTemplate> {
    let db = db.clone();
    let reference = reference.to_string();
    let user_id = user.user_id.clone();
    let org_id = user.organization_id.clone();

    tokio::task::spawn_blocking(move || {
        let conn = db.connect().ok()?;
        conn.query_row(
            "SELECT id, org_id, user_id, name, description, os, image, cpu_millis, \
             memory_mib, disk_mib, network_enabled, env_json, packages_json, tags_json, public, \
             spec_yaml, ref, golden_snapshot_id, build_status, build_error, built_at \
             FROM desktop_templates \
             WHERE ref = ?1 AND (public = 1 OR user_id = ?2 OR org_id = ?3)",
            rusqlite::params![reference, user_id, org_id],
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

/// Outcome of an upsert: which row, and whether anything was written.
/// `changed: false` means the stored canonical doc already matched the new
/// one — a no-op that preserves any existing golden build state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpsertOutcome {
    pub id: String,
    pub changed: bool,
}

/// Persist (create or replace-by-name for this owner) a validated template
/// doc. `spec_yaml` must be the canonical serialization of `spec`. Replaces
/// reset any previous golden build — the doc is the source of truth and it
/// changed. Re-importing an unchanged doc is a no-op: nothing is written and
/// build state (e.g. a ready golden) is preserved.
pub fn upsert_template_from_spec(
    conn: &rusqlite::Connection,
    org_id: Option<&str>,
    user_id: &str,
    spec: &ComputerTemplateSpec,
    spec_yaml: &str,
) -> Result<UpsertOutcome, rusqlite::Error> {
    let view = spec.effective_view();
    let env_json = serde_json::to_string(&view.env).unwrap_or_default();
    let packages_json = serde_json::to_string(&view.packages).unwrap_or_default();
    let tags_json = serde_json::to_string(&view.tags).unwrap_or_default();
    let existing: Option<(String, Option<String>)> = conn
        .query_row(
            "SELECT id, spec_yaml FROM desktop_templates WHERE name = ?1 AND user_id = ?2 AND org_id IS ?3",
            rusqlite::params![view.name, user_id, org_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if let Some((id, stored_yaml)) = existing {
        // Idempotent re-import: identical canonical doc → skip every write so
        // an unchanged file never invalidates a ready golden.
        if stored_yaml.as_deref() == Some(spec_yaml) {
            return Ok(UpsertOutcome { id, changed: false });
        }
        // The v1 doc has no network/public fields: on replace, reset them to
        // import semantics (network on, caller-private). public stays
        // user-controlled via the legacy endpoint afterwards.
        conn.execute(
            "UPDATE desktop_templates SET description = ?2, os = ?3, image = ?4, \
             cpu_millis = ?5, memory_mib = ?6, disk_mib = ?7, network_enabled = 1, \
             public = 0, env_json = ?8, \
             packages_json = ?9, tags_json = ?10, spec_yaml = ?11, \
             golden_snapshot_id = NULL, build_status = NULL, build_error = NULL, \
             built_at = NULL, updated_at = CURRENT_TIMESTAMP \
             WHERE id = ?1",
            rusqlite::params![
                id,
                view.description,
                view.os,
                view.image,
                view.cpu_millis as i64,
                view.memory_mib as i64,
                view.disk_mib as i64,
                env_json,
                packages_json,
                tags_json,
                spec_yaml,
            ],
        )?;
        return Ok(UpsertOutcome { id, changed: true });
    }
    let id = format!("dtpl-{}", uuid::Uuid::new_v4().simple());
    conn.execute(
        "INSERT INTO desktop_templates \
         (id, org_id, user_id, name, description, os, image, cpu_millis, memory_mib, disk_mib, \
          network_enabled, env_json, packages_json, tags_json, public, spec_yaml) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?12, ?13, 0, ?14)",
        rusqlite::params![
            id,
            org_id,
            user_id,
            view.name,
            view.description,
            view.os,
            view.image,
            view.cpu_millis as i64,
            view.memory_mib as i64,
            view.disk_mib as i64,
            env_json,
            packages_json,
            tags_json,
            spec_yaml,
        ],
    )?;
    Ok(UpsertOutcome { id, changed: true })
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
            catalog_ref: None,
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

    /// Regression (live-smoke defect, rq-20260909-004): a never-built
    /// template has `build_status NULL`; the build-start gate must read that
    /// as None, not blow up with `Invalid column type Null`.
    #[tokio::test]
    async fn null_build_status_reads_as_none_for_build_gate() {
        let db = test_db();
        let id = format!("dtpl-{}", uuid::Uuid::new_v4().simple());
        let inserted = tokio::task::spawn_blocking({
            let db = db.clone();
            let id = id.clone();
            move || {
                let conn = db.connect()?;
                conn.execute(
                    "INSERT INTO desktop_templates \
                     (id, org_id, user_id, name, description, os, image, cpu_millis, memory_mib, disk_mib, \
                      network_enabled, env_json, packages_json, tags_json, public) \
                     VALUES (?1, NULL, 'owner-1', 'fresh', '', 'linux', '', 2000, 4096, 20480, 1, '{}', '[]', '[]', 0)",
                    rusqlite::params![&id],
                )?;
                // The exact query shape used by build_template's gate.
                let current: Option<Option<String>> = conn
                    .query_row(
                        "SELECT build_status FROM desktop_templates WHERE id = ?1",
                        rusqlite::params![&id],
                        |row| row.get::<_, Option<String>>(0),
                    )
                    .optional()?;
                Ok::<_, rusqlite::Error>(current.flatten())
            }
        })
        .await
        .unwrap()
        .unwrap();
        assert_eq!(inserted, None, "NULL build_status must read as None");
        assert!(build_transition_allowed(None, BUILD_STATUS_BUILDING));
    }
}

#[cfg(test)]
mod phase_four_spec_tests {
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
            "allternit-template-spec-test-{}.db",
            uuid::Uuid::new_v4()
        ));
        DbHandle::new(path).expect("test db")
    }

    const GOOD_DOC: &str = r#"
apiVersion: allternit.ai/v1
kind: ComputerTemplate
metadata:
  name: node-20-builder
  description: Node 20 CI builder
  tags: [node, ci]
os:
  name: linux
  image: ""
hardware:
  cpu_cores: 4
  memory_mb: 8192
  disk_mb: 40960
  resolution: [1920, 1080]
packages: [nodejs, npm]
services:
  - name: app
    command: node /opt/app/server.js
    env:
      PORT: "8080"
    autostart: true
secrets:
  - name: NPM_TOKEN
    ref: vault://org/org-1/npm_token
hooks:
  postCreate:
    - npm ci --prefix /opt/app
"#;

    #[test]
    fn good_doc_parses_and_validates() {
        let spec: ComputerTemplateSpec = serde_yaml::from_str(GOOD_DOC).expect("doc parses");
        spec.validate().expect("doc validates");
        let view = spec.effective_view();
        assert_eq!(view.name, "node-20-builder");
        assert_eq!(view.os, "linux");
        assert_eq!(view.image, "");
        assert_eq!(view.cpu_millis, 4000);
        assert_eq!(view.memory_mib, 8192);
        assert_eq!(view.disk_mib, 40960);
        assert_eq!(
            view.env.get("ALLTERNIT_DESKTOP_RESOLUTION"),
            Some(&"1920x1080".to_string())
        );
        assert_eq!(view.packages, vec!["nodejs", "npm"]);
    }

    #[test]
    fn bad_size_fails_validation() {
        let doc = GOOD_DOC.replace("cpu_cores: 4", "cpu_cores: 3");
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        let err = spec.validate().unwrap_err();
        assert!(err.contains("cpu_cores"), "unexpected error: {err}");

        let doc = GOOD_DOC.replace("resolution: [1920, 1080]", "resolution: [800, 600]");
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        assert!(spec.validate().unwrap_err().contains("resolution"));
    }

    #[test]
    fn bad_secret_ref_fails_validation() {
        let doc = GOOD_DOC
            .replace("vault://org/org-1/npm_token", "http://example.com/secret");
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        assert!(spec.validate().unwrap_err().contains("vault://org/"));

        let doc = GOOD_DOC.replace("vault://org/org-1/npm_token", "vault://org/org-1");
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        assert!(spec.validate().is_err());

        let doc = GOOD_DOC.replace("vault://org/org-1/npm_token", "vault://org//npm_token");
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        assert!(spec.validate().is_err());
    }

    #[test]
    fn wrong_api_version_or_kind_fails() {
        let doc = GOOD_DOC.replace("allternit.ai/v1", "allternit.ai/v2");
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        assert!(spec.validate().unwrap_err().contains("apiVersion"));

        let doc = GOOD_DOC.replace("kind: ComputerTemplate", "kind: SomethingElse");
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        assert!(spec.validate().unwrap_err().contains("kind"));
    }

    #[test]
    fn json_doc_parses_too() {
        let doc = r#"{"apiVersion":"allternit.ai/v1","kind":"ComputerTemplate","metadata":{"name":"j"}}"#;
        let spec: ComputerTemplateSpec = serde_yaml::from_str(doc).expect("json parses");
        spec.validate().expect("json doc validates");
    }

    #[test]
    fn canonical_yaml_uses_camel_case_keys() {
        let spec: ComputerTemplateSpec = serde_yaml::from_str(GOOD_DOC).unwrap();
        let yaml = spec.to_yaml().unwrap();
        assert!(yaml.contains("apiVersion: allternit.ai/v1"), "{yaml}");
        assert!(yaml.contains("postCreate:"), "{yaml}");
        assert!(yaml.contains("ref: vault://org/org-1/npm_token"), "{yaml}");
        // round-trip
        let reparsed: ComputerTemplateSpec = serde_yaml::from_str(&yaml).unwrap();
        reparsed.validate().unwrap();
        assert_eq!(reparsed, spec);
    }

    #[test]
    fn build_state_machine_transitions() {
        use crate::bot_desktop_templates::*;
        // never-built → building, rebuild from terminal states, building → ready/failed
        assert!(build_transition_allowed(None, BUILD_STATUS_BUILDING));
        assert!(build_transition_allowed(Some(BUILD_STATUS_FAILED), BUILD_STATUS_BUILDING));
        assert!(build_transition_allowed(Some(BUILD_STATUS_READY), BUILD_STATUS_BUILDING));
        assert!(build_transition_allowed(
            Some(BUILD_STATUS_BUILDING),
            BUILD_STATUS_READY
        ));
        assert!(build_transition_allowed(
            Some(BUILD_STATUS_BUILDING),
            BUILD_STATUS_FAILED
        ));
        // illegal: double-build, skipping the building state, ready→failed
        assert!(!build_transition_allowed(
            Some(BUILD_STATUS_BUILDING),
            BUILD_STATUS_BUILDING
        ));
        assert!(!build_transition_allowed(None, BUILD_STATUS_READY));
        assert!(!build_transition_allowed(
            Some(BUILD_STATUS_FAILED),
            BUILD_STATUS_READY
        ));
        assert!(!build_transition_allowed(Some(BUILD_STATUS_READY), BUILD_STATUS_FAILED));
    }

    #[test]
    fn provision_source_selection() {
        use crate::bot_desktop_templates::*;
        let holder = GoldenSource {
            snapshot_id: "golden".to_string(),
            holder_native_id: "allternit-x".to_string(),
            holder_provider: "incus".to_string(),
            holder_os: "linux".to_string(),
        };
        // ready + golden snapshot + holder → clone
        match select_provision_source(
            Some(BUILD_STATUS_READY),
            Some("golden"),
            Some(holder.clone()),
        ) {
            ProvisionSource::Golden(g) => assert_eq!(g.snapshot_id, "golden"),
            ProvisionSource::Image => panic!("expected golden"),
        }
        // not ready → image, even with a snapshot recorded
        assert_eq!(
            select_provision_source(Some(BUILD_STATUS_BUILDING), Some("golden"), Some(holder.clone())),
            ProvisionSource::Image
        );
        // ready but no golden_snapshot_id persisted → image (the F1 fallback:
        // a build that never recorded its snapshot id must not take the
        // golden path)
        assert_eq!(
            select_provision_source(Some(BUILD_STATUS_READY), None, Some(holder.clone())),
            ProvisionSource::Image
        );
        // ready but holder row missing → image (honest fallback)
        assert_eq!(
            select_provision_source(Some(BUILD_STATUS_READY), Some("golden"), None),
            ProvisionSource::Image
        );
        // never built → image
        assert_eq!(
            select_provision_source(None, None, None),
            ProvisionSource::Image
        );
    }

    #[tokio::test]
    async fn by_ref_resolves_seeded_system_presets() {
        let db = test_db();
        let user = test_user("random-user", None);
        let t = resolve_template_by_ref(&db, &user, "system/preset-linux-ubuntu")
            .await
            .expect("preset resolves by ref");
        assert_eq!(t.id, "preset-linux-ubuntu");
        assert_eq!(t.ref_.as_deref(), Some("system/preset-linux-ubuntu"));

        assert!(
            resolve_template_by_ref(&db, &user, "system/does-not-exist")
                .await
                .is_none()
        );
    }

    #[tokio::test]
    async fn import_upserts_by_name_and_resets_build_state() {
        let db = test_db();
        let user = test_user("owner-1", Some("org-1"));
        let spec: ComputerTemplateSpec = serde_yaml::from_str(GOOD_DOC).unwrap();
        let yaml = spec.to_yaml().unwrap();

        let id = {
            let conn = db.connect().unwrap();
            upsert_template_from_spec(&conn, Some("org-1"), "owner-1", &spec, &yaml)
                .unwrap()
                .id
        };
        let resolved = resolve_template(&db, &user, &id).await.unwrap();
        assert_eq!(resolved.name, "node-20-builder");
        assert_eq!(resolved.cpu_millis, 4000);
        assert_eq!(resolved.packages, vec!["nodejs", "npm"]);
        assert!(resolved.spec_yaml.is_some());

        // Simulate a finished build, then re-import: the golden state resets.
        {
            let conn = db.connect().unwrap();
            conn.execute(
                "UPDATE desktop_templates SET build_status = 'ready', golden_snapshot_id = 'golden', \
                 network_enabled = 0, public = 1 WHERE id = ?1",
                rusqlite::params![id],
            )
            .unwrap();
        }
        let spec2: ComputerTemplateSpec =
            serde_yaml::from_str(&GOOD_DOC.replace("Node 20 CI builder", "Node 22 CI builder"))
                .unwrap();
        let id2 = {
            let conn = db.connect().unwrap();
            upsert_template_from_spec(
                &conn,
                Some("org-1"),
                "owner-1",
                &spec2,
                &spec2.to_yaml().unwrap(),
            )
            .unwrap()
            .id
        };
        assert_eq!(id, id2, "replace-by-name keeps the id");
        let re = resolve_template(&db, &user, &id).await.unwrap();
        assert_eq!(
            re.description.as_deref(),
            Some("Node 22 CI builder"),
            "description updated"
        );
        assert_eq!(re.build_status, None, "build state reset on replace");
        assert_eq!(re.golden_snapshot_id, None);
        assert!(re.network_enabled, "network reset to the doc-default on replace");
        assert!(!re.public, "import is caller-private unless set via the legacy endpoint");
    }

    /// Re-importing an unchanged doc must be a no-op: no write, and any
    /// ready golden build state survives (idempotent rebuild story).
    #[tokio::test]
    async fn reimport_of_unchanged_doc_preserves_build_state() {
        let db = test_db();
        let spec: ComputerTemplateSpec = serde_yaml::from_str(GOOD_DOC).unwrap();
        let yaml = spec.to_yaml().unwrap();
        let id = {
            let conn = db.connect().unwrap();
            upsert_template_from_spec(&conn, Some("org-1"), "owner-1", &spec, &yaml)
                .unwrap()
                .id
        };
        {
            let conn = db.connect().unwrap();
            conn.execute(
                "UPDATE desktop_templates SET build_status = 'ready', \
                 golden_snapshot_id = 'golden', built_at = '2026-09-10 00:00:00' WHERE id = ?1",
                rusqlite::params![id],
            )
            .unwrap();
        }
        let outcome = {
            let conn = db.connect().unwrap();
            upsert_template_from_spec(&conn, Some("org-1"), "owner-1", &spec, &yaml).unwrap()
        };
        assert_eq!(outcome.id, id);
        assert!(!outcome.changed, "identical doc must be a no-op");
        let (status, golden): (Option<String>, Option<String>) = {
            let conn = db.connect().unwrap();
            conn.query_row(
                "SELECT build_status, golden_snapshot_id FROM desktop_templates WHERE id = ?1",
                rusqlite::params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap()
        };
        assert_eq!(status.as_deref(), Some("ready"), "ready golden survives re-import");
        assert_eq!(golden.as_deref(), Some("golden"));
    }

    #[test]
    fn prebuild_and_install_scripts_validate() {
        let doc = GOOD_DOC.replace(
            "hooks:\n  postCreate:",
            "installScripts:\n  - ./configure && make install\nhooks:\n  preBuild:\n    - apt-get update\n  postCreate:",
        );
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        spec.validate().expect("doc with preBuild + installScripts validates");
        assert_eq!(spec.install_scripts.len(), 1);
        assert_eq!(spec.hooks.pre_build, vec!["apt-get update"]);

        // empty entries rejected
        let doc = GOOD_DOC.replace(
            "packages: [nodejs, npm]",
            "installScripts:\n  - \"\"\npackages: [nodejs, npm]",
        );
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).unwrap();
        assert!(spec.validate().unwrap_err().contains("installScripts"));
    }

    /// Tier C gate: pasted credential material (PEM blocks) in a template
    /// file is rejected — secrets are vault refs by name only.
    #[test]
    fn literal_secret_material_is_rejected() {
        // The PEM below is deliberately truncated FAKE key material; the Tier C
        // gate test asserts template validation rejects it.
        let pem = "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7\\n-----END PRIVATE KEY-----"; // gitleaks:allow (fake fixture)

        let doc = GOOD_DOC.replace(
            "env:\n      PORT: \"8080\"",
            &format!("env:\n      PORT: \"8080\"\n      API_KEY: \"{pem}\""),
        );
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        let err = spec.validate().unwrap_err();
        assert!(err.contains("literal secret"), "unexpected error: {err}");

        let doc = GOOD_DOC.replace(
            "- npm ci --prefix /opt/app",
            &format!("- printf '%s' '{pem}' > /etc/app.key"),
        );
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        assert!(spec.validate().unwrap_err().contains("literal secret"));

        let doc = GOOD_DOC.replace(
            "packages: [nodejs, npm]",
            &format!("installScripts:\n  - echo {pem}\npackages: [nodejs, npm]"),
        );
        let spec: ComputerTemplateSpec = serde_yaml::from_str(&doc).expect("doc parses");
        assert!(spec.validate().unwrap_err().contains("literal secret"));
    }

    #[tokio::test]
    async fn create_from_catalog_ref_instantiates_caller_owned_copy() {
        let entry = crate::template_catalog::get_catalog_entry("system/base-desktop")
            .expect("catalog entry exists");
        let db = test_db();
        let user = test_user("owner-1", Some("org-1"));
        let yaml = entry.spec.to_yaml().unwrap();
        let outcome = {
            let conn = db.connect().unwrap();
            upsert_template_from_spec(&conn, Some("org-1"), &user.user_id, &entry.spec, &yaml)
                .unwrap()
        };
        assert!(outcome.changed);
        let resolved = resolve_template(&db, &user, &outcome.id).await.unwrap();
        assert_eq!(resolved.name, "base-desktop");
        assert_eq!(resolved.ref_, None, "caller copy is not the curated ref");
        assert!(!resolved.public);
        assert_eq!(resolved.user_id, "owner-1");
    }

    /// Regression (live-smoke defect, rq-20260909-004): provisioning from a
    /// ready golden never happened — `find_golden_holder` passed `None` into
    /// `select_provision_source`, which always answered Image, so every
    /// computer fell back to a stock-image spawn despite a ready golden.
    #[tokio::test]
    async fn find_golden_holder_resolves_when_build_ready() {
        let db = test_db();
        let tid = "dtpl-golden-regression";
        {
            let conn = db.connect().unwrap();
            conn.execute(
                "INSERT INTO desktop_templates \
                 (id, org_id, user_id, name, description, os, image, cpu_millis, memory_mib, disk_mib, \
                  network_enabled, env_json, packages_json, tags_json, public, build_status, golden_snapshot_id) \
                 VALUES (?1, NULL, 'owner-1', 'golden-regression', '', 'linux', '', 2000, 4096, 20480, 1, '{}', '[]', '[]', 0, 'ready', 'golden')",
                rusqlite::params![tid],
            )
            .unwrap();
            conn.execute(
                "INSERT INTO computers (id, kind, provider, status, owner_type, owner_id, name, \
                 native_id, os, template_id, role) \
                 VALUES ('comp-golden-1', 'cloud_desktop', 'incus', 'stopped', 'user', 'owner-1', \
                 'tpl-golden-x', 'native-holder-1', 'linux', ?1, 'golden')",
                rusqlite::params![tid],
            )
            .unwrap();
        }
        let found = {
            let conn = db.connect().unwrap();
            find_golden_holder(&conn, tid, Some("golden"), Some("ready"))
        };
        let src = found.expect("ready build with holder row must resolve to the golden");
        assert_eq!(src.snapshot_id, "golden");
        assert_eq!(src.holder_native_id, "native-holder-1");
        assert_eq!(src.holder_provider, "incus");

        // Not ready → no golden source (honest fallback).
        let not_ready = {
            let conn = db.connect().unwrap();
            find_golden_holder(&conn, tid, Some("golden"), Some("building"))
        };
        assert!(not_ready.is_none());
        let never_built = {
            let conn = db.connect().unwrap();
            find_golden_holder(&conn, tid, None, None)
        };
        assert!(never_built.is_none());
    }
}

#[cfg(test)]
mod computer_spec_tests {
    use super::*;

    #[test]
    fn computer_size_validation() {
        for (field, allowed) in [
            ("cpu", VALIDATED_CPU_CORES),
            ("memory", VALIDATED_MEMORY_MB),
            ("disk", VALIDATED_DISK_MB),
        ] {
            for value in allowed.iter().copied().chain([-1, 0, 1, i64::MAX]) {
                let mut req = ProvisionRequest::default();
                match field {
                    "cpu" => req.cpu_cores = Some(value),
                    "memory" => req.memory_mb = Some(value),
                    _ => req.disk_mb = Some(value),
                }
                assert_eq!(
                    validate_provision_request(&req).is_ok(),
                    allowed.contains(&value),
                    "{field} {value}"
                );
            }
        }
        for value in VALIDATED_RESOLUTIONS
            .iter()
            .copied()
            .chain(["", "800x600", "1920X1080"])
        {
            let req = ProvisionRequest {
                resolution: Some(value.into()),
                ..Default::default()
            };
            assert_eq!(
                validate_provision_request(&req).is_ok(),
                VALIDATED_RESOLUTIONS.contains(&value)
            );
        }
        assert!(validate_provision_request(&ProvisionRequest::default()).is_ok());
    }

    #[test]
    fn default_os_matches_configured_substrate() {
        // Tart-only hosts must not default to linux (dead Incus route).
        assert_eq!(pick_default_os(false, true), "macos");
        // Incus present (alone or alongside Tart) keeps the linux default.
        assert_eq!(pick_default_os(true, false), "linux");
        assert_eq!(pick_default_os(true, true), "linux");
        // Neither configured: keep the historical default.
        assert_eq!(pick_default_os(false, false), "linux");
    }
}
