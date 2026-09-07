//! Provider Driver Interface
//!
//! Abstracts provider-specific operations:
//! - Server creation
//! - SSH key injection
//! - Wait for ready (SSH-ready, not just "running")
//! - Server destruction
//!
//! IMPLEMENTATION STATUS:
//! - HetznerDriver: REAL API calls
//! - DigitalOceanDriver: REAL API calls
//! - AwsDriver: REAL API calls (see `aws.rs` — hand-rolled SigV4, EC2 Query API)

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::timeout;
use tokio::net::TcpStream;

/// Provider driver trait
#[async_trait]
pub trait ProviderDriver: Send + Sync {
    /// Get provider name
    fn name(&self) -> &str;

    /// Get provider capabilities
    fn capabilities(&self) -> ProviderCapabilities;

    /// Create server instance
    async fn create_server(&self, request: &CreateServerRequest) -> Result<CreateServerResult, ProviderError>;

    /// Inject SSH key (returns key ID for future use)
    async fn inject_ssh_key(&self, server_id: &str, public_key: &str) -> Result<String, ProviderError>;

    /// Wait for server to be SSH-ready
    async fn wait_for_ready(&self, server_id: &str, timeout: Duration) -> Result<ServerStatus, ProviderError>;

    /// Get server status
    async fn get_server_status(&self, server_id: &str) -> Result<ServerStatus, ProviderError>;

    /// Destroy server
    async fn destroy_server(&self, server_id: &str) -> Result<(), ProviderError>;

    /// Reboot server (default: unsupported by this driver)
    async fn reboot_server(&self, server_id: &str) -> Result<(), ProviderError> {
        let _ = server_id;
        Err(ProviderError {
            code: "UNSUPPORTED".to_string(),
            message: format!("{} driver does not support reboot", self.name()),
            retryable: false,
        })
    }

    /// Get the server's public IPv4 address (default: unknown)
    async fn get_server_ip(&self, _server_id: &str) -> Result<Option<String>, ProviderError> {
        Ok(None)
    }
}

/// Build the driver for an API-mode provider. `None` for providers without
/// an automated driver — those go through the universal SSH path instead.
/// AWS takes its JSON credential string (`{"access_key_id",...}`); when it
/// doesn't parse, `None` routes the session to SSH mode.
pub fn driver_for(
    provider: crate::capability::SupportedProvider,
    api_token: String,
) -> Option<Box<dyn ProviderDriver>> {
    match provider {
        crate::capability::SupportedProvider::Hetzner => {
            Some(Box::new(HetznerDriver::new(api_token)))
        }
        crate::capability::SupportedProvider::DigitalOcean => {
            Some(Box::new(DigitalOceanDriver::new(api_token)))
        }
        crate::capability::SupportedProvider::Aws => crate::aws::AwsCredentials::from_token(
            &api_token,
        )
        .ok()
        .map(|creds| Box::new(crate::aws::AwsDriver::new(creds)) as Box<dyn ProviderDriver>),
        _ => None,
    }
}

/// Provider capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    /// Supports API provisioning
    pub supports_api: bool,
    /// Supports SSH key injection
    pub supports_ssh_key_injection: bool,
    /// Supports automatic firewall configuration
    pub supports_firewall_config: bool,
    /// Supported regions
    pub regions: Vec<String>,
    /// Supported instance types
    pub instance_types: Vec<String>,
    /// Supported OS images
    pub os_images: Vec<String>,
}

/// Create server request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateServerRequest {
    /// Server name
    pub name: String,
    /// Region
    pub region: String,
    /// Instance type
    pub instance_type: String,
    /// OS image
    pub image: String,
    /// SSH public keys
    pub ssh_keys: Vec<String>,
    /// Storage size (GB)
    pub storage_gb: u32,
    /// API token (provider-specific)
    pub api_token: String,
    /// Owning user id (for provider-side ownership tags/labels, e.g. AWS
    /// `allternit:user`). Absent for providers that don't tag.
    #[serde(default)]
    pub owner_id: Option<String>,
}

