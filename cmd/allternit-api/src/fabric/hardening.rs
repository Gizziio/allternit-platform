//! Production hardening stubs.
//!
//! These types are intentionally lightweight placeholders. They capture the
//! hardening surface that Cloud must own (spend caps, provider health, rate
//! limits, orphan cleanup) without adding new external dependencies or
//! expanding the generic Fabric control plane.
//!
//! The AllternitOS integrator should treat these as the Cloud-side boundaries
//! to wire into the canonical policy, health, and reconciliation services.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Spend guardrail configured for an organization or project.
///
/// Cloud owns the commercial quota/cap semantics; the canonical OS may later
/// own the authoritative policy decision point, but Cloud retains enforcement
/// at the billing boundary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganizationLimit {
    pub organization_id: String,
    pub monthly_budget_cents: Option<i64>,
    pub max_held_cents: Option<i64>,
    pub inference_daily_budget_cents: Option<i64>,
    pub vm_hourly_quota: Option<u64>,
    pub hard_stop: bool,
}

impl OrganizationLimit {
    /// Placeholder builder used until the limits table is fully wired.
    pub fn disabled(organization_id: &str) -> Self {
        Self {
            organization_id: organization_id.to_string(),
            monthly_budget_cents: None,
            max_held_cents: None,
            inference_daily_budget_cents: None,
            vm_hourly_quota: None,
            hard_stop: false,
        }
    }
}

/// Snapshot of a provider's health from Cloud's point of view.
///
/// This is the Cloud-specific health record used for retry/fallback decisions.
/// AllternitOS canonical health/telemetry is a separate, richer object.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderHealth {
    pub provider_kind: String,
    pub healthy: bool,
    pub consecutive_errors: u32,
    pub last_success_at: Option<DateTime<Utc>>,
    pub last_error_at: Option<DateTime<Utc>>,
    pub last_error_message: Option<String>,
    pub circuit_open_until: Option<DateTime<Utc>>,
}

impl ProviderHealth {
    /// Create an initial healthy snapshot.
    pub fn new(provider_kind: &str) -> Self {
        Self {
            provider_kind: provider_kind.to_string(),
            healthy: true,
            consecutive_errors: 0,
            last_success_at: Some(Utc::now()),
            last_error_at: None,
            last_error_message: None,
            circuit_open_until: None,
        }
    }

    /// True if the provider should not be used right now.
    pub fn is_blocked(&self) -> bool {
        if !self.healthy {
            return true;
        }
        if let Some(until) = self.circuit_open_until {
            return Utc::now() < until;
        }
        false
    }
}

/// Per-model/per-organization rate limit state.
///
/// Cloud keeps the product-level rate limit enforcement (requests per minute,
/// tokens per day). The canonical OS may own global admission control later.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelGatewayRateLimit {
    pub organization_id: String,
    pub model_full_id: String,
    pub requests_per_minute: u32,
    pub tokens_per_day: u64,
    pub window_start: DateTime<Utc>,
    pub requests_in_window: u32,
    pub tokens_in_window: u64,
}

impl ModelGatewayRateLimit {
    /// Stub limit with generous defaults; production should load from config.
    pub fn default_for(organization_id: &str, model_full_id: &str) -> Self {
        Self {
            organization_id: organization_id.to_string(),
            model_full_id: model_full_id.to_string(),
            requests_per_minute: 120,
            tokens_per_day: 10_000_000,
            window_start: Utc::now(),
            requests_in_window: 0,
            tokens_in_window: 0,
        }
    }

    /// Stub check. Always succeeds until real counters are wired.
    pub fn allow(&self, _input_tokens: u32, _output_tokens: u32) -> bool {
        true
    }
}

/// Background orphan-cleanup job descriptor.
///
/// Describes the reconciliation loop that scans `fabric_resources` rows stuck
/// in `provisioning` for too long, releases any outstanding credit holds, and
/// marks them terminated. This is a stub; the actual job is scheduled by the
/// Cloud control-plane worker loop.
#[derive(Debug, Clone, Default)]
pub struct OrphanCleanupJob {
    pub max_age_minutes: u64,
    pub release_holds: bool,
    pub notify_webhook: Option<String>,
}

impl OrphanCleanupJob {
    /// Default cleanup policy.
    pub fn default_policy() -> Self {
        Self {
            max_age_minutes: 30,
            release_holds: true,
            notify_webhook: None,
        }
    }

    /// Returns a human-readable description of what the job would do.
    ///
    /// The real implementation belongs in the Cloud control-plane worker; this
    /// stub is here to make the hardening surface compile and testable.
    pub fn describe(&self) -> String {
        format!(
            "scan fabric_resources.status='provisioning' older than {} minutes; \
             release holds={}; terminate orphans",
            self.max_age_minutes, self.release_holds
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_health_starts_healthy() {
        let health = ProviderHealth::new("openai");
        assert!(health.healthy);
        assert!(!health.is_blocked());
    }

    #[test]
    fn provider_health_blocked_when_circuit_open() {
        let mut health = ProviderHealth::new("openai");
        health.healthy = true;
        health.circuit_open_until = Some(Utc::now() + chrono::Duration::minutes(5));
        assert!(health.is_blocked());
    }

    #[test]
    fn rate_limit_allows_by_default() {
        let limit = ModelGatewayRateLimit::default_for("org-1", "openai/gpt-4o-mini");
        assert!(limit.allow(1_000, 1_000));
    }

    #[test]
    fn orphan_cleanup_job_describes_policy() {
        let job = OrphanCleanupJob::default_policy();
        let desc = job.describe();
        assert!(desc.contains("provisioning"));
        assert!(desc.contains("30 minutes"));
    }
}
