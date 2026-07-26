//! Preflight Validation Module
//!
//! Validates deployment prerequisites:
//! - Credential validation
//! - Connectivity checks
//! - System requirements
//! - Provider quotas

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::timeout;

use crate::capability::{SupportedProvider, AuthMethod};

/// Preflight checker
pub struct PreflightChecker {
    /// Connection timeout
    pub timeout: Duration,
}

impl Default for PreflightChecker {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
        }
    }
}

impl PreflightChecker {
    /// Create new preflight checker
    pub fn new() -> Self {
        Self::default()
    }

    /// Run all preflight checks
    pub async fn run_all(&self, context: &crate::state_machine::WizardContext) -> PreflightResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Check credentials based on mode
        if let Some(auth) = context.auth_method {
            match auth {
                AuthMethod::ApiToken => {
                    if let Some(token) = &context.api_token {
                        match self.validate_api_token(context.provider, token).await {
                            Ok(_) => {}
                            Err(e) => errors.push(e),
                        }
                    } else {
                        errors.push(PreflightError::MissingCredentials("API token required".to_string()));
                    }
                }
                AuthMethod::SshKey | AuthMethod::SshPassword => {
                    if let (Some(host), Some(username)) = (&context.ssh_host, &context.ssh_username) {
                        match self.validate_ssh_connection(
                            host,
                            context.ssh_port.unwrap_or(22),
                            username,
                            context.ssh_private_key.as_deref(),
                            context.ssh_password.as_deref(),
                        ).await {
                            Ok(_) => {}
                            Err(e) => errors.push(e),
                        }
                    } else {
                        errors.push(PreflightError::MissingCredentials("SSH host and username required".to_string()));
                    }
                }
            }
        }

        // Check provider quota (API mode only)
        if let Some(provider) = context.provider {
            if provider.supports_api() {
                if let Some(token) = &context.api_token {
                    match self.check_provider_quota(provider, token).await {
                        Ok(_) => {}
                        Err(e) => warnings.push(e),
                    }
                }
            }
        }

