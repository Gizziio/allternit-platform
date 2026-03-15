//! Security Headers Module
//!
//! Provides security headers for HTTP responses according to OWASP recommendations.

use axum::{
    body::Body,
    http::{header, HeaderValue, Response},
};

use tower_http::set_header::SetResponseHeaderLayer;

/// Security headers configuration
#[derive(Debug, Clone)]
pub struct SecurityHeaders {
    pub content_security_policy: String,
    pub x_frame_options: String,
    pub x_content_type_options: String,
    pub strict_transport_security: String,
    pub x_xss_protection: String,
    pub referrer_policy: String,
    pub permissions_policy: String,
}

impl Default for SecurityHeaders {
    fn default() -> Self {
        Self {
            content_security_policy: concat!(
                "default-src 'self'; ",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'; ",
                "style-src 'self' 'unsafe-inline'; ",
                "img-src 'self' data: blob: https:; ",
                "font-src 'self' data:; ",
                "connect-src 'self' ws: wss:; ",
                "frame-ancestors 'none'; ",
                "base-uri 'self'; ",
                "form-action 'self';"
            )
            .to_string(),
            x_frame_options: "DENY".to_string(),
            x_content_type_options: "nosniff".to_string(),
            strict_transport_security: "max-age=31536000; includeSubDomains; preload".to_string(),
            x_xss_protection: "1; mode=block".to_string(),
            referrer_policy: "strict-origin-when-cross-origin".to_string(),
            permissions_policy: concat!(
                "accelerometer=(), ",
                "camera=(), ",
                "geolocation=(), ",
                "gyroscope=(), ",
                "magnetometer=(), ",
                "microphone=(), ",
                "payment=(), ",
                "usb=()"
            )
            .to_string(),
        }
    }
}

impl SecurityHeaders {
    /// Create with permissive CSP for development
    pub fn development() -> Self {
        Self {
            content_security_policy: "default-src * 'unsafe-inline' 'unsafe-eval'".to_string(),
            ..Default::default()
        }
    }

    /// Create with strict CSP for production
    pub fn production() -> Self {
        Self::default()
    }
}

/// Add security headers to response
pub fn add_security_headers(response: &mut Response<Body>) {
    let headers = SecurityHeaders::default();

    // Content Security Policy
    if let Ok(value) = HeaderValue::from_str(&headers.content_security_policy) {
        response
            .headers_mut()
            .insert(header::CONTENT_SECURITY_POLICY, value);
    }

    // X-Frame-Options
    if let Ok(value) = HeaderValue::from_str(&headers.x_frame_options) {
        response
            .headers_mut()
            .insert(header::X_FRAME_OPTIONS, value);
    }

    // X-Content-Type-Options
    if let Ok(value) = HeaderValue::from_str(&headers.x_content_type_options) {
        response
            .headers_mut()
            .insert(header::X_CONTENT_TYPE_OPTIONS, value);
    }

    // Strict-Transport-Security
    if let Ok(value) = HeaderValue::from_str(&headers.strict_transport_security) {
        response
            .headers_mut()
            .insert(header::STRICT_TRANSPORT_SECURITY, value);
    }

    // X-XSS-Protection
    if let Ok(value) = HeaderValue::from_str(&headers.x_xss_protection) {
        response
            .headers_mut()
            .insert(header::HeaderName::from_static("x-xss-protection"), value);
    }

    // Referrer-Policy
    if let Ok(value) = HeaderValue::from_str(&headers.referrer_policy) {
        response
            .headers_mut()
            .insert(header::HeaderName::from_static("referrer-policy"), value);
    }

    // Permissions-Policy
    if let Ok(value) = HeaderValue::from_str(&headers.permissions_policy) {
        response
            .headers_mut()
            .insert(header::HeaderName::from_static("permissions-policy"), value);
    }
}

/// Create security headers middleware layer
pub fn create_security_headers_layer() -> SetResponseHeaderLayer<HeaderValue> {
    // Return a simple header layer for the most critical header
    tower_http::set_header::SetResponseHeaderLayer::if_not_present(
        header::X_FRAME_OPTIONS,
        HeaderValue::from_static("DENY"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_security_headers() {
        let headers = SecurityHeaders::default();
        assert!(headers.content_security_policy.contains("default-src"));
        assert_eq!(headers.x_frame_options, "DENY");
        assert_eq!(headers.x_content_type_options, "nosniff");
    }

    #[test]
    fn test_development_headers() {
        let headers = SecurityHeaders::development();
        assert!(headers.content_security_policy.contains("unsafe-inline"));
    }

    #[test]
    fn test_add_security_headers() {
        let mut response = Response::builder().status(200).body(Body::empty()).unwrap();

        add_security_headers(&mut response);

        assert!(response
            .headers()
            .contains_key(header::CONTENT_SECURITY_POLICY));
        assert!(response.headers().contains_key(header::X_FRAME_OPTIONS));
        assert!(response
            .headers()
            .contains_key(header::X_CONTENT_TYPE_OPTIONS));
    }
}
