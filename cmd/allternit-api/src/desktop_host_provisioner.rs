//! Background provisioner and autoscaler for Desktop Cloud Incus hosts.

use crate::desktop_host_registry::{DesktopHostRecord, DesktopHostRegistry, DesktopHostStatus};
use crate::AppState;
use allternit_computer_cloud::{
    CloudProvider, CloudProviderError, CloudProviderRegistry, CreateServerRequest, IncusDriver,
    IncusSubstrate, ProviderKind,
};
use anyhow::{anyhow, Context};
use chrono::Utc;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing::{info, warn};

/// Background provisioner for cloud Incus hosts.
#[derive(Debug, Clone)]
pub struct DesktopHostProvisioner {
    registry: DesktopHostRegistry,
    providers: CloudProviderRegistry,
    incus_driver: Option<Arc<IncusDriver>>,
    registration_token: Option<String>,
    registration_url: Option<String>,
    scaling_lock: Arc<Mutex<()>>,
}

#[derive(Debug, thiserror::Error)]
pub enum ProvisionError {
    #[error("no Incus driver is configured")]
    NoIncusDriver,
    #[error("no cloud provider available")]
    NoProvider,
    #[error("cloud provider error: {0}")]
    Cloud(#[from] CloudProviderError),
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("other: {0}")]
    Other(String),
}

impl From<anyhow::Error> for ProvisionError {
    fn from(e: anyhow::Error) -> Self {
        ProvisionError::Other(e.to_string())
    }
}

impl DesktopHostProvisioner {
    pub fn new(
        registry: DesktopHostRegistry,
        providers: CloudProviderRegistry,
        incus_driver: Option<Arc<IncusDriver>>,
    ) -> Self {
        let registration_token = std::env::var("DESKTOP_HOST_REGISTRATION_TOKEN")
            .ok()
            .filter(|s| !s.is_empty());
        let registration_url = std::env::var("DESKTOP_HOST_REGISTRATION_URL")
            .ok()
            .filter(|s| !s.is_empty());

        Self {
            registry,
            providers,
            incus_driver,
            registration_token,
            registration_url,
            scaling_lock: Arc::new(Mutex::new(())),
        }
    }

    /// Reload active hosts from the database into the Incus driver.
    pub async fn sync_active_hosts(&self) -> Result<(), ProvisionError> {
        let Some(driver) = &self.incus_driver else {
            return Ok(());
        };

        let hosts = self.registry.list_active()?;
        for host in hosts {
            if let Err(e) = add_host_to_driver(driver, &host).await {
                warn!(host_id = %host.id, error = %e, "failed to add active host to driver");
            } else {
                info!(host_id = %host.id, url = %host.incus_url, "synced active host to driver");
            }
        }
        Ok(())
    }

    /// Provision a new host. For the local dev provider this immediately
    /// registers the existing Incus server; for real providers it creates a
    /// VPS and waits for the bootstrap script to register back.
    pub async fn provision(
        &self,
        preferred_provider: Option<ProviderKind>,
        region: Option<String>,
        plan: Option<String>,
    ) -> Result<DesktopHostRecord, ProvisionError> {
        let host_id = format!("host-{}", uuid::Uuid::new_v4().simple());
        let name = format!("allternit-{}", &host_id);

        // Build the user-data bootstrap payload for real cloud providers.
        let user_data = self.build_user_data(&host_id);

        let create_req = CreateServerRequest {
            name,
            region,
            plan,
            ssh_key_id: None,
            user_data,
        };

        // If a specific provider is requested, find it in the registry.
        let server = if let Some(kind) = preferred_provider {
            let provider = self
                .providers
                .providers()
                .iter()
                .find(|p| p.kind() == kind)
                .ok_or(ProvisionError::NoProvider)?
                .clone();
            provider.create_server(create_req).await?
        } else {
            self.providers.create_server(create_req).await?
        };

        let provider_name = provider_name_from_server(&server);
        let mut record = DesktopHostRecord {
            id: host_id.clone(),
            provider: provider_name,
            cloud_instance_id: Some(server.id.clone()),
            region: Some(server.region.clone()),
            instance_type: Some(server.plan.clone()),
            tailscale_ip: None,
            incus_url: format!("https://{}:8443", server.ipv4.as_deref().unwrap_or("unknown")),
            incus_ca_cert: None,
            status: DesktopHostStatus::Provisioning,
            total_memory_mb: 0,
            used_memory_mb: 0,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_seen_at: None,
            decommission_after: None,
        };

        // Local dev hosts are already running; skip bootstrap wait.
        if server.ipv4.is_some() && self.is_local_provider(&server) {
            record.status = DesktopHostStatus::Active;
            record.last_seen_at = Some(Utc::now());
            self.registry.insert(&record)?;
            if let Some(driver) = &self.incus_driver {
                add_host_to_driver(driver, &record).await?;
            }
            return Ok(record);
        }

        self.registry.insert(&record)?;

        // Wait for the bootstrap script to call the registration endpoint.
        let registered = self.wait_for_registration(&host_id).await;
        match registered {
            Ok(record) => {
                info!(host_id = %record.id, "cloud host registered and active");
                Ok(record)
            }
            Err(e) => {
                warn!(host_id = %host_id, error = %e, "host failed to register; marking terminated");
                let _ = self.registry.update_status(&host_id, DesktopHostStatus::Terminated);
                Err(e)
            }
        }
    }

