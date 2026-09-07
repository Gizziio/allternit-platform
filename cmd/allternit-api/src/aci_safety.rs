//! Backend safety policy enforcement for the Agent-Computer Interface (ACI).
//!
//! Mirrors the extension-side `browser-agent/safety/` layer so that a
//! compromised or misconfigured client cannot bypass host allowlisting,
//! sensitive-data masking, or circuit-breaker limits when proxying to the ACU
//! computer-use gateway.

use once_cell::sync::Lazy;
use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Safety mode: disabled, audit-only (log but allow), or enforce (default).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SafetyMode {
    Off,
    Audit,
    Enforce,
}

impl SafetyMode {
    pub fn from_env() -> Self {
        match std::env::var("ALLTERNIT_ACI_SAFETY_MODE")
            .ok()
            .map(|s| s.to_lowercase())
            .as_deref()
        {
            Some("off") | Some("disabled") | Some("false") => SafetyMode::Off,
            Some("audit") | Some("warn") => SafetyMode::Audit,
            _ => SafetyMode::Enforce,
        }
    }

    pub fn is_off(&self) -> bool {
        matches!(self, SafetyMode::Off)
    }
}

/// Kinds of actions that require human handoff instead of autonomous execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SensitiveActionType {
    FormSubmit,
    Payment,
    Captcha,
    IdentityVerification,
    Download,
    FileUpload,
}

impl SensitiveActionType {
    fn detect(goal: &str) -> Vec<Self> {
        let lower = goal.to_lowercase();
        let mut found = Vec::new();
        if lower.contains("captcha") {
            found.push(Self::Captcha);
        }
        if lower.contains("payment") || lower.contains("checkout") || lower.contains("credit card") || lower.contains("billing") {
            found.push(Self::Payment);
        }
        if lower.contains("identity verification") || lower.contains("verify identity") || lower.contains("kyc") || lower.contains("ssn") {
            found.push(Self::IdentityVerification);
        }
        if lower.contains("submit form") || lower.contains("click submit") || lower.contains("confirm order") {
            found.push(Self::FormSubmit);
        }
        if lower.contains("download") && (lower.contains("file") || lower.contains("attachment")) {
            found.push(Self::Download);
        }
        if lower.contains("upload") && (lower.contains("file") || lower.contains("attachment")) {
            found.push(Self::FileUpload);
        }
        found
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::FormSubmit => "form submission",
            Self::Payment => "payment",
            Self::Captcha => "CAPTCHA",
            Self::IdentityVerification => "identity verification",
            Self::Download => "file download",
            Self::FileUpload => "file upload",
        }
    }
}

/// Per-run safety decision returned to the caller.
#[derive(Debug, Serialize)]
pub struct SafetyDecision {
    pub allowed: bool,
    pub sanitized_goal: String,
    pub reason: Option<String>,
    pub handoff_required: bool,
    pub sensitive_actions: Vec<SensitiveActionType>,
}

/// Host allowlist/blocklist policy loaded from environment.
#[derive(Debug, Clone)]
pub struct HostPolicy {
    pub mode: SafetyMode,
    pub allowed_hosts: Vec<String>,
    pub blocked_hosts: Vec<String>,
    pub allowed_patterns: Vec<String>,
}

impl HostPolicy {
    pub fn from_env() -> Self {
        let allowed_hosts = parse_host_list("ALLTERNIT_ACI_ALLOWED_HOSTS");
        let blocked_hosts = parse_host_list("ALLTERNIT_ACI_BLOCKED_HOSTS");
        let allowed_patterns = parse_host_list("ALLTERNIT_ACI_ALLOWED_PATTERNS");
        Self {
            mode: SafetyMode::from_env(),
            allowed_hosts,
            blocked_hosts,
            allowed_patterns,
        }
    }

    pub fn allows(&self, url: &str) -> bool {
        let Some(host) = extract_host(url) else {
            return false;
        };

        if self.blocked_hosts.iter().any(|b| host.eq_ignore_ascii_case(b)) {
            return false;
        }

        if self.mode == SafetyMode::Off || self.allowed_hosts.is_empty() {
            return true;
        }

        if self.allowed_hosts.iter().any(|a| host.eq_ignore_ascii_case(a)) {
            return true;
        }

        if self
            .allowed_patterns
            .iter()
            .any(|p| matches_wildcard(&host, p))
        {
            return true;
        }

        false
    }
}

fn parse_host_list(env_var: &str) -> Vec<String> {
    std::env::var(env_var)
        .ok()
        .map(|s| {
            s.split(',')
                .map(str::trim)
                .filter(|h| !h.is_empty())
                .map(|h| h.to_lowercase())
                .collect()
        })
        .unwrap_or_default()
}

fn extract_host(url: &str) -> Option<String> {
    let url = url.trim();
    // Try to parse as a full URL first.
    if let Ok(parsed) = url::Url::parse(url) {
        return parsed.host_str().map(|h| h.to_lowercase());
    }
    // Fallback: extract a bare hostname or host:port.
    let host = url
        .split_once('/')
        .map(|(h, _)| h)
        .unwrap_or(url)
        .split_once(':')
        .map(|(h, _)| h)
        .unwrap_or(url)
        .to_lowercase();
    if host.is_empty() || !host.contains('.') {
        return None;
    }
    Some(host)
}

