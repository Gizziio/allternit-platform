//! P2 per-subscription provisioning lane: fleet scheduling, Incus backend
//! adapter, per-instance state machine, pairing bind, and metering.
//!
//! Decision record: docs/architecture/2026-09-03-control-plane-data-plane-
//! decision.md items 7-10 (decisions A3/D2/D3). One unprivileged Incus
//! container per paid subscription on fleet hosts; the container's init
//! script (infrastructure/provisioned-instance/init.sh, embedded below)
//! installs allternit-api and phones home through the runtime pairing flow,
//! so fleet hosts never need inbound ports from user traffic (ADR A1).
//!
//! The DevPod provider contract is the design precedent (ADR §Prior art):
//! lifecycle hooks create/start/stop/status/delete over the container
//! backend, options reach the instance as env vars, the injected agent
//! phones home, and `status` reports a small enum —
//! [`BackendStatus::Running` / `Busy` / `Stopped` / `NotFound`]. Unlike
//! DevPod we keep the control plane: this service is part of it.
//!
//! ## Fleet scheduling algorithm (documented, per ADR item 9)
//!
//! `select_host` is a best-free bin-pack: among *enabled* hosts with enough
//! free capacity for the request in **every** dimension (cpu, memory, disk),
//! pick the host with the **most free memory**; ties break on most free
//! cpu, then on the host id (lexicographic) so the choice is deterministic
//! across calls. When the winning host fills up, the next create lands on
//! the next-best host automatically — capacity is tracked incrementally on
//! `provisioned_hosts`, so no global rebalancing pass is needed. v1 is
//! deliberately simple: no affinity, no fragmentation score, no
//! defragmentation; per-org/team tiers (A3 follow-up) may demand one later.
//!
//! ## State machine (provisioned_instances.status)
//!
//! ```text
//!             create()
//!                │
//!                ▼
//!          provisioning ──────────────┐
//!             │    │ device bound or  │ backend failure
//!             │    │ backend Running  ▼
//!             │    ▼              error (error_message)
//!             │  running ◄──────────────┐
//!          start/stop │ ▲               │
//!             ▼       │ └───────────────┘
//!           stopped ──┘          delete()
//!                │    ▲            │
//!                └────┴────────────▼
//!                               deleted (terminal; allocation released)
//! ```
//!
//! `deleted` is the only terminal state. Metering opens/closes a
//! `provisioned_instance_usage_sessions` row on every running↔stopped
//! transition; total running seconds per period derives from that table
//! (`usage_summary`). Stripe is intentionally out of scope (ADR item 9).

use async_trait::async_trait;
use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

use crate::ApiError;

/// First-boot contract shipped to the container via cloud-init user-data.
/// Path is relative to this file (cmd/allternit-cloud-api/src/services/);
/// the crate already depends on the repo layout via path dependencies.
pub const INIT_SCRIPT: &str =
    include_str!("../../../../infrastructure/provisioned-instance/init.sh");

// ---------------------------------------------------------------------------
// Configuration (env, following the crate's env-config convention)
// ---------------------------------------------------------------------------

const ENV_IMAGE: &str = "ALLTERNIT_PROVISION_IMAGE";
const ENV_CPU: &str = "ALLTERNIT_PROVISION_CPU";
const ENV_MEMORY_MB: &str = "ALLTERNIT_PROVISION_MEMORY_MB";
const ENV_DISK_GB: &str = "ALLTERNIT_PROVISION_DISK_GB";
const ENV_PROFILES: &str = "ALLTERNIT_PROVISION_PROFILES";
const ENV_RELEASE_URL: &str = "ALLTERNIT_NODE_RELEASE_URL";
const ENV_JWKS_URL: &str = "ALLTERNIT_CLOUD_JWKS_URL";
const ENV_API_BASE: &str = "ALLTERNIT_CLOUD_API_BASE";
const ENV_STORAGE_POOL: &str = "ALLTERNIT_INCUS_STORAGE_POOL";
const ENV_PAIRING_TTL_HOURS: &str = "ALLTERNIT_PAIRING_CODE_TTL_HOURS";
const ENV_RECONCILE_SECONDS: &str = "PROVISIONED_RECONCILE_SECONDS";

/// Image alias every container is launched from. Pinned per deployment; a
/// real fleet image does not exist yet — until one does, create() against a
/// live host fails at the Incus layer with a clean error status.
const DEFAULT_IMAGE: &str = "allternit-node";
const DEFAULT_CPU: i64 = 2;
const DEFAULT_MEMORY_MB: i64 = 2048;
const DEFAULT_DISK_GB: i64 = 20;
const DEFAULT_PROFILES: &str = "default";
/// Placeholder until the release pipeline publishes node tarballs; the init
/// script requires the URL to be set, and production must pin the sha256.
const DEFAULT_RELEASE_URL: &str =
    "https://api.allternit.com/releases/allternit-api/latest/linux-x86_64.tar.gz";
const DEFAULT_API_BASE: &str = "https://api.allternit.com";
const DEFAULT_STORAGE_POOL: &str = "default";
const DEFAULT_PAIRING_TTL_HOURS: i64 = 24;
const DEFAULT_RECONCILE_SECONDS: u64 = 60;

fn env_i64(name: &str, default: i64) -> i64 {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(default)
}

fn env_string(name: &str, default: &str) -> String {
    std::env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| default.to_string())
}

/// Resolved provisioning defaults, snapshotted at service construction.
#[derive(Debug, Clone)]
pub struct ProvisionDefaults {
    pub image: String,
    pub cpu_cores: i64,
    pub memory_mb: i64,
    pub disk_gb: i64,
    pub profiles: Vec<String>,
    pub release_url: String,
    pub binary_sha256: Option<String>,
    pub jwks_url: String,
    pub api_base: String,
    pub storage_pool: String,
    pub pairing_ttl: Duration,
}

impl ProvisionDefaults {
    pub fn from_env() -> Self {
        let api_base = env_string(ENV_API_BASE, DEFAULT_API_BASE);
        Self {
            image: env_string(ENV_IMAGE, DEFAULT_IMAGE),
            cpu_cores: env_i64(ENV_CPU, DEFAULT_CPU),
            memory_mb: env_i64(ENV_MEMORY_MB, DEFAULT_MEMORY_MB),
            disk_gb: env_i64(ENV_DISK_GB, DEFAULT_DISK_GB),
            profiles: env_string(ENV_PROFILES, DEFAULT_PROFILES)
                .split(',')
                .map(|profile| profile.trim().to_string())
                .filter(|profile| !profile.is_empty())
                .collect(),
            release_url: env_string(ENV_RELEASE_URL, DEFAULT_RELEASE_URL),
            binary_sha256: std::env::var("ALLTERNIT_BINARY_SHA256")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            jwks_url: env_string(ENV_JWKS_URL, &format!("{api_base}/api/v1/auth/dp-jwks")),
            api_base,
            storage_pool: env_string(ENV_STORAGE_POOL, DEFAULT_STORAGE_POOL),
            pairing_ttl: Duration::hours(env_i64(ENV_PAIRING_TTL_HOURS, DEFAULT_PAIRING_TTL_HOURS)),
        }
    }
}

// ---------------------------------------------------------------------------
// Backend status enum (DevPod precedent) and lifecycle trait
// ---------------------------------------------------------------------------

/// Small status enum the fleet scheduler understands — the DevPod provider
/// contract's Running/Busy/Stopped/NotFound, adopted verbatim by the ADR.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackendStatus {
    Running,
    Busy,
    Stopped,
    NotFound,
}

/// Lifecycle request for one container on one fleet host.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProvisionSpec {
    /// Incus instance name (also `provisioned_instances.incus_name`).
    pub name: String,
    /// Pinned image alias (`local:<image>`).
    pub image: String,
    pub cpu_cores: i64,
    pub memory_mb: i64,
    pub disk_gb: i64,
    pub profiles: Vec<String>,
    /// Storage pool backing the root disk.
    pub storage_pool: String,
    /// cloud-init user-data (the embedded init script + its env contract).
    pub user_data: String,
}

/// Backend seam the scheduling/lifecycle logic programs against. Tests
/// substitute a mock; production uses [`IncusHttpBackend`].
#[async_trait]
pub trait ProvisionBackend: Send + Sync + std::fmt::Debug {
    async fn create(&self, spec: &ProvisionSpec) -> Result<(), ProvisionError>;
    async fn start(&self, name: &str) -> Result<(), ProvisionError>;
    async fn stop(&self, name: &str) -> Result<(), ProvisionError>;
    async fn status(&self, name: &str) -> Result<BackendStatus, ProvisionError>;
    async fn delete(&self, name: &str) -> Result<(), ProvisionError>;
}

/// Errors out of a backend. Surfaced to callers as 503/4xx via `to_api_error`.
#[derive(Debug, thiserror::Error)]
pub enum ProvisionError {
    #[error("backend request failed: {0}")]
    Request(String),
    #[error("backend api error {status}: {message}")]
    Api { status: u16, message: String },
    #[error("instance not found on backend: {0}")]
    NotFound(String),
    #[error("backend operation timed out")]
    Timeout,
}

impl ProvisionError {
    pub fn to_api_error(&self) -> ApiError {
        match self {
            ProvisionError::NotFound(message) => ApiError::NotFound(message.clone()),
            other => ApiError::ServiceUnavailable(other.to_string()),
        }
    }
}

// ---------------------------------------------------------------------------
// Incus HTTP backend (client-cert auth, same convention as the Desktop Cloud
// lane: INCUS_CLIENT_CERT / INCUS_CLIENT_KEY / INCUS_CA_CERT /
// INCUS_INSECURE_SKIP_VERIFY)
// ---------------------------------------------------------------------------

/// Minimal async HTTP seam so the Incus adapter itself is unit-testable with
/// canned responses (mirrors the HttpClient seam in allternit-computer-cloud's
/// substrate, kept local to avoid a crate dependency).
#[async_trait]
pub(crate) trait IncusTransport: Send + Sync {
    async fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<(u16, serde_json::Value), ProvisionError>;
}

pub(crate) struct ReqwestIncusTransport {
    client: reqwest::Client,
    base: String,
}

#[async_trait]
impl IncusTransport for ReqwestIncusTransport {
    async fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<(u16, serde_json::Value), ProvisionError> {
        let url = format!("{}{}", self.base.trim_end_matches('/'), path);
        let mut request = self.client.request(method, &url);
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request
            .send()
            .await
            .map_err(|error| ProvisionError::Request(error.to_string()))?;
        let status = response.status().as_u16();
        let json = response
            .json()
            .await
            .unwrap_or(serde_json::Value::Null);
        Ok((status, json))
    }
}

/// Incus daemon adapter over the `/1.0` HTTP API. Talks to per-host endpoints
/// (`provisioned_hosts.incus_endpoint`) with the same client-certificate
/// trust model as the existing Desktop Cloud deploy (see
/// infrastructure/vps-desktop-cloud/api.env.template).
pub struct IncusHttpBackend {
    transport: Box<dyn IncusTransport>,
}

