//! Provider Usage Types
//!
//! Normalized usage metrics across all providers.

use serde::{Deserialize, Serialize};

/// Normalized usage metrics from a provider response
///
/// All fields are optional because not all providers return
/// complete usage information.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NormalizedUsage {
    /// Number of input/prompt tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<u64>,
    /// Number of output/completion tokens
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<u64>,
    /// Total tokens (input + output)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u64>,
    /// Estimated cost in USD (if calculable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_usd: Option<f64>,
    /// Provider-specific raw usage data (for debugging)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<serde_json::Value>,
}

impl NormalizedUsage {
    /// Create a new empty usage
    pub fn new() -> Self {
        Self::default()
    }

    /// Create usage with token counts
    pub fn with_tokens(input: u64, output: u64) -> Self {
        Self {
            input_tokens: Some(input),
            output_tokens: Some(output),
            total_tokens: Some(input + output),
            cost_usd: None,
            raw: None,
        }
    }

    /// Calculate total tokens if not provided
    pub fn ensure_total(&mut self) {
        if self.total_tokens.is_none() {
            if let (Some(input), Some(output)) = (self.input_tokens, self.output_tokens) {
                self.total_tokens = Some(input + output);
            }
        }
    }

    /// Merge with another usage (additive)
    pub fn merge(&mut self, other: &NormalizedUsage) {
        if let Some(other_input) = other.input_tokens {
            self.input_tokens = Some(self.input_tokens.unwrap_or(0) + other_input);
        }
        if let Some(other_output) = other.output_tokens {
            self.output_tokens = Some(self.output_tokens.unwrap_or(0) + other_output);
        }
        if let Some(other_total) = other.total_tokens {
            self.total_tokens = Some(self.total_tokens.unwrap_or(0) + other_total);
        }
        // Cost is not additive (we keep the latest or accumulate separately)
        if other.cost_usd.is_some() {
            self.cost_usd = other.cost_usd;
        }
    }

    /// Check if any usage data is available
    pub fn has_data(&self) -> bool {
        self.input_tokens.is_some()
            || self.output_tokens.is_some()
            || self.total_tokens.is_some()
            || self.cost_usd.is_some()
    }

    /// Format for display
    pub fn format_summary(&self) -> String {
        match (self.input_tokens, self.output_tokens, self.total_tokens) {
            (Some(i), Some(o), _) => format!("{} prompt + {} completion tokens", i, o),
            (Some(i), None, Some(t)) => {
                format!("{} prompt + {} completion = {} total", i, t - i, t)
            }
            (None, Some(o), Some(t)) => {
                format!("{} prompt + {} completion = {} total", t - o, o, t)
            }
            (None, None, Some(t)) => format!("{} total tokens", t),
            _ => "No usage data".to_string(),
        }
    }
}

/// Usage aggregator for accumulating usage across multiple requests
#[derive(Debug, Clone, Default)]
pub struct UsageAggregator {
    total: NormalizedUsage,
    request_count: u64,
}

impl UsageAggregator {
    /// Create a new aggregator
    pub fn new() -> Self {
        Self::default()
    }

    /// Add usage from a request
    pub fn add(&mut self, usage: &NormalizedUsage) {
        self.total.merge(usage);
        self.request_count += 1;
    }

    /// Get total usage
    pub fn total(&self) -> &NormalizedUsage {
        &self.total
    }

    /// Get request count
    pub fn request_count(&self) -> u64 {
        self.request_count
    }

    /// Average tokens per request
    pub fn avg_tokens_per_request(&self) -> Option<f64> {
        self.total
            .total_tokens
            .map(|t| t as f64 / self.request_count as f64)
    }

    /// Reset the aggregator
    pub fn reset(&mut self) {
        self.total = NormalizedUsage::default();
        self.request_count = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usage_with_tokens() {
        let usage = NormalizedUsage::with_tokens(100, 50);
        assert_eq!(usage.input_tokens, Some(100));
        assert_eq!(usage.output_tokens, Some(50));
        assert_eq!(usage.total_tokens, Some(150));
    }

    #[test]
    fn test_usage_merge() {
        let mut usage1 = NormalizedUsage::with_tokens(100, 50);
        let usage2 = NormalizedUsage::with_tokens(50, 25);
        usage1.merge(&usage2);
        assert_eq!(usage1.input_tokens, Some(150));
        assert_eq!(usage1.output_tokens, Some(75));
        assert_eq!(usage1.total_tokens, Some(225));
    }

    #[test]
    fn test_usage_has_data() {
        let empty = NormalizedUsage::new();
        assert!(!empty.has_data());

        let with_tokens = NormalizedUsage::with_tokens(10, 5);
        assert!(with_tokens.has_data());
    }

    #[test]
    fn test_usage_format_summary() {
        let usage = NormalizedUsage::with_tokens(100, 50);
        assert_eq!(usage.format_summary(), "100 prompt + 50 completion tokens");

        let empty = NormalizedUsage::new();
        assert_eq!(empty.format_summary(), "No usage data");
    }

    #[test]
    fn test_aggregator() {
        let mut agg = UsageAggregator::new();
        agg.add(&NormalizedUsage::with_tokens(100, 50));
        agg.add(&NormalizedUsage::with_tokens(50, 25));

        assert_eq!(agg.request_count(), 2);
        assert_eq!(agg.total().input_tokens, Some(150));
        assert_eq!(agg.avg_tokens_per_request(), Some(112.5));
    }
}
