//! Admin endpoints for managing cloud-provisioned Desktop Cloud Incus hosts.

use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::auth::AuthUser;
use crate::desktop_host_provisioner::DesktopHostProvisioner;
use crate::AppState;
use allternit_computer_cloud::ProviderKind;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/desktop-hosts", get(list_hosts).post(provision_host))
        .route("/desktop-hosts/:id/drain", post(drain_host))
}

/// Public registration route mounted outside the authenticated /api/v1 surface.
pub fn public_router() -> Router<Arc<AppState>> {
    Router::new().route("/api/v1/desktop-hosts/register", post(register_host))
}

#[derive(Debug, Serialize)]
struct HostResponse {
    pub id: String,
    pub provider: String,
    pub cloud_instance_id: Option<String>,
    pub region: Option<String>,
    pub instance_type: Option<String>,
    pub tailscale_ip: Option<String>,
    pub incus_url: String,
    pub status: String,
    pub total_memory_mb: i64,
    pub used_memory_mb: i64,
    pub created_at: String,
    pub updated_at: String,
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProvisionRequest {
    provider: Option<String>,
    region: Option<String>,
    plan: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    host_id: String,
    incus_url: String,
    tailscale_ip: Option<String>,
    incus_ca_cert: Option<String>,
    token: String,
}

fn provisioner(state: &AppState) -> Result<&DesktopHostProvisioner, Response> {
    state
        .desktop_host_provisioner
        .as_ref()
        .ok_or_else(|| error_response(StatusCode::SERVICE_UNAVAILABLE, "desktop host provisioner is not configured"))
}

fn error_response(status: StatusCode, message: impl Into<String>) -> Response {
    (status, Json(json!({ "error": message.into() }))).into_response()
}

async fn list_hosts(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
) -> impl IntoResponse {
    let db = state.db.clone();
    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, provider, cloud_instance_id, region, instance_type,
                    tailscale_ip, incus_url, status,
                    total_memory_mb, used_memory_mb, created_at, updated_at, last_seen_at
             FROM desktop_hosts
             ORDER BY created_at DESC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(HostResponse {
                id: row.get(0)?,
                provider: row.get(1)?,
                cloud_instance_id: row.get(2)?,
                region: row.get(3)?,
                instance_type: row.get(4)?,
                tailscale_ip: row.get(5)?,
                incus_url: row.get(6)?,
                status: row.get(7)?,
                total_memory_mb: row.get(8)?,
                used_memory_mb: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                last_seen_at: row.get(12)?,
            })
        })?;
        let mut hosts = Vec::new();
        for row in rows {
            hosts.push(row?);
        }
        Ok::<_, rusqlite::Error>(hosts)
    })
    .await;

    match result {
        Ok(Ok(hosts)) => (StatusCode::OK, Json(json!({ "hosts": hosts }))).into_response(),
        Ok(Err(e)) => {
            warn!(error = %e, "failed to list desktop hosts");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, format!("database error: {e}"))
        }
        Err(e) => {
            warn!(error = %e, "task panicked listing desktop hosts");
            error_response(StatusCode::INTERNAL_SERVER_ERROR, "internal error")
        }
    }
}

async fn provision_host(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Json(req): Json<ProvisionRequest>,
) -> impl IntoResponse {
    let provisioner = match provisioner(&state) {
        Ok(p) => p.clone(),
        Err(resp) => return resp,
    };

    let preferred_provider = req.provider.and_then(|p| match p.as_str() {
        "hetzner" => Some(ProviderKind::Hetzner),
        "contabo" => Some(ProviderKind::Contabo),
        "local" => Some(ProviderKind::Local),
        _ => None,
    });

    match provisioner.provision(preferred_provider, req.region, req.plan).await {
        Ok(host) => (
            StatusCode::CREATED,
            Json(json!({
                "id": host.id,
                "provider": host.provider,
                "status": host.status.as_str(),
                "incus_url": host.incus_url,
            })),
        )
            .into_response(),
        Err(e) => {
            warn!(error = %e, "failed to provision desktop host");
            error_response(StatusCode::SERVICE_UNAVAILABLE, format!("provision failed: {e}"))
        }
    }
}

async fn drain_host(
    State(state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let provisioner = match provisioner(&state) {
        Ok(p) => p.clone(),
        Err(resp) => return resp,
    };

    match provisioner.drain(&id).await {
        Ok(()) => (StatusCode::OK, Json(json!({ "id": id, "status": "terminated" }))).into_response(),
        Err(e) => {
            warn!(host_id = %id, error = %e, "failed to drain desktop host");
            error_response(StatusCode::SERVICE_UNAVAILABLE, format!("drain failed: {e}"))
        }
    }
}

async fn register_host(
    State(state): State<Arc<AppState>>,
    Json(req): Json<RegisterRequest>,
) -> impl IntoResponse {
    let provisioner = match provisioner(&state) {
        Ok(p) => p.clone(),
        Err(resp) => return resp,
    };

    let expected = provisioner.registration_token().unwrap_or("");
    if expected.is_empty() || req.token != expected {
        return error_response(StatusCode::UNAUTHORIZED, "invalid registration token");
    }

    match provisioner
        .register_host(&req.host_id, req.incus_url, req.tailscale_ip, req.incus_ca_cert)
        .await
    {
        Ok(host) => (
            StatusCode::OK,
            Json(json!({
                "id": host.id,
                "status": host.status.as_str(),
                "incus_url": host.incus_url,
            })),
        )
            .into_response(),
        Err(e) => {
            warn!(host_id = %req.host_id, error = %e, "failed to register desktop host");
            error_response(StatusCode::SERVICE_UNAVAILABLE, format!("registration failed: {e}"))
        }
    }
}
