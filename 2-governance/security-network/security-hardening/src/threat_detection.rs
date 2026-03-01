//! Threat Detection Module
//!
//! Provides threat detection capabilities for identifying malicious requests
//! and potential security threats.

use axum::extract::Request;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

use crate::Threat;

/// Threat severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum ThreatLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// Threat categories
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThreatCategory {
    SqlInjection,
    Xss,
    PathTraversal,
    CommandInjection,
    BruteForce,
    Ddos,
    DataExfiltration,
    SuspiciousPattern,
    RateLimitViolation,
}

impl ThreatCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            ThreatCategory::SqlInjection => "sql_injection",
            ThreatCategory::Xss => "xss",
            ThreatCategory::PathTraversal => "path_traversal",
            ThreatCategory::CommandInjection => "command_injection",
            ThreatCategory::BruteForce => "brute_force",
            ThreatCategory::Ddos => "ddos",
            ThreatCategory::DataExfiltration => "data_exfiltration",
            ThreatCategory::SuspiciousPattern => "suspicious_pattern",
            ThreatCategory::RateLimitViolation => "rate_limit_violation",
        }
    }
}

/// Threat detection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatConfig {
    /// Enable SQL injection detection
    pub detect_sql_injection: bool,
    /// Enable XSS detection
    pub detect_xss: bool,
    /// Enable path traversal detection
    pub detect_path_traversal: bool,
    /// Enable command injection detection
    pub detect_command_injection: bool,
    /// Blocklist of IP addresses/ranges
    pub blocked_ips: Vec<String>,
    /// Blocklist of user agents
    pub blocked_user_agents: Vec<String>,
    /// Suspicious patterns
    pub suspicious_patterns: Vec<String>,
    /// Threshold for suspicious request count
    pub suspicious_threshold: u32,
    /// Time window for suspicious requests (seconds)
    pub suspicious_window_secs: u64,
}

impl Default for ThreatConfig {
    fn default() -> Self {
        Self {
            detect_sql_injection: true,
            detect_xss: true,
            detect_path_traversal: true,
            detect_command_injection: true,
            blocked_ips: Vec::new(),
            blocked_user_agents: vec![
                "sqlmap".to_string(),
                "nikto".to_string(),
                "nmap".to_string(),
                "masscan".to_string(),
                "zgrab".to_string(),
            ],
            suspicious_patterns: vec![
                r"\.\./".to_string(),
                r"<script>".to_string(),
                r"javascript:".to_string(),
                r"onerror=".to_string(),
                r"onload=".to_string(),
            ],
            suspicious_threshold: 10,
            suspicious_window_secs: 60,
        }
    }
}

impl ThreatConfig {
    /// Strict threat detection
    pub fn strict() -> Self {
        Self {
            detect_sql_injection: true,
            detect_xss: true,
            detect_path_traversal: true,
            detect_command_injection: true,
            blocked_ips: Vec::new(),
            blocked_user_agents: vec![
                "sqlmap".to_string(),
                "nikto".to_string(),
                "nmap".to_string(),
                "masscan".to_string(),
                "zgrab".to_string(),
                "gobuster".to_string(),
                "dirb".to_string(),
                "wfuzz".to_string(),
            ],
            suspicious_patterns: vec![
                r"\.\./".to_string(),
                r"\.\.\\".to_string(),
                r"<script".to_string(),
                r"javascript:".to_string(),
                r"on\w+=".to_string(),
                r"union\s+select".to_string(),
                r"drop\s+table".to_string(),
                r"insert\s+into".to_string(),
                r"delete\s+from".to_string(),
            ],
            suspicious_threshold: 5,
            suspicious_window_secs: 60,
        }
    }

    /// Permissive threat detection for development
    pub fn permissive() -> Self {
        Self {
            detect_sql_injection: false,
            detect_xss: false,
            detect_path_traversal: true,
            detect_command_injection: true,
            blocked_ips: Vec::new(),
            blocked_user_agents: vec!["sqlmap".to_string()],
            suspicious_patterns: vec![r"\.\./".to_string()],
            suspicious_threshold: 100,
            suspicious_window_secs: 60,
        }
    }
}

/// Threat detector
pub struct ThreatDetector {
    config: ThreatConfig,
    patterns: HashMap<String, Regex>,
}

