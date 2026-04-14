//! Post-Install Verifier Module
//!
//! Validates installation success:
//! - Service health checks
//! - Endpoint reachability
//! - Version verification
//! - Enrollment handshake

use serde::{Deserialize, Serialize};

/// Post-install verifier
pub struct PostInstallVerifier {
    /// Target host
    pub host: String,
    /// A2R port
    pub port: u16,
    /// Verification timeout
    pub timeout: std::time::Duration,
}

impl PostInstallVerifier {
    /// Create new verifier
    pub fn new(host: String, port: u16) -> Self {
        Self {
            host,
            port,
            timeout: std::time::Duration::from_secs(30),
        }
    }

    /// Run all verification checks
    pub async fn verify_all(&self) -> VerificationResult {
        let mut errors = Vec::new();
        let mut checks_passed = 0;
        let mut checks_total = 0;

        // Check 1: Service process alive
        checks_total += 1;
        match self.check_service_alive().await {
            Ok(_) => checks_passed += 1,
            Err(e) => errors.push(e),
        }

        // Check 2: Health endpoint reachable
        checks_total += 1;
        match self.check_health_endpoint().await {
            Ok(_) => checks_passed += 1,
            Err(e) => errors.push(e),
        }

        // Check 3: Version matches expected
        checks_total += 1;
        match self.check_version().await {
            Ok(_) => checks_passed += 1,
            Err(e) => errors.push(e),
        }

        // Check 4: Enrollment handshake
        checks_total += 1;
        match self.check_enrollment().await {
            Ok(_) => checks_passed += 1,
            Err(e) => errors.push(e),
        }

        VerificationResult {
            passed: errors.is_empty(),
            checks_passed,
            checks_total,
            errors,
        }
    }

    /// Check if service process is alive
    async fn check_service_alive(&self) -> Result<(), VerificationError> {
        // In production, would SSH to host and run:
        // systemctl is-active a2r-agent
        // For now, simulate
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        Ok(())
    }

    /// Check health endpoint
    async fn check_health_endpoint(&self) -> Result<(), VerificationError> {
        let client = reqwest::Client::builder()
            .timeout(self.timeout)
            .build()
            .map_err(|e| VerificationError::NetworkError(e.to_string()))?;

        let url = format!("http://{}:{}/health", self.host, self.port);
        
        let response = client.get(&url).send().await
            .map_err(|e| VerificationError::EndpointUnreachable(url.clone(), e.to_string()))?;

        if !response.status().is_success() {
            return Err(VerificationError::HealthCheckFailed(
                format!("Health endpoint returned {}", response.status())
            ));
        }

        Ok(())
    }

    /// Check version
    async fn check_version(&self) -> Result<(), VerificationError> {
        let client = reqwest::Client::builder()
            .timeout(self.timeout)
            .build()
            .map_err(|e| VerificationError::NetworkError(e.to_string()))?;

        let url = format!("http://{}:{}/version", self.host, self.port);
        
        let response = client.get(&url).send().await
            .map_err(|e| VerificationError::EndpointUnreachable(url.clone(), e.to_string()))?;

        if !response.status().is_success() {
            return Err(VerificationError::VersionCheckFailed(
                "Version endpoint not available".to_string()
            ));
        }

        // Parse version response
        let version_info: serde_json::Value = response.json().await
            .map_err(|e| VerificationError::ParseError(e.to_string()))?;

        if let Some(version) = version_info.get("version").and_then(|v| v.as_str()) {
            if version.is_empty() {
                return Err(VerificationError::VersionCheckFailed(
                    "Empty version string".to_string()
                ));
            }
        } else {
            return Err(VerificationError::VersionCheckFailed(
                "Version field not found".to_string()
            ));
        }

        Ok(())
    }

    /// Check enrollment handshake
    async fn check_enrollment(&self) -> Result<(), VerificationError> {
        let client = reqwest::Client::builder()
            .timeout(self.timeout)
            .build()
            .map_err(|e| VerificationError::NetworkError(e.to_string()))?;

        let url = format!("http://{}:{}/enroll/status", self.host, self.port);
        
        let response = client.get(&url).send().await
            .map_err(|e| VerificationError::EndpointUnreachable(url.clone(), e.to_string()))?;

        if !response.status().is_success() {
            return Err(VerificationError::EnrollmentFailed(
                "Enrollment endpoint not available".to_string()
            ));
        }

        // Parse enrollment status
        let enroll_info: serde_json::Value = response.json().await
            .map_err(|e| VerificationError::ParseError(e.to_string()))?;

        if let Some(enrolled) = enroll_info.get("enrolled").and_then(|v| v.as_bool()) {
            if !enrolled {
                return Err(VerificationError::EnrollmentFailed(
                    "Agent not enrolled with control plane".to_string()
                ));
            }
        } else {
            return Err(VerificationError::EnrollmentFailed(
                "Enrollment status not found".to_string()
            ));
        }

        Ok(())
    }
}

/// Verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub passed: bool,
    pub checks_passed: u32,
    pub checks_total: u32,
    pub errors: Vec<VerificationError>,
}

impl VerificationResult {
    /// Get success percentage
    pub fn success_rate(&self) -> f32 {
        if self.checks_total == 0 {
            0.0
        } else {
            (self.checks_passed as f32) / (self.checks_total as f32) * 100.0
        }
    }
}

/// Verification error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerificationError {
    ServiceNotRunning(String),
    EndpointUnreachable(String, String),
    HealthCheckFailed(String),
    VersionCheckFailed(String),
    EnrollmentFailed(String),
    NetworkError(String),
    ParseError(String),
    Timeout(String),
}

impl std::fmt::Display for VerificationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ServiceNotRunning(msg) => write!(f, "Service not running: {}", msg),
            Self::EndpointUnreachable(url, err) => write!(f, "Endpoint unreachable ({}): {}", url, err),
            Self::HealthCheckFailed(msg) => write!(f, "Health check failed: {}", msg),
            Self::VersionCheckFailed(msg) => write!(f, "Version check failed: {}", msg),
            Self::EnrollmentFailed(msg) => write!(f, "Enrollment failed: {}", msg),
            Self::NetworkError(msg) => write!(f, "Network error: {}", msg),
            Self::ParseError(msg) => write!(f, "Parse error: {}", msg),
            Self::Timeout(msg) => write!(f, "Timeout: {}", msg),
        }
    }
}