impl std::fmt::Debug for IncusHttpBackend {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        f.debug_struct("IncusHttpBackend").finish_non_exhaustive()
    }
}

impl IncusHttpBackend {
    pub fn new(endpoint: &str) -> Result<Self, ProvisionError> {
        // Generous timeout: create/wait operations can block for tens of
        // seconds while the image unpacks (same rationale as the substrate).
        let mut builder = reqwest::Client::builder().timeout(std::time::Duration::from_secs(180));
        if let (Ok(cert_path), Ok(key_path)) = (
            std::env::var("INCUS_CLIENT_CERT"),
            std::env::var("INCUS_CLIENT_KEY"),
        ) {
            let mut pem = std::fs::read(&cert_path)
                .map_err(|error| ProvisionError::Request(format!("cert read: {error}")))?;
            pem.extend_from_slice(
                &std::fs::read(&key_path)
                    .map_err(|error| ProvisionError::Request(format!("key read: {error}")))?,
            );
            let identity = reqwest::Identity::from_pem(&pem)
                .map_err(|error| ProvisionError::Request(format!("identity from_pem: {error}")))?;
            builder = builder.identity(identity).use_rustls_tls();
        }
        if let Ok(ca_path) = std::env::var("INCUS_CA_CERT") {
            let ca = std::fs::read(&ca_path)
                .map_err(|error| ProvisionError::Request(format!("ca cert read: {error}")))?;
            let certificate = reqwest::Certificate::from_pem(&ca)
                .map_err(|error| ProvisionError::Request(format!("ca cert parse: {error}")))?;
            builder = builder.add_root_certificate(certificate);
        } else if std::env::var("INCUS_INSECURE_SKIP_VERIFY").as_deref() == Ok("true") {
            builder = builder.danger_accept_invalid_certs(true);
        }
        let client = builder
            .build()
            .map_err(|error| ProvisionError::Request(format!("reqwest client build: {error}")))?;
        Ok(Self {
            transport: Box::new(ReqwestIncusTransport {
                client,
                base: endpoint.to_string(),
            }),
        })
    }

    #[cfg(test)]
    pub(crate) fn with_transport(transport: Box<dyn IncusTransport>) -> Self {
        Self { transport }
    }

    async fn wait_operation(&self, response: &serde_json::Value) -> Result<(), ProvisionError> {
        let Some(operation) = response
            .get("operation")
            .and_then(|value| value.as_str())
        else {
            return Ok(());
        };
        let wait_path = format!("{}/wait?timeout=60", operation.trim_end_matches('/'));
        let (status, json) = self
            .transport
            .request(reqwest::Method::GET, &wait_path, None)
            .await
            .or_else(|error| match error {
                // Incus removes completed operations quickly; a 404 wait means
                // the operation already finished.
                ProvisionError::NotFound(_) => Ok((200, serde_json::json!({ "data": {} }))),
                other => Err(other),
            })?;
        if status == 404 {
            return Ok(());
        }
        let payload = json.get("data").unwrap_or(&json);
        if payload.get("status").and_then(|value| value.as_str()) == Some("Failure") {
            let message = payload
                .get("err")
                .and_then(|error| error.as_str())
                .unwrap_or("unknown Incus operation failure");
            return Err(ProvisionError::Api {
                status: 500,
                message: message.to_string(),
            });
        }
        Ok(())
    }

    async fn state_action(&self, name: &str, action: &str) -> Result<(), ProvisionError> {
        let path = format!("/1.0/instances/{name}/state");
        let (status, json) = self
            .transport
            .request(
                reqwest::Method::POST,
                &path,
                Some(serde_json::json!({ "action": action })),
            )
            .await?;
        if !is_success(status) {
            return Err(error_from_status(status, &json));
        }
        self.wait_operation(&json).await
    }
}

fn is_success(status: u16) -> bool {
    (200..300).contains(&status)
}

fn error_from_status(status: u16, json: &serde_json::Value) -> ProvisionError {
    if status == 404 {
        ProvisionError::NotFound(json.to_string())
    } else {
        ProvisionError::Api {
            status,
            message: json.to_string(),
        }
    }
}

fn incus_name(instance_id: &str) -> String {
    // Incus names: lowercase letters, digits, hyphens; <= 63 chars.
    format!("allternit-sub-{}", &instance_id.replace('_', "-")[..instance_id.len().min(12)])
}

#[async_trait]
impl ProvisionBackend for IncusHttpBackend {
    async fn create(&self, spec: &ProvisionSpec) -> Result<(), ProvisionError> {
        let alias = spec.image.strip_prefix("local:").unwrap_or(&spec.image);
        let mut config = serde_json::json!({
            "limits.cpu": spec.cpu_cores.to_string(),
            "limits.memory": format!("{}MiB", spec.memory_mb),
            // ADR A3/v1: unprivileged containers, explicit rather than host default.
            "security.privileged": "false",
            "user.user-data": spec.user_data,
        });
        if let Some(sha256) = spec
            .user_data
            .lines()
            .find_map(|line| line.strip_prefix("# allternit sha256: "))
        {
            config["user.allternit.binary-sha256"] = sha256.trim().into();
        }
        let body = serde_json::json!({
            "name": spec.name,
            "source": { "type": "image", "alias": alias },
            "type": "container",
            "config": config,
            "profiles": spec.profiles,
            "devices": {
                "root": {
                    "type": "disk",
                    "path": "/",
                    "pool": spec.storage_pool,
                    "size": format!("{}GiB", spec.disk_gb),
                }
            },
        });
        let (status, json) = self
            .transport
            .request(reqwest::Method::POST, "/1.0/instances", Some(body))
            .await?;
        if !is_success(status) {
            return Err(error_from_status(status, &json));
        }
        self.wait_operation(&json).await
    }

    async fn start(&self, name: &str) -> Result<(), ProvisionError> {
        self.state_action(name, "start").await
    }

    async fn stop(&self, name: &str) -> Result<(), ProvisionError> {
        self.state_action(name, "stop").await
    }

    async fn status(&self, name: &str) -> Result<BackendStatus, ProvisionError> {
        let path = format!("/1.0/instances/{name}");
        let (status, json) = self
            .transport
            .request(reqwest::Method::GET, &path, None)
            .await
            .map_err(|error| match error {
                ProvisionError::NotFound(_) => ProvisionError::NotFound(name.to_string()),
                other => other,
            })?;
        if !is_success(status) {
            return Err(error_from_status(status, &json));
        }
        let payload = json.get("metadata").unwrap_or(&json);
        Ok(match payload.get("status").and_then(|value| value.as_str()) {
            Some("Running") => BackendStatus::Running,
            Some("Stopped") => BackendStatus::Stopped,
            _ => BackendStatus::Busy,
        })
    }

    async fn delete(&self, name: &str) -> Result<(), ProvisionError> {
        let path = format!("/1.0/instances/{name}");
        let (status, json) = self
            .transport
            .request(reqwest::Method::DELETE, &path, None)
            .await?;
        if is_success(status) {
            self.wait_operation(&json).await
        } else {
            Err(error_from_status(status, &json))
        }
    }
}

// ---------------------------------------------------------------------------
// Fleet scheduling (pure functions — the seam the scheduling tests target)
// ---------------------------------------------------------------------------

/// One host's capacity ledger row, as the scheduler sees it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostCapacity {
    pub id: String,
    pub enabled: bool,
    pub cpu_total: i64,
    pub memory_total: i64,
    pub disk_total: i64,
    pub cpu_used: i64,
    pub memory_used: i64,
    pub disk_used: i64,
}

impl HostCapacity {
    pub fn free_cpu(&self) -> i64 {
        self.cpu_total - self.cpu_used
    }
    pub fn free_memory(&self) -> i64 {
        self.memory_total - self.memory_used
    }
    pub fn free_disk(&self) -> i64 {
        self.disk_total - self.disk_used
    }

    fn fits(&self, cpu: i64, memory_mb: i64, disk_gb: i64) -> bool {
        self.free_cpu() >= cpu && self.free_memory() >= memory_mb && self.free_disk() >= disk_gb
    }
}

