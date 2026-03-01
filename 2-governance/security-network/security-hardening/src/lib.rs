//! A2R Security Hardening
//!
//! Provides security controls and hardening mechanisms for the A2R platform.
//! Includes input validation, security headers, rate limiting, audit logging,
//! and threat detection.

pub mod audit;
pub mod headers;
pub mod input_validation;
pub mod rate_limiting;
pub mod secure_config;
pub mod threat_detection;

use axum::{extract::Request, http::StatusCode, middleware::Next, response::Response};
use std::sync::Arc;
use tracing::{error, warn};

pub use audit::{AuditLogger, SecurityAuditEvent};
pub use headers::SecurityHeaders;
pub use input_validation::{InputValidator, ValidationRule};
pub use rate_limiting::{RateLimitConfig, RateLimiter};
pub use secure_config::{SecureConfig, SecurityPolicy};
pub use threat_detection::{ThreatDetector, ThreatLevel};

/// Security hardening middleware stack
pub struct SecurityHardening {
    config: Arc<SecureConfig>,
    rate_limiter: Arc<RateLimiter>,
    audit_logger: Arc<AuditLogger>,
    threat_detector: Arc<ThreatDetector>,
    input_validator: Arc<InputValidator>,
}

impl SecurityHardening {
    /// Create a new security hardening instance
    pub fn new(config: SecureConfig) -> Self {
        let config = Arc::new(config);

        Self {
            rate_limiter: Arc::new(RateLimiter::new(config.rate_limit.clone())),
            audit_logger: Arc::new(AuditLogger::new()),
            threat_detector: Arc::new(ThreatDetector::new(config.threat_detection.clone())),
            input_validator: Arc::new(InputValidator::new(&config.validation_rules)),
            config,
        }
    }

    /// Get a copy of the security hardening instance for use in middleware
    pub fn clone_for_middleware(&self) -> Self {
        self.clone()
    }

    /// Get security headers layer
    pub fn security_headers_layer(
        &self,
    ) -> tower_http::set_header::SetResponseHeaderLayer<http::HeaderValue> {
        headers::create_security_headers_layer()
    }

    /// Validate input
    pub async fn validate_input(&self, input: &str, context: &str) -> Result<(), ValidationError> {
        self.input_validator.validate(input, context).await
    }

    /// Check rate limit
    pub async fn check_rate_limit(&self, key: &str) -> Result<(), RateLimitError> {
        self.rate_limiter.check(key).await
    }

    /// Log security event
    pub async fn log_event(&self, event: SecurityAuditEvent) {
        self.audit_logger.log(event).await;
    }

    /// Detect threats in request
    pub async fn detect_threats(&self, request: &Request) -> Vec<Threat> {
        self.threat_detector.analyze(request).await
    }
}

impl Clone for SecurityHardening {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            rate_limiter: self.rate_limiter.clone(),
            audit_logger: self.audit_logger.clone(),
            threat_detector: self.threat_detector.clone(),
            input_validator: self.input_validator.clone(),
        }
    }
}

