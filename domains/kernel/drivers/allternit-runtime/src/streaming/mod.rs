//! Streaming Supervisor
//!
//! Backpressure, rate limiting, and flow control for token streams.

mod backpressure;
mod rate_limiter;
mod supervisor;

pub use backpressure::*;
pub use rate_limiter::*;
pub use supervisor::*;

/// Streaming configuration
#[derive(Debug, Clone, Copy)]
pub struct StreamingConfig {
    pub max_tokens_per_second: u32,
    pub max_buffer_size: usize,
    pub backpressure_threshold: f64, // 0.0-1.0
}

impl Default for StreamingConfig {
    fn default() -> Self {
        Self {
            max_tokens_per_second: 1000,
            max_buffer_size: 10000,
            backpressure_threshold: 0.8,
        }
    }
}

/// Streaming errors
#[derive(Debug, thiserror::Error)]
pub enum StreamingError {
    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Buffer overflow")]
    BufferOverflow,

    #[error("Backpressure timeout")]
    BackpressureTimeout,

    #[error("Stream closed")]
    StreamClosed,
}
