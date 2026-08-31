//! Pluggable cloud-provider clients for provisioning VPS Incus hosts.
//!
//! The trait lives here so `allternit-computer-cloud` can be reused by the API
//! provisioner without adding a database dependency to this crate.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::Arc;
use thiserror::Error;
use tracing::{info, warn};

pub mod contabo;
pub mod hetzner;
pub mod local_host;

/// Supported cloud providers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderKind {
    Hetzner,
    Contabo,
    Local,
}

impl fmt::Display for ProviderKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProviderKind::Hetzner => write!(f, "hetzner"),
            ProviderKind::Contabo => write!(f, "contabo"),
            ProviderKind::Local => write!(f, "local"),
        }
    }
}

/// Request to create a new VPS that will become an Incus host.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CreateServerRequest {
    pub name: String,
    pub region: Option<String>,
    pub plan: Option<String>,
    pub ssh_key_id: Option<String>,
    pub user_data: Option<String>,
}

/// Information about a VPS returned by a cloud provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerInfo {
    pub id: String,
    pub name: String,
    pub status: ServerStatus,
    pub ipv4: Option<String>,
    pub region: String,
    pub plan: String,
}

/// Lifecycle status of a VPS.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ServerStatus {
    Provisioning,
    Running,
    Stopped,
    Terminated,
    Error,
    Unknown,
}

#[derive(Debug, Error)]
pub enum CloudProviderError {
    #[error("request failed: {0}")]
    Request(String),
    #[error("api error {status}: {message}")]
    Api { status: u16, message: String },
    #[error("server not found: {0}")]
    NotFound(String),
    #[error("missing credentials for provider {0}")]
    MissingCredentials(String),
    #[error("no provider available")]
    NoProvider,
}

impl CloudProviderError {
    pub fn from_api_status(status: u16, body: String) -> Self {
        if status == 404 {
            Self::NotFound(body)
        } else {
            Self::Api { status, message: body }
        }
    }
}

#[async_trait]
pub trait CloudProvider: Send + Sync + fmt::Debug {
    fn kind(&self) -> ProviderKind;

    async fn create_server(
        &self,
        req: CreateServerRequest,
    ) -> Result<ServerInfo, CloudProviderError>;

    async fn delete_server(&self, id: &str) -> Result<(), CloudProviderError>;

    async fn get_server(&self, id: &str) -> Result<Option<ServerInfo>, CloudProviderError>;

    async fn list_servers(&self) -> Result<Vec<ServerInfo>, CloudProviderError>;
}

/// A prioritized collection of enabled cloud providers.
#[derive(Clone, Debug)]
pub struct CloudProviderRegistry {
    providers: Vec<Arc<dyn CloudProvider>>,
}

impl CloudProviderRegistry {
    /// Build a registry from environment variables.
    ///
    /// Hetzner and Contabo are registered when their credentials are present.
    /// If neither is configured, the local dev fallback is used so the rest of
    /// the system can be exercised without spending money.
    pub fn from_env() -> Result<Self, CloudProviderError> {
        let mut providers: Vec<Arc<dyn CloudProvider>> = Vec::new();

        match hetzner::HetznerClient::from_env() {
            Ok(client) => {
                info!("registered Hetzner cloud provider");
                providers.push(Arc::new(client));
            }
            Err(e) => {
                warn!(error = %e, "Hetzner not configured");
            }
        }

        match contabo::ContaboClient::from_env() {
            Ok(client) => {
                info!("registered Contabo cloud provider");
                providers.push(Arc::new(client));
            }
            Err(e) => {
                warn!(error = %e, "Contabo not configured");
            }
        }

        if providers.is_empty() {
            info!("no cloud credentials found; using local dev fallback");
            providers.push(Arc::new(local_host::LocalHostProvider::from_env()?));
        }

        Ok(Self { providers })
    }

    pub fn empty() -> Self {
        Self {
            providers: Vec::new(),
        }
    }

    pub fn register(&mut self, provider: Arc<dyn CloudProvider>) {
        self.providers.push(provider);
    }

    pub fn providers(&self) -> &[Arc<dyn CloudProvider>] {
        &self.providers
    }

    /// Create a server using the first provider that succeeds.
    ///
    /// If the caller does not supply a region/plan, each provider fills in its
    /// own defaults from environment variables.
    pub async fn create_server(
        &self,
        req: CreateServerRequest,
    ) -> Result<ServerInfo, CloudProviderError> {
        if self.providers.is_empty() {
            return Err(CloudProviderError::NoProvider);
        }

        let mut last_err = None;
        for provider in &self.providers {
            match provider.create_server(req.clone()).await {
                Ok(info) => return Ok(info),
                Err(e) => {
                    warn!(provider = ?provider.kind(), error = %e, "provider create_server failed, trying next");
                    last_err = Some(e);
                }
            }
        }

        Err(last_err.unwrap_or(CloudProviderError::NoProvider))
    }

    /// Delete a server by id across all registered providers.
    pub async fn delete_server(&self, id: &str) -> Result<(), CloudProviderError> {
        for provider in self.providers() {
            match provider.get_server(id).await {
                Ok(Some(_)) => {
                    return provider.delete_server(id).await;
                }
                Ok(None) => continue,
                Err(e) => {
                    warn!(provider = ?provider.kind(), error = %e, "get_server during delete failed");
                    continue;
                }
            }
        }
        Err(CloudProviderError::NotFound(id.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_kind_display() {
        assert_eq!(ProviderKind::Hetzner.to_string(), "hetzner");
        assert_eq!(ProviderKind::Contabo.to_string(), "contabo");
        assert_eq!(ProviderKind::Local.to_string(), "local");
    }

    #[test]
    fn empty_registry_returns_no_provider() {
        let registry = CloudProviderRegistry::empty();
        let req = CreateServerRequest {
            name: "test".to_string(),
            ..Default::default()
        };
        let rt = tokio::runtime::Runtime::new().unwrap();
        let err = rt.block_on(registry.create_server(req)).unwrap_err();
        assert!(matches!(err, CloudProviderError::NoProvider));
    }

    #[test]
    fn registry_falls_back_to_next_provider() {
        let mut registry = CloudProviderRegistry::empty();
        registry.register(Arc::new(local_host::LocalHostProvider::from_url(
            "https://127.0.0.1:8443",
        )));
        let req = CreateServerRequest {
            name: "test".to_string(),
            ..Default::default()
        };
        let rt = tokio::runtime::Runtime::new().unwrap();
        let info = rt.block_on(registry.create_server(req)).unwrap();
        assert_eq!(info.id, "local");
        assert_eq!(info.status, ServerStatus::Running);
    }

    #[test]
    fn local_host_extracts_host_from_url() {
        let provider = local_host::LocalHostProvider::from_url("https://100.64.0.5:8443");
        let rt = tokio::runtime::Runtime::new().unwrap();
        let info = rt.block_on(provider.get_server("local")).unwrap().unwrap();
        assert_eq!(info.ipv4, Some("100.64.0.5".to_string()));
    }
}