/// Create server result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateServerResult {
    /// Server ID
    pub server_id: String,
    /// Server IP (assigned when ready)
    pub ip_address: Option<String>,
    /// Initial status
    pub status: ServerStatus,
}

/// Server status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ServerStatus {
    /// Server is being created
    Provisioning,
    /// Server is starting
    Starting,
    /// Server is running AND SSH-ready
    Running,
    /// Server is stopping
    Stopping,
    /// Server is stopped
    Stopped,
    /// Server has error
    Error,
    /// Server unknown
    Unknown,
}

impl ServerStatus {
    /// Check if server is ready (running + SSH accessible)
    pub fn is_ready(&self) -> bool {
        matches!(self, Self::Running)
    }

    /// Check if server is terminal
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Running | Self::Stopped | Self::Error)
    }
}

/// Provider error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderError {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}

impl std::fmt::Display for ProviderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for ProviderError {}

// ============================================================================
// Hetzner Driver - REAL API IMPLEMENTATION
// ============================================================================

/// Hetzner Cloud API driver
pub struct HetznerDriver {
    api_token: String,
    client: reqwest::Client,
}

impl HetznerDriver {
    /// Create new Hetzner driver
    pub fn new(api_token: String) -> Self {
        Self {
            api_token,
            client: reqwest::Client::new(),
        }
    }

    /// Get server details from Hetzner API
    async fn get_server(&self, server_id: &str) -> Result<HetznerServer, ProviderError> {
        let url = format!("https://api.hetzner.cloud/v1/servers/{}", server_id);
        
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Failed to get server: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Server {} returned {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        let result: HetznerServerResponse = response.json().await.map_err(|e| ProviderError {
            code: "HETZNER_PARSE_ERROR".to_string(),
            message: format!("Failed to parse response: {}", e),
            retryable: false,
        })?;

        Ok(result.server)
    }

    /// Wait for TCP port to be accessible
    async fn wait_for_tcp(&self, host: &str, port: u16, timeout_dur: Duration) -> Result<(), ProviderError> {
        timeout(timeout_dur, async {
            loop {
                match TcpStream::connect(format!("{}:{}", host, port)).await {
                    Ok(_) => return Ok(()),
                    Err(_) => tokio::time::sleep(Duration::from_secs(2)).await,
                }
            }
        })
        .await
        .map_err(|_| ProviderError {
            code: "TIMEOUT".to_string(),
            message: format!("TCP {}:{} not reachable within timeout", host, port),
            retryable: true,
        })?
    }
}

#[async_trait]
impl ProviderDriver for HetznerDriver {
    fn name(&self) -> &str {
        "hetzner"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_api: true,
            supports_ssh_key_injection: true,
            supports_firewall_config: true,
            regions: vec!["fsn1".to_string(), "nbg1".to_string(), "hel1".to_string()],
            instance_types: vec!["cx11".to_string(), "cx21".to_string(), "cx31".to_string()],
            os_images: vec!["ubuntu-22.04".to_string(), "ubuntu-24.04".to_string(), "debian-12".to_string()],
        }
    }

