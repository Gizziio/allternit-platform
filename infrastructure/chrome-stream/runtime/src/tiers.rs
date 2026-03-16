//! Browser Policy Tier Gating (P5.1.3)
//!
//! Tier-based restrictions on browser automation capabilities

use crate::BrowserAction;
use serde::{Deserialize, Serialize};

/// Browser policy tiers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BrowserPolicyTier {
    /// Minimal - only navigation and basic observation
    Minimal,
    /// Standard - navigation, clicking, typing, screenshots
    Standard,
    /// Extended - includes JavaScript execution, form submission
    Extended,
    /// Research - full automation including file downloads
    Research,
}

impl BrowserPolicyTier {
    /// Get default allowed hosts for tier
    pub fn default_allowed_hosts(&self) -> Vec<String> {
        match self {
            BrowserPolicyTier::Minimal => vec![
                "docs.a2r.systems".to_string(),
            ],
            BrowserPolicyTier::Standard => vec![
                "*.a2r.systems".to_string(),
                "*.github.com".to_string(),
                "*.stackoverflow.com".to_string(),
                "docs.rs".to_string(),
            ],
            BrowserPolicyTier::Extended => vec![
                "*.a2r.systems".to_string(),
                "*.github.com".to_string(),
                "*.stackoverflow.com".to_string(),
                "docs.rs".to_string(),
                "crates.io".to_string(),
            ],
            BrowserPolicyTier::Research => vec![
                "*".to_string(), // Allow all with additional safeguards
            ],
        }
    }

    /// Get default allowed paths for tier
    pub fn default_allowed_paths(&self) -> Vec<String> {
        match self {
            BrowserPolicyTier::Minimal => vec![
                "/docs".to_string(),
                "/api".to_string(),
            ],
            BrowserPolicyTier::Standard => vec![
                "/".to_string(),
            ],
            BrowserPolicyTier::Extended => vec![
                "/".to_string(),
            ],
            BrowserPolicyTier::Research => vec![
                "/".to_string(),
            ],
        }
    }

    /// Check if action is allowed in this tier
    pub fn allows_action(&self, action: &BrowserAction) -> bool {
        match self {
            BrowserPolicyTier::Minimal => matches!(
                action,
                BrowserAction::Navigate { .. } |
                BrowserAction::Wait { .. } |
                BrowserAction::Screenshot
            ),
            BrowserPolicyTier::Standard => matches!(
                action,
                BrowserAction::Navigate { .. } |
                BrowserAction::Click { .. } |
                BrowserAction::Type { .. } |
                BrowserAction::Wait { .. } |
                BrowserAction::Screenshot |
                BrowserAction::Extract { .. } |
                BrowserAction::Scroll { .. }
            ),
            BrowserPolicyTier::Extended => matches!(
                action,
                BrowserAction::Navigate { .. } |
                BrowserAction::Click { .. } |
                BrowserAction::Type { .. } |
                BrowserAction::Wait { .. } |
                BrowserAction::Screenshot |
                BrowserAction::Extract { .. } |
                BrowserAction::Scroll { .. } |
                BrowserAction::ExecuteJs { .. }
            ),
            BrowserPolicyTier::Research => true, // All actions allowed
        }
    }

    /// Get tier name
    pub fn name(&self) -> &'static str {
        match self {
            BrowserPolicyTier::Minimal => "minimal",
            BrowserPolicyTier::Standard => "standard",
            BrowserPolicyTier::Extended => "extended",
            BrowserPolicyTier::Research => "research",
        }
    }
}

impl Default for BrowserPolicyTier {
    fn default() -> Self {
        BrowserPolicyTier::Standard
    }
}

/// Tier enforcer
pub struct TierEnforcer;

impl TierEnforcer {
    /// Create new tier enforcer
    pub fn new() -> Self {
        Self
    }

    /// Check if action is allowed by tier
    pub fn check_action(&self, tier: &BrowserPolicyTier, action: &BrowserAction) -> Result<(), String> {
        if tier.allows_action(action) {
            Ok(())
        } else {
            Err(format!(
                "Action {:?} not allowed in tier {:?}",
                action, tier
            ))
        }
    }