/// Main security middleware function
///
/// Usage example:
/// ```rust,ignore
/// use a2r_security_hardening::{SecurityHardening, SecureConfig, security_middleware};
/// use axum::{Router, middleware};
///
/// let hardening = SecurityHardening::new(SecureConfig::default());
/// let router = Router::new();
/// let app = router.layer(middleware::from_fn(move |req, next| {
///     let h = hardening.clone();
///     security_middleware(h, req, next)
/// }));
/// ```
pub async fn security_middleware(
    hardening: SecurityHardening,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let start = std::time::Instant::now();
    let client_ip = get_client_ip(&request);

    // 1. Check rate limiting
    if let Err(e) = hardening.check_rate_limit(&client_ip).await {
        warn!("Rate limit exceeded for {}: {}", client_ip, e);
        hardening
            .log_event(SecurityAuditEvent {
                timestamp: chrono::Utc::now(),
                event_type: "rate_limit_exceeded".to_string(),
                client_ip: client_ip.clone(),
                request_path: request.uri().path().to_string(),
                severity: Severity::Warning,
                details: format!("Rate limit error: {}", e),
            })
            .await;
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    // 2. Detect threats
    let threats = hardening.detect_threats(&request).await;
    let critical_threats: Vec<_> = threats
        .iter()
        .filter(|t| t.level == ThreatLevel::Critical)
        .collect();

    if !critical_threats.is_empty() {
        error!(
            "Critical threats detected from {}: {:?}",
            client_ip, critical_threats
        );
        hardening
            .log_event(SecurityAuditEvent {
                timestamp: chrono::Utc::now(),
                event_type: "threat_detected".to_string(),
                client_ip: client_ip.clone(),
                request_path: request.uri().path().to_string(),
                severity: Severity::Critical,
                details: format!("Critical threats: {:?}", critical_threats),
            })
            .await;
        return Err(StatusCode::FORBIDDEN);
    }

    // 3. Process request
    let mut response = next.run(request).await;

    // 4. Add security headers
    headers::add_security_headers(&mut response);

    // 5. Log successful request
    let duration = start.elapsed();
    hardening
        .log_event(SecurityAuditEvent {
            timestamp: chrono::Utc::now(),
            event_type: "request_processed".to_string(),
            client_ip,
            request_path: response
                .headers()
                .get("x-request-path")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("/")
                .to_string(),
            severity: Severity::Info,
            details: format!("Duration: {:?}, Status: {}", duration, response.status()),
        })
        .await;

    Ok(response)
}

/// Get client IP from request
fn get_client_ip(request: &Request) -> String {
    // Check X-Forwarded-For header
    if let Some(header) = request.headers().get("x-forwarded-for") {
        if let Ok(value) = header.to_str() {
            return value
                .split(',')
                .next()
                .unwrap_or("unknown")
                .trim()
                .to_string();
        }
    }

    // Check X-Real-IP header
    if let Some(header) = request.headers().get("x-real-ip") {
        if let Ok(value) = header.to_str() {
            return value.to_string();
        }
    }

    // Default
    "unknown".to_string()
}

/// Security severity levels
#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, serde::Serialize, serde::Deserialize,
)]
pub enum Severity {
    Debug,
    Info,
    Warning,
    Error,
    Critical,
}

/// Threat information
#[derive(Debug, Clone)]
pub struct Threat {
    pub level: ThreatLevel,
    pub category: String,
    pub description: String,
    pub confidence: f64,
}

/// Validation error
#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    #[error("Input validation failed: {0}")]
    InvalidInput(String),
    #[error("Pattern mismatch: {0}")]
    PatternMismatch(String),
    #[error("Length violation: {0}")]
    LengthViolation(String),
}

/// Rate limit error
#[derive(Debug, thiserror::Error)]
pub enum RateLimitError {
    #[error("Rate limit exceeded for key: {0}")]
    LimitExceeded(String),
    #[error("Rate limiter error: {0}")]
    InternalError(String),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;

    #[test]
    fn test_security_config() {
        let config = SecureConfig::default();
        assert!(!config.validation_rules.is_empty());
    }

    #[tokio::test]
    async fn test_input_validation() {
        let config = SecureConfig::default();
        let hardening = SecurityHardening::new(config);

        // Valid input should pass
        let result = hardening.validate_input("valid-input-123", "generic").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_rate_limiting() {
        let config = SecureConfig::default();
        let hardening = SecurityHardening::new(config);

        // First request should pass
        let result = hardening.check_rate_limit("test-client").await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_client_ip_extraction() {
        use axum::http::Request;

        // Test without headers
        let request = Request::builder().uri("/test").body(Body::empty()).unwrap();

        let ip = get_client_ip(&request);
        assert_eq!(ip, "unknown");

        // Test with X-Forwarded-For
        let request = Request::builder()
            .uri("/test")
            .header("x-forwarded-for", "192.168.1.1, 10.0.0.1")
            .body(Body::empty())
            .unwrap();

        let ip = get_client_ip(&request);
        assert_eq!(ip, "192.168.1.1");
    }
}
