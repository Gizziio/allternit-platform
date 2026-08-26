//! Compute-usage pricing. Single source of truth for cost calculation —
//! `usage_events.computed_cost_cents` is always derived here, server-side,
//! from whatever the Python ACU gateway reports as measured (quantity, unit,
//! resource_type). Never trust a client-supplied cost: pricing/margin logic
//! lives in exactly one place so it can change without touching every caller.

use std::collections::HashMap;

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
    // Desktop Cloud minute pricing (placeholder pending business decision).
    m.insert("computer_minute:minutes", 0.5);
    m
}

fn env_key_for(resource_type: &str, unit: &str) -> String {
    let key = format!("{resource_type}:{unit}");
    format!(
        "ALLTERNIT_PRICE_{}",
        key.to_uppercase()
            .replace(|c: char| !c.is_ascii_alphanumeric(), "_")
    )
}

/// Compute cost in cents for a quantity of a `resource_type`/`unit` pair.
/// Env override: `ALLTERNIT_PRICE_<RESOURCE_TYPE>_<UNIT>` (cents-per-unit,
/// float). Unknown resource_type/unit pairs price at zero rather than
/// erroring — an unrecognized meter shouldn't block usage-event ingestion,
/// but it also shouldn't silently invent a price.
pub fn compute_cost_cents(resource_type: &str, unit: &str, quantity: f64) -> i64 {
    let key = format!("{resource_type}:{unit}");
    let cents_per_unit = std::env::var(env_key_for(resource_type, unit))
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .or_else(|| default_rates().get(key.as_str()).copied())
        .unwrap_or(0.0);
    (quantity * cents_per_unit).round() as i64
}