    /// Get list of allowed actions for tier
    pub fn get_allowed_actions(&self, tier: &BrowserPolicyTier) -> Vec<&'static str> {
        match tier {
            BrowserPolicyTier::Minimal => vec![
                "navigate", "wait", "screenshot"
            ],
            BrowserPolicyTier::Standard => vec![
                "navigate", "click", "type", "wait", "screenshot", "extract", "scroll"
            ],
            BrowserPolicyTier::Extended => vec![
                "navigate", "click", "type", "wait", "screenshot", "extract", "scroll", "execute_js"
            ],
            BrowserPolicyTier::Research => vec![
                "navigate", "click", "type", "wait", "screenshot", "extract", "scroll", "execute_js"
            ],
        }
    }

    /// Check if tier can access URL
    pub fn can_access_url(&self, tier: &BrowserPolicyTier, url: &str) -> bool {
        let allowed_hosts = tier.default_allowed_hosts();

        // Research tier with wildcard needs special handling
        if matches!(tier, BrowserPolicyTier::Research) && allowed_hosts.contains(&"*".to_string()) {
            // Still check for obviously dangerous patterns
            if is_dangerous_url(url) {
                return false;
            }
            return true;
        }

        // Parse URL
        let parsed = match url::Url::parse(url) {
            Ok(u) => u,
            Err(_) => return false,
        };

        let host = parsed.host_str().unwrap_or("");

        // Check against allowlist
        allowed_hosts.iter().any(|allowed| {
            if allowed.starts_with("*.") {
                host.ends_with(&allowed[2..])
            } else {
                host == allowed
            }
        })
    }
}

impl Default for TierEnforcer {
    fn default() -> Self {
        Self::new()
    }
}

/// Check if URL is dangerous
fn is_dangerous_url(url: &str) -> bool {
    let dangerous_patterns = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "file://",
        "data:text/html",
    ];

    dangerous_patterns.iter().any(|pattern| url.contains(pattern))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ScrollDirection;

    #[test]
    fn test_minimal_tier_restrictions() {
        let tier = BrowserPolicyTier::Minimal;

        assert!(tier.allows_action(&BrowserAction::Navigate { url: "test".to_string() }));
        assert!(tier.allows_action(&BrowserAction::Wait { duration_ms: 100 }));
        assert!(tier.allows_action(&BrowserAction::Screenshot));

        assert!(!tier.allows_action(&BrowserAction::Click { selector: "#btn".to_string() }));
        assert!(!tier.allows_action(&BrowserAction::Type { selector: "#in".to_string(), text: "x".to_string() }));
        assert!(!tier.allows_action(&BrowserAction::ExecuteJs { script: "" .to_string() }));
    }

    #[test]
    fn test_standard_tier_restrictions() {
        let tier = BrowserPolicyTier::Standard;

        assert!(tier.allows_action(&BrowserAction::Navigate { url: "test".to_string() }));
        assert!(tier.allows_action(&BrowserAction::Click { selector: "#btn".to_string() }));
        assert!(tier.allows_action(&BrowserAction::Type { selector: "#in".to_string(), text: "x".to_string() }));
        assert!(tier.allows_action(&BrowserAction::Scroll { direction: ScrollDirection::Down, amount: 100 }));

        assert!(!tier.allows_action(&BrowserAction::ExecuteJs { script: "" .to_string() }));
    }

    #[test]
    fn test_extended_tier_permissions() {
        let tier = BrowserPolicyTier::Extended;

        assert!(tier.allows_action(&BrowserAction::ExecuteJs { script: "console.log('test')".to_string() }));
    }

    #[test]
    fn test_tier_enforcer_check() {
        let enforcer = TierEnforcer::new();

        assert!(enforcer.check_action(&BrowserPolicyTier::Standard, &BrowserAction::Click { selector: "#btn".to_string() }).is_ok());
        assert!(enforcer.check_action(&BrowserPolicyTier::Minimal, &BrowserAction::Click { selector: "#btn".to_string() }).is_err());
    }

    #[test]
    fn test_url_allowlist() {
        let enforcer = TierEnforcer::new();

        // Minimal tier only allows specific hosts
        assert!(!enforcer.can_access_url(&BrowserPolicyTier::Minimal, "https://example.com"));
        assert!(!enforcer.can_access_url(&BrowserPolicyTier::Minimal, "https://github.com"));

        // Standard tier allows github
        assert!(enforcer.can_access_url(&BrowserPolicyTier::Standard, "https://github.com"));
        assert!(enforcer.can_access_url(&BrowserPolicyTier::Standard, "https://docs.rs"));
    }

    #[test]
    fn test_dangerous_url_detection() {
        assert!(is_dangerous_url("http://localhost:3000"));
        assert!(is_dangerous_url("http://127.0.0.1:8080"));
        assert!(is_dangerous_url("file:///etc/passwd"));
        assert!(!is_dangerous_url("https://example.com"));
    }
}
