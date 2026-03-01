//! Secure Configuration Module
//!
//! Provides secure configuration management with validation and policy enforcement.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use crate::{input_validation::ValidationRule, Severity};

/// Security policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityPolicy {
    /// Policy name
    pub name: String,
    /// Policy version
    pub version: String,
    /// Whether strict mode is enabled
    pub strict_mode: bool,
    /// Allowed encryption algorithms
    pub allowed_ciphers: Vec<String>,
    /// Minimum TLS version
    pub min_tls_version: TlsVersion,
    /// Whether to require certificate validation
    pub require_cert_validation: bool,
    /// Session timeout in seconds
    pub session_timeout_secs: u64,
    /// Maximum failed login attempts
    pub max_login_attempts: u32,
    /// Account lockout duration in seconds
    pub lockout_duration_secs: u64,
    /// Password policy
    pub password_policy: PasswordPolicy,
    /// CORS policy
    pub cors_policy: CorsPolicy,
}

impl Default for SecurityPolicy {
    fn default() -> Self {
        Self {
            name: "default".to_string(),
            version: "1.0.0".to_string(),
            strict_mode: false,
            allowed_ciphers: vec![
                "TLS_AES_256_GCM_SHA384".to_string(),
                "TLS_CHACHA20_POLY1305_SHA256".to_string(),
                "TLS_AES_128_GCM_SHA256".to_string(),
            ],
            min_tls_version: TlsVersion::Tls1_3,
            require_cert_validation: true,
            session_timeout_secs: 3600,
            max_login_attempts: 5,
            lockout_duration_secs: 900,
            password_policy: PasswordPolicy::default(),
            cors_policy: CorsPolicy::default(),
        }
    }
}

impl SecurityPolicy {
    /// Production security policy
    pub fn production() -> Self {
        Self {
            name: "production".to_string(),
            version: "1.0.0".to_string(),
            strict_mode: true,
            allowed_ciphers: vec![
                "TLS_AES_256_GCM_SHA384".to_string(),
                "TLS_CHACHA20_POLY1305_SHA256".to_string(),
            ],
            min_tls_version: TlsVersion::Tls1_3,
            require_cert_validation: true,
            session_timeout_secs: 1800,
            max_login_attempts: 3,
            lockout_duration_secs: 1800,
            password_policy: PasswordPolicy::strict(),
            cors_policy: CorsPolicy::strict(),
        }
    }

    /// Development security policy (more permissive)
    pub fn development() -> Self {
        Self {
            name: "development".to_string(),
            version: "1.0.0".to_string(),
            strict_mode: false,
            allowed_ciphers: vec![
                "TLS_AES_256_GCM_SHA384".to_string(),
                "TLS_AES_128_GCM_SHA256".to_string(),
                "ECDHE-RSA-AES256-GCM-SHA384".to_string(),
            ],
            min_tls_version: TlsVersion::Tls1_2,
            require_cert_validation: false,
            session_timeout_secs: 86400,
            max_login_attempts: 10,
            lockout_duration_secs: 300,
            password_policy: PasswordPolicy::relaxed(),
            cors_policy: CorsPolicy::permissive(),
        }
    }
}

/// TLS version
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TlsVersion {
    Tls1_0,
    Tls1_1,
    Tls1_2,
    Tls1_3,
}

/// Password policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasswordPolicy {
    /// Minimum length
    pub min_length: usize,
    /// Maximum length
    pub max_length: usize,
    /// Require uppercase letters
    pub require_uppercase: bool,
    /// Require lowercase letters
    pub require_lowercase: bool,
    /// Require digits
    pub require_digits: bool,
    /// Require special characters
    pub require_special: bool,
    /// Minimum entropy bits
    pub min_entropy_bits: f64,
    /// Password history count (prevent reuse)
    pub history_count: usize,
    /// Maximum age in days
    pub max_age_days: u32,
}

impl Default for PasswordPolicy {
    fn default() -> Self {
        Self {
            min_length: 12,
            max_length: 128,
            require_uppercase: true,
            require_lowercase: true,
            require_digits: true,
            require_special: true,
            min_entropy_bits: 50.0,
            history_count: 5,
            max_age_days: 90,
        }
    }
}