    async fn create_server(&self, request: &CreateServerRequest) -> Result<CreateServerResult, ProviderError> {
        tracing::info!("Creating Hetzner server: {} in {}", request.name, request.region);

        // First, create or find SSH key
        let mut ssh_key_ids = Vec::new();
        for key in &request.ssh_keys {
            let key_id = self.inject_ssh_key("", key).await?;
            ssh_key_ids.push(key_id);
        }

        // Create server
        let url = "https://api.hetzner.cloud/v1/servers";
        
        let body = serde_json::json!({
            "name": request.name,
            "server_type": request.instance_type,
            "image": request.image,
            "location": request.region,
            "ssh_keys": ssh_key_ids,
            "start_after_create": true,
        });

        let response = self.client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Failed to create server: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            // Hetzner has no quota-list endpoint; the create call itself
            // reports "resource_limit_exceeded" — surface it as QUOTA_EXCEEDED.
            if body.contains("resource_limit_exceeded") {
                return Err(ProviderError {
                    code: crate::failure_policy::error_codes::QUOTA_EXCEEDED.to_string(),
                    message: format!("Hetzner resource limit reached: {}", body),
                    retryable: false,
                });
            }
            return Err(ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Server creation failed {}: {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        let result: HetznerCreateResponse = response.json().await.map_err(|e| ProviderError {
            code: "HETZNER_PARSE_ERROR".to_string(),
            message: format!("Failed to parse response: {}", e),
            retryable: false,
        })?;

        Ok(CreateServerResult {
            server_id: result.server.id.to_string(),
            ip_address: None,  // Will be populated after wait_for_ready
            status: ServerStatus::Provisioning,
        })
    }

    async fn inject_ssh_key(&self, _server_id: &str, public_key: &str) -> Result<String, ProviderError> {
        // Try to find existing key by fingerprint
        let fingerprint = self.get_key_fingerprint(public_key)?;
        
        let url = "https://api.hetzner.cloud/v1/ssh_keys";
        let response = self.client
            .get(url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Failed to list SSH keys: {}", e),
                retryable: true,
            })?;

        if response.status().is_success() {
            let result: HetznerSshKeysResponse = response.json().await.map_err(|e| ProviderError {
                code: "HETZNER_PARSE_ERROR".to_string(),
                message: format!("Failed to parse SSH keys response: {}", e),
                retryable: false,
            })?;

            // Check if key already exists
            for key in &result.ssh_keys {
                if key.fingerprint == fingerprint {
                    tracing::info!("SSH key already exists: {}", key.id);
                    return Ok(key.id.to_string());
                }
            }
        }

        // Create new SSH key
        let body = serde_json::json!({
            "name": format!("allternit-key-{}", uuid::Uuid::new_v4()),
            "public_key": public_key,
        });

        let response = self.client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Failed to create SSH key: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("SSH key creation failed {}: {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        let result: HetznerSshKeyResponse = response.json().await.map_err(|e| ProviderError {
            code: "HETZNER_PARSE_ERROR".to_string(),
            message: format!("Failed to parse SSH key response: {}", e),
            retryable: false,
        })?;

        Ok(result.ssh_key.id.to_string())
    }

