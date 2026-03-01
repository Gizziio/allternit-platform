//! Rate Limiting Module
//!
//! Provides rate limiting for API endpoints using token bucket algorithm.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// Rate limit configuration
#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    /// Requests per second
    pub requests_per_second: u32,
    /// Burst capacity
    pub burst_size: u32,
    /// Window duration for sliding window
    pub window_duration: Duration,
    /// Whether to use sliding window (true) or token bucket (false)
    pub use_sliding_window: bool,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            requests_per_second: 10,
            burst_size: 20,
            window_duration: Duration::from_secs(60),
            use_sliding_window: false,
        }
    }
}

impl RateLimitConfig {
    /// Conservative limits for production
    pub fn conservative() -> Self {
        Self {
            requests_per_second: 5,
            burst_size: 10,
            window_duration: Duration::from_secs(60),
            use_sliding_window: false,
        }
    }

    /// Relaxed limits for development
    pub fn relaxed() -> Self {
        Self {
            requests_per_second: 100,
            burst_size: 200,
            window_duration: Duration::from_secs(60),
            use_sliding_window: false,
        }
    }

    /// Strict limits for sensitive endpoints
    pub fn strict() -> Self {
        Self {
            requests_per_second: 1,
            burst_size: 5,
            window_duration: Duration::from_secs(60),
            use_sliding_window: true,
        }
    }
}

/// Token bucket for rate limiting
#[derive(Debug)]
struct TokenBucket {
    tokens: f64,
    last_update: Instant,
    capacity: f64,
    refill_rate: f64,
}

impl TokenBucket {
    fn new(capacity: f64, refill_rate: f64) -> Self {
        Self {
            tokens: capacity,
            last_update: Instant::now(),
            capacity,
            refill_rate,
        }
    }

    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_update).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);
        self.last_update = now;
    }

    fn try_consume(&mut self, tokens: f64) -> bool {
        self.refill();
        if self.tokens >= tokens {
            self.tokens -= tokens;
            true
        } else {
            false
        }
    }
}

/// Sliding window entry
#[derive(Debug)]
struct WindowEntry {
    requests: Vec<Instant>,
}

impl WindowEntry {
    fn new() -> Self {
        Self {
            requests: Vec::new(),
        }
    }

    fn clean_old(&mut self, window: Duration) {
        let cutoff = Instant::now() - window;
        self.requests.retain(|&t| t > cutoff);
    }

    fn add(&mut self) {
        self.requests.push(Instant::now());
    }

    fn count(&self) -> usize {
        self.requests.len()
    }
}

/// Rate limiter implementation
pub struct RateLimiter {
    config: RateLimitConfig,
    buckets: Arc<RwLock<HashMap<String, TokenBucket>>>,
    windows: Arc<RwLock<HashMap<String, WindowEntry>>>,
}

impl RateLimiter {
    /// Create a new rate limiter
    pub fn new(config: RateLimitConfig) -> Self {
        let limiter = Self {
            config,
            buckets: Arc::new(RwLock::new(HashMap::new())),
            windows: Arc::new(RwLock::new(HashMap::new())),
        };

        // Start cleanup task
        let buckets = limiter.buckets.clone();
        let windows = limiter.windows.clone();
        let window_duration = limiter.config.window_duration;

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                Self::cleanup(&buckets, &windows, window_duration).await;
            }
        });

        limiter
    }

    /// Check if request is allowed
    pub async fn check(&self, key: &str) -> Result<(), super::RateLimitError> {
        if self.config.use_sliding_window {
            self.check_sliding_window(key).await
        } else {
            self.check_token_bucket(key).await
        }
    }

    /// Check using token bucket algorithm
    async fn check_token_bucket(&self, key: &str) -> Result<(), super::RateLimitError> {
        let mut buckets = self.buckets.write().await;

        let bucket = buckets.entry(key.to_string()).or_insert_with(|| {
            TokenBucket::new(
                self.config.burst_size as f64,
                self.config.requests_per_second as f64,
            )
        });

        if bucket.try_consume(1.0) {
            Ok(())
        } else {
            Err(super::RateLimitError::LimitExceeded(key.to_string()))
        }
    }

    /// Check using sliding window algorithm
    async fn check_sliding_window(&self, key: &str) -> Result<(), super::RateLimitError> {
        let mut windows = self.windows.write().await;

        let entry = windows
            .entry(key.to_string())
            .or_insert_with(WindowEntry::new);
        entry.clean_old(self.config.window_duration);

        let limit = (self.config.requests_per_second as u64 * self.config.window_duration.as_secs())
            as usize;

        if entry.count() >= limit {
            Err(super::RateLimitError::LimitExceeded(key.to_string()))
        } else {
            entry.add();
            Ok(())
        }
    }

    /// Get current rate limit status
    pub async fn get_status(&self, key: &str) -> RateLimitStatus {
        if self.config.use_sliding_window {
            let windows = self.windows.read().await;
            let count = windows.get(key).map(|e| e.count()).unwrap_or(0);
            let limit = (self.config.requests_per_second as u64
                * self.config.window_duration.as_secs()) as usize;

            RateLimitStatus {
                limit,
                remaining: limit.saturating_sub(count),
                reset_after: self.config.window_duration,
            }
        } else {
            let buckets = self.buckets.read().await;
            let tokens = buckets
                .get(key)
                .map(|b| b.tokens as usize)
                .unwrap_or(self.config.burst_size as usize);

            RateLimitStatus {
                limit: self.config.burst_size as usize,
                remaining: tokens,
                reset_after: Duration::from_secs_f64(1.0 / self.config.requests_per_second as f64),
            }
        }
    }

    /// Cleanup old entries
    async fn cleanup(
        buckets: &Arc<RwLock<HashMap<String, TokenBucket>>>,
        windows: &Arc<RwLock<HashMap<String, WindowEntry>>>,
        window_duration: Duration,
    ) {
        // Clean up old windows
        let mut windows = windows.write().await;
        let keys_to_remove: Vec<String> = windows
            .iter_mut()
            .filter_map(|(key, entry)| {
                entry.clean_old(window_duration);
                if entry.requests.is_empty() {
                    Some(key.clone())
                } else {
                    None
                }
            })
            .collect();

        for key in keys_to_remove {
            windows.remove(&key);
        }

        // Clean up old buckets (inactive for more than 5 minutes)
        let mut buckets = buckets.write().await;
        let stale_threshold = Instant::now() - Duration::from_secs(300);
        buckets.retain(|_, bucket| bucket.last_update > stale_threshold);
    }

    /// Reset rate limit for a key
    pub async fn reset(&self, key: &str) {
        let mut buckets = self.buckets.write().await;
        buckets.remove(key);

        let mut windows = self.windows.write().await;
        windows.remove(key);
    }
}