/// Best-free bin-pack (see module header for the full algorithm
/// description): most free memory wins, tie → most free cpu, tie → lowest
/// host id for determinism. Returns `None` when no enabled host fits.
pub fn select_host(
    hosts: &[HostCapacity],
    cpu: i64,
    memory_mb: i64,
    disk_gb: i64,
) -> Option<String> {
    hosts
        .iter()
        .filter(|host| host.enabled && host.fits(cpu, memory_mb, disk_gb))
        .max_by(|a, b| {
            a.free_memory()
                .cmp(&b.free_memory())
                .then_with(|| a.free_cpu().cmp(&b.free_cpu()))
                .then_with(|| b.id.cmp(&a.id)) // reversed: max_by keeps the LAST max, so invert the id order
        })
        .map(|host| host.id.clone())
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

/// Legal `provisioned_instances.status` transitions. `error` is reachable
/// from any active state; `deleted` is reachable from any non-deleted state.
pub fn can_transition(from: &str, to: &str) -> bool {
    match (from, to) {
        // deleted is terminal: no transition leaves it.
        ("deleted", _) => false,
        ("provisioning", "running") => true,
        ("provisioning", "error") => true,
        ("running", "stopped") => true,
        ("running", "error") => true,
        ("stopped", "running") => true,
        ("error", "deleted") => true,
        ("provisioning" | "running" | "stopped", "deleted") => true,
        _ => from == to,
    }
}

// ---------------------------------------------------------------------------
// Row views
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, FromRow)]
pub struct InstanceRow {
    pub id: String,
    pub user_id: String,
    pub subscription_id: Option<String>,
    pub host_id: Option<String>,
    pub incus_name: String,
    pub status: String,
    pub device_id: Option<String>,
    pub cpu_cores: i32,
    pub memory_mb: i64,
    pub disk_gb: i64,
    pub error_message: Option<String>,
    pub last_started_at: Option<DateTime<Utc>>,
    pub last_stopped_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceView {
    pub id: String,
    pub user_id: String,
    pub subscription_id: Option<String>,
    pub host_id: Option<String>,
    pub incus_name: String,
    pub status: String,
    pub device_id: Option<String>,
    pub cpu_cores: i32,
    pub memory_mb: i64,
    pub disk_gb: i64,
    pub error_message: Option<String>,
    pub last_started_at: Option<DateTime<Utc>>,
    pub last_stopped_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<InstanceRow> for InstanceView {
    fn from(row: InstanceRow) -> Self {
        Self {
            id: row.id,
            user_id: row.user_id,
            subscription_id: row.subscription_id,
            host_id: row.host_id,
            incus_name: row.incus_name,
            status: row.status,
            device_id: row.device_id,
            cpu_cores: row.cpu_cores,
            memory_mb: row.memory_mb,
            disk_gb: row.disk_gb,
            error_message: row.error_message,
            last_started_at: row.last_started_at,
            last_stopped_at: row.last_stopped_at,
            created_at: row.created_at,
        }
    }
}

// ---------------------------------------------------------------------------
// Backend registry (one backend per fleet host, cached)
// ---------------------------------------------------------------------------

/// Resolves a backend for a fleet host. Production builds an
/// [`IncusHttpBackend`] from the host's endpoint (cached per host id); tests
/// substitute a static registry with a mock.
#[async_trait]
pub trait BackendRegistry: Send + Sync + std::fmt::Debug {
    async fn backend(
        &self,
        host_id: &str,
        endpoint: &str,
    ) -> Result<Arc<dyn ProvisionBackend>, ApiError>;
}

#[derive(Debug, Default)]
pub struct IncusBackendRegistry {
    cache: Mutex<HashMap<String, Arc<dyn ProvisionBackend>>>,
}

#[async_trait]
impl BackendRegistry for IncusBackendRegistry {
    async fn backend(
        &self,
        host_id: &str,
        endpoint: &str,
    ) -> Result<Arc<dyn ProvisionBackend>, ApiError> {
        if let Some(backend) = self.cache.lock().unwrap().get(host_id) {
            return Ok(backend.clone());
        }
        let backend: Arc<dyn ProvisionBackend> =
            Arc::new(IncusHttpBackend::new(endpoint).map_err(|error| {
                ApiError::ServiceUnavailable(format!("Incus backend for host {host_id}: {error}"))
            })?);
        self.cache
            .lock()
            .unwrap()
            .insert(host_id.to_string(), backend.clone());
        Ok(backend)
    }
}

// ---------------------------------------------------------------------------
// cloud-init user-data (init script + options-as-env runcmd)
// ---------------------------------------------------------------------------

/// Renders the `#cloud-config` user-data: writes the embedded init script
/// into the container and runs it once with the parameters as env vars.
/// The sha256 pin, when configured, rides along in a comment the Incus
/// backend copies onto `user.allternit.binary-sha256`.
pub fn build_user_data(params: &HashMap<String, String>) -> String {
    let mut lines = vec![
        "#cloud-config".to_string(),
        "write_files:".to_string(),
        "  - path: /usr/local/sbin/allternit-node-init".to_string(),
        "    owner: root:root".to_string(),
        "    permissions: '0755'".to_string(),
        "    content: |".to_string(),
    ];
    if let Some(sha256) = params.get("ALLTERNIT_BINARY_SHA256") {
        lines.push(format!("      # allternit sha256: {sha256}"));
    }
    for script_line in INIT_SCRIPT.lines() {
        lines.push(format!("      {script_line}"));
    }
    let env_args = params
        .iter()
        .map(|(key, value)| format!("{key}='{value}'"))
        .collect::<Vec<_>>()
        .join(" ");
    lines.push("runcmd:".to_string());
    lines.push(format!("  - env {env_args} /usr/local/sbin/allternit-node-init"));
    lines.join("\n")
}

// ---------------------------------------------------------------------------
// Metering (sessions table; no Stripe — ADR item 9)
// ---------------------------------------------------------------------------

/// Open a run interval for the instance (idempotent: at most one open
/// session per instance via the partial unique index).
pub async fn record_instance_started(db: &PgPool, instance_id: &str) -> Result<(), ApiError> {
    let Some(user_id) = user_id_for_instance(db, instance_id).await? else {
        return Err(ApiError::NotFound("Provisioned instance not found".to_string()));
    };
    sqlx::query(
        r#"
        INSERT INTO provisioned_instance_usage_sessions (id, instance_id, user_id, started_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(format!("pus_{}", Uuid::new_v4().simple()))
    .bind(instance_id)
    .bind(user_id)
    .execute(db)
    .await?;
    Ok(())
}

/// Close the open run interval, freezing its duration. Repeated calls are
/// no-ops — closing is idempotent per session.
pub async fn record_instance_stopped(
    db: &PgPool,
    instance_id: &str,
    reason: &str,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        UPDATE provisioned_instance_usage_sessions
        SET ended_at = CURRENT_TIMESTAMP,
            duration_seconds = GREATEST(
                0,
                EXTRACT(EPOCH FROM NOW())::BIGINT - EXTRACT(EPOCH FROM started_at)::BIGINT
            ),
            stop_reason = $1
        WHERE instance_id = $2 AND ended_at IS NULL
        "#,
    )
    .bind(reason)
    .bind(instance_id)
    .execute(db)
    .await?;
    Ok(())
}

/// Total running seconds for the instance since `since`: closed intervals
/// plus the still-open one (counted to now). This is the quantity per-minute
/// desktop-style billing multiplies by the period rate.
pub async fn usage_summary(
    db: &PgPool,
    instance_id: &str,
    since: DateTime<Utc>,
) -> Result<i64, ApiError> {
    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(
            CASE WHEN ended_at IS NULL
                THEN GREATEST(0, EXTRACT(EPOCH FROM NOW())::BIGINT - EXTRACT(EPOCH FROM started_at)::BIGINT)
                ELSE COALESCE(duration_seconds, 0)
            END
        ), 0)::BIGINT
        FROM provisioned_instance_usage_sessions
        WHERE instance_id = $1 AND started_at >= $2
        "#,
    )
    .bind(instance_id)
    .bind(since)
    .fetch_one(db)
    .await?;
    Ok(total)
}

async fn user_id_for_instance(db: &PgPool, instance_id: &str) -> Result<Option<String>, ApiError> {
    sqlx::query_scalar("SELECT user_id FROM provisioned_instances WHERE id = $1")
        .bind(instance_id)
        .fetch_optional(db)
        .await
        .map_err(ApiError::from)
}

// ---------------------------------------------------------------------------
// Pairing bind (called from runtime_pairing::exchange_pairing)
// ---------------------------------------------------------------------------

/// Validates a one-time provisioned bootstrap token exactly like the hosted
/// lane validates its bootstrap token: the instance row must exist and be
/// live, unbound, unexpired, and the sha256 of the presented code must match
/// `pairing_code_hash`. Returns the owning user for the pre-approved pairing.
pub async fn validate_provisioned_bootstrap(
    db: &PgPool,
    instance_id: Option<&str>,
    token: Option<&str>,
) -> Result<String, ApiError> {
    use crate::routes::runtime_pairing::sha256_hex;
    let instance_id = instance_id
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::BadRequest("provisioned_instance_id is required".to_string()))?;
    let token = token
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::Unauthorized("provisioned_bootstrap_token is required".to_string()))?;

    let row: Option<(String, Option<String>, Option<DateTime<Utc>>, Option<String>, String)> =
        sqlx::query_as(
            r#"
            SELECT user_id, pairing_code_hash, pairing_expires_at, device_id, status
            FROM provisioned_instances
            WHERE id = $1 AND status != 'deleted'
            "#,
        )
        .bind(instance_id)
        .fetch_optional(db)
        .await?;
    let Some((user_id, code_hash, expires_at, device_id, status)) = row else {
        tracing::warn!(%instance_id, "provisioned bootstrap rejected: no matching instance row");
        return Err(ApiError::Unauthorized("Invalid provisioned instance".to_string()));
    };
    if !matches!(status.as_str(), "provisioning" | "running" | "stopped") {
        return Err(ApiError::Unauthorized(
            "Provisioned instance is not live".to_string(),
        ));
    }
    if device_id.is_some() {
        return Err(ApiError::Unauthorized(
            "Provisioned instance is already registered".to_string(),
        ));
    }
    let expected = code_hash.ok_or_else(|| {
        tracing::warn!(%instance_id, "provisioned bootstrap rejected: no pairing code on row");
        ApiError::Unauthorized("Provisioned instance has no pairing code".to_string())
    })?;
    if expected != sha256_hex(token.as_bytes()) {
        tracing::warn!(%instance_id, "provisioned bootstrap rejected: code hash mismatch");
        return Err(ApiError::Unauthorized(
            "Invalid provisioned bootstrap token".to_string(),
        ));
    }
    // Checked in Rust: sqlx stores DateTime<Utc> as RFC3339 text, which does
    // not compare cleanly against CURRENT_TIMESTAMP in SQL (same note as in
    // runtime_pairing::previous_credential_for_token).
    if expires_at.map(|expires| expires <= Utc::now()).unwrap_or(true) {
        return Err(ApiError::TokenExpired(
            "Provisioned pairing code expired".to_string(),
        ));
    }
    Ok(user_id)
}

/// Transactional half of the pairing bind: claims the device slot on the
/// instance row. Runs inside `exchange_pairing`'s transaction; a second
/// exchange racing the same instance loses (`rows_affected != 1`) and the
/// whole exchange rolls back, mirroring the hosted-instance link.
pub async fn bind_device_slot(
    transaction: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    instance_id: &str,
    device_id: &str,
) -> Result<(), ApiError> {
    let bound = sqlx::query(
        r#"
        UPDATE provisioned_instances
        SET device_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND device_id IS NULL
        "#,
    )
    .bind(device_id)
    .bind(instance_id)
    .execute(&mut **transaction)
    .await?
    .rows_affected();
    if bound != 1 {
        return Err(ApiError::Unauthorized(
            "Provisioned instance was already registered".to_string(),
        ));
    }
    Ok(())
}

/// Post-commit half of the pairing bind: consume the one-time code, flip the
/// instance to `running`, stamp metering, and open its run interval. Safe to
/// call exactly once per successful exchange.
pub async fn activate_registered_device(
    db: &PgPool,
    instance_id: &str,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        UPDATE provisioned_instances
        SET status = 'running',
            pairing_code_hash = NULL,
            pairing_expires_at = NULL,
            last_started_at = COALESCE(last_started_at, CURRENT_TIMESTAMP),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND status = 'provisioning'
        "#,
    )
    .bind(instance_id)
    .execute(db)
    .await?;
    record_instance_started(db, instance_id).await
}

// ---------------------------------------------------------------------------
// The provisioning service
// ---------------------------------------------------------------------------

/// Per-subscription provisioning lane. Owns fleet scheduling, the
/// create/start/stop/status/delete lifecycle over the per-host
/// [`ProvisionBackend`], the state machine, and metering hooks.
#[derive(Debug)]
pub struct ProvisioningService {
    db: PgPool,
    defaults: ProvisionDefaults,
    registry: Arc<dyn BackendRegistry>,
}

impl ProvisioningService {
    pub fn new(db: PgPool) -> Self {
        Self::with_registry(db, Arc::new(IncusBackendRegistry::default()))
    }

    pub fn with_registry(db: PgPool, registry: Arc<dyn BackendRegistry>) -> Self {
        Self {
            db,
            defaults: ProvisionDefaults::from_env(),
            registry,
        }
    }

    #[cfg(test)]
    fn with_defaults(mut self, defaults: ProvisionDefaults) -> Self {
        self.defaults = defaults;
        self
    }