    async fn wait_for_ready(&self, server_id: &str, timeout_dur: Duration) -> Result<ServerStatus, ProviderError> {
        tracing::info!("Waiting for Hetzner server {} to be SSH-ready", server_id);

        // Poll until server is running AND SSH is accessible
        let start = std::time::Instant::now();
        
        loop {
            if start.elapsed() > timeout_dur {
                return Err(ProviderError {
                    code: "TIMEOUT".to_string(),
                    message: "Server did not become ready within timeout".to_string(),
                    retryable: true,
                });
            }

            match self.get_server(server_id).await {
                Ok(server) => {
                    if server.status == "running" {
                        // Check if we have an IP
                        if let Some(ip) = &server.public_net.ipv4.ip {
                            // Try SSH connection
                            match self.wait_for_tcp(ip, 22, Duration::from_secs(5)).await {
                                Ok(_) => {
                                    tracing::info!("Server {} is SSH-ready at {}", server_id, ip);
                                    return Ok(ServerStatus::Running);
                                }
                                Err(_) => {
                                    tracing::debug!("Server {} running but SSH not ready yet", server_id);
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to get server status: {}", e);
                }
            }

            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    }

    async fn get_server_status(&self, server_id: &str) -> Result<ServerStatus, ProviderError> {
        match self.get_server(server_id).await {
            Ok(server) => {
                let status = match server.status.as_str() {
                    "running" => ServerStatus::Running,
                    "starting" => ServerStatus::Starting,
                    "stopping" => ServerStatus::Stopping,
                    "off" => ServerStatus::Stopped,
                    _ => ServerStatus::Unknown,
                };
                Ok(status)
            }
            Err(e) => {
                if e.code == "HETZNER_API_ERROR" && e.message.contains("404") {
                    Err(ProviderError {
                        code: "NOT_FOUND".to_string(),
                        message: format!("Server {} not found", server_id),
                        retryable: false,
                    })
                } else {
                    Err(e)
                }
            }
        }
    }

    async fn destroy_server(&self, server_id: &str) -> Result<(), ProviderError> {
        tracing::info!("Destroying Hetzner server {}", server_id);

        let url = format!("https://api.hetzner.cloud/v1/servers/{}", server_id);
        
        let response = self.client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Failed to delete server: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Server deletion failed {}: {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        tracing::info!("Server {} destroyed", server_id);
        Ok(())
    }

    async fn reboot_server(&self, server_id: &str) -> Result<(), ProviderError> {
        tracing::info!("Rebooting Hetzner server {}", server_id);

        let url = format!(
            "https://api.hetzner.cloud/v1/servers/{}/actions/reboot",
            server_id
        );

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Failed to reboot server: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError {
                code: "HETZNER_API_ERROR".to_string(),
                message: format!("Server reboot failed {}: {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        Ok(())
    }

    async fn get_server_ip(&self, server_id: &str) -> Result<Option<String>, ProviderError> {
        Ok(self.get_server(server_id).await?.public_net.ipv4.ip)
    }
}

impl HetznerDriver {
    /// Get SSH key fingerprint from public key
    fn get_key_fingerprint(&self, public_key: &str) -> Result<String, ProviderError> {
        // Simple fingerprint extraction - in production, use proper SSH key parsing
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        public_key.hash(&mut hasher);
        let hash = hasher.finish();
        Ok(format!("{:016x}", hash))
    }
}

// ============================================================================
// DigitalOcean Driver - REAL API IMPLEMENTATION
// ============================================================================

/// DigitalOcean API driver
pub struct DigitalOceanDriver {
    api_token: String,
    client: reqwest::Client,
}

impl DigitalOceanDriver {
    /// Create new DigitalOcean driver
    pub fn new(api_token: String) -> Self {
        Self {
            api_token,
            client: reqwest::Client::new(),
        }
    }

    /// Get droplet details from DO API
    async fn get_droplet(&self, droplet_id: &str) -> Result<DigitalOceanDroplet, ProviderError> {
        let url = format!("https://api.digitalocean.com/v2/droplets/{}", droplet_id);
        
        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Failed to get droplet: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Droplet {} returned {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        let result: DigitalOceanDropletResponse = response.json().await.map_err(|e| ProviderError {
            code: "DO_PARSE_ERROR".to_string(),
            message: format!("Failed to parse response: {}", e),
            retryable: false,
        })?;

        Ok(result.droplet)
    }

    /// Pre-create quota check: droplet count vs the account's droplet limit.
    /// At/over the limit this fails with QUOTA_EXCEEDED naming the limit;
    /// if the check itself can't complete, it only logs and lets the create
    /// attempt proceed (the API's own 4xx remains the backstop).
    async fn check_quota(&self) -> Result<(), ProviderError> {
        let account = self.client
            .get("https://api.digitalocean.com/v2/account")
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await;
        let droplets = self.client
            .get("https://api.digitalocean.com/v2/droplets?per_page=200")
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await;

        let (account, droplets) = match (account, droplets) {
            (Ok(a), Ok(d)) if a.status().is_success() && d.status().is_success() => (a, d),
            _ => {
                tracing::warn!("Could not pre-check DigitalOcean droplet quota; proceeding");
                return Ok(());
            }
        };

        let limit = account
            .json::<DigitalOceanAccountResponse>()
            .await
            .map(|r| r.account.droplet_limit);
        let total = droplets
            .json::<DigitalOceanDropletsResponse>()
            .await
            .map(|r| r.meta.total);

        if let (Ok(limit), Ok(total)) = (limit, total) {
            if total >= limit {
                return Err(ProviderError {
                    code: crate::failure_policy::error_codes::QUOTA_EXCEEDED.to_string(),
                    message: format!(
                        "DigitalOcean droplet limit reached: {}/{} droplets in use - destroy one or request a limit increase",
                        total, limit
                    ),
                    retryable: false,
                });
            }
        }
        Ok(())
    }

    /// Wait for TCP port to be accessible
    async fn wait_for_tcp(&self, host: &str, port: u16, timeout_dur: Duration) -> Result<(), ProviderError> {
        timeout(timeout_dur, async {
            loop {
                match TcpStream::connect(format!("{}:{}", host, port)).await {
                    Ok(_) => return Ok(()),
                    Err(_) => tokio::time::sleep(Duration::from_secs(2)).await,
                }
            }
        })
        .await
        .map_err(|_| ProviderError {
            code: "TIMEOUT".to_string(),
            message: format!("TCP {}:{} not reachable within timeout", host, port),
            retryable: true,
        })?
    }
}

#[async_trait]
impl ProviderDriver for DigitalOceanDriver {
    fn name(&self) -> &str {
        "digitalocean"
    }

    fn capabilities(&self) -> ProviderCapabilities {
        ProviderCapabilities {
            supports_api: true,
            supports_ssh_key_injection: true,
            supports_firewall_config: true,
            regions: vec!["nyc3".to_string(), "sfo3".to_string(), "ams3".to_string()],
            instance_types: vec!["s-1vcpu-1gb".to_string(), "s-1vcpu-2gb".to_string()],
            os_images: vec!["ubuntu-22-04-x64".to_string(), "debian-12-x64".to_string()],
        }
    }

    async fn create_server(&self, request: &CreateServerRequest) -> Result<CreateServerResult, ProviderError> {
        tracing::info!("Creating DigitalOcean droplet: {} in {}", request.name, request.region);

        // Quota precheck: fail with a clear limit-named error before burning
        // a create call that would 4xx anyway.
        self.check_quota().await?;

        // First, create or find SSH key
        let mut ssh_key_ids = Vec::new();
        for key in &request.ssh_keys {
            let key_id = self.inject_ssh_key("", key).await?;
            ssh_key_ids.push(key_id.parse::<i64>().unwrap_or(0));
        }

        // Create droplet
        let url = "https://api.digitalocean.com/v2/droplets";
        
        let body = serde_json::json!({
            "name": request.name,
            "region": request.region,
            "size": request.instance_type,
            "image": request.image,
            "ssh_keys": ssh_key_ids,
        });

        let response = self.client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Failed to create droplet: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Droplet creation failed {}: {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        let result: DigitalOceanCreateResponse = response.json().await.map_err(|e| ProviderError {
            code: "DO_PARSE_ERROR".to_string(),
            message: format!("Failed to parse response: {}", e),
            retryable: false,
        })?;

        Ok(CreateServerResult {
            server_id: result.droplet.id.to_string(),
            ip_address: None,
            status: ServerStatus::Provisioning,
        })
    }

    async fn inject_ssh_key(&self, _server_id: &str, public_key: &str) -> Result<String, ProviderError> {
        // List existing keys
        let url = "https://api.digitalocean.com/v2/account/keys";
        let response = self.client
            .get(url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Failed to list SSH keys: {}", e),
                retryable: true,
            })?;

        if response.status().is_success() {
            let result: DigitalOceanSshKeysResponse = response.json().await.map_err(|e| ProviderError {
                code: "DO_PARSE_ERROR".to_string(),
                message: format!("Failed to parse SSH keys response: {}", e),
                retryable: false,
            })?;

            // Check if key already exists (by public key match)
            for key in &result.ssh_keys {
                if key.public_key.trim() == public_key.trim() {
                    tracing::info!("SSH key already exists: {}", key.id);
                    return Ok(key.id.to_string());
                }
            }
        }

        // Create new SSH key
        let body = serde_json::json!({
            "name": format!("allternit-key-{}", uuid::Uuid::new_v4()),
            "public_key": public_key,
        });

        let response = self.client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Failed to create SSH key: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("SSH key creation failed {}: {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        let result: DigitalOceanSshKeyResponse = response.json().await.map_err(|e| ProviderError {
            code: "DO_PARSE_ERROR".to_string(),
            message: format!("Failed to parse SSH key response: {}", e),
            retryable: false,
        })?;

        Ok(result.ssh_key.id.to_string())
    }

    async fn wait_for_ready(&self, droplet_id: &str, timeout_dur: Duration) -> Result<ServerStatus, ProviderError> {
        tracing::info!("Waiting for DigitalOcean droplet {} to be SSH-ready", droplet_id);

        let start = std::time::Instant::now();
        
        loop {
            if start.elapsed() > timeout_dur {
                return Err(ProviderError {
                    code: "TIMEOUT".to_string(),
                    message: "Droplet did not become ready within timeout".to_string(),
                    retryable: true,
                });
            }

            match self.get_droplet(droplet_id).await {
                Ok(droplet) => {
                    if droplet.status == "active" {
                        // Check if we have an IP
                        if let Some(networks) = &droplet.networks {
                            if let Some(v4) = networks.v4.iter().find(|n| n.r#type == "public") {
                                // Try SSH connection
                                match self.wait_for_tcp(&v4.ip_address, 22, Duration::from_secs(5)).await {
                                    Ok(_) => {
                                        tracing::info!("Droplet {} is SSH-ready at {}", droplet_id, v4.ip_address);
                                        return Ok(ServerStatus::Running);
                                    }
                                    Err(_) => {
                                        tracing::debug!("Droplet {} active but SSH not ready yet", droplet_id);
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to get droplet status: {}", e);
                }
            }

            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    }

    async fn get_server_status(&self, droplet_id: &str) -> Result<ServerStatus, ProviderError> {
        match self.get_droplet(droplet_id).await {
            Ok(droplet) => {
                let status = match droplet.status.as_str() {
                    "active" => ServerStatus::Running,
                    "new" => ServerStatus::Starting,
                    "off" => ServerStatus::Stopped,
                    _ => ServerStatus::Unknown,
                };
                Ok(status)
            }
            Err(e) => Err(e),
        }
    }

    async fn destroy_server(&self, droplet_id: &str) -> Result<(), ProviderError> {
        tracing::info!("Destroying DigitalOcean droplet {}", droplet_id);

        let url = format!("https://api.digitalocean.com/v2/droplets/{}", droplet_id);
        
        let response = self.client
            .delete(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Failed to delete droplet: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Droplet deletion failed {}: {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        tracing::info!("Droplet {} destroyed", droplet_id);
        Ok(())
    }

    async fn reboot_server(&self, droplet_id: &str) -> Result<(), ProviderError> {
        tracing::info!("Rebooting DigitalOcean droplet {}", droplet_id);

        let url = format!(
            "https://api.digitalocean.com/v2/droplets/{}/actions",
            droplet_id
        );
        let body = serde_json::json!({ "type": "reboot" });

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_token))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Failed to reboot droplet: {}", e),
                retryable: true,
            })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(ProviderError {
                code: "DO_API_ERROR".to_string(),
                message: format!("Droplet reboot failed {}: {}", status, body),
                retryable: status.is_server_error(),
            });
        }

        Ok(())
    }

    async fn get_server_ip(&self, droplet_id: &str) -> Result<Option<String>, ProviderError> {
        let droplet = self.get_droplet(droplet_id).await?;
        Ok(droplet.networks.and_then(|networks| {
            networks
                .v4
                .into_iter()
                .find(|n| n.r#type == "public")
                .map(|n| n.ip_address)
        }))
    }
}

// ============================================================================
// Hetzner API Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
struct HetznerServerResponse {
    server: HetznerServer,
}

#[derive(Debug, Deserialize)]
struct HetznerCreateResponse {
    server: HetznerServer,
    action: HetznerAction,
}

#[derive(Debug, Deserialize)]
struct HetznerServer {
    id: i64,
    name: String,
    status: String,
    public_net: HetznerPublicNet,
}

#[derive(Debug, Deserialize)]
struct HetznerPublicNet {
    ipv4: HetznerIpv4,
}

#[derive(Debug, Deserialize)]
struct HetznerIpv4 {
    ip: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HetznerAction {
    id: i64,
    command: String,
    status: String,
}

#[derive(Debug, Deserialize)]
struct HetznerSshKeysResponse {
    ssh_keys: Vec<HetznerSshKey>,
}

#[derive(Debug, Deserialize)]
struct HetznerSshKeyResponse {
    ssh_key: HetznerSshKey,
}

#[derive(Debug, Deserialize)]
struct HetznerSshKey {
    id: i64,
    name: String,
    fingerprint: String,
    public_key: String,
}

// ============================================================================
// DigitalOcean API Response Types
// ============================================================================

#[derive(Debug, Deserialize)]
struct DigitalOceanDropletResponse {
    droplet: DigitalOceanDroplet,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanCreateResponse {
    droplet: DigitalOceanDroplet,
    links: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanDroplet {
    id: i64,
    name: String,
    status: String,
    networks: Option<DigitalOceanNetworks>,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanNetworks {
    v4: Vec<DigitalOceanNetworkV4>,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanNetworkV4 {
    ip_address: String,
    r#type: String,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanSshKeysResponse {
    ssh_keys: Vec<DigitalOceanSshKey>,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanSshKeyResponse {
    ssh_key: DigitalOceanSshKey,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanSshKey {
    id: i64,
    name: String,
    public_key: String,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanAccountResponse {
    account: DigitalOceanAccount,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanAccount {
    droplet_limit: i64,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanDropletsResponse {
    meta: DigitalOceanMeta,
}

#[derive(Debug, Deserialize)]
struct DigitalOceanMeta {
    total: i64,
}

// ============================================================================
// Tests (mock driver — no real cloud API calls)
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Records trait calls and returns scripted results.
    struct MockDriver {
        calls: Mutex<Vec<String>>,
        fail_on: Mutex<Option<String>>,
    }

    impl MockDriver {
        fn new() -> Self {
            Self {
                calls: Mutex::new(Vec::new()),
                fail_on: Mutex::new(None),
            }
        }

        fn record(&self, call: &str) -> Result<(), ProviderError> {
            self.calls.lock().unwrap().push(call.to_string());
            if self.fail_on.lock().unwrap().as_deref() == Some(call) {
                return Err(ProviderError {
                    code: "MOCK_FAILURE".to_string(),
                    message: format!("scripted failure on {}", call),
                    retryable: false,
                });
            }
            Ok(())
        }
    }

    #[async_trait]
    impl ProviderDriver for MockDriver {
        fn name(&self) -> &str {
            "mock"
        }

        fn capabilities(&self) -> ProviderCapabilities {
            ProviderCapabilities {
                supports_api: true,
                supports_ssh_key_injection: true,
                supports_firewall_config: false,
                regions: vec![],
                instance_types: vec![],
                os_images: vec![],
            }
        }

        async fn create_server(
            &self,
            _request: &CreateServerRequest,
        ) -> Result<CreateServerResult, ProviderError> {
            self.record("create")?;
            Ok(CreateServerResult {
                server_id: "mock-1".to_string(),
                ip_address: Some("203.0.113.1".to_string()),
                status: ServerStatus::Provisioning,
            })
        }

        async fn inject_ssh_key(
            &self,
            _server_id: &str,
            _public_key: &str,
        ) -> Result<String, ProviderError> {
            self.record("inject_key")?;
            Ok("key-1".to_string())
        }

        async fn wait_for_ready(
            &self,
            _server_id: &str,
            _timeout: Duration,
        ) -> Result<ServerStatus, ProviderError> {
            self.record("wait")?;
            Ok(ServerStatus::Running)
        }

        async fn get_server_status(&self, _server_id: &str) -> Result<ServerStatus, ProviderError> {
            self.record("status")?;
            Ok(ServerStatus::Running)
        }

        async fn destroy_server(&self, server_id: &str) -> Result<(), ProviderError> {
            self.record(&format!("destroy:{}", server_id))
        }

        async fn reboot_server(&self, server_id: &str) -> Result<(), ProviderError> {
            self.record(&format!("reboot:{}", server_id))
        }
    }

    /// A driver that inherits the default (unsupported) reboot behavior.
    struct NoRebootDriver;

    #[async_trait]
    impl ProviderDriver for NoRebootDriver {
        fn name(&self) -> &str {
            "no-reboot"
        }
        fn capabilities(&self) -> ProviderCapabilities {
            MockDriver::new().capabilities()
        }
        async fn create_server(
            &self,
            _r: &CreateServerRequest,
        ) -> Result<CreateServerResult, ProviderError> {
            unimplemented!()
        }
        async fn inject_ssh_key(&self, _s: &str, _k: &str) -> Result<String, ProviderError> {
            unimplemented!()
        }
        async fn wait_for_ready(
            &self,
            _s: &str,
            _t: Duration,
        ) -> Result<ServerStatus, ProviderError> {
            unimplemented!()
        }
        async fn get_server_status(&self, _s: &str) -> Result<ServerStatus, ProviderError> {
            unimplemented!()
        }
        async fn destroy_server(&self, _s: &str) -> Result<(), ProviderError> {
            unimplemented!()
        }
    }

    #[tokio::test]
    async fn trait_dispatch_reaches_driver_ops() {
        let driver = MockDriver::new();
        let dyn_driver: &dyn ProviderDriver = &driver;

        dyn_driver.reboot_server("srv-42").await.unwrap();
        dyn_driver.destroy_server("srv-42").await.unwrap();

        let calls = driver.calls.lock().unwrap().clone();
        assert_eq!(calls, vec!["reboot:srv-42", "destroy:srv-42"]);
    }

    #[tokio::test]
    async fn driver_errors_propagate_through_trait() {
        let driver = MockDriver::new();
        *driver.fail_on.lock().unwrap() = Some("reboot:srv-1".to_string());

        let err = driver.reboot_server("srv-1").await.unwrap_err();
        assert_eq!(err.code, "MOCK_FAILURE");
    }

    #[tokio::test]
    async fn default_reboot_reports_unsupported() {
        let driver = NoRebootDriver;
        let err = driver.reboot_server("srv-1").await.unwrap_err();
        assert_eq!(err.code, "UNSUPPORTED");
        assert!(!err.retryable);
    }

    #[tokio::test]
    async fn default_get_server_ip_is_none() {
        let driver = NoRebootDriver;
        assert_eq!(driver.get_server_ip("srv-1").await.unwrap(), None);
    }

    #[test]
    fn driver_for_covers_automated_providers_only() {
        use crate::capability::SupportedProvider;
        assert!(driver_for(SupportedProvider::Hetzner, "t".to_string()).is_some());
        assert!(driver_for(SupportedProvider::DigitalOcean, "t".to_string()).is_some());
        // AWS needs its JSONB credential string; anything else falls back to SSH mode.
        assert!(driver_for(SupportedProvider::Aws, "t".to_string()).is_none());
        let aws_json = r#"{"access_key_id":"AKIA","secret_access_key":"s","region":"us-east-1"}"#;
        assert!(driver_for(SupportedProvider::Aws, aws_json.to_string()).is_some());
        assert!(driver_for(SupportedProvider::Manual, "t".to_string()).is_none());
    }
}
