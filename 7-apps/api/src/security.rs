#![allow(dead_code, unused_variables, unused_imports)]
//! Security Middleware Integration for A2R API
//!
//! This module integrates the security-hardening crate with the Axum API,
//! providing request validation, rate limiting, threat detection, and security headers.

use a2r_security_hardening::{
    InputValidator, SecureConfig, SecurityAuditEvent, SecurityHardening, Severity, ValidationRule,
};
use axum::{
    extract::Request,
    http::{header, HeaderValue, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};

/// Security middleware state (cloneable for Axum)
#[derive(Clone)]
pub struct SecurityMiddlewareState {
    pub hardening: Arc<SecurityHardening>,
    pub enabled: Arc<RwLock<bool>>,
}

impl SecurityMiddlewareState {
    /// Create new security middleware state
    pub fn new(config: SecureConfig) -> Self {
        let hardening = Arc::new(SecurityHardening::new(config));
        Self {
            hardening,
            enabled: Arc::new(RwLock::new(true)),
        }
    }

    /// Create with default production config
    pub fn production() -> Self {
        Self::new(SecureConfig::production())
    }

    /// Create with development config (more permissive)
    pub fn development() -> Self {
        Self::new(SecureConfig::development())
    }

    /// Check if middleware is enabled
    pub async fn is_enabled(&self) -> bool {
        *self.enabled.read().await
    }

    /// Enable/disable middleware
    pub async fn set_enabled(&self, enabled: bool) {
        let mut lock = self.enabled.write().await;
        *lock = enabled;
    }
}

/// Security middleware for Axum
pub async fn security_middleware(
    state: SecurityMiddlewareState,
    request: Request,
    next: Next,
) -> Response {
    // Check if middleware is enabled
    if !state.is_enabled().await {
        return next.run(request).await;
    }

    let start = std::time::Instant::now();

    // Extract client IP
    let client_ip = get_client_ip(&request);
    let request_path = request.uri().path().to_string();
    let request_method = request.method().to_string();

    // 1. Rate limiting check
    if let Err(e) = state.hardening.check_rate_limit(&client_ip).await {
        warn!("Rate limit exceeded for {}: {}", client_ip, e);

        // Log security event
        state
            .hardening
            .log_event(SecurityAuditEvent {
                timestamp: chrono::Utc::now(),
                event_type: "rate_limit_exceeded".to_string(),
                client_ip: client_ip.clone(),
                request_path: request_path.clone(),
                severity: Severity::Warning,
                details: format!("Rate limit error: {}", e),
            })
            .await;

        return (StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded").into_response();
    }

    // 2. Threat detection
    let threats = state.hardening.detect_threats(&request).await;
    let critical_threats: Vec<_> = threats
        .iter()
        .filter(|t| matches!(t.level, a2r_security_hardening::ThreatLevel::Critical))
        .collect();

    if !critical_threats.is_empty() {
        error!(
            "Critical threats detected from {}: {:?}",
            client_ip, critical_threats
        );

        state
            .hardening
            .log_event(SecurityAuditEvent {
                timestamp: chrono::Utc::now(),
                event_type: "threat_detected".to_string(),
                client_ip: client_ip.clone(),
                request_path: request_path.clone(),
                severity: Severity::Critical,
                details: format!("Critical threats: {:?}", critical_threats),
            })
            .await;

        return (StatusCode::FORBIDDEN, "Access denied").into_response();
    }

    // 3. Process request
    let response = next.run(request).await;

    // 4. Add security headers
    let response = add_security_headers(response);

    // 5. Log successful request
    let duration = start.elapsed();
    let status = response.status();

    state
        .hardening
        .log_event(SecurityAuditEvent {
            timestamp: chrono::Utc::now(),
            event_type: "request_processed".to_string(),
            client_ip: client_ip.clone(),
            request_path: request_path.clone(),
            severity: Severity::Info,
            details: format!(
                "{} {} - {} in {:?}",
                request_method, request_path, status, duration
            ),
        })
        .await;

    response
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

    // Fall back to socket address
    if let Some(addr) = request.extensions().get::<std::net::SocketAddr>() {
        return addr.ip().to_string();
    }

    "unknown".to_string()
}

/// Add security headers to response
fn add_security_headers(mut response: Response) -> Response {
    let headers = response.headers_mut();

    // Content Security Policy
    headers.insert(
        "Content-Security-Policy",
        HeaderValue::from_static(
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
        ),
    );

    // X-Content-Type-Options
    headers.insert(
        "X-Content-Type-Options",
        HeaderValue::from_static("nosniff"),
    );

    // X-Frame-Options
    headers.insert("X-Frame-Options", HeaderValue::from_static("DENY"));

    // X-XSS-Protection
    headers.insert(
        "X-XSS-Protection",
        HeaderValue::from_static("1; mode=block"),
    );

    // Strict-Transport-Security
    headers.insert(
        "Strict-Transport-Security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );

    // Referrer-Policy
    headers.insert(
        "Referrer-Policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );

    // Permissions-Policy
    headers.insert(
        "Permissions-Policy",
        HeaderValue::from_static("geolocation=(), microphone=(), camera=()"),
    );

    // Cache-Control for sensitive endpoints
    headers.insert(
        "Cache-Control",
        HeaderValue::from_static("no-store, no-cache, must-revalidate"),
    );

    response
}

/// Input validation helper for endpoints
pub struct InputValidationHelper {
    validator: Arc<InputValidator>,
}

impl InputValidationHelper {
    /// Create new validation helper
    pub fn new() -> Self {
        Self {
            validator: Arc::new(InputValidator::new(&std::collections::HashMap::new())),
        }
    }

    /// Validate username
    pub async fn validate_username(&self, username: &str) -> Result<(), String> {
        self.validator
            .validate(username, "username")
            .await
            .map_err(|e| e.to_string())
    }

    /// Validate email
    pub async fn validate_email(&self, email: &str) -> Result<(), String> {
        self.validator
            .validate(email, "email")
            .await
            .map_err(|e| e.to_string())
    }

    /// Validate UUID
    pub async fn validate_uuid(&self, uuid: &str) -> Result<(), String> {
        self.validator
            .validate(uuid, "uuid")
            .await
            .map_err(|e| e.to_string())
    }

    /// Validate API key
    pub async fn validate_api_key(&self, api_key: &str) -> Result<(), String> {
        self.validator
            .validate(api_key, "api_key")
            .await
            .map_err(|e| e.to_string())
    }

    /// Validate path
    pub async fn validate_path(&self, path: &str) -> Result<(), String> {
        self.validator
            .validate(path, "path")
            .await
            .map_err(|e| e.to_string())
    }

    /// Validate generic input
    pub async fn validate_generic(&self, input: &str) -> Result<(), String> {
        self.validator
            .validate(input, "generic")
            .await
            .map_err(|e| e.to_string())
    }

    /// Sanitize input
    pub fn sanitize(&self, input: &str) -> String {
        InputValidator::sanitize(input)
    }

    /// Escape HTML
    pub fn escape_html(&self, input: &str) -> String {
        InputValidator::escape_html(input)
    }
}

impl Default for InputValidationHelper {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Method};

    #[test]
    fn test_security_middleware_state_creation() {
        let state = SecurityMiddlewareState::production();
        assert!(state.hardening.config.strict_mode);

        let dev_state = SecurityMiddlewareState::development();
        assert!(!dev_state.hardening.config.strict_mode);
    }

    #[tokio::test]
    async fn test_middleware_enabled_toggle() {
        let state = SecurityMiddlewareState::production();

        assert!(state.is_enabled().await);

        state.set_enabled(false).await;
        assert!(!state.is_enabled().await);

        state.set_enabled(true).await;
        assert!(state.is_enabled().await);
    }

    #[test]
    fn test_client_ip_extraction() {
        use http::Request;

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

        // Test with X-Real-IP
        let request = Request::builder()
            .uri("/test")
            .header("x-real-ip", "10.0.0.2")
            .body(Body::empty())
            .unwrap();
        let ip = get_client_ip(&request);
        assert_eq!(ip, "10.0.0.2");
    }

    #[tokio::test]
    async fn test_input_validation_helper() {
        let helper = InputValidationHelper::new();

        // Valid username
        assert!(helper.validate_username("user123").await.is_ok());

        // Invalid username (too short)
        assert!(helper.validate_username("ab").await.is_err());

        // Valid email
        assert!(helper.validate_email("user@example.com").await.is_ok());

        // Invalid email
        assert!(helper.validate_email("invalid").await.is_err());

        // Valid UUID
        assert!(helper
            .validate_uuid("550e8400-e29b-41d4-a716-446655440000")
            .await
            .is_ok());

        // Sanitize input
        let sanitized = helper.sanitize("hello\x00world");
        assert!(!sanitized.contains('\0'));

        // Escape HTML
        let escaped = helper.escape_html("<script>alert('xss')</script>");
        assert!(escaped.contains("&lt;"));
    }

    #[test]
    fn test_security_headers() {
        use axum::{http::HeaderValue, response::Response};

        let response = Response::new(Body::empty());
        let response = add_security_headers(response);
        let headers = response.headers();

        assert!(headers.get("Content-Security-Policy").is_some());
        assert!(headers.get("X-Content-Type-Options").is_some());
        assert!(headers.get("X-Frame-Options").is_some());
        assert!(headers.get("Strict-Transport-Security").is_some());

        assert_eq!(
            headers.get("X-Content-Type-Options").unwrap(),
            &HeaderValue::from_static("nosniff")
        );

        assert_eq!(
            headers.get("X-Frame-Options").unwrap(),
            &HeaderValue::from_static("DENY")
        );
    }
}