impl Clone for RateLimiter {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            buckets: self.buckets.clone(),
            windows: self.windows.clone(),
        }
    }
}

/// Rate limit status
#[derive(Debug, Clone)]
pub struct RateLimitStatus {
    pub limit: usize,
    pub remaining: usize,
    pub reset_after: Duration,
}

/// Rate limiter builder
pub struct RateLimiterBuilder {
    config: RateLimitConfig,
}

impl RateLimiterBuilder {
    pub fn new() -> Self {
        Self {
            config: RateLimitConfig::default(),
        }
    }

    pub fn requests_per_second(mut self, rps: u32) -> Self {
        self.config.requests_per_second = rps;
        self
    }

    pub fn burst_size(mut self, size: u32) -> Self {
        self.config.burst_size = size;
        self
    }

    pub fn window_duration(mut self, duration: Duration) -> Self {
        self.config.window_duration = duration;
        self
    }

    pub fn use_sliding_window(mut self, use_sw: bool) -> Self {
        self.config.use_sliding_window = use_sw;
        self
    }

    pub fn build(self) -> RateLimiter {
        RateLimiter::new(self.config)
    }
}

impl Default for RateLimiterBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_bucket() {
        let mut bucket = TokenBucket::new(10.0, 5.0);

        // Should be able to consume burst
        assert!(bucket.try_consume(5.0));
        assert!(bucket.try_consume(5.0));

        // Should not be able to consume more than capacity
        assert!(!bucket.try_consume(1.0));
    }

    #[tokio::test]
    async fn test_rate_limiter_token_bucket() {
        let config = RateLimitConfig {
            requests_per_second: 10,
            burst_size: 5,
            window_duration: Duration::from_secs(60),
            use_sliding_window: false,
        };

        let limiter = RateLimiter::new(config);

        // Should allow burst
        for _ in 0..5 {
            assert!(limiter.check("test-key").await.is_ok());
        }

        // Should deny after burst
        assert!(limiter.check("test-key").await.is_err());

        // Different key should work
        assert!(limiter.check("other-key").await.is_ok());
    }

    #[tokio::test]
    async fn test_rate_limiter_sliding_window() {
        let config = RateLimitConfig {
            requests_per_second: 10,
            burst_size: 0,
            window_duration: Duration::from_secs(1),
            use_sliding_window: true,
        };

        let limiter = RateLimiter::new(config);

        // Should allow 10 requests
        for _ in 0..10 {
            assert!(limiter.check("test-key").await.is_ok());
        }

        // Should deny 11th
        assert!(limiter.check("test-key").await.is_err());
    }

    #[tokio::test]
    async fn test_rate_limit_status() {
        let config = RateLimitConfig {
            requests_per_second: 10,
            burst_size: 5,
            window_duration: Duration::from_secs(60),
            use_sliding_window: false,
        };

        let limiter = RateLimiter::new(config);

        // Initial status
        let status = limiter.get_status("test-key").await;
        assert_eq!(status.limit, 5);
        assert_eq!(status.remaining, 5);

        // After consuming some tokens
        limiter.check("test-key").await.ok();
        limiter.check("test-key").await.ok();

        let status = limiter.get_status("test-key").await;
        assert_eq!(status.remaining, 3);
    }

    #[tokio::test]
    async fn test_reset() {
        let config = RateLimitConfig {
            requests_per_second: 1,
            burst_size: 1,
            window_duration: Duration::from_secs(60),
            use_sliding_window: false,
        };

        let limiter = RateLimiter::new(config);

        // Consume token
        assert!(limiter.check("test-key").await.is_ok());
        assert!(limiter.check("test-key").await.is_err());

        // Reset and try again
        limiter.reset("test-key").await;
        assert!(limiter.check("test-key").await.is_ok());
    }
}