    /// Mark a host as draining, remove it from the driver, and delete the
    /// backing cloud instance.
    pub async fn drain(&self, host_id: &str) -> Result<(), ProvisionError> {
        let host = self
            .registry
            .get(host_id)?
            .ok_or_else(|| ProvisionError::Other(format!("host not found: {host_id}")))?;

        self.registry
            .update_status(host_id, DesktopHostStatus::Draining)?;

        if let Some(driver) = &self.incus_driver {
            driver.remove_host(&host.incus_url);
        }

        // Delete from the cloud provider unless this is the local dev fallback.
        if host.provider != "local" {
            if let Some(cloud_instance_id) = &host.cloud_instance_id {
                if let Some(provider) = self.find_provider(&host.provider) {
                    if let Err(e) = provider.delete_server(cloud_instance_id).await {
                        warn!(host_id = %host_id, error = %e, "failed to delete cloud instance");
                    }
                }
            }
        }

        self.registry
            .update_status(host_id, DesktopHostStatus::Terminated)?;
        info!(host_id = %host_id, "host drained and terminated");
        Ok(())
    }

    /// Update a host record from a registration payload and add it to the
    /// live Incus pool.
    pub async fn register_host(
        &self,
        host_id: &str,
        incus_url: String,
        tailscale_ip: Option<String>,
        ca_cert: Option<String>,
    ) -> Result<DesktopHostRecord, ProvisionError> {
        let mut host = self
            .registry
            .get(host_id)?
            .ok_or_else(|| ProvisionError::Other(format!("host not found: {host_id}")))?;

        host.incus_url = incus_url;
        host.tailscale_ip = tailscale_ip;
        host.incus_ca_cert = ca_cert;
        host.status = DesktopHostStatus::Active;
        host.last_seen_at = Some(Utc::now());
        host.updated_at = Utc::now();

        // Persist the registration details.
        {
            let conn = self.registry.db().connect()?;
            conn.execute(
                "UPDATE desktop_hosts
                 SET incus_url = ?1, tailscale_ip = ?2, incus_ca_cert = ?3,
                     status = 'active', last_seen_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?4",
                rusqlite::params![
                    host.incus_url,
                    host.tailscale_ip,
                    host.incus_ca_cert,
                    host.id,
                ],
            )?;
        }

        if let Some(driver) = &self.incus_driver {
            add_host_to_driver(driver, &host).await?;
        }

        Ok(host)
    }

    pub fn registration_token(&self) -> Option<&str> {
        self.registration_token.as_deref()
    }

    fn is_local_provider(&self, server: &allternit_computer_cloud::ServerInfo) -> bool {
        server.region == "local" && server.plan == "local"
    }

    fn find_provider(&self, provider: &str) -> Option<Arc<dyn CloudProvider>> {
        self.providers
            .providers()
            .iter()
            .find(|p| provider_name(p.kind()) == provider)
            .cloned()
    }

    fn build_user_data(&self, host_id: &str) -> Option<String> {
        let registration_url = self.registration_url.as_deref()?;
        let token = self.registration_token.as_deref()?;
        let headscale_url = std::env::var("HEADSCALE_CONTROL_PLANE_URL").ok()?;
        let headscale_key = std::env::var("HEADSCALE_PREAUTH_KEY").ok()?;
        let api_client_cert_b64 = std::env::var("INCUS_CLIENT_CERT")
            .ok()
            .filter(|s| !s.is_empty())
            .and_then(|path| std::fs::read_to_string(path).ok())
            .map(|pem| base64::Engine::encode(&base64::engine::general_purpose::STANDARD, pem));

        let script = include_str!("../../../infrastructure/vps-desktop-cloud/bootstrap-host.sh");

        Some(format!(
            "#cloud-config\nwrite_files:\n  - path: /root/allternit-bootstrap.sh\n    permissions: '0700'\n    content: |\n{}\nruncmd:\n  - |\n      set -euo pipefail\n      export HEADSCALE_CONTROL_PLANE_URL={} HEADSCALE_PREAUTH_KEY={} BOOTSTRAP_REGISTRATION_URL={} REGISTRATION_TOKEN={} HOST_ID={} API_INCUS_CLIENT_CERT_B64={}\n      bash /root/allternit-bootstrap.sh\n",
            indent_lines(script),
            shell_quote(&headscale_url),
            shell_quote(&headscale_key),
            shell_quote(&registration_url),
            shell_quote(&token),
            shell_quote(host_id),
            shell_quote(&api_client_cert_b64.unwrap_or_default())
        ))
    }