    /// Provision one container for `(user_id, subscription_id)`: allocate the
    /// best-free host, insert the instance row with a fresh one-time pairing
    /// code, then drive the backend create+start and feed the init script its
    /// parameters through cloud-init user-data. Backend failures leave the
    /// row in `error` with the allocation released.
    pub async fn create(
        &self,
        user_id: &str,
        subscription_id: Option<&str>,
    ) -> Result<InstanceView, ApiError> {
        let existing: Option<String> = sqlx::query_scalar(
            r#"
            SELECT id FROM provisioned_instances
            WHERE user_id = $1 AND status != 'deleted'
              AND subscription_id IS NOT DISTINCT FROM $2
            "#,
        )
        .bind(user_id)
        .bind(subscription_id)
        .fetch_optional(&self.db)
        .await?;
        if let Some(id) = existing {
            return Err(ApiError::BadRequest(format!(
                "An active provisioned instance already exists for this subscription ({id})"
            )));
        }

        let instance_id = format!("pi_{}", Uuid::new_v4().simple());
        let incus_name = incus_name(&instance_id);
        let pairing_code = crate::routes::runtime_pairing::random_secret(24);
        let pairing_code_hash = crate::routes::runtime_pairing::sha256_hex(pairing_code.as_bytes());
        let pairing_expires_at = Utc::now() + self.defaults.pairing_ttl;
        let defaults = self.defaults.clone();

        // 1. Allocate a host (best-free bin-pack under row locks).
        let mut transaction = self.db.begin().await?;
        let host_rows = sqlx::query_as::<_, HostCapacityRow>(
            r#"
            SELECT id, enabled, cpu_cores_total, memory_mb_total, disk_gb_total,
                   cpu_cores_allocated, memory_mb_allocated, disk_gb_allocated
            FROM provisioned_hosts
            WHERE enabled = TRUE
            ORDER BY id
            FOR UPDATE
            "#,
        )
        .fetch_all(&mut *transaction)
        .await?;
        let hosts: Vec<HostCapacity> = host_rows.into_iter().map(HostCapacityRow::into_capacity).collect();
        let Some(host_id) = select_host(&hosts, defaults.cpu_cores, defaults.memory_mb, defaults.disk_gb) else {
            transaction.rollback().await?;
            return Err(ApiError::ServiceUnavailable(
                "No provisioned fleet host has capacity for this instance".to_string(),
            ));
        };
        sqlx::query(
            r#"
            UPDATE provisioned_hosts
            SET cpu_cores_allocated = cpu_cores_allocated + $1,
                memory_mb_allocated = memory_mb_allocated + $2,
                disk_gb_allocated = disk_gb_allocated + $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            "#,
        )
        .bind(defaults.cpu_cores as i32)
        .bind(defaults.memory_mb)
        .bind(defaults.disk_gb)
        .bind(&host_id)
        .execute(&mut *transaction)
        .await?;
        sqlx::query(
            r#"
            INSERT INTO provisioned_instances (
                id, user_id, subscription_id, host_id, incus_name, status,
                pairing_code_hash, pairing_expires_at,
                cpu_cores, memory_mb, disk_gb
            ) VALUES ($1, $2, $3, $4, $5, 'provisioning', $6, $7, $8, $9, $10)
            "#,
        )
        .bind(&instance_id)
        .bind(user_id)
        .bind(subscription_id)
        .bind(&host_id)
        .bind(&incus_name)
        .bind(&pairing_code_hash)
        .bind(pairing_expires_at)
        .bind(defaults.cpu_cores)
        .bind(defaults.memory_mb)
        .bind(defaults.disk_gb)
        .execute(&mut *transaction)
        .await?;
        transaction.commit().await?;

        // 2. Drive the backend. On failure: error status + release the slot.
        let result = self.drive_create(&instance_id, &host_id, &incus_name, &pairing_code).await;
        if let Err(error) = result {
            tracing::warn!(%instance_id, %error, "provisioned instance create failed; marking error");
            let message = format!("{error}");
            sqlx::query(
                "UPDATE provisioned_instances SET status = 'error', error_message = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
            )
            .bind(&message)
            .bind(&instance_id)
            .execute(&self.db)
            .await?;
            self.release_allocation(&host_id, &defaults).await;
            return Err(error);
        }

        self.get_for_user(&instance_id, user_id).await
    }

    async fn drive_create(
        &self,
        instance_id: &str,
        host_id: &str,
        incus_name: &str,
        pairing_code: &str,
    ) -> Result<(), ApiError> {
        let row: Option<(String, Option<String>)> = sqlx::query_as(
            "SELECT incus_endpoint, region FROM provisioned_hosts WHERE id = $1",
        )
        .bind(host_id)
        .fetch_optional(&self.db)
        .await?;
        let Some((endpoint, _region)) = row else {
            return Err(ApiError::ServiceUnavailable(format!(
                "Fleet host {host_id} disappeared between allocation and create"
            )));
        };
        let endpoint = endpoint.trim_end_matches('/');
        let backend = self.registry.backend(host_id, endpoint).await?;

        let mut params: HashMap<String, String> = HashMap::new();
        params.insert(
            "ALLTERNIT_PROVISIONED_INSTANCE_ID".to_string(),
            instance_id.to_string(),
        );
        params.insert("ALLTERNIT_PAIRING_CODE".to_string(), pairing_code.to_string());
        params.insert(
            "ALLTERNIT_CLOUD_API_BASE".to_string(),
            self.defaults.api_base.clone(),
        );
        params.insert("ALLTERNIT_CLOUD_JWKS_URL".to_string(), self.defaults.jwks_url.clone());
        params.insert(
            "ALLTERNIT_NODE_RELEASE_URL".to_string(),
            self.defaults.release_url.clone(),
        );
        if let Some(sha256) = &self.defaults.binary_sha256 {
            params.insert("ALLTERNIT_BINARY_SHA256".to_string(), sha256.clone());
        }
        params.insert(
            "ALLTERNIT_NODE_DATA_DIR".to_string(),
            "/var/lib/allternit-node".to_string(),
        );

        let spec = ProvisionSpec {
            name: incus_name.to_string(),
            image: format!("local:{}", self.defaults.image),
            cpu_cores: self.defaults.cpu_cores,
            memory_mb: self.defaults.memory_mb,
            disk_gb: self.defaults.disk_gb,
            profiles: self.defaults.profiles.clone(),
            storage_pool: self.defaults.storage_pool.clone(),
            user_data: build_user_data(&params),
        };
        backend.create(&spec).await.map_err(|error| error.to_api_error())?;
        backend.start(incus_name).await.map_err(|error| error.to_api_error())?;
        Ok(())
    }

    /// Release a host allocation after error/delete (floor at zero).
    async fn release_allocation(&self, host_id: &str, defaults: &ProvisionDefaults) {
        if let Err(error) = sqlx::query(
            r#"
            UPDATE provisioned_hosts
            SET cpu_cores_allocated = GREATEST(0, cpu_cores_allocated - $1),
                memory_mb_allocated = GREATEST(0, memory_mb_allocated - $2),
                disk_gb_allocated = GREATEST(0, disk_gb_allocated - $3),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
            "#,
        )
        .bind(defaults.cpu_cores)
        .bind(defaults.memory_mb)
        .bind(defaults.disk_gb)
        .bind(host_id)
        .execute(&self.db)
        .await
        {
            tracing::warn!(%host_id, %error, "failed to release provisioned host allocation");
        }
    }

    pub async fn get_for_user(&self, instance_id: &str, user_id: &str) -> Result<InstanceView, ApiError> {
        let row = self.fetch_row(instance_id, Some(user_id)).await?;
        Ok(InstanceView::from(row))
    }

    pub async fn list_for_user(&self, user_id: &str) -> Result<Vec<InstanceView>, ApiError> {
        let rows = sqlx::query_as::<_, InstanceRow>(
            r#"
            SELECT id, user_id, subscription_id, host_id, incus_name, status, device_id,
                   cpu_cores, memory_mb, disk_gb, error_message,
                   last_started_at, last_stopped_at, created_at, updated_at
            FROM provisioned_instances
            WHERE user_id = $1 AND status != 'deleted'
            ORDER BY created_at DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.db)
        .await?;
        Ok(rows.into_iter().map(InstanceView::from).collect())
    }

    /// Start a stopped instance: backend start first, then the row transition
    /// and an open metering session. The transition guard (`WHERE status =
    /// 'stopped'`) keeps racing starts idempotent.
    pub async fn start(&self, instance_id: &str, user_id: &str) -> Result<InstanceView, ApiError> {
        let row = self.fetch_row(instance_id, Some(user_id)).await?;
        if row.status != "stopped" {
            return Err(ApiError::BadRequest(format!(
                "Instance cannot start from status '{}'",
                row.status
            )));
        }
        let backend = self.backend_for_row(&row).await?;
        backend.start(&row.incus_name).await.map_err(|error| error.to_api_error())?;
        sqlx::query(
            r#"
            UPDATE provisioned_instances
            SET status = 'running', last_started_at = CURRENT_TIMESTAMP,
                error_message = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'stopped'
            "#,
        )
        .bind(instance_id)
        .execute(&self.db)
        .await?;
        record_instance_started(&self.db, instance_id).await?;
        self.get_for_user(instance_id, user_id).await
    }

    /// Stop a running instance: backend stop, row transition, and a closed
    /// metering interval with frozen duration.
    pub async fn stop(&self, instance_id: &str, user_id: &str) -> Result<InstanceView, ApiError> {
        let row = self.fetch_row(instance_id, Some(user_id)).await?;
        if row.status != "running" {
            return Err(ApiError::BadRequest(format!(
                "Instance cannot stop from status '{}'",
                row.status
            )));
        }
        let backend = self.backend_for_row(&row).await?;
        backend.stop(&row.incus_name).await.map_err(|error| error.to_api_error())?;
        sqlx::query(
            r#"
            UPDATE provisioned_instances
            SET status = 'stopped', last_stopped_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status = 'running'
            "#,
        )
        .bind(instance_id)
        .execute(&self.db)
        .await?;
        record_instance_stopped(&self.db, instance_id, "user_stopped").await?;
        self.get_for_user(instance_id, user_id).await
    }

    /// Delete the container and retire the row. Allocation is released, the
    /// metering interval closes, and the bound runtime_devices row (if any)
    /// is revoked so node resolution stops routing to a deleted node.
    pub async fn delete(&self, instance_id: &str, user_id: &str) -> Result<InstanceView, ApiError> {
        let row = self.fetch_row(instance_id, Some(user_id)).await?;
        let backend = self.backend_for_row(&row).await?;
        match backend.delete(&row.incus_name).await {
            Ok(()) => {}
            // Already gone from the host is still a successful delete.
            Err(ProvisionError::NotFound(_)) => {}
            Err(error) => return Err(error.to_api_error()),
        }
        sqlx::query(
            r#"
            UPDATE provisioned_instances
            SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status != 'deleted'
            "#,
        )
        .bind(instance_id)
        .execute(&self.db)
        .await?;
        if let (Some(host_id), ) = (row.host_id.as_ref(), ) {
            self.release_allocation(host_id, &self.defaults).await;
        }
        record_instance_stopped(&self.db, instance_id, "deleted").await?;
        if let Some(device_id) = &row.device_id {
            sqlx::query(
                "UPDATE runtime_devices SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL",
            )
            .bind(device_id)
            .execute(&self.db)
            .await?;
        }
        self.get_for_user(instance_id, user_id).await
    }

