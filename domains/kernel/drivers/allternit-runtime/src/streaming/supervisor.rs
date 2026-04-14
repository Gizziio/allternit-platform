//! Streaming Supervisor
//!
//! Manages token streaming with rate limiting and backpressure.

use super::{StreamingConfig, StreamingError};
use crate::streaming::{BackpressureController, RateLimiter};
use std::sync::atomic::{AtomicUsize, Ordering};
// Arc not used

/// Supervisor for streaming content
pub struct StreamingSupervisor {
    config: StreamingConfig,
    rate_limiter: RateLimiter,
    backpressure: BackpressureController,
    tokens_emitted: AtomicUsize,
}

impl StreamingSupervisor {
    pub fn new(config: StreamingConfig) -> Self {
        Self {
            config,
            rate_limiter: RateLimiter::new(config.max_tokens_per_second),
            backpressure: BackpressureController::new(
                config.max_buffer_size,
                config.backpressure_threshold,
            ),
            tokens_emitted: AtomicUsize::new(0),
        }
    }

    /// Emit a token with rate limiting and backpressure
    pub async fn emit_token(&self, token: &str) -> Result<(), StreamingError> {
        // Check rate limit
        let token_count = token.split_whitespace().count() as u32;
        if !self.rate_limiter.try_consume(token_count) {
            self.rate_limiter.wait_for_refill(token_count).await;
        }

        // Check backpressure
        if self.backpressure.should_pause() {
            self.backpressure
                .wait_for_resume()
                .await
                .map_err(|_| StreamingError::BackpressureTimeout)?;
        }

        // Record emission
        self.tokens_emitted.fetch_add(1, Ordering::Relaxed);
        self.backpressure.record_emission(token.len());

        Ok(())
    }

    /// Emit raw bytes (for binary content)
    pub async fn emit_bytes(&self, bytes: &[u8]) -> Result<(), StreamingError> {
        // Simple byte-based rate limiting
        let tokens = (bytes.len() / 4) as u32; // Approximate
        if !self.rate_limiter.try_consume(tokens) {
            self.rate_limiter.wait_for_refill(tokens).await;
        }

        if self.backpressure.should_pause() {
            self.backpressure
                .wait_for_resume()
                .await
                .map_err(|_| StreamingError::BackpressureTimeout)?;
        }

        self.backpressure.record_emission(bytes.len());
        Ok(())
    }

    /// Get total tokens emitted
    pub fn tokens_emitted(&self) -> usize {
        self.tokens_emitted.load(Ordering::Relaxed)
    }

    /// Signal that client consumed some data
    pub fn record_consumption(&self, bytes: usize) {
        self.backpressure.record_consumption(bytes);
    }

    /// Check if backpressure is active
    pub fn is_backpressured(&self) -> bool {
        self.backpressure.should_pause()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_emit_token() {
        let config = StreamingConfig {
            max_tokens_per_second: 10000, // Very high for testing
            max_buffer_size: 1000,
            backpressure_threshold: 0.9,
        };

        let supervisor = StreamingSupervisor::new(config);

        for i in 0..10 {
            assert!(supervisor.emit_token(&format!("token{}", i)).await.is_ok());
        }

        assert_eq!(supervisor.tokens_emitted(), 10);
    }
}
