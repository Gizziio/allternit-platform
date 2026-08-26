//! Compute-usage pricing. Single source of truth for cost calculation —
//! `usage_events.computed_cost_cents` is always derived here, server-side,
//! from whatever the caller reports as measured (quantity, unit, resource_type).
//! Never trust a client-supplied cost: pricing/margin logic lives in exactly
//! one place so it can change without touching every caller.

use std::collections::HashMap;

/// Base memory bucket in MiB used to scale rates. A 4 GB desktop is 1.0x.
const BASE_MEMORY_MIB: f64 = 4096.0;

/// Cents per unit, keyed by `resource_type:unit` (e.g. "sandbox_runtime:seconds").
///
/// These numbers are placeholders pending a real margin decision on top of
/// whatever the underlying cloud actually costs (BYOC: allternit's own
/// platform-fee margin; metered pass-through: measured cloud cost + margin).
/// Do not treat these as final pricing.
fn default_rates() -> HashMap<&'static str, f64> {
    let mut m = HashMap::new();
    m.insert("sandbox_runtime:seconds", 0.02);
    m.insert("vcpu_seconds:seconds", 0.01);
    m.insert("gpu_seconds:seconds", 0.5);
    // Desktop Cloud minute pricing: base rate for a 4 GB Linux desktop.
    // Windows is 2x; macOS is 3x. Memory scales linearly from the 4 GB base.
    m.insert("computer_minute:minutes:linux", 0.5);
    m.insert("computer_minute:minutes:windows", 1.0);
    m.insert("computer_minute:minutes:macos", 1.5);
    m
}

fn env_key_for(resource_type: &str, unit: &str, os: Option<&str>) -> String {
    let key = if let Some(os) = os {
        format!("{resource_type}:{unit}:{os}")
    } else {
        format!("{resource_type}:{unit}")
    };
    format!(
        "ALLTERNIT_PRICE_{}",
        key.to_uppercase()
            .replace(|c: char| !c.is_ascii_alphanumeric(), "_")
    )
}

fn os_bucket(os: Option<&str>) -> &'static str {
    match os.unwrap_or("linux").to_lowercase().as_str() {
        "windows" => "windows",
        "macos" | "mac" | "darwin" => "macos",
        _ => "linux",
    }
}

/// Compute cost in cents for a quantity of a `resource_type`/`unit` pair.
/// Env override: `ALLTERNIT_PRICE_<RESOURCE_TYPE>_<UNIT>` (cents-per-unit,
/// float). Unknown resource_type/unit pairs price at zero rather than
/// erroring — an unrecognized meter shouldn't block usage-event ingestion,
/// but it also shouldn't silently invent a price.
pub fn compute_cost_cents(resource_type: &str, unit: &str, quantity: f64) -> i64 {
    let key = format!("{resource_type}:{unit}");
    let cents_per_unit = std::env::var(env_key_for(resource_type, unit, None))
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .or_else(|| default_rates().get(key.as_str()).copied())
        .unwrap_or(0.0);
    (quantity * cents_per_unit).round() as i64
}

/// Compute cost in cents for computer desktop minutes, scaled by OS and memory.
///
/// Pricing model derived from Orgo/Hermes competitive analysis:
/// - Base rate is for a 4 GB Linux desktop.
/// - Windows costs 2x (license/premium).
/// - macOS costs 3x (Apple hardware premium).
/// - Memory scales linearly from the 4 GB base.
///
/// Examples (with default rates):
/// - Linux 4 GB for 60 min = 30 cents
/// - Linux 8 GB for 60 min = 60 cents
/// - Windows 8 GB for 60 min = 120 cents
/// - macOS 8 GB for 60 min = 180 cents
pub fn compute_computer_minute_cost_cents(
    memory_mib: Option<i64>,
    os: Option<&str>,
    minutes: f64,
) -> i64 {
    let bucket = os_bucket(os);
    let key = format!("computer_minute:minutes:{bucket}");
    let base_cents_per_minute: f64 = std::env::var(env_key_for("computer_minute", "minutes", Some(bucket)))
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .or_else(|| default_rates().get(key.as_str()).copied())
        .unwrap_or(0.0);

    let memory_factor = memory_mib.unwrap_or(BASE_MEMORY_MIB as i64) as f64 / BASE_MEMORY_MIB;
    let cents = base_cents_per_minute * memory_factor * minutes;
    cents.round() as i64
}

/// Estimate the cost of running a computer for one hour.
pub fn estimate_hourly_cost_cents(memory_mib: Option<i64>, os: Option<&str>) -> i64 {
    compute_computer_minute_cost_cents(memory_mib, os, 60.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn linux_4gb_60min_cost() {
        assert_eq!(compute_computer_minute_cost_cents(Some(4096), Some("linux"), 60.0), 30);
    }

    #[test]
    fn linux_8gb_60min_cost() {
        assert_eq!(compute_computer_minute_cost_cents(Some(8192), Some("linux"), 60.0), 60);
    }

    #[test]
    fn windows_8gb_60min_cost() {
        assert_eq!(compute_computer_minute_cost_cents(Some(8192), Some("windows"), 60.0), 120);
    }

    #[test]
    fn macos_8gb_60min_cost() {
        assert_eq!(compute_computer_minute_cost_cents(Some(8192), Some("macos"), 60.0), 180);
    }

    #[test]
    fn defaults_to_linux_4gb() {
        assert_eq!(compute_computer_minute_cost_cents(None, None, 60.0), 30);
    }

}