    /// Total running seconds since `since` (closed intervals + the open one
    /// counted to now) — the metering input for per-minute billing.
    pub async fn usage(
        &self,
        instance_id: &str,
        user_id: &str,
        since: DateTime<Utc>,
    ) -> Result<i64, ApiError> {
        self.fetch_row(instance_id, Some(user_id)).await?;
        usage_summary(&self.db, instance_id, since).await
    }

    async fn fetch_row(
        &self,
        instance_id: &str,
        user_id: Option<&str>,
    ) -> Result<InstanceRow, ApiError> {
        let row = match user_id {
            Some(user_id) => sqlx::query_as::<_, InstanceRow>(
                r#"
                SELECT id, user_id, subscription_id, host_id, incus_name, status, device_id,
                       cpu_cores, memory_mb, disk_gb, error_message,
                       last_started_at, last_stopped_at, created_at, updated_at
                FROM provisioned_instances
                WHERE id = $1 AND user_id = $2
                "#,
            )
            .bind(instance_id)
            .bind(user_id)
            .fetch_optional(&self.db)
            .await?,
            None => sqlx::query_as::<_, InstanceRow>(
                r#"
                SELECT id, user_id, subscription_id, host_id, incus_name, status, device_id,
                       cpu_cores, memory_mb, disk_gb, error_message,
                       last_started_at, last_stopped_at, created_at, updated_at
                FROM provisioned_instances
                WHERE id = $1
                "#,
            )
            .bind(instance_id)
            .fetch_optional(&self.db)
            .await?,
        };
        row.ok_or_else(|| ApiError::NotFound("Provisioned instance not found".to_string()))
    }

    async fn backend_for_row(&self, row: &InstanceRow) -> Result<Arc<dyn ProvisionBackend>, ApiError> {
        let Some(host_id) = row.host_id.as_ref() else {
            return Err(ApiError::ServiceUnavailable(
                "Instance has no fleet host (pre-create failure?)".to_string(),
            ));
        };
        let endpoint: Option<String> =
            sqlx::query_scalar("SELECT incus_endpoint FROM provisioned_hosts WHERE id = $1")
                .bind(host_id)
                .fetch_optional(&self.db)
                .await?;
        let Some(endpoint) = endpoint else {
            return Err(ApiError::ServiceUnavailable(format!(
                "Fleet host {host_id} no longer exists"
            )));
        };
        self.registry.backend(host_id, endpoint.trim_end_matches('/')).await
    }

    /// One reconciliation pass: poll the backend for every live instance and
    /// converge the row status + metering. Started as a background task by
    /// `start_provisioning_reconcile_task`.
    pub async fn reconcile_all(&self) -> Result<(), ApiError> {
        let rows: Vec<(String, String, String, String, Option<String>, Option<String>, Option<String>)> =
            sqlx::query_as(
                r#"
                SELECT i.id, i.user_id, i.incus_name, i.status, i.device_id, i.host_id,
                       h.incus_endpoint
                FROM provisioned_instances i
                LEFT JOIN provisioned_hosts h ON h.id = i.host_id
                WHERE i.status IN ('provisioning', 'running', 'stopped')
                "#,
            )
            .fetch_all(&self.db)
            .await?;

        for (id, _user_id, incus_name, status, device_id, host_id, endpoint) in rows {
            let (Some(host_id), Some(endpoint)) = (host_id, endpoint) else { continue };
            let backend = match self.registry.backend(&host_id, &endpoint).await {
                Ok(backend) => backend,
                Err(error) => {
                    tracing::warn!(%id, %error, "reconcile: backend unavailable, skipping");
                    continue;
                }
            };
            match backend.status(&incus_name).await {
                Ok(BackendStatus::Running) if status == "provisioning" => {
                    activate_registered_device(&self.db, &id).await?;
                    tracing::info!(%id, "reconcile: provisioning -> running");
                }
                Ok(BackendStatus::Running) if status == "stopped" => {
                    sqlx::query(
                        "UPDATE provisioned_instances SET status = 'running', last_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                    )
                    .bind(&id)
                    .execute(&self.db)
                    .await?;
                    record_instance_started(&self.db, &id).await?;
                }
                Ok(BackendStatus::Stopped) if status == "running" => {
                    sqlx::query(
                        "UPDATE provisioned_instances SET status = 'stopped', last_stopped_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                    )
                    .bind(&id)
                    .execute(&self.db)
                    .await?;
                    record_instance_stopped(&self.db, &id, "provider_stopped").await?;
                }
                Ok(BackendStatus::NotFound) => {
                    // Container vanished out from under the control plane.
                    sqlx::query(
                        "UPDATE provisioned_instances SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
                    )
                    .bind(&id)
                    .execute(&self.db)
                    .await?;
                    record_instance_stopped(&self.db, &id, "backend_removed").await?;
                    if let Some(device_id) = device_id {
                        sqlx::query(
                            "UPDATE runtime_devices SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL",
                        )
                        .bind(&device_id)
                        .execute(&self.db)
                        .await?;
                    }
                    tracing::warn!(%id, "reconcile: instance gone from backend, marked deleted");
                }
                Ok(BackendStatus::Busy) | Ok(_) => {}
                Err(error) => {
                    tracing::warn!(%id, %error, "reconcile: status poll failed, skipping");
                }
            }
        }
        Ok(())
    }
}

#[derive(sqlx::FromRow)]
struct HostCapacityRow {
    id: String,
    enabled: bool,
    cpu_cores_total: i32,
    memory_mb_total: i64,
    disk_gb_total: i64,
    cpu_cores_allocated: i32,
    memory_mb_allocated: i64,
    disk_gb_allocated: i64,
}

impl HostCapacityRow {
    fn into_capacity(self) -> HostCapacity {
        HostCapacity {
            id: self.id,
            enabled: self.enabled,
            cpu_total: i64::from(self.cpu_cores_total),
            memory_total: self.memory_mb_total,
            disk_total: self.disk_gb_total,
            cpu_used: i64::from(self.cpu_cores_allocated),
            memory_used: self.memory_mb_allocated,
            disk_used: self.disk_gb_allocated,
        }
    }
}

/// Background reconciler, mirroring the hosted-runtime lifecycle task: keeps
/// row statuses honest against the backends and converges metering. Interval
/// is `PROVISIONED_RECONCILE_SECONDS` (default 60, floor 15).
pub fn start_provisioning_reconcile_task(state: Arc<crate::ApiState>) {
    let interval_seconds = std::env::var(ENV_RECONCILE_SECONDS)
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value >= 15)
        .unwrap_or(DEFAULT_RECONCILE_SECONDS);

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(interval_seconds));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        tracing::info!(interval_seconds, "Provisioned instance reconcile task started");
        loop {
            interval.tick().await;
            if let Err(error) = state.provisioning_service.reconcile_all().await {
                tracing::error!("Provisioned instance reconciliation failed: {}", error);
            }
        }
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;

    // ---- pure scheduling ---------------------------------------------------

    fn host(id: &str, cpu_total: i64, mem_total: i64, disk_total: i64) -> HostCapacity {
        HostCapacity {
            id: id.to_string(),
            enabled: true,
            cpu_total,
            memory_total: mem_total,
            disk_total,
            cpu_used: 0,
            memory_used: 0,
            disk_used: 0,
        }
    }

    #[test]
    fn select_host_empty_fleet_has_no_placement() {
        assert_eq!(select_host(&[], 2, 2048, 20), None);
    }

    #[test]
    fn select_host_skips_full_and_disabled_hosts() {
        let mut full = host("full", 4, 4096, 100);
        full.memory_used = 4096; // no free memory left
        let mut disabled = host("off", 16, 16384, 500);
        disabled.enabled = false;
        let live = host("live", 4, 4096, 100);
        let hosts = vec![full, disabled, live.clone()];
        assert_eq!(select_host(&hosts, 2, 2048, 20), Some(live.id));

        // When every host is full (or disabled), placement is None — the
        // next subscription must wait for capacity, not oversubscribe.
        let mut full2 = host("full2", 4, 4096, 100);
        full2.memory_used = 4096;
        assert_eq!(select_host(&[full2], 2, 2048, 20), None);
    }

    #[test]
    fn select_host_picks_most_free_memory_then_cpu_then_lowest_id() {
        // Bin-pack: the emptiest host wins so hosts fill one at a time.
        let mut a = host("a", 8, 8192, 100);
        a.memory_used = 4096; // 4096 free
        let mut b = host("b", 8, 16384, 100);
        b.memory_used = 2048; // 14336 free -> wins
        assert_eq!(select_host(&[a.clone(), b.clone()], 2, 2048, 20), Some("b".to_string()));

        // Memory tie: most free cpu wins.
        let mut c = host("c", 16, 8192, 100);
        c.memory_used = 4096; // 4096 free mem, 16 free cpu
        let mut d = host("d", 8, 8192, 100);
        d.memory_used = 4096; // 4096 free mem, 8 free cpu
        assert_eq!(select_host(&[d, c], 2, 2048, 20), Some("c".to_string()));

        // Full tie (including capacity shapes): lowest id, deterministically.
        let e1 = host("host-1", 8, 8192, 100);
        let e2 = host("host-2", 8, 8192, 100);
        assert_eq!(select_host(&[e2, e1.clone()], 2, 2048, 20), Some("host-1".to_string()));
        assert_eq!(select_host(&[e1, host("host-2", 8, 8192, 100)], 2, 2048, 20), Some("host-1".to_string()));

        // A request bigger than any single host fits nowhere, even with
        // aggregate capacity across the fleet.
        let fleet = vec![host("a", 4, 4096, 100), host("b", 4, 4096, 100)];
        assert_eq!(select_host(&fleet, 6, 2048, 20), None);
    }

    #[test]
    fn select_host_fills_hosts_one_at_a_time() {
        // When the best host has exactly one slot left, the next create()
        // lands on the next host (ADR item 9 "when a host fills, land on the
        // next") — the allocation ledger does this incrementally, so the
        // pure function only needs to see the updated `*_used` values.
        let mut a = host("a", 4, 4096, 100);
        a.memory_used = 2048; // one 2048 slot left
        let b = host("b", 4, 4096, 100); // fully free, but less free than... it IS the emptiest
        // "b" has 4096 free > "a"'s 2048 free -> new subs land on b first.
        assert_eq!(select_host(&[a.clone(), b.clone()], 2, 2048, 20), Some("b".to_string()));
        // Fill b's memory; now a's remaining slot is the only fit.
        let mut b_full = b.clone();
        b_full.memory_used = 4096;
        assert_eq!(select_host(&[a, b_full], 2, 2048, 20), Some("a".to_string()));
    }

    // ---- state machine -----------------------------------------------------

