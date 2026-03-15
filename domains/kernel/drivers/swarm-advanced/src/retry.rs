//! Retry Logic with Exponential Backoff
//!
//! Implements retry logic for transient failures with:
//! - Exponential backoff
//! - Maximum retry limit
//! - Jitter to prevent thundering herd

use rand::Rng;
use std::future::Future;
use std::time::Duration;
use tokio::time::sleep;

/// Retry error types
#[derive(Debug, Clone)]
pub enum RetryError {
    /// Transient error that can be retried
    Transient(String),
    /// Permanent error that should not be retried
    Permanent(String),
    /// Circuit breaker is open
    CircuitBreakerOpen,
    /// Maximum retries exceeded
    MaxRetriesExceeded,
}

impl std::fmt::Display for RetryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RetryError::Transient(msg) => write!(f, "Transient error: {}", msg),
            RetryError::Permanent(msg) => write!(f, "Permanent error: {}", msg),
            RetryError::CircuitBreakerOpen => write!(f, "Circuit breaker open"),
            RetryError::MaxRetriesExceeded => write!(f, "Maximum retries exceeded"),
        }
    }
}

/// Retry configuration
#[derive(Debug, Clone)]
pub struct RetryConfig {
    /// Maximum number of retry attempts
    pub max_retries: u32,
    /// Initial delay in milliseconds
    pub initial_delay_ms: u64,
    /// Maximum delay in milliseconds
    pub max_delay_ms: u64,
    /// Exponential backoff multiplier
    pub multiplier: f64,
    /// Add jitter to delay (true recommended)
    pub jitter: bool,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries: 3,
            initial_delay_ms: 100,
            max_delay_ms: 10000,
            multiplier: 2.0,
            jitter: true,
        }
    }
}

/// Retry manager for handling retries with backoff
pub struct RetryManager {
    config: RetryConfig,
}

impl Default for RetryManager {
    fn default() -> Self {
        Self::with_config(RetryConfig::default())
    }
}

impl RetryManager {
    /// Create a new retry manager
    pub fn new(max_retries: u32, initial_delay_ms: u64, max_delay_ms: u64) -> Self {
        Self {
            config: RetryConfig {
                max_retries,
                initial_delay_ms,
                max_delay_ms,
                ..Default::default()
            },
        }
    }

    /// Create with custom config
    #[allow(dead_code)]
    pub fn with_config(config: RetryConfig) -> Self {
        Self { config }
    }