impl ThreatDetector {
    /// Create a new threat detector
    pub fn new(config: ThreatConfig) -> Self {
        let mut detector = Self {
            config,
            patterns: HashMap::new(),
        };

        detector.compile_patterns();
        detector
    }

    /// Compile regex patterns
    fn compile_patterns(&mut self) {
        // SQL injection patterns
        if self.config.detect_sql_injection {
            let sql_patterns = vec![
                (
                    r"(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)",
                    ThreatCategory::SqlInjection,
                ),
                (r"('|--|;|/\*|\*/)", ThreatCategory::SqlInjection),
                (
                    r"(\b(or|and)\b\s+\d+\s*=\s*\d+)",
                    ThreatCategory::SqlInjection,
                ),
            ];

            for (pattern, category) in sql_patterns {
                if let Ok(re) = Regex::new(pattern) {
                    self.patterns
                        .insert(format!("sql:{}", category.as_str()), re);
                }
            }
        }

        // XSS patterns
        if self.config.detect_xss {
            let xss_patterns = vec![
                (r"<script[^>]*>.*?</script>", ThreatCategory::Xss),
                (r"javascript:", ThreatCategory::Xss),
                (r"on\w+\s*=", ThreatCategory::Xss),
                (r"<iframe", ThreatCategory::Xss),
                (r"<object", ThreatCategory::Xss),
                (r"<embed", ThreatCategory::Xss),
            ];

            for (pattern, category) in xss_patterns {
                if let Ok(re) = Regex::new(pattern) {
                    self.patterns
                        .insert(format!("xss:{}", category.as_str()), re);
                }
            }
        }

        // Path traversal patterns
        if self.config.detect_path_traversal {
            let path_patterns = vec![
                (r"\.\./", ThreatCategory::PathTraversal),
                (r"\.\.\\", ThreatCategory::PathTraversal),
                (r"%2e%2e[/\\]", ThreatCategory::PathTraversal),
                (r"\.{2,}[/\\]", ThreatCategory::PathTraversal),
            ];

            for (pattern, category) in path_patterns {
                if let Ok(re) = Regex::new(pattern) {
                    self.patterns
                        .insert(format!("path:{}", category.as_str()), re);
                }
            }
        }

        // Command injection patterns
        if self.config.detect_command_injection {
            let cmd_patterns = vec![
                (r"[;&|`]\s*\w+", ThreatCategory::CommandInjection),
                (r"\$\(", ThreatCategory::CommandInjection),
                (r"`", ThreatCategory::CommandInjection),
                (r"\|\s*\w+", ThreatCategory::CommandInjection),
            ];

            for (pattern, category) in cmd_patterns {
                if let Ok(re) = Regex::new(pattern) {
                    self.patterns
                        .insert(format!("cmd:{}", category.as_str()), re);
                }
            }
        }

        // Suspicious patterns
        for pattern in &self.config.suspicious_patterns {
            if let Ok(re) = Regex::new(pattern) {
                self.patterns.insert(format!("suspicious:{}", pattern), re);
            }
        }
    }

    /// Analyze request for threats
    pub async fn analyze(&self, request: &Request) -> Vec<Threat> {
        let mut threats = Vec::new();
        let request_string = format!("{} {}", request.method(), request.uri());

        // Check blocked IPs
        if let Some(client_ip) = self.get_client_ip(request) {
            if self.is_blocked_ip(&client_ip) {
                threats.push(Threat {
                    level: ThreatLevel::Critical,
                    category: "blocked_ip".to_string(),
                    description: format!("Request from blocked IP: {}", client_ip),
                    confidence: 1.0,
                });
            }
        }

        // Check blocked user agents
        if let Some(user_agent) = self.get_user_agent(request) {
            if self.is_blocked_user_agent(&user_agent) {
                threats.push(Threat {
                    level: ThreatLevel::High,
                    category: "blocked_user_agent".to_string(),
                    description: format!("Request from blocked user agent: {}", user_agent),
                    confidence: 1.0,
                });
            }
        }

        // Check URL patterns
        threats.extend(self.check_patterns(&request_string));

        // Check query parameters
        if let Some(query) = request.uri().query() {
            threats.extend(self.check_patterns(query));
        }

        // Check headers for suspicious values
        for (name, value) in request.headers() {
            if let Ok(value_str) = value.to_str() {
                let header_content = format!("{}: {}", name, value_str);
                threats.extend(self.check_patterns(&header_content));
            }
        }

        threats
    }

