//! Retry Policy
//!
//! Configurable exponential backoff for tool execution.

/// Retry policy configuration
#[derive(Debug, Clone, Copy)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay_ms: 100,
            max_delay_ms: 10000,
            backoff_multiplier: 2.0,
        }
    }
}

impl RetryPolicy {
    /// Calculate delay for a given attempt (0-indexed)
    pub fn delay_ms(&self, attempt: u32) -> u64 {
        let delay =
            (self.base_delay_ms as f64 * self.backoff_multiplier.powi(attempt as i32)) as u64;
        delay.min(self.max_delay_ms)
    }

    /// Check if we should retry
    pub fn should_retry(&self, attempt: u32, is_retryable_error: bool) -> bool {
        is_retryable_error && attempt < self.max_attempts - 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exponential_backoff() {
        let policy = RetryPolicy::default();

        assert_eq!(policy.delay_ms(0), 100); // 100 * 2^0
        assert_eq!(policy.delay_ms(1), 200); // 100 * 2^1
        assert_eq!(policy.delay_ms(2), 400); // 100 * 2^2
        assert_eq!(policy.delay_ms(3), 800); // 100 * 2^3
    }

    #[test]
    fn test_max_delay_cap() {
        let policy = RetryPolicy {
            max_attempts: 10,
            base_delay_ms: 1000,
            max_delay_ms: 5000,
            backoff_multiplier: 2.0,
        };

        // Would be 8000ms but capped at 5000ms
        assert_eq!(policy.delay_ms(3), 5000);
    }

    #[test]
    fn test_should_retry() {
        let policy = RetryPolicy {
            max_attempts: 3,
            ..Default::default()
        };

        assert!(policy.should_retry(0, true));
        assert!(policy.should_retry(1, true));
        assert!(!policy.should_retry(2, true)); // Last attempt
        assert!(!policy.should_retry(0, false)); // Non-retryable error
    }
}