    async fn wait_for_registration(
        &self,
        host_id: &str,
    ) -> Result<DesktopHostRecord, ProvisionError> {
        for attempt in 0..180 {
            tokio::time::sleep(Duration::from_secs(10)).await;
            if let Some(host) = self.registry.get(host_id)? {
                if host.status == DesktopHostStatus::Active {
                    return Ok(host);
                }
                if host.status == DesktopHostStatus::Terminated {
                    return Err(ProvisionError::Other(
                        "host was marked terminated during provisioning".to_string(),
                    ));
                }
            }
            if attempt % 12 == 0 {
                info!(host_id = %host_id, minutes = attempt / 6, "waiting for host registration");
            }
        }
        Err(ProvisionError::Other(
            "host did not register in time".to_string(),
        ))
    }
}

/// Spawn the provisioner background loops.
pub fn spawn_provisioner(state: Arc<AppState>, period: Duration) {
    let Some(provisioner) = state.desktop_host_provisioner.clone() else {
        warn!("no desktop host provisioner configured; autoscaling disabled");
        return;
    };

    tokio::spawn(async move {
        if let Err(e) = provisioner.sync_active_hosts().await {
            warn!(error = %e, "failed to sync active desktop hosts at startup");
        }

        let mut ticker = tokio::time::interval(period);
        loop {
            ticker.tick().await;
            if let Err(e) = run_provisioner_cycle(&provisioner).await {
                warn!(error = %e, "desktop host provisioner cycle failed");
            }
        }
    });
}

async fn run_provisioner_cycle(
    provisioner: &DesktopHostProvisioner,
) -> Result<(), ProvisionError> {
    // Autoscale up.
    if should_scale_up().await {
        let _guard = provisioner.scaling_lock.lock().await;
        // Re-check after acquiring the lock.
        if should_scale_up().await {
            info!("autoscale: capacity threshold exceeded, provisioning new desktop host");
            provisioner.provision(None, None, None).await?;
        }
    }

    // Decommission idle hosts.
    let idle = provisioner
        .registry
        .find_idle_hosts(chrono::Duration::minutes(30))?;
    for host in idle {
        info!(host_id = %host.id, "decommissioning idle desktop host");
        provisioner.drain(&host.id).await?;
    }

    Ok(())
}

async fn should_scale_up() -> bool {
    if let Some(monitor) = crate::bot_desktop_capacity::CAPACITY_MONITOR.get() {
        monitor.status().await.scale_up_recommended
    } else {
        false
    }
}

async fn add_host_to_driver(
    driver: &Arc<IncusDriver>,
    host: &DesktopHostRecord,
) -> Result<(), anyhow::Error> {
    let substrate: Arc<IncusSubstrate> = if let Some(ca) = &host.incus_ca_cert {
        Arc::new(IncusSubstrate::new_with_ca(&host.incus_url, ca.as_bytes())?)
    } else {
        Arc::new(IncusSubstrate::new(&host.incus_url)?)
    };
    driver.add_host(&host.incus_url, substrate);
    driver.set_host_capacity(
        &host.incus_url,
        host.total_memory_mb as u64,
        host.used_memory_mb as u64,
    );
    Ok(())
}

fn provider_name(kind: ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Hetzner => "hetzner",
        ProviderKind::Contabo => "contabo",
        ProviderKind::Local => "local",
    }
}

fn provider_name_from_server(server: &allternit_computer_cloud::ServerInfo) -> String {
    if server.region == "local" && server.plan == "local" {
        "local".to_string()
    } else {
        "cloud".to_string()
    }
}

fn shell_quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', "'\"'\"'"))
}

fn indent_lines(s: &str) -> String {
    s.lines()
        .map(|line| format!("      {}", line))
        .collect::<Vec<_>>()
        .join("\n")
}