    #[test]
    fn state_machine_follows_the_documented_transitions() {
        // The happy path.
        assert!(can_transition("provisioning", "running"));
        assert!(can_transition("running", "stopped"));
        assert!(can_transition("stopped", "running"));
        for from in ["provisioning", "running", "stopped", "error"] {
            assert!(can_transition(from, "deleted"), "{from} -> deleted");
        }
        assert!(can_transition("running", "error"));
        assert!(can_transition("provisioning", "error"));

        // Illegal hops.
        assert!(!can_transition("stopped", "provisioning"));
        assert!(!can_transition("running", "provisioning"));
        assert!(!can_transition("error", "running"));
        assert!(!can_transition("deleted", "running"));
        assert!(!can_transition("deleted", "deleted"), "deleted is terminal");

        // Same-state is always allowed (idempotent writes).
        assert!(can_transition("running", "running"));
    }

    // ---- init-script contract -----------------------------------------------

    #[test]
    fn init_script_contract_is_embedded_and_reviewable() {
        assert!(INIT_SCRIPT.starts_with("#!/usr/bin/env bash"));
        assert!(INIT_SCRIPT.contains("set -euo pipefail"));
        assert!(INIT_SCRIPT.contains("ALLTERNIT_PAIRING_CODE"));
        assert!(INIT_SCRIPT.contains("/api/v1/runtime-pairings/exchange"));
        assert!(INIT_SCRIPT.contains("ALLTERNIT_CLOUD_JWKS_URL"));
        assert!(INIT_SCRIPT.contains("/var/lib/allternit-node"));
        assert!(INIT_SCRIPT.contains("heartbeat"));
        assert!(INIT_SCRIPT.contains("allternit-node-backup"));
    }

    #[test]
    fn user_data_carries_script_and_options_as_env() {
        let mut params = HashMap::new();
        params.insert("ALLTERNIT_PROVISIONED_INSTANCE_ID".to_string(), "pi_abc".to_string());
        params.insert("ALLTERNIT_PAIRING_CODE".to_string(), "code123".to_string());
        params.insert("ALLTERNIT_BINARY_SHA256".to_string(), "deadbeef".to_string());
        let user_data = build_user_data(&params);
        assert!(user_data.starts_with("#cloud-config"));
        assert!(user_data.contains("path: /usr/local/sbin/allternit-node-init"));
        assert!(user_data.contains("      #!/usr/bin/env bash"), "script lines are indented into content: |");
        assert!(user_data.contains("# allternit sha256: deadbeef"));
        assert!(user_data.contains("runcmd:"));
        assert!(user_data.contains("ALLTERNIT_PROVISIONED_INSTANCE_ID='pi_abc'"));
        assert!(user_data.contains("ALLTERNIT_PAIRING_CODE='code123'"));
        // Values are single-quoted so shell metacharacters cannot escape.
        assert!(!user_data.contains("ALLTERNIT_PAIRING_CODE=code123'"));
    }

    #[test]
    fn incus_names_are_valid_and_distinct_per_instance() {
        let name = incus_name("pi_abcdef012345");
        assert!(name.starts_with("allternit-sub-"));
        assert!(name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'));
        assert!(name.len() <= 63);
        assert_ne!(incus_name("pi_abcdef012345"), incus_name("pi_abcdef999999"));
    }

    // ---- Incus adapter over a mock transport -------------------------------

    #[derive(Debug, Default)]
    struct MockTransport {
        responses: Mutex<VecDeque<(u16, serde_json::Value)>>,
        requests: Mutex<Vec<(String, String, Option<serde_json::Value>)>>,
    }

    #[async_trait]
    impl IncusTransport for MockTransport {
        async fn request(
            &self,
            method: reqwest::Method,
            path: &str,
            body: Option<serde_json::Value>,
        ) -> Result<(u16, serde_json::Value), ProvisionError> {
            self.requests
                .lock()
                .unwrap()
                .push((method.to_string(), path.to_string(), body));
            Ok(self
                .responses
                .lock()
                .unwrap()
                .pop_front()
                .unwrap_or((200, serde_json::json!({}))))
        }
    }

    /// Wrap a shared mock so requests are recorded on the Arc the test keeps.
    struct SharedTransport(Arc<MockTransport>);

    #[async_trait]
    impl IncusTransport for SharedTransport {
        async fn request(
            &self,
            method: reqwest::Method,
            path: &str,
            body: Option<serde_json::Value>,
        ) -> Result<(u16, serde_json::Value), ProvisionError> {
            self.0
                .requests
                .lock()
                .unwrap()
                .push((method.to_string(), path.to_string(), body));
            Ok(self
                .0
                .responses
                .lock()
                .unwrap()
                .pop_front()
                .unwrap_or((200, serde_json::json!({}))))
        }
    }

    fn create_operation_response(name: &str) -> (u16, serde_json::Value) {
        (
            200,
            serde_json::json!({
                "operation": "/1.0/operations/op-1",
                "metadata": { "resources": { "instances": [format!("/1.0/instances/{name}")] } }
            }),
        )
    }

    fn spec(name: &str) -> ProvisionSpec {
        ProvisionSpec {
            name: name.to_string(),
            image: "local:allternit-node".to_string(),
            cpu_cores: 2,
            memory_mb: 2048,
            disk_gb: 20,
            profiles: vec!["default".to_string()],
            storage_pool: "default".to_string(),
            user_data: "#cloud-config\nruncmd: [init]\n".to_string(),
        }
    }

    #[tokio::test]
    async fn incus_create_posts_an_unprivileged_container_with_cloud_init_and_waits() {
        let mock = Arc::new(MockTransport::default());
        mock.responses
            .lock()
            .unwrap()
            .push_back(create_operation_response("allternit-sub-y"));
        let backend = IncusHttpBackend::with_transport(Box::new(SharedTransport(mock.clone())));

        backend.create(&spec("allternit-sub-y")).await.unwrap();

        let requests = mock.requests.lock().unwrap();
        assert_eq!(requests.len(), 2, "create + operation wait");
        let (method, path, body) = &requests[0];
        assert_eq!(method, "POST");
        assert_eq!(path, "/1.0/instances");
        let body = body.as_ref().unwrap();
        assert_eq!(body["name"], "allternit-sub-y");
        assert_eq!(body["type"], "container");
        assert_eq!(body["source"]["alias"], "allternit-node");
        assert_eq!(body["config"]["security.privileged"], "false");
        assert_eq!(body["config"]["limits.cpu"], "2");
        assert_eq!(body["config"]["limits.memory"], "2048MiB");
        assert_eq!(body["config"]["user.user-data"], "#cloud-config\nruncmd: [init]\n");
        assert_eq!(body["devices"]["root"]["pool"], "default");
        assert_eq!(body["devices"]["root"]["size"], "20GiB");
        assert_eq!(requests[1].1, "/1.0/operations/op-1/wait?timeout=60");
    }

    #[tokio::test]
    async fn incus_create_surfaces_api_errors() {
        let mock = Arc::new(MockTransport::default());
        mock.responses.lock().unwrap().push_back((
            409,
            serde_json::json!({ "error": "Instance 'allternit-sub-y' already exists" }),
        ));
        let backend = IncusHttpBackend::with_transport(Box::new(SharedTransport(mock)));
        let error = backend.create(&spec("allternit-sub-y")).await.unwrap_err();
        assert!(
            matches!(error, ProvisionError::Api { status: 409, .. }),
            "create conflict must surface as an Api error, got {error}"
        );
    }

    #[tokio::test]
    async fn incus_start_stop_delete_wrap_state_actions() {
        let mock = Arc::new(MockTransport::default());
        let backend = IncusHttpBackend::with_transport(Box::new(SharedTransport(mock.clone())));

        for action in ["start", "stop"] {
            mock.responses
                .lock()
                .unwrap()
                .push_back(create_operation_response("n1"));
            match action {
                "start" => backend.start("n1").await.unwrap(),
                _ => backend.stop("n1").await.unwrap(),
            }
        }
        mock.responses
            .lock()
            .unwrap()
            .push_back(create_operation_response("n1"));
        backend.delete("n1").await.unwrap();

        let requests = mock.requests.lock().unwrap();
        assert_eq!(requests[0].0, "POST");
        assert_eq!(requests[0].1, "/1.0/instances/n1/state");
        assert_eq!(requests[0].2.as_ref().unwrap()["action"], "start");
        assert_eq!(requests[2].2.as_ref().unwrap()["action"], "stop");
        assert_eq!(requests[4].0, "DELETE");
        assert_eq!(requests[4].1, "/1.0/instances/n1");
    }

    #[tokio::test]
    async fn incus_status_maps_the_devpod_enum() {
        let mock = Arc::new(MockTransport::default());
        let backend = IncusHttpBackend::with_transport(Box::new(SharedTransport(mock.clone())));

        for (incus_status, expected) in [
            ("Running", BackendStatus::Running),
            ("Stopped", BackendStatus::Stopped),
            ("Freezing", BackendStatus::Busy), // in-flight transitions are Busy
            ("Error", BackendStatus::Busy),    // unrecognized states are Busy, never silent Running
        ] {
            mock.responses.lock().unwrap().push_back((
                200,
                serde_json::json!({ "metadata": { "status": incus_status } }),
            ));
            assert_eq!(
                backend.status("n1").await.unwrap(),
                expected,
                "Incus status {incus_status}"
            );
        }

        // HTTP 404 maps to NotFound (the scheduler's deletion signal).
        mock.responses
            .lock()
            .unwrap()
            .push_back((404, serde_json::json!({ "error": "not found" })));
        assert!(matches!(
            backend.status("n1").await.unwrap_err(),
            ProvisionError::NotFound(_)
        ));
    }
}

// ---------------------------------------------------------------------------
// Live-PG tests: the service against migrations_pg/014 in a scratch schema,
// following the schema-per-test pattern from node_resolution::tests.
// ---------------------------------------------------------------------------

#[cfg(test)]
mod pg_tests {
    use super::*;
    use std::collections::VecDeque;

    const MIGRATION_014: &str = include_str!("../../migrations_pg/014_provisioned_fleet.sql");