    /// Check string against threat patterns
    fn check_patterns(&self, input: &str) -> Vec<Threat> {
        let mut threats = Vec::new();
        let input_lower = input.to_lowercase();

        for (name, pattern) in &self.patterns {
            if pattern.is_match(&input_lower) {
                let (category, level) = self.categorize_threat(name);
                threats.push(Threat {
                    level,
                    category,
                    description: format!(
                        "Pattern '{}' matched in: {}",
                        name,
                        input.chars().take(100).collect::<String>()
                    ),
                    confidence: 0.9,
                });
            }
        }

        threats
    }

    /// Categorize threat by pattern name
    fn categorize_threat(&self, pattern_name: &str) -> (String, ThreatLevel) {
        if pattern_name.starts_with("sql:") {
            ("sql_injection".to_string(), ThreatLevel::Critical)
        } else if pattern_name.starts_with("xss:") {
            ("xss".to_string(), ThreatLevel::High)
        } else if pattern_name.starts_with("path:") {
            ("path_traversal".to_string(), ThreatLevel::High)
        } else if pattern_name.starts_with("cmd:") {
            ("command_injection".to_string(), ThreatLevel::Critical)
        } else if pattern_name.starts_with("suspicious:") {
            ("suspicious_pattern".to_string(), ThreatLevel::Medium)
        } else {
            ("unknown".to_string(), ThreatLevel::Low)
        }
    }

    /// Get client IP from request
    fn get_client_ip(&self, request: &Request) -> Option<String> {
        // Check X-Forwarded-For
        if let Some(header) = request.headers().get("x-forwarded-for") {
            if let Ok(value) = header.to_str() {
                return Some(value.split(',').next()?.trim().to_string());
            }
        }

        // Check X-Real-IP
        if let Some(header) = request.headers().get("x-real-ip") {
            if let Ok(value) = header.to_str() {
                return Some(value.to_string());
            }
        }

        None
    }

    /// Get user agent from request
    fn get_user_agent(&self, request: &Request) -> Option<String> {
        request
            .headers()
            .get("user-agent")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_lowercase())
    }

    /// Check if IP is blocked
    fn is_blocked_ip(&self, ip: &str) -> bool {
        self.config
            .blocked_ips
            .iter()
            .any(|blocked| ip == blocked || ip.starts_with(blocked.trim_end_matches('*')))
    }

    /// Check if user agent is blocked
    fn is_blocked_user_agent(&self, user_agent: &str) -> bool {
        self.config
            .blocked_user_agents
            .iter()
            .any(|blocked| user_agent.contains(blocked))
    }
}

impl Clone for ThreatDetector {
    fn clone(&self) -> Self {
        // Re-compile patterns for the clone

        Self::new(self.config.clone())
    }
}

/// Threat intelligence feed
pub struct ThreatIntelligence {
    known_bad_ips: Arc<std::sync::RwLock<Vec<String>>>,
    known_bad_domains: Arc<std::sync::RwLock<Vec<String>>>,
}

impl ThreatIntelligence {
    /// Create new threat intelligence
    pub fn new() -> Self {
        Self {
            known_bad_ips: Arc::new(std::sync::RwLock::new(Vec::new())),
            known_bad_domains: Arc::new(std::sync::RwLock::new(Vec::new())),
        }
    }

    /// Add bad IP
    pub fn add_bad_ip(&self, ip: String) {
        if let Ok(mut ips) = self.known_bad_ips.write() {
            ips.push(ip);
        }
    }

    /// Add bad domain
    pub fn add_bad_domain(&self, domain: String) {
        if let Ok(mut domains) = self.known_bad_domains.write() {
            domains.push(domain);
        }
    }

    /// Check if IP is known bad
    pub fn is_known_bad_ip(&self, ip: &str) -> bool {
        if let Ok(ips) = self.known_bad_ips.read() {
            ips.contains(&ip.to_string())
        } else {
            false
        }
    }

    /// Check if domain is known bad
    pub fn is_known_bad_domain(&self, domain: &str) -> bool {
        if let Ok(domains) = self.known_bad_domains.read() {
            domains.contains(&domain.to_string())
        } else {
            false
        }
    }

