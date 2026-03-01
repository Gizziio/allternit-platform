use axum::{
    body::Body,
    extract::{ConnectInfo, State},
    http::{HeaderMap, Request},
    middleware::Next,
    response::Response,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub requests_per_minute: u32,
    pub burst_capacity: u32,
    pub per_session: bool,
    pub per_tenant: bool,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            requests_per_minute: 60,
            burst_capacity: 10,
            per_session: true,
            per_tenant: false,
        }
    }
}

#[derive(Debug)]
struct RateLimitBucket {
    tokens: f64,
    last_refill: Instant,
    capacity: f64,
    refill_rate: f64, // tokens per second
}

impl RateLimitBucket {
    fn new(config: &RateLimitConfig) -> Self {
        let capacity = config.burst_capacity as f64;
        let refill_rate = config.requests_per_minute as f64 / 60.0; // tokens per second

        Self {
            tokens: capacity,
            last_refill: Instant::now(),
            capacity,
            refill_rate,
        }
    }

    fn consume(&mut self, amount: f64) -> bool {
        // Refill tokens based on time passed
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_rate).min(self.capacity);
        self.last_refill = now;

        if self.tokens >= amount {
            self.tokens -= amount;
            true
        } else {
            false
        }
    }
}

#[derive(Debug)]
pub struct RateLimiter {
    buckets: Arc<RwLock<HashMap<String, RateLimitBucket>>>,
    config: RateLimitConfig,
}

impl RateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            buckets: Arc::new(RwLock::new(HashMap::new())),
            config,
        }
    }

    pub async fn check_rate_limit(&self, key: &str) -> bool {
        let mut buckets = self.buckets.write().await;

        let bucket = buckets
            .entry(key.to_string())
            .or_insert_with(|| RateLimitBucket::new(&self.config));

        bucket.consume(1.0)
    }

    pub fn get_client_key(
        &self,
        headers: &HeaderMap,
        addr: Option<SocketAddr>,
        session_id: Option<&str>,
    ) -> String {
        if self.config.per_session {
            if let Some(session) = session_id {
                return format!("session:{}", session);
            }
        }

        // Use IP address as fallback
        if let Some(addr) = addr {
            return format!("ip:{}", addr.ip());
        }

        // Use a default key if no identifying info is available
        "default".to_string()
    }
}

pub async fn rate_limit_middleware(
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(rate_limiter): State<Arc<RateLimiter>>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, axum::http::StatusCode> {
    use axum::extract::RawQuery;

    // Extract session ID from headers or query parameters
    let headers = request.headers();
    let session_id = headers.get("x-session-id").and_then(|hv| hv.to_str().ok());

    // Get the rate limit key
    let key = rate_limiter.get_client_key(headers, Some(addr), session_id);

    // Check rate limit
    if !rate_limiter.check_rate_limit(&key).await {
        return Err(axum::http::StatusCode::TOO_MANY_REQUESTS);
    }

    Ok(next.run(request).await)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter() {
        let config = RateLimitConfig {
            requests_per_minute: 10,
            burst_capacity: 5,
            per_session: true,
            per_tenant: false,
        };

        let limiter = RateLimiter::new(config);

        // Should allow burst up to capacity
        for _ in 0..5 {
            assert!(limiter.check_rate_limit("test_session").await);
        }

        // Next request should fail
        assert!(!limiter.check_rate_limit("test_session").await);
    }
}
