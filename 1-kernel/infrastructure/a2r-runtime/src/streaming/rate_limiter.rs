//! Rate Limiter
//!
//! Token bucket rate limiter for streaming.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tokio::time::sleep;

/// Token bucket rate limiter
pub struct RateLimiter {
    max_tokens_per_second: u32,
    tokens: AtomicU32,
    last_refill: Mutex<Instant>,
}

impl RateLimiter {
    pub fn new(max_tokens_per_second: u32) -> Self {
        Self {
            max_tokens_per_second,
            tokens: AtomicU32::new(max_tokens_per_second),
            last_refill: Mutex::new(Instant::now()),
        }
    }

    /// Try to consume tokens, returns false if not enough available
    pub fn try_consume(&self, amount: u32) -> bool {
        self.refill();

        let current = self.tokens.load(Ordering::Relaxed);
        if current >= amount {
            self.tokens.fetch_sub(amount, Ordering::Relaxed);
            true
        } else {
            false
        }
    }

    /// Wait until enough tokens are available
    pub async fn wait_for_refill(&self, amount: u32) {
        while !self.try_consume(amount) {
            let current = self.tokens.load(Ordering::Relaxed);
            let needed = amount - current;
            let wait_ms = (needed as f64 / self.max_tokens_per_second as f64 * 1000.0) as u64;
            sleep(Duration::from_millis(wait_ms.max(10))).await;
        }
    }

    /// Refill tokens based on elapsed time
    fn refill(&self) {
        let now = Instant::now();
        let mut last_refill = self.last_refill.lock().unwrap();
        let elapsed = now.duration_since(*last_refill);

        let tokens_to_add = (elapsed.as_secs_f64() * self.max_tokens_per_second as f64) as u32;

        if tokens_to_add > 0 {
            let current = self.tokens.load(Ordering::Relaxed);
            let new_tokens = (current + tokens_to_add).min(self.max_tokens_per_second);
            self.tokens.store(new_tokens, Ordering::Relaxed);
            *last_refill = now;
        }
    }

    /// Get current token count
    pub fn available_tokens(&self) -> u32 {
        self.refill();
        self.tokens.load(Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_consumption() {
        let limiter = RateLimiter::new(100);

        assert!(limiter.try_consume(50));
        assert_eq!(limiter.available_tokens(), 50);

        assert!(limiter.try_consume(50));
        assert_eq!(limiter.available_tokens(), 0);

        assert!(!limiter.try_consume(1));
    }

    #[tokio::test]
    async fn test_refill() {
        let limiter = RateLimiter::new(1000); // 1000 tokens/sec

        // Consume tokens
        assert!(limiter.try_consume(500));
        let remaining = limiter.available_tokens();
        assert!(
            remaining < 1000,
            "Should have less than max tokens after consumption"
        );

        // Wait for refill
        sleep(Duration::from_millis(200)).await;

        // Should have more or equal tokens now (refilled ~200, capped at max)
        let after_refill = limiter.available_tokens();
        assert!(
            after_refill >= remaining,
            "Expected {} >= {} after refill",
            after_refill,
            remaining
        );
    }
}
