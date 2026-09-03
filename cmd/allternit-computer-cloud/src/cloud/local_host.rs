//! Local dev fallback "cloud provider".
//!
//! When no real cloud credentials are configured, this provider registers the
//! existing Incus server from `INCUS_URL` as a single fleet host so the rest of
//! the Desktop Cloud control plane can be developed and tested without spending
//! money.

use super::{CloudProvider, CloudProviderError, CreateServerRequest, ProviderKind, ServerInfo, ServerStatus};
use async_trait::async_trait;

const LOCAL_ID: &str = "local";

#[derive(Debug, Clone)]
pub struct LocalHostProvider {
    incus_url: String,
}

impl LocalHostProvider {
    pub fn from_env() -> Result<Self, CloudProviderError> {
        let incus_url = std::env::var("INCUS_URL")
            .ok()
            .filter(|s| !s.is_empty())
            .ok_or_else(|| {
                CloudProviderError::MissingCredentials(
                    "INCUS_URL (no cloud credentials configured)".to_string(),
                )
            })?;
        Ok(Self { incus_url })
    }

    pub fn from_url(url: impl Into<String>) -> Self {
        Self {
            incus_url: url.into(),
        }
    }

    fn host_from_url(url: &str) -> String {
        url.trim()
            .strip_prefix("https://")
            .or_else(|| url.strip_prefix("http://"))
            .unwrap_or(url)
            .split('/')
            .next()
            .unwrap_or(url)
            .split(':')
            .next()
            .unwrap_or(url)
            .to_string()
    }

    fn server_info(&self) -> ServerInfo {
        ServerInfo {
            id: LOCAL_ID.to_string(),
            name: "local-dev".to_string(),
            status: ServerStatus::Running,
            ipv4: Some(Self::host_from_url(&self.incus_url)),
            region: "local".to_string(),
            plan: "local".to_string(),
        }
    }
}

#[async_trait]
impl CloudProvider for LocalHostProvider {
    fn kind(&self) -> ProviderKind {
        ProviderKind::Local
    }

    async fn create_server(
        &self,
        _req: CreateServerRequest,
    ) -> Result<ServerInfo, CloudProviderError> {
        Ok(self.server_info())
    }

    async fn delete_server(&self, _id: &str) -> Result<(), CloudProviderError> {
        // Local dev hosts are never decommissioned through the provider.
        Ok(())
    }

    async fn get_server(&self, id: &str) -> Result<Option<ServerInfo>, CloudProviderError> {
        if id == LOCAL_ID {
            Ok(Some(self.server_info()))
        } else {
            Ok(None)
        }
    }

    async fn list_servers(&self) -> Result<Vec<ServerInfo>, CloudProviderError> {
        Ok(vec![self.server_info()])
    }
}