impl PasswordPolicy {
    /// Strict password policy
    pub fn strict() -> Self {
        Self {
            min_length: 16,
            max_length: 128,
            require_uppercase: true,
            require_lowercase: true,
            require_digits: true,
            require_special: true,
            min_entropy_bits: 60.0,
            history_count: 10,
            max_age_days: 60,
        }
    }

    /// Relaxed password policy for development
    pub fn relaxed() -> Self {
        Self {
            min_length: 8,
            max_length: 128,
            require_uppercase: false,
            require_lowercase: false,
            require_digits: false,
            require_special: false,
            min_entropy_bits: 30.0,
            history_count: 3,
            max_age_days: 365,
        }
    }

    /// Validate password against policy
    pub fn validate(&self, password: &str) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if password.len() < self.min_length {
            errors.push(format!(
                "Password must be at least {} characters",
                self.min_length
            ));
        }

        if password.len() > self.max_length {
            errors.push(format!(
                "Password must be at most {} characters",
                self.max_length
            ));
        }

        if self.require_uppercase && !password.chars().any(|c| c.is_uppercase()) {
            errors.push("Password must contain uppercase letters".to_string());
        }

        if self.require_lowercase && !password.chars().any(|c| c.is_lowercase()) {
            errors.push("Password must contain lowercase letters".to_string());
        }

        if self.require_digits && !password.chars().any(|c| c.is_ascii_digit()) {
            errors.push("Password must contain digits".to_string());
        }