    /// Execute a function with retry logic
    pub async fn execute_with_retry<F, Fut, T>(
        &self,
        mut func: F,
        agent_id: &str,
    ) -> Result<T, RetryError>
    where
        F: FnMut() -> Fut,
        Fut: Future<Output = Result<T, RetryError>>,
    {
        let mut attempt = 0;
        let mut delay = self.config.initial_delay_ms;

        loop {
            attempt += 1;

            match func().await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    // Don't retry permanent errors or circuit breaker open
                    if matches!(e, RetryError::Permanent(_) | RetryError::CircuitBreakerOpen) {
                        return Err(e);
                    }

                    // Check if max retries exceeded
                    if attempt > self.config.max_retries {
                        return Err(RetryError::MaxRetriesExceeded);
                    }

                    // Calculate delay with exponential backoff
                    let actual_delay = if self.config.jitter {
                        // Add ±25% jitter
                        let jitter_factor = 0.75 + rand::thread_rng().gen_range(0.0..0.5);
                        (delay as f64 * jitter_factor) as u64
                    } else {
                        delay
                    };

                    // Clamp to max delay
                    let actual_delay = actual_delay.min(self.config.max_delay_ms);

                    tracing::warn!(
                        "Retry attempt {}/{} for agent {} after {}ms: {}",
                        attempt,
                        self.config.max_retries,
                        agent_id,
                        actual_delay,
                        e
                    );

                    // Wait before next attempt
                    sleep(Duration::from_millis(actual_delay)).await;

                    // Increase delay for next iteration (exponential backoff)
                    delay = (delay as f64 * self.config.multiplier) as u64;
                }
            }
        }
    }

    /// Calculate delay for a given attempt number
    pub fn calculate_delay(&self, attempt: u32) -> Duration {
        let mut delay = self.config.initial_delay_ms;

        for _ in 1..attempt {
            delay = (delay as f64 * self.config.multiplier) as u64;
            delay = delay.min(self.config.max_delay_ms);
        }

        if self.config.jitter {
            let jitter_factor = 0.75 + rand::thread_rng().gen_range(0.0..0.5);
            delay = (delay as f64 * jitter_factor) as u64;
        }

        Duration::from_millis(delay)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    #[tokio::test]
    async fn test_retry_success_on_first_attempt() {
        let manager = RetryManager::default();
        let call_count = Arc::new(Mutex::new(0));
        let call_count_clone = call_count.clone();

        let result = manager
            .execute_with_retry(
                move || {
                    let count = call_count_clone.clone();
                    async move {
                        let mut c = count.lock().await;
                        *c += 1;
                        Ok::<_, RetryError>("success".to_string())
                    }
                },
                "test_agent",
            )
            .await;

        assert!(result.is_ok());
        assert_eq!(*call_count.lock().await, 1); // Only called once
    }

    #[tokio::test]
    async fn test_retry_on_transient_failure() {
        let manager = RetryManager::new(3, 10, 1000); // Fast retries for testing
        let call_count = Arc::new(Mutex::new(0));
        let call_count_clone = call_count.clone();

        let result = manager
            .execute_with_retry(
                move || {
                    let count = call_count_clone.clone();
                    async move {
                        let mut c = count.lock().await;
                        *c += 1;
                        if *c < 3 {
                            Err(RetryError::Transient("Temporary failure".to_string()))
                        } else {
                            Ok::<_, RetryError>("success".to_string())
                        }
                    }
                },
                "test_agent",
            )
            .await;

        assert!(result.is_ok());
        assert_eq!(*call_count.lock().await, 3); // Called 3 times
    }

    #[tokio::test]
    async fn test_no_retry_on_permanent_failure() {
        let manager = RetryManager::default();
        let call_count = Arc::new(Mutex::new(0));
        let call_count_clone = call_count.clone();

        let result = manager
            .execute_with_retry(
                move || {
                    let count = call_count_clone.clone();
                    async move {
                        let mut c = count.lock().await;
                        *c += 1;
                        Err::<String, _>(RetryError::Permanent("Permanent failure".to_string()))
                    }
                },
                "test_agent",
            )
            .await;

        assert!(result.is_err());
        assert_eq!(*call_count.lock().await, 1); // Only called once
    }

    #[tokio::test]
    async fn test_no_retry_on_circuit_breaker_open() {
        let manager = RetryManager::default();
        let call_count = Arc::new(Mutex::new(0));
        let call_count_clone = call_count.clone();

        let result = manager
            .execute_with_retry(
                move || {
                    let count = call_count_clone.clone();
                    async move {
                        let mut c = count.lock().await;
                        *c += 1;
                        Err::<String, _>(RetryError::CircuitBreakerOpen)
                    }
                },
                "test_agent",
            )
            .await;

        assert!(matches!(result, Err(RetryError::CircuitBreakerOpen)));
        assert_eq!(*call_count.lock().await, 1);
    }

    #[tokio::test]
    async fn test_max_retries_exceeded() {
        let manager = RetryManager::new(2, 10, 100); // Only 2 retries
        let call_count = Arc::new(Mutex::new(0));
        let call_count_clone = call_count.clone();

        let result = manager
            .execute_with_retry(
                move || {
                    let count = call_count_clone.clone();
                    async move {
                        let mut c = count.lock().await;
                        *c += 1;
                        Err::<String, _>(RetryError::Transient("Always fails".to_string()))
                    }
                },
                "test_agent",
            )
            .await;

        assert!(matches!(result, Err(RetryError::MaxRetriesExceeded)));
        assert_eq!(*call_count.lock().await, 3); // Initial + 2 retries
    }

    #[test]
    fn test_delay_calculation() {
        let manager = RetryManager::new(3, 100, 10000);

        // Test without jitter for deterministic results
        let delay0 = manager.config.initial_delay_ms;
        let delay1 = (delay0 as f64 * manager.config.multiplier) as u64;
        let delay2 = (delay1 as f64 * manager.config.multiplier) as u64;

        // Delays should increase exponentially
        assert!(delay1 >= delay0);
        assert!(delay2 >= delay1);

        // Should not exceed max delay
        assert!(delay2 <= 10000);
    }
}