        PreflightResult {
            passed: errors.is_empty(),
            errors,
            warnings,
        }
    }

    /// Validate API token
    pub async fn validate_api_token(
        &self,
        provider: Option<SupportedProvider>,
        token: &str,
    ) -> Result<(), PreflightError> {
        match provider {
            Some(SupportedProvider::Hetzner) => {
                // Validate Hetzner token
                let client = reqwest::Client::new();
                let result = timeout(self.timeout, async {
                    client.get("https://api.hetzner.cloud/v1/servers")
                        .bearer_auth(token)
                        .send()
                        .await
                }).await;

                match result {
                    Ok(Ok(response)) => {
                        if response.status().is_success() {
                            Ok(())
                        } else if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                            Err(PreflightError::InvalidCredentials("Invalid Hetzner API token".to_string()))
                        } else {
                            Err(PreflightError::ProviderError(format!("Hetzner API error: {}", response.status())))
                        }
                    }
                    Ok(Err(e)) => Err(PreflightError::NetworkError(e.to_string())),
                    Err(_) => Err(PreflightError::Timeout("Hetzner API validation timed out".to_string())),
                }
            }
            Some(SupportedProvider::DigitalOcean) => {
                // Validate DigitalOcean token
                let client = reqwest::Client::new();
                let result = timeout(self.timeout, async {
                    client.get("https://api.digitalocean.com/v2/account")
                        .bearer_auth(token)
                        .send()
                        .await
                }).await;

                match result {
                    Ok(Ok(response)) => {
                        if response.status().is_success() {
                            Ok(())
                        } else if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                            Err(PreflightError::InvalidCredentials("Invalid DigitalOcean API token".to_string()))
                        } else {
                            Err(PreflightError::ProviderError(format!("DigitalOcean API error: {}", response.status())))
                        }
                    }
                    Ok(Err(e)) => Err(PreflightError::NetworkError(e.to_string())),
                    Err(_) => Err(PreflightError::Timeout("DigitalOcean API validation timed out".to_string())),
                }
            }
            Some(SupportedProvider::Aws) => {
                // AWS credentials are a JSON string
                // ({"access_key_id","secret_access_key","region"}), validated
                // live via STS GetCallerIdentity.
                let creds = crate::aws::AwsCredentials::from_token(token)
                    .map_err(PreflightError::InvalidCredentials)?;
                let driver = crate::aws::AwsDriver::new(creds);
                match timeout(self.timeout, driver.validate()).await {
                    Ok(Ok(())) => Ok(()),
                    Ok(Err(e)) if e.code == "AWS_AUTH_ERROR" => Err(
                        PreflightError::InvalidCredentials(format!("Invalid AWS credentials: {}", e.message)),
                    ),
                    Ok(Err(e)) => Err(PreflightError::ProviderError(format!("AWS API error: {}", e.message))),
                    Err(_) => Err(PreflightError::Timeout("AWS STS validation timed out".to_string())),
                }
            }
            Some(SupportedProvider::Manual) | None => {
                Err(PreflightError::InvalidProvider("API token validation requires API-mode provider".to_string()))
            }
        }
    }

    /// Validate SSH connection
    ///
    /// Real validation: TCP connect, SSH handshake + auth (key or password),
    /// then a trivial remote command (`uname -a`).
    pub async fn validate_ssh_connection(
        &self,
        host: &str,
        port: u16,
        username: &str,
        private_key: Option<&str>,
        password: Option<&str>,
    ) -> Result<(), PreflightError> {
        if private_key.is_none() && password.is_none() {
            return Err(PreflightError::MissingCredentials("SSH key or password required".to_string()));
        }

        let connect = async {
            match (private_key, password) {
                (Some(key), _) => {
                    allternit_cloud_ssh::SshConnection::connect(host, port, username, key).await
                }
                (None, Some(pass)) => {
                    allternit_cloud_ssh::SshConnection::connect_password(host, port, username, pass)
                        .await
                }
                (None, None) => unreachable!("checked above"),
            }
        };

        let conn = match timeout(self.timeout, connect).await {
            Ok(Ok(conn)) => conn,
            Ok(Err(allternit_cloud_ssh::SshError::AuthenticationFailed(msg))) => {
                return Err(PreflightError::InvalidCredentials(format!(
                    "SSH authentication failed for {}@{}:{} - {}",
                    username, host, port, msg
                )));
            }
            Ok(Err(e)) => {
                return Err(PreflightError::ConnectionFailed(format!(
                    "Cannot connect to {}:{} - {}",
                    host, port, e
                )));
            }
            Err(_) => {
                return Err(PreflightError::Timeout(format!(
                    "SSH connection to {}:{} timed out",
                    host, port
                )));
            }
        };

        // Trivial command proves the session really executes.
        let output = match timeout(self.timeout, conn.execute("uname -a")).await {
            Ok(Ok(output)) => output,
            Ok(Err(e)) => {
                return Err(PreflightError::ConnectionFailed(format!(
                    "SSH command failed on {}:{} - {}",
                    host, port, e
                )));
            }
            Err(_) => {
                return Err(PreflightError::Timeout(format!(
                    "SSH command on {}:{} timed out",
                    host, port
                )));
            }
        };

        if output.exit_code != 0 || output.stdout.trim().is_empty() {
            return Err(PreflightError::ConnectionFailed(format!(
                "`uname -a` failed on {}:{} (exit {})",
                host, port, output.exit_code
            )));
        }

        Ok(())
    }

    /// Check provider quota
    pub async fn check_provider_quota(
        &self,
        provider: SupportedProvider,
        token: &str,
    ) -> Result<(), PreflightWarning> {
        match provider {
            SupportedProvider::Hetzner => {
                // Check Hetzner quota
                let client = reqwest::Client::new();
                let result = timeout(self.timeout, async {
                    client.get("https://api.hetzner.cloud/v1/projects")
                        .bearer_auth(token)
                        .send()
                        .await
                }).await;

                match result {
                    Ok(Ok(response)) => {
                        if !response.status().is_success() {
                            return Err(PreflightWarning::QuotaUnknown("Cannot check Hetzner quota".to_string()));
                        }
                        // Hetzner exposes no quota-list endpoint; create-time
                        // "resource_limit_exceeded" errors are mapped to
                        // QUOTA_EXCEEDED by the driver instead.
                        Ok(())
                    }
                    _ => Err(PreflightWarning::QuotaUnknown("Cannot check Hetzner quota".to_string())),
                }
            }
            SupportedProvider::DigitalOcean => {
                // Check DigitalOcean quota: droplet count vs account limit.
                let client = reqwest::Client::new();
                let check = async {
                    let account = client
                        .get("https://api.digitalocean.com/v2/account")
                        .bearer_auth(token)
                        .send()
                        .await
                        .map_err(|e| e.to_string())?;
                    if !account.status().is_success() {
                        return Err(format!("account endpoint returned {}", account.status()));
                    }
                    let account: serde_json::Value = account.json().await.map_err(|e| e.to_string())?;
                    let limit = account["account"]["droplet_limit"]
                        .as_i64()
                        .ok_or_else(|| "no droplet_limit in account response".to_string())?;

                    let droplets = client
                        .get("https://api.digitalocean.com/v2/droplets?per_page=200")
                        .bearer_auth(token)
                        .send()
                        .await
                        .map_err(|e| e.to_string())?;
                    if !droplets.status().is_success() {
                        return Err(format!("droplets endpoint returned {}", droplets.status()));
                    }
                    let droplets: serde_json::Value = droplets.json().await.map_err(|e| e.to_string())?;
                    let total = droplets["meta"]["total"]
                        .as_i64()
                        .ok_or_else(|| "no meta.total in droplets response".to_string())?;

                    Ok((total, limit))
                };

                match timeout(self.timeout, check).await {
                    Ok(Ok((total, limit))) if total >= limit => Err(
                        PreflightWarning::QuotaExceeded(format!(
                            "DigitalOcean droplet limit reached: {}/{} droplets in use",
                            total, limit
                        )),
                    ),
                    Ok(Ok(_)) => Ok(()),
                    Ok(Err(e)) => Err(PreflightWarning::QuotaUnknown(format!(
                        "Cannot check DigitalOcean quota: {}",
                        e
                    ))),
                    Err(_) => Err(PreflightWarning::QuotaUnknown(
                        "DigitalOcean quota check timed out".to_string(),
                    )),
                }
            }
            _ => Ok(()),
        }
    }
}