fn matches_wildcard(host: &str, pattern: &str) -> bool {
    if pattern.starts_with("*.") {
        let suffix = &pattern[2..];
        return host == suffix || host.ends_with(&format!(".{}", suffix));
    }
    host == pattern
}

/// Mask sensitive tokens, keys, and credentials in the goal text.
pub fn mask_sensitive_data(goal: &str) -> String {
    let mut out = goal.to_string();

    // API keys / bearer tokens / secrets.
    static KEY_RE: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r#"(?i)\b(?:api[_-]?key|apikey|secret|token|password|passwd|pwd)\s*[:=]\s*['"]?([A-Za-z0-9_\-./+=]{8,})['"]?"#).unwrap()
    });
    out = KEY_RE
        .replace_all(&out, |caps: &regex::Captures| {
            let key = &caps[1];
            let masked = if key.len() > 8 {
                format!("{}...{}", &key[..4], &key[key.len() - 4..])
            } else {
                "***".to_string()
            };
            caps[0].replace(&caps[1], &masked)
        })
        .into_owned();

    // Credit card numbers.
    static CC_RE: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b").unwrap());
    out = CC_RE.replace_all(&out, "[CREDIT-CARD-REDACTED]").into_owned();

    // SSN-like patterns.
    static SSN_RE: Lazy<Regex> =
        Lazy::new(|| Regex::new(r"\b\d{3}[\s\-]\d{2}[\s\-]\d{4}\b").unwrap());
    out = SSN_RE.replace_all(&out, "[SSN-REDACTED]").into_owned();

    out
}

