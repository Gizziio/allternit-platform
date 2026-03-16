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

use crate::capability::{SupportedProvider, SupportedOS, AuthMethod};

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
                // AWS validation would require AWS SDK
                // For now, skip validation
                Ok(())
            }
            Some(SupportedProvider::Manual) | None => {
                Err(PreflightError::InvalidProvider("API token validation requires API-mode provider".to_string()))
            }
        }
    }

    /// Validate SSH connection
    pub async fn validate_ssh_connection(
        &self,
        host: &str,
        port: u16,
        username: &str,
        private_key: Option<&str>,
        password: Option<&str>,
    ) -> Result<(), PreflightError> {
        // Test TCP connectivity first
        let tcp_result = timeout(self.timeout, async {
            tokio::net::TcpStream::connect(format!("{}:{}", host, port)).await
        }).await;

        match tcp_result {
            Ok(Ok(_)) => {}
            Ok(Err(e)) => return Err(PreflightError::ConnectionFailed(format!("Cannot connect to {}:{} - {}", host, port, e))),
            Err(_) => return Err(PreflightError::Timeout(format!("TCP connection to {}:{} timed out", host, port))),
        }

        // Test SSH authentication
        // In production, use ssh2 crate to actually test auth
        // For now, just verify credentials are provided
        if private_key.is_none() && password.is_none() {
            return Err(PreflightError::MissingCredentials("SSH key or password required".to_string()));
        }

        // Detect OS via SSH
        // In production, would actually connect and run commands
        // For now, skip OS detection

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
                        // Parse response to check quota
                        // For now, assume OK
                        Ok(())
                    }
                    _ => Err(PreflightWarning::QuotaUnknown("Cannot check Hetzner quota".to_string())),
                }
            }
            SupportedProvider::DigitalOcean => {
                // Check DigitalOcean quota
                let client = reqwest::Client::new();
                let result = timeout(self.timeout, async {
                    client.get("https://api.digitalocean.com/v2/account")
                        .bearer_auth(token)
                        .send()
                        .await
                }).await;

                match result {
                    Ok(Ok(response)) => {
                        if !response.status().is_success() {
                            return Err(PreflightWarning::QuotaUnknown("Cannot check DigitalOcean quota".to_string()));
                        }
                        // Parse response to check quota
                        // For now, assume OK
                        Ok(())
                    }
                    _ => Err(PreflightWarning::QuotaUnknown("Cannot check DigitalOcean quota".to_string())),
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
    OSUnknown(String),
    FirewallDetected(String),
}

impl std::fmt::Display for PreflightWarning {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::QuotaUnknown(msg) => write!(f, "Quota unknown: {}", msg),
            Self::OSUnknown(msg) => write!(f, "OS unknown: {}", msg),
            Self::FirewallDetected(msg) => write!(f, "Firewall detected: {}", msg),
        }
    }
}