/// Preflight result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreflightResult {
    pub passed: bool,
    pub errors: Vec<PreflightError>,
    pub warnings: Vec<PreflightWarning>,
}

/// Preflight error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PreflightError {
    MissingCredentials(String),
    InvalidCredentials(String),
    ConnectionFailed(String),
    Timeout(String),
    NetworkError(String),
    ProviderError(String),
    InvalidProvider(String),
    OSUnsupported(String),
}

impl std::fmt::Display for PreflightError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MissingCredentials(msg) => write!(f, "Missing credentials: {}", msg),
            Self::InvalidCredentials(msg) => write!(f, "Invalid credentials: {}", msg),
            Self::ConnectionFailed(msg) => write!(f, "Connection failed: {}", msg),
            Self::Timeout(msg) => write!(f, "Timeout: {}", msg),
            Self::NetworkError(msg) => write!(f, "Network error: {}", msg),
            Self::ProviderError(msg) => write!(f, "Provider error: {}", msg),
            Self::InvalidProvider(msg) => write!(f, "Invalid provider: {}", msg),
            Self::OSUnsupported(msg) => write!(f, "OS unsupported: {}", msg),
        }
    }
}

/// Preflight warning
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PreflightWarning {
    QuotaUnknown(String),
    QuotaExceeded(String),
    OSUnknown(String),
    FirewallDetected(String),
}

impl std::fmt::Display for PreflightWarning {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::QuotaUnknown(msg) => write!(f, "Quota unknown: {}", msg),
            Self::QuotaExceeded(msg) => write!(f, "Quota exceeded: {}", msg),
            Self::OSUnknown(msg) => write!(f, "OS unknown: {}", msg),
            Self::FirewallDetected(msg) => write!(f, "Firewall detected: {}", msg),
        }
    }
}