/// Extract likely URLs from the goal text.
pub fn extract_urls(text: &str) -> Vec<String> {
    static URL_RE: Lazy<Regex> = Lazy::new(|| {
        Regex::new(r#"https?://[^\s<>"{}|\\^`\[\]]+|(?:[a-zA-Z0-9][a-zA-Z0-9\-]{1,63}\.)+[a-zA-Z]{2,}(?::\d+)?(?:/[^\s<>"{}|\\^`\[\]]*)?"#).unwrap()
    });
    URL_RE
        .find_iter(text)
        .map(|m| m.as_str().to_string())
        .collect()
}

// ─── Circuit-breaker / rate-limit state ─────────────────────────────────────

#[derive(Debug, Default)]
struct WindowState {
    actions: Vec<Instant>,
    consecutive_errors: u32,
    cooldown_until: Option<Instant>,
}

/// In-memory rate limiter keyed by organization/user id.
pub struct CircuitBreaker {
    max_per_minute: u32,
    max_per_hour: u32,
    cooldown_after_burst_ms: u64,
    cooldown_after_errors_ms: u64,
    consecutive_error_threshold: u32,
    state: Mutex<HashMap<String, WindowState>>,
}

impl CircuitBreaker {
    pub fn from_env() -> Self {
        Self {
            max_per_minute: env_u32("ALLTERNIT_ACI_MAX_ACTIONS_PER_MINUTE", 30),
            max_per_hour: env_u32("ALLTERNIT_ACI_MAX_ACTIONS_PER_HOUR", 300),
            cooldown_after_burst_ms: env_u64("ALLTERNIT_ACI_BURST_COOLDOWN_MS", 5000),
            cooldown_after_errors_ms: env_u64("ALLTERNIT_ACI_ERROR_COOLDOWN_MS", 10000),
            consecutive_error_threshold: env_u32("ALLTERNIT_ACI_ERROR_THRESHOLD", 5),
            state: Mutex::new(HashMap::new()),
        }
    }

    pub fn check(&self, key: &str) -> Result<(), String> {
        let mut store = self.state.lock().unwrap();
        let entry = store.entry(key.to_string()).or_default();
        let now = Instant::now();

        // Prune old actions.
        let one_minute_ago = now - Duration::from_secs(60);
        let one_hour_ago = now - Duration::from_secs(3600);
        entry.actions.retain(|t| *t > one_hour_ago);

        // Check cooldown.
        if let Some(until) = entry.cooldown_until {
            if now < until {
                let wait = (until - now).as_secs();
                return Err(format!("rate limited: cooldown for {} more seconds", wait));
            }
            entry.cooldown_until = None;
        }

        // Enforce limits.
        let last_minute = entry.actions.iter().filter(|t| **t > one_minute_ago).count();
        if last_minute >= self.max_per_minute as usize {
            entry.cooldown_until = Some(now + Duration::from_millis(self.cooldown_after_burst_ms));
            return Err(format!(
                "rate limit exceeded: {} actions per minute",
                self.max_per_minute
            ));
        }
        let last_hour = entry.actions.len();
        if last_hour >= self.max_per_hour as usize {
            return Err(format!(
                "rate limit exceeded: {} actions per hour",
                self.max_per_hour
            ));
        }

        entry.actions.push(now);
        Ok(())
    }

    pub fn record_error(&self, key: &str) {
        let mut store = self.state.lock().unwrap();
        let entry = store.entry(key.to_string()).or_default();
        entry.consecutive_errors += 1;
        if entry.consecutive_errors >= self.consecutive_error_threshold {
            entry.cooldown_until =
                Some(Instant::now() + Duration::from_millis(self.cooldown_after_errors_ms));
            entry.consecutive_errors = 0;
        }
    }

    pub fn record_success(&self, key: &str) {
        let mut store = self.state.lock().unwrap();
        if let Some(entry) = store.get_mut(key) {
            entry.consecutive_errors = 0;
        }
    }
}

fn env_u32(name: &str, default: u32) -> u32 {
    std::env::var(name)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(default)
}

// ─── Global enforcer ────────────────────────────────────────────────────────

static HOST_POLICY: Lazy<HostPolicy> = Lazy::new(HostPolicy::from_env);
static BREAKER: Lazy<CircuitBreaker> = Lazy::new(CircuitBreaker::from_env);

/// Evaluate an ACI run request against the backend safety policy.
///
/// `actor_key` should uniquely identify the caller (e.g. `org_id:user_id`).
pub fn evaluate_request(goal: &str, actor_key: &str) -> SafetyDecision {
    let mode = HOST_POLICY.mode;
    let sanitized_goal = mask_sensitive_data(goal);
    let sensitive_actions = SensitiveActionType::detect(goal);
    let handoff_required = !sensitive_actions.is_empty();

    if handoff_required && mode == SafetyMode::Enforce {
        return SafetyDecision {
            allowed: false,
            sanitized_goal,
            reason: Some(format!(
                "human handoff required for: {}",
                sensitive_actions
                    .iter()
                    .map(|a| a.label())
                    .collect::<Vec<_>>()
                    .join(", ")
            )),
            handoff_required: true,
            sensitive_actions,
        };
    }

    if handoff_required && mode == SafetyMode::Audit {
        tracing::warn!(
            actor = %actor_key,
            actions = ?sensitive_actions,
            "aci safety: sensitive action detected in audit mode"
        );
    }

    // Rate limit check.
    if let Err(reason) = BREAKER.check(actor_key) {
        if mode == SafetyMode::Enforce {
            return SafetyDecision {
                allowed: false,
                sanitized_goal,
                reason: Some(reason),
                handoff_required: false,
                sensitive_actions: Vec::new(),
            };
        }
        tracing::warn!(actor = %actor_key, %reason, "aci safety: rate limit breached");
    }

    // Host allowlist check.
    if mode != SafetyMode::Off {
        let urls = extract_urls(goal);
        for url in &urls {
            if !HOST_POLICY.allows(url) {
                let reason = format!("host not allowed: {}", url);
                if mode == SafetyMode::Enforce {
                    return SafetyDecision {
                        allowed: false,
                        sanitized_goal,
                        reason: Some(reason),
                        handoff_required: false,
                        sensitive_actions: Vec::new(),
                    };
                }
                tracing::warn!(actor = %actor_key, url = %url, "aci safety: blocked host in audit mode");
            }
        }
    }

    SafetyDecision {
        allowed: true,
        sanitized_goal,
        reason: None,
        handoff_required: false,
        sensitive_actions: Vec::new(),
    }
}

pub fn record_aci_error(actor_key: &str) {
    BREAKER.record_error(actor_key);
}

pub fn record_aci_success(actor_key: &str) {
    BREAKER.record_success(actor_key);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_sensitive_data() {
        let goal = "log in with api_key=sk_test_1234567890abcdef and ssn 123-45-6789";
        let masked = mask_sensitive_data(goal);
        assert!(!masked.contains("sk_test_1234567890abcdef"));
        assert!(masked.contains("[SSN-REDACTED]"));
        assert!(masked.contains("api_key="));
    }

    #[test]
    fn test_extract_urls() {
        let text = "go to https://example.com/path and also checkout github.com/allternit";
        let urls = extract_urls(text);
        assert!(urls.iter().any(|u| u.contains("example.com")));
        assert!(urls.iter().any(|u| u.contains("github.com")));
    }

    #[test]
    fn test_host_policy_allows() {
        let policy = HostPolicy {
            mode: SafetyMode::Enforce,
            allowed_hosts: vec!["example.com".to_string()],
            blocked_hosts: vec!["evil.com".to_string()],
            allowed_patterns: vec!["*.safe.com".to_string()],
        };
        assert!(policy.allows("https://example.com/foo"));
        assert!(policy.allows("https://app.safe.com/bar"));
        assert!(!policy.allows("https://evil.com"));
        assert!(!policy.allows("https://other.com"));
    }

    #[test]
    fn test_circuit_breaker_limits() {
        let breaker = CircuitBreaker {
            max_per_minute: 2,
            max_per_hour: 10,
            cooldown_after_burst_ms: 10,
            cooldown_after_errors_ms: 10,
            consecutive_error_threshold: 2,
            state: Mutex::new(HashMap::new()),
        };
        let key = "org:user";
        assert!(breaker.check(key).is_ok());
        assert!(breaker.check(key).is_ok());
        assert!(breaker.check(key).is_err());
    }
}