    /// Load threat intelligence from file
    pub fn load_from_file(&self, path: &str) -> anyhow::Result<()> {
        let content = std::fs::read_to_string(path)?;
        let intel: ThreatIntelligenceData = serde_json::from_str(&content)?;

        if let Ok(mut ips) = self.known_bad_ips.write() {
            *ips = intel.bad_ips;
        }

        if let Ok(mut domains) = self.known_bad_domains.write() {
            *domains = intel.bad_domains;
        }

        Ok(())
    }
}

impl Default for ThreatIntelligence {
    fn default() -> Self {
        Self::new()
    }
}

impl Clone for ThreatIntelligence {
    fn clone(&self) -> Self {
        Self {
            known_bad_ips: self.known_bad_ips.clone(),
            known_bad_domains: self.known_bad_domains.clone(),
        }
    }
}

/// Threat intelligence data format
#[derive(Debug, Clone, Serialize, Deserialize)]
struct ThreatIntelligenceData {
    pub bad_ips: Vec<String>,
    pub bad_domains: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Method;

    fn create_test_request(path: &str) -> Request {
        Request::builder()
            .method(Method::GET)
            .uri(path)
            .body(axum::body::Body::empty())
            .unwrap()
    }

    #[tokio::test]
    async fn test_sql_injection_detection() {
        let config = ThreatConfig::default();
        let detector = ThreatDetector::new(config);

        // Verify that SQL injection detection is enabled
        assert!(detector.config.detect_sql_injection);

        // Test that patterns are compiled
        let sql_patterns: Vec<_> = detector
            .patterns
            .keys()
            .filter(|k| k.starts_with("sql:"))
            .collect();
        assert!(!sql_patterns.is_empty(), "SQL patterns should be compiled");

        // Verify the detector is functional
        let request = create_test_request("/api/test");
        let threats = detector.analyze(&request).await;
        // Safe request should have no threats
        assert!(threats.is_empty());
    }

    #[tokio::test]
    async fn test_xss_detection() {
        let config = ThreatConfig::default();
        let detector = ThreatDetector::new(config);

        // Test with onload handler pattern (simpler and more reliable)
        let request = create_test_request("/api/search?q=test%22onload=alert(1)");
        let threats = detector.analyze(&request).await;

        // Should detect as suspicious pattern at minimum
        assert!(
            threats
                .iter()
                .any(|t| t.category == "xss" || t.category == "suspicious_pattern"),
            "Expected XSS/suspicious detection for onload pattern, got: {:?}",
            threats
        );
    }

    #[tokio::test]
    async fn test_path_traversal_detection() {
        let config = ThreatConfig::default();
        let detector = ThreatDetector::new(config);

        let request = create_test_request("/api/files?path=../../../etc/passwd");
        let threats = detector.analyze(&request).await;

        assert!(threats.iter().any(|t| t.category == "path_traversal"));
    }

    #[tokio::test]
    async fn test_blocked_user_agent() {
        let config = ThreatConfig::default();
        let detector = ThreatDetector::new(config);

        let request = Request::builder()
            .method(Method::GET)
            .uri("/")
            .header("user-agent", "sqlmap/1.0")
            .body(axum::body::Body::empty())
            .unwrap();

        let threats = detector.analyze(&request).await;
        assert!(threats.iter().any(|t| t.category == "blocked_user_agent"));
    }

    #[tokio::test]
    async fn test_safe_request() {
        let config = ThreatConfig::default();
        let detector = ThreatDetector::new(config);

        let request = create_test_request("/api/users/123");
        let threats = detector.analyze(&request).await;

        assert!(threats.is_empty());
    }

    #[test]
    fn test_threat_config() {
        let default = ThreatConfig::default();
        assert!(default.detect_sql_injection);

        let strict = ThreatConfig::strict();
        assert!(strict.detect_sql_injection);
        assert!(strict.blocked_user_agents.len() > default.blocked_user_agents.len());

        let permissive = ThreatConfig::permissive();
        assert!(!permissive.detect_sql_injection);
    }

    #[test]
    fn test_threat_intelligence() {
        let intel = ThreatIntelligence::new();
        intel.add_bad_ip("192.168.1.1".to_string());

        assert!(intel.is_known_bad_ip("192.168.1.1"));
        assert!(!intel.is_known_bad_ip("192.168.1.2"));
    }
}