        if self.require_special && !password.chars().any(|c| !c.is_alphanumeric()) {
            errors.push("Password must contain special characters".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

/// CORS policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorsPolicy {
    /// Allowed origins
    pub allowed_origins: Vec<String>,
    /// Allowed methods
    pub allowed_methods: Vec<String>,
    /// Allowed headers
    pub allowed_headers: Vec<String>,
    /// Allow credentials
    pub allow_credentials: bool,
    /// Max age in seconds
    pub max_age_secs: u64,
    /// Expose headers
    pub expose_headers: Vec<String>,
}

impl Default for CorsPolicy {
    fn default() -> Self {
        Self {
            allowed_origins: vec!["https://*.a2r.local".to_string()],
            allowed_methods: vec![
                "GET".to_string(),
                "POST".to_string(),
                "PUT".to_string(),
                "DELETE".to_string(),
                "OPTIONS".to_string(),
            ],
            allowed_headers: vec![
                "Content-Type".to_string(),
                "Authorization".to_string(),
                "X-Request-ID".to_string(),
            ],
            allow_credentials: true,
            max_age_secs: 86400,
            expose_headers: vec!["X-Request-ID".to_string()],
        }
    }
}

impl CorsPolicy {
    /// Strict CORS policy
    pub fn strict() -> Self {
        Self {
            allowed_origins: vec!["https://a2r.local".to_string()],
            allowed_methods: vec!["GET".to_string(), "POST".to_string()],
            allowed_headers: vec!["Content-Type".to_string(), "Authorization".to_string()],
            allow_credentials: true,
            max_age_secs: 3600,
            expose_headers: vec![],
        }
    }

    /// Permissive CORS policy for development
    pub fn permissive() -> Self {
        Self {
            allowed_origins: vec!["*".to_string()],
            allowed_methods: vec![
                "GET".to_string(),
                "POST".to_string(),
                "PUT".to_string(),
                "DELETE".to_string(),
                "PATCH".to_string(),
                "OPTIONS".to_string(),
            ],
            allowed_headers: vec!["*".to_string()],
            allow_credentials: false,
            max_age_secs: 86400,
            expose_headers: vec!["*".to_string()],
        }
    }
}

/// Secure configuration
#[derive(Debug, Clone)]
pub struct SecureConfig {
    /// Security policy
    pub security_policy: SecurityPolicy,
    /// Rate limit configuration
    pub rate_limit: crate::rate_limiting::RateLimitConfig,
    /// Validation rules
    pub validation_rules: HashMap<String, Vec<ValidationRule>>,
    /// Threat detection configuration
    pub threat_detection: crate::threat_detection::ThreatConfig,
    /// Audit configuration
    pub audit_config: crate::audit::AuditConfig,
}

impl Default for SecureConfig {
    fn default() -> Self {
        let mut validation_rules = HashMap::new();

        // Add default validation rules
        validation_rules.insert("api_key".to_string(), vec![ValidationRule::Length(32, 128)]);

        Self {
            security_policy: SecurityPolicy::default(),
            rate_limit: crate::rate_limiting::RateLimitConfig::default(),
            validation_rules,
            threat_detection: crate::threat_detection::ThreatConfig::default(),
            audit_config: crate::audit::AuditConfig::default(),
        }
    }
}

impl SecureConfig {
    /// Load configuration from file
    pub async fn from_file<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let content = tokio::fs::read_to_string(path).await?;
        let config: SecureConfigFile = serde_json::from_str(&content)?;

        Ok(Self::from_file_config(config))
    }

    /// Load from environment variables
    pub fn from_env() -> Self {
        let mut config = Self::default();

        // Load security policy from env
        if let Ok(policy) = std::env::var("A2R_SECURITY_POLICY") {
            config.security_policy = match policy.as_str() {
                "production" => SecurityPolicy::production(),
                "development" => SecurityPolicy::development(),
                _ => SecurityPolicy::default(),
            };
        }

        // Load rate limit config
        if let Ok(rps) = std::env::var("A2R_RATE_LIMIT_RPS") {
            if let Ok(rps) = rps.parse() {
                config.rate_limit.requests_per_second = rps;
            }
        }

        // Load strict mode
        if let Ok(strict) = std::env::var("A2R_STRICT_MODE") {
            config.security_policy.strict_mode = strict == "true" || strict == "1";
        }

        config
    }

    /// Create from file config
    fn from_file_config(file: SecureConfigFile) -> Self {
        Self {
            security_policy: file.security_policy,
            rate_limit: file.rate_limit.into(),
            validation_rules: file.validation_rules,
            threat_detection: file.threat_detection,
            audit_config: file.audit_config,
        }
    }

    /// Save configuration to file
    pub async fn save_to_file<P: AsRef<Path>>(&self, path: P) -> anyhow::Result<()> {
        let file = SecureConfigFile {
            security_policy: self.security_policy.clone(),
            rate_limit: RateLimitConfigFile::from(self.rate_limit.clone()),
            validation_rules: self.validation_rules.clone(),
            threat_detection: self.threat_detection.clone(),
            audit_config: self.audit_config.clone(),
        };

        let content = serde_json::to_string_pretty(&file)?;
        tokio::fs::write(path, content).await?;

        Ok(())
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        // Validate rate limit config
        if self.rate_limit.requests_per_second == 0 {
            errors.push("Rate limit requests_per_second must be > 0".to_string());
        }

        if self.rate_limit.burst_size == 0 {
            errors.push("Rate limit burst_size must be > 0".to_string());
        }

        // Validate security policy
        if self.security_policy.session_timeout_secs == 0 {
            errors.push("Session timeout must be > 0".to_string());
        }

        if self.security_policy.max_login_attempts == 0 {
            errors.push("Max login attempts must be > 0".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    /// Get environment-specific configuration
    pub fn for_environment(env: &str) -> Self {
        match env {
            "production" => Self::production(),
            "development" => Self::development(),
            _ => Self::default(),
        }
    }

    /// Production configuration
    pub fn production() -> Self {
        Self {
            security_policy: SecurityPolicy::production(),
            rate_limit: crate::rate_limiting::RateLimitConfig::conservative(),
            validation_rules: HashMap::new(),
            threat_detection: crate::threat_detection::ThreatConfig::strict(),
            audit_config: crate::audit::AuditConfig {
                log_to_file: true,
                min_severity: Severity::Info,
                ..Default::default()
            },
        }
    }

    /// Development configuration
    pub fn development() -> Self {
        Self {
            security_policy: SecurityPolicy::development(),
            rate_limit: crate::rate_limiting::RateLimitConfig::relaxed(),
            validation_rules: HashMap::new(),
            threat_detection: crate::threat_detection::ThreatConfig::permissive(),
            audit_config: crate::audit::AuditConfig {
                log_to_stdout: true,
                min_severity: Severity::Debug,
                ..Default::default()
            },
        }
    }
}

/// Serializable configuration file format
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SecureConfigFile {
    #[serde(default)]
    pub security_policy: SecurityPolicy,
    #[serde(default)]
    pub rate_limit: RateLimitConfigFile,
    #[serde(default)]
    pub validation_rules: HashMap<String, Vec<ValidationRule>>,
    #[serde(default)]
    pub threat_detection: crate::threat_detection::ThreatConfig,
    #[serde(default)]
    pub audit_config: crate::audit::AuditConfig,
}

/// Rate limit config file format (serializable)
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RateLimitConfigFile {
    pub requests_per_second: u32,
    pub burst_size: u32,
    pub window_duration_secs: u64,
    pub use_sliding_window: bool,
}

impl Default for RateLimitConfigFile {
    fn default() -> Self {
        Self {
            requests_per_second: 10,
            burst_size: 20,
            window_duration_secs: 60,
            use_sliding_window: false,
        }
    }
}

impl From<crate::rate_limiting::RateLimitConfig> for RateLimitConfigFile {
    fn from(config: crate::rate_limiting::RateLimitConfig) -> Self {
        Self {
            requests_per_second: config.requests_per_second,
            burst_size: config.burst_size,
            window_duration_secs: config.window_duration.as_secs(),
            use_sliding_window: config.use_sliding_window,
        }
    }
}

impl From<RateLimitConfigFile> for crate::rate_limiting::RateLimitConfig {
    fn from(file: RateLimitConfigFile) -> Self {
        Self {
            requests_per_second: file.requests_per_second,
            burst_size: file.burst_size,
            window_duration: std::time::Duration::from_secs(file.window_duration_secs),
            use_sliding_window: file.use_sliding_window,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_security_policies() {
        let default = SecurityPolicy::default();
        assert!(!default.strict_mode);

        let production = SecurityPolicy::production();
        assert!(production.strict_mode);

        let development = SecurityPolicy::development();
        assert!(!development.strict_mode);
    }

    #[test]
    fn test_password_policy_validation() {
        let policy = PasswordPolicy::default();

        // Valid password
        let result = policy.validate("SecureP@ss123");
        assert!(result.is_ok());

        // Too short
        let result = policy.validate("Short1!");
        assert!(result.is_err());

        // Missing special char
        let result = policy.validate("SecurePass123");
        assert!(result.is_err());
    }

    #[test]
    fn test_secure_config_validation() {
        let valid = SecureConfig::default();
        assert!(valid.validate().is_ok());

        let mut invalid = SecureConfig::default();
        invalid.rate_limit.requests_per_second = 0;
        assert!(invalid.validate().is_err());
    }

    #[test]
    fn test_cors_policies() {
        let strict = CorsPolicy::strict();
        assert_eq!(strict.allowed_origins.len(), 1);

        let permissive = CorsPolicy::permissive();
        assert_eq!(permissive.allowed_origins[0], "*");
    }

    #[test]
    fn test_config_from_env() {
        // Set env vars
        std::env::set_var("A2R_SECURITY_POLICY", "production");
        std::env::set_var("A2R_RATE_LIMIT_RPS", "5");
        std::env::set_var("A2R_STRICT_MODE", "true");

        let config = SecureConfig::from_env();
        assert_eq!(config.security_policy.name, "production");
        assert_eq!(config.rate_limit.requests_per_second, 5);
        assert!(config.security_policy.strict_mode);

        // Cleanup
        std::env::remove_var("A2R_SECURITY_POLICY");
        std::env::remove_var("A2R_RATE_LIMIT_RPS");
        std::env::remove_var("A2R_STRICT_MODE");
    }
}