    async fn test_pool() -> PgPool {
        let url = "postgres://allternit:allternit_pg_2026@localhost:5432/allternit_test";
        let schema = format!("test_{}", uuid::Uuid::new_v4().simple());
        let schema_for_hook = schema.clone();
        sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .after_connect(move |conn, _meta| {
                let schema = schema_for_hook.clone();
                Box::pin(async move {
                    sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    sqlx::query(&format!("SET search_path TO {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    Ok(())
                })
            })
            .connect(url)
            .await
            .unwrap()
    }

    /// Applies a migrations_pg file statement-by-statement to the scratch
    /// schema (same helper pattern as node_resolution::tests).
    async fn apply_migration_sql(pool: &PgPool, schema: &str, sql: &str) {
        let without_comments = sql
            .lines()
            .map(|line| line.split_once("--").map(|(code, _)| code).unwrap_or(line))
            .collect::<Vec<_>>()
            .join("\n");
        let rewritten = without_comments.replace("public.", &format!("{schema}."));
        for statement in rewritten.split(';') {
            let statement = statement.trim();
            if statement.is_empty() || statement.contains("OWNER TO") {
                continue;
            }
            sqlx::query(statement).execute(pool).await.unwrap();
        }
    }

    /// Stubs the FK targets of migration 014 and applies it — twice, proving
    /// the IF NOT EXISTS statements are idempotent — returning a pool whose
    /// schema carries the real migration DDL.
    async fn migrated_pool() -> PgPool {
        let pool = test_pool().await;
        sqlx::query("CREATE TABLE users (id TEXT PRIMARY KEY)").execute(&pool).await.unwrap();
        sqlx::query(
            "CREATE TABLE billing_subscriptions (stripe_subscription_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL DEFAULT 'active')",
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("CREATE TABLE runtime_pairings (id TEXT PRIMARY KEY)")
            .execute(&pool)
            .await
            .unwrap();
        // The delete/bind paths touch runtime_devices (device revocation).
        sqlx::query(
            r#"
            CREATE TABLE runtime_devices (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                name TEXT,
                status TEXT NOT NULL DEFAULT 'offline',
                credential_expires_at TIMESTAMPTZ,
                revoked_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        let schema: String =
            sqlx::query_scalar("SELECT current_schema()").fetch_one(&pool).await.unwrap();
        apply_migration_sql(&pool, &schema, MIGRATION_014).await;
        apply_migration_sql(&pool, &schema, MIGRATION_014).await;
        sqlx::query("INSERT INTO users (id) VALUES ('user_1'), ('user_2')")
            .execute(&pool)
            .await
            .unwrap();
        // FK targets for the subscription ids the tests provision against.
        sqlx::query(
            "INSERT INTO billing_subscriptions (stripe_subscription_id, user_id, status) VALUES ('sub_1', 'user_1', 'active'), ('sub_2', 'user_1', 'active'), ('sub_9', 'user_2', 'active')",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn insert_host(pool: &PgPool, id: &str, cpu: i64, mem: i64, disk: i64) {
        sqlx::query(
            r#"
            INSERT INTO provisioned_hosts (
                id, name, incus_endpoint, cpu_cores_total, memory_mb_total, disk_gb_total
            ) VALUES ($1, $1, 'https://incus.example.com:8443', $2, $3, $4)
            "#,
        )
        .bind(id)
        .bind(cpu as i32)
        .bind(mem)
        .bind(disk)
        .execute(pool)
        .await
        .unwrap();
    }

    /// Fixed defaults so the tests are immune to the outer environment.
    fn test_defaults() -> ProvisionDefaults {
        ProvisionDefaults {
            image: "allternit-node".to_string(),
            cpu_cores: 2,
            memory_mb: 2048,
            disk_gb: 20,
            profiles: vec!["default".to_string()],
            release_url: "https://releases.example.com/allternit-api.tar.gz".to_string(),
            binary_sha256: Some("abc123".to_string()),
            jwks_url: "https://api.allternit.com/api/v1/auth/dp-jwks".to_string(),
            api_base: "https://api.allternit.com".to_string(),
            storage_pool: "default".to_string(),
            pairing_ttl: Duration::hours(24),
        }
    }

    #[derive(Debug, Default)]
    struct MockBackend {
        created: Mutex<Vec<ProvisionSpec>>,
        calls: Mutex<Vec<String>>,
        statuses: Mutex<VecDeque<Result<BackendStatus, ProvisionError>>>,
        fail_create: bool,
    }

    #[async_trait]
    impl ProvisionBackend for MockBackend {
        async fn create(&self, spec: &ProvisionSpec) -> Result<(), ProvisionError> {
            self.created.lock().unwrap().push(spec.clone());
            if self.fail_create {
                return Err(ProvisionError::Api {
                    status: 500,
                    message: "mock create failure".to_string(),
                });
            }
            Ok(())
        }
        async fn start(&self, name: &str) -> Result<(), ProvisionError> {
            self.calls.lock().unwrap().push(format!("start:{name}"));
            Ok(())
        }
        async fn stop(&self, name: &str) -> Result<(), ProvisionError> {
            self.calls.lock().unwrap().push(format!("stop:{name}"));
            Ok(())
        }
        async fn status(&self, _name: &str) -> Result<BackendStatus, ProvisionError> {
            self.statuses
                .lock()
                .unwrap()
                .pop_front()
                .unwrap_or(Ok(BackendStatus::Running))
        }
        async fn delete(&self, name: &str) -> Result<(), ProvisionError> {
            self.calls.lock().unwrap().push(format!("delete:{name}"));
            Ok(())
        }
    }

    #[derive(Debug)]
    struct StaticRegistry {
        backend: Arc<MockBackend>,
    }

    #[async_trait]
    impl BackendRegistry for StaticRegistry {
        async fn backend(
            &self,
            _host_id: &str,
            _endpoint: &str,
        ) -> Result<Arc<dyn ProvisionBackend>, ApiError> {
            Ok(self.backend.clone())
        }
    }

    fn service(pool: PgPool, backend: Arc<MockBackend>) -> ProvisioningService {
        ProvisioningService::with_registry(pool, Arc::new(StaticRegistry { backend }))
            .with_defaults(test_defaults())
    }

    #[tokio::test]
    async fn migration_014_applies_idempotently() {
        let pool = migrated_pool().await;
        // Real DDL round-trips: insert a host + instance + an open session.
        insert_host(&pool, "host_a", 8, 8192, 100).await;
        sqlx::query(
            r#"
            INSERT INTO provisioned_instances (id, user_id, host_id, incus_name, status)
            VALUES ('pi_1', 'user_1', 'host_a', 'allternit-sub-pi1', 'running')
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO provisioned_instance_usage_sessions (id, instance_id, user_id) VALUES ('pus_1', 'pi_1', 'user_1')",
        )
        .execute(&pool)
        .await
        .unwrap();
        // The one-open-session partial unique index holds.
        let result = sqlx::query(
            "INSERT INTO provisioned_instance_usage_sessions (id, instance_id, user_id) VALUES ('pus_2', 'pi_1', 'user_1')",
        )
        .execute(&pool)
        .await;
        assert!(result.is_err(), "a second open session must violate the partial unique index");
        // The status vocabulary is pinned by the CHECK.
        let result = sqlx::query(
            "UPDATE provisioned_instances SET status = 'bogus' WHERE id = 'pi_1'",
        )
        .execute(&pool)
        .await;
        assert!(result.is_err(), "the status CHECK must reject unknown states");
        // The pairing-link column landed on runtime_pairings.
        let column: Option<String> = sqlx::query_scalar(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'runtime_pairings' AND column_name = 'provisioned_instance_id'",
        )
        .fetch_optional(&pool)
        .await
        .unwrap();
        assert_eq!(column.as_deref(), Some("provisioned_instance_id"));
    }

    #[tokio::test]
    async fn create_allocates_best_host_and_feeds_init_parameters() {
        let pool = migrated_pool().await;
        // Host b has more free memory -> bin-pack lands there first.
        insert_host(&pool, "host_a", 8, 8192, 100).await;
        insert_host(&pool, "host_b", 8, 16384, 100).await;
        sqlx::query("UPDATE provisioned_hosts SET memory_mb_allocated = 2048 WHERE id = 'host_b'")
            .execute(&pool)
            .await
            .unwrap();
        let backend = Arc::new(MockBackend::default());
        let service = service(pool.clone(), backend.clone());

        let view = service.create("user_1", Some("sub_1")).await.unwrap();
        assert_eq!(view.status, "provisioning");
        assert_eq!(view.host_id.as_deref(), Some("host_b"));
        assert!(view.device_id.is_none());

        // The backend got the full spec; user-data carries the pairing code
        // and the env contract to the init script.
        let created = backend.created.lock().unwrap();
        assert_eq!(created.len(), 1);
        assert_eq!(created[0].name, view.incus_name);
        assert_eq!(created[0].image, "local:allternit-node");
        let user_data = &created[0].user_data;
        assert!(user_data.contains("#cloud-config"));
        assert!(user_data.contains("content: |"));
        assert!(user_data.contains("#!/usr/bin/env bash"), "the embedded init script ships in user-data");
        assert!(user_data.contains(&format!("ALLTERNIT_PROVISIONED_INSTANCE_ID='{}'", view.id)));
        assert!(user_data.contains("ALLTERNIT_CLOUD_JWKS_URL='https://api.allternit.com/api/v1/auth/dp-jwks'"));
        assert!(user_data.contains("ALLTERNIT_BINARY_SHA256='abc123'"));
        drop(created);
        assert!(backend.calls.lock().unwrap().contains(&format!("start:{}", view.incus_name)));

        // The instance row holds the *hash* of the one-time code, never the code.
        let code_hash: Option<String> =
            sqlx::query_scalar("SELECT pairing_code_hash FROM provisioned_instances WHERE id = $1")
                .bind(&view.id)
                .fetch_one(&pool)
                .await
                .unwrap();
        let code_hash = code_hash.expect("a fresh pairing code hash is stored");
        assert_eq!(code_hash.len(), 64, "sha256 hex");

        // The allocation ledger moved by exactly one default slot.
        let allocated: (i32, i64, i64) =
            sqlx::query_as("SELECT cpu_cores_allocated, memory_mb_allocated, disk_gb_allocated FROM provisioned_hosts WHERE id = 'host_b'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(allocated, (2, 4096, 20));
    }

    #[tokio::test]
    async fn create_refuses_duplicates_and_empty_fleet() {
        let pool = migrated_pool().await;
        let backend = Arc::new(MockBackend::default());
        let service = service(pool.clone(), backend);

        let error = service.create("user_1", Some("sub_1")).await.unwrap_err();
        assert!(
            matches!(error, ApiError::ServiceUnavailable(_)),
            "no fleet hosts -> ServiceUnavailable, got {error}"
        );

        insert_host(&pool, "host_a", 8, 8192, 100).await;
        let view = service.create("user_1", Some("sub_1")).await.unwrap();
        let error = service.create("user_1", Some("sub_1")).await.unwrap_err();
        assert!(
            matches!(error, ApiError::BadRequest(_)),
            "one active instance per subscription, got {error}"
        );
        // A different subscription for the same user is a different instance;
        // capacity permitting.
        let other = service.create("user_1", Some("sub_2")).await.unwrap();
        assert_ne!(view.id, other.id);
    }

    #[tokio::test]
    async fn create_backend_failure_marks_error_and_releases_capacity() {
        let pool = migrated_pool().await;
        insert_host(&pool, "host_a", 8, 8192, 100).await;
        let backend = Arc::new(MockBackend {
            fail_create: true,
            ..Default::default()
        });
        let service = service(pool.clone(), backend);

        let error = service.create("user_1", Some("sub_1")).await.unwrap_err();
        assert!(matches!(error, ApiError::ServiceUnavailable(_)));

        let (status, message): (String, Option<String>) = sqlx::query_as(
            "SELECT status, error_message FROM provisioned_instances WHERE user_id = 'user_1'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(status, "error");
        assert!(message.unwrap().contains("mock create failure"));

        // The failed attempt must not hold capacity hostage.
        let allocated: (i32, i64, i64) = sqlx::query_as(
            "SELECT cpu_cores_allocated, memory_mb_allocated, disk_gb_allocated FROM provisioned_hosts WHERE id = 'host_a'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(allocated, (0, 0, 0));
    }

    #[tokio::test]
    async fn start_stop_drive_state_machine_and_metering() {
        let pool = migrated_pool().await;
        insert_host(&pool, "host_a", 8, 8192, 100).await;
        let backend = Arc::new(MockBackend::default());
        let service = service(pool.clone(), backend.clone());
        let view = service.create("user_1", Some("sub_1")).await.unwrap();

        // provisioning cannot be started/stopped directly.
        assert!(matches!(
            service.start(&view.id, "user_1").await.unwrap_err(),
            ApiError::BadRequest(_)
        ));

        // Simulate the pairing bind flipping the instance to running.
        crate::services::provisioning::activate_registered_device(&pool, &view.id)
            .await
            .unwrap();
        let open_sessions: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM provisioned_instance_usage_sessions WHERE instance_id = $1 AND ended_at IS NULL",
        )
        .bind(&view.id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(open_sessions, 1, "bind opens exactly one run interval");

        // stop: backend stop, transition, closed interval, timestamps.
        let stopped = service.stop(&view.id, "user_1").await.unwrap();
        assert_eq!(stopped.status, "stopped");
        assert!(stopped.last_stopped_at.is_some());
        assert!(backend.calls.lock().unwrap().contains(&format!("stop:{}", view.incus_name)));
        let open_sessions: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM provisioned_instance_usage_sessions WHERE instance_id = $1 AND ended_at IS NULL",
        )
        .bind(&view.id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(open_sessions, 0);
        let closed: (Option<DateTime<Utc>>, String) = sqlx::query_as(
            "SELECT ended_at, stop_reason FROM provisioned_instance_usage_sessions WHERE instance_id = $1",
        )
        .bind(&view.id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert!(closed.0.is_some());
        assert_eq!(closed.1, "user_stopped");

        // start again: new open interval; usage sums closed + open seconds.
        let started = service.start(&view.id, "user_1").await.unwrap();
        assert_eq!(started.status, "running");
        assert!(started.last_started_at.is_some());
        let usage = service
            .usage(&view.id, "user_1", Utc::now() - Duration::hours(1))
            .await
            .unwrap();
        assert!(usage >= 0);

        // Wrong user sees nothing (no cross-tenant existence leak).
        assert!(matches!(
            service.stop(&view.id, "user_2").await.unwrap_err(),
            ApiError::NotFound(_)
        ));
    }

    #[tokio::test]
    async fn usage_summary_counts_closed_and_open_sessions_per_period() {
        let pool = migrated_pool().await;
        insert_host(&pool, "host_a", 8, 8192, 100).await;
        sqlx::query(
            r#"
            INSERT INTO provisioned_instances (id, user_id, incus_name, status)
            VALUES ('pi_1', 'user_1', 'allternit-sub-pi1', 'running')
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        // Closed hour-long session within the period, another outside it,
        // and one still-open interval counted to now.
        for (id, started, ended, duration) in [
            ("pus_in", "1 hour", "30 minutes", 1800_i64),
            ("pus_out", "10 days", "9 days", 3600_i64),
        ] {
            sqlx::query(
                r#"
                INSERT INTO provisioned_instance_usage_sessions
                    (id, instance_id, user_id, started_at, ended_at, duration_seconds)
                VALUES ($1, 'pi_1', 'user_1', NOW() - $2::interval, NOW() - $3::interval, $4)
                "#,
            )
            .bind(id)
            .bind(started)
            .bind(ended)
            .bind(duration)
            .execute(&pool)
            .await
            .unwrap();
        }
        sqlx::query(
            "INSERT INTO provisioned_instance_usage_sessions (id, instance_id, user_id, started_at) VALUES ('pus_open', 'pi_1', 'user_1', NOW() - interval '90 seconds')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let total = usage_summary(&pool, "pi_1", Utc::now() - Duration::hours(24)).await.unwrap();
        assert!(total >= 1800 + 89, "closed 1800s + ~90s open, got {total}");
        assert!(total <= 1800 + 95, "the out-of-period session must not count, got {total}");

        // Period query: since-now excludes everything older than a moment ago.
        let recent = usage_summary(&pool, "pi_1", Utc::now()).await.unwrap();
        assert!(recent <= 95, "only the fresh open interval counts, got {recent}");
    }

    #[tokio::test]
    async fn delete_tears_down_backend_row_session_device_and_allocation() {
        let pool = migrated_pool().await;
        insert_host(&pool, "host_a", 8, 8192, 100).await;
        let backend = Arc::new(MockBackend::default());
        let service = service(pool.clone(), backend.clone());
        let view = service.create("user_1", Some("sub_1")).await.unwrap();

        // Bind a device row the delete must revoke.
        sqlx::query(
            r#"
            INSERT INTO runtime_devices (id, user_id, name, credential_expires_at, status)
            VALUES ('rt_1', 'user_1', 'provisioned', CURRENT_TIMESTAMP + interval '30 days', 'online')
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        let mut tx = pool.begin().await.unwrap();
        bind_device_slot(&mut tx, &view.id, "rt_1").await.unwrap();
        tx.commit().await.unwrap();
        activate_registered_device(&pool, &view.id).await.unwrap();

        let deleted = service.delete(&view.id, "user_1").await.unwrap();
        assert_eq!(deleted.status, "deleted");
        assert!(backend.calls.lock().unwrap().contains(&format!("delete:{}", view.incus_name)));

        let device_status: String =
            sqlx::query_scalar("SELECT status FROM runtime_devices WHERE id = 'rt_1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(device_status, "revoked", "the bound node must stop resolving");
        let allocated: (i32, i64) =
            sqlx::query_as("SELECT cpu_cores_allocated, memory_mb_allocated FROM provisioned_hosts WHERE id = 'host_a'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(allocated, (0, 0));
        let stop_reason: String = sqlx::query_scalar(
            "SELECT stop_reason FROM provisioned_instance_usage_sessions WHERE instance_id = $1",
        )
        .bind(&view.id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(stop_reason, "deleted");
    }

    #[tokio::test]
    async fn pairing_bind_flow_validates_consumes_and_activates() {
        let pool = migrated_pool().await;
        insert_host(&pool, "host_a", 8, 8192, 100).await;
        let backend = Arc::new(MockBackend::default());
        let service = service(pool.clone(), backend);
        let view = service.create("user_1", Some("sub_1")).await.unwrap();

        // create() stores only the hash of the one-time code, so for the
        // accept paths point the row at a known code's hash (the reject
        // paths work against whatever hash is stored).
        let error = validate_provisioned_bootstrap(&pool, Some(&view.id), Some("wrong-code"))
            .await
            .unwrap_err();
        assert!(matches!(error, ApiError::Unauthorized(_)));

        let known_code = "known-bootstrap-code";
        sqlx::query("UPDATE provisioned_instances SET pairing_code_hash = $1 WHERE id = $2")
            .bind(crate::routes::runtime_pairing::sha256_hex(known_code.as_bytes()))
            .bind(&view.id)
            .execute(&pool)
            .await
            .unwrap();

        let user = validate_provisioned_bootstrap(&pool, Some(&view.id), Some(known_code))
            .await
            .unwrap();
        assert_eq!(user, "user_1");

        // A second device cannot steal the slot.
        let mut tx = pool.begin().await.unwrap();
        bind_device_slot(&mut tx, &view.id, "rt_1").await.unwrap();
        tx.commit().await.unwrap();
        let error = validate_provisioned_bootstrap(&pool, Some(&view.id), Some(known_code))
            .await
            .unwrap_err();
        assert!(
            matches!(error, ApiError::Unauthorized(_)),
            "a bound instance rejects further bootstrap codes, got {error}"
        );

        // Expired codes are rejected and the slot still cannot be claimed by
        // a fresh (unbound) instance whose code lapsed.
        let view2 = service.create("user_2", Some("sub_9")).await.unwrap();
        sqlx::query(
            "UPDATE provisioned_instances SET pairing_expires_at = NOW() - interval '1 minute' WHERE id = $1",
        )
        .bind(&view2.id)
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query("UPDATE provisioned_instances SET pairing_code_hash = $1 WHERE id = $2")
            .bind(crate::routes::runtime_pairing::sha256_hex(known_code.as_bytes()))
            .bind(&view2.id)
            .execute(&pool)
            .await
            .unwrap();
        let error = validate_provisioned_bootstrap(&pool, Some(&view2.id), Some(known_code))
            .await
            .unwrap_err();
        assert!(matches!(error, ApiError::TokenExpired(_)));

        // Activation flips the row to running, consumes the code, opens the
        // run interval.
        activate_registered_device(&pool, &view.id).await.unwrap();
        let row: (String, Option<String>, Option<DateTime<Utc>>) = sqlx::query_as(
            "SELECT status, pairing_code_hash, last_started_at FROM provisioned_instances WHERE id = $1",
        )
        .bind(&view.id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(row.0, "running");
        assert!(row.1.is_none(), "the one-time code is consumed at bind");
        assert!(row.2.is_some());
    }

    #[tokio::test]
    async fn reconcile_converges_status_and_metering_from_backend_truth() {
        let pool = migrated_pool().await;
        insert_host(&pool, "host_a", 8, 8192, 100).await;
        let backend = Arc::new(MockBackend::default());
        let service = service(pool.clone(), backend.clone());

        // provisioning + backend Running -> running (backend truth wins when
        // the pairing exchange has not fired yet).
        let view = service.create("user_1", Some("sub_1")).await.unwrap();
        service.reconcile_all().await.unwrap();
        let status: String =
            sqlx::query_scalar("SELECT status FROM provisioned_instances WHERE id = $1")
                .bind(&view.id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(status, "running");

        // running + backend Stopped -> stopped, interval closed.
        backend
            .statuses
            .lock()
            .unwrap()
            .push_back(Ok(BackendStatus::Stopped));
        service.reconcile_all().await.unwrap();
        let status: String =
            sqlx::query_scalar("SELECT status FROM provisioned_instances WHERE id = $1")
                .bind(&view.id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(status, "stopped");
        let open: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM provisioned_instance_usage_sessions WHERE instance_id = $1 AND ended_at IS NULL",
        )
        .bind(&view.id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(open, 0);

        // stopped + backend Running -> running again, fresh interval.
        backend
            .statuses
            .lock()
            .unwrap()
            .push_back(Ok(BackendStatus::Running));
        service.reconcile_all().await.unwrap();
        let status: String =
            sqlx::query_scalar("SELECT status FROM provisioned_instances WHERE id = $1")
                .bind(&view.id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(status, "running");

        // NotFound -> deleted.
        backend
            .statuses
            .lock()
            .unwrap()
            .push_back(Ok(BackendStatus::NotFound));
        service.reconcile_all().await.unwrap();
        let status: String =
            sqlx::query_scalar("SELECT status FROM provisioned_instances WHERE id = $1")
                .bind(&view.id)
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(status, "deleted");
    }
}
