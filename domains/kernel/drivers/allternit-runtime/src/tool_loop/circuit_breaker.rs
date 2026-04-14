//! Circuit Breaker
//!
//! Prevents cascading failures by stopping calls to failing tools.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Circuit breaker configuration
#[derive(Debug, Clone, Copy)]
pub struct CircuitConfig {
    pub failure_threshold: u32,
    pub recovery_timeout_secs: u64,
}

impl Default for CircuitConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            recovery_timeout_secs: 60,
        }
    }
}

/// Circuit breaker states
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum State {
    Closed,   // Normal operation
    Open,     // Failing, rejecting calls
    HalfOpen, // Testing if recovered
}

/// Circuit breaker for tool execution
pub struct CircuitBreaker {
    failure_count: AtomicU32,
    success_count: AtomicU32,
    state: Mutex<State>,
    last_failure: Mutex<Option<Instant>>,
    config: CircuitConfig,
}

impl CircuitBreaker {
    pub fn new(config: CircuitConfig) -> Self {
        Self {
            failure_count: AtomicU32::new(0),
            success_count: AtomicU32::new(0),
            state: Mutex::new(State::Closed),
            last_failure: Mutex::new(None),
            config,
        }
    }

    /// Check if circuit is open (should reject calls)
    pub fn is_open(&self) -> bool {
        let mut state = self.state.lock().unwrap();

        match *state {
            State::Open => {
                // Check if recovery timeout elapsed
                let last = self.last_failure.lock().unwrap();
                if let Some(last) = *last {
                    if last.elapsed() > Duration::from_secs(self.config.recovery_timeout_secs) {
                        // Try half-open
                        *state = State::HalfOpen;
                        return false;
                    }
                }
                true
            }
            State::HalfOpen | State::Closed => false,
        }
    }

    /// Record a successful call
    pub fn record_success(&self) {
        self.success_count.fetch_add(1, Ordering::Relaxed);

        let mut state = self.state.lock().unwrap();
        if *state == State::HalfOpen {
            // Recovery successful
            *state = State::Closed;
            self.failure_count.store(0, Ordering::Relaxed);
        }
    }

    /// Record a failed call
    pub fn record_failure(&self) {
        let failures = self.failure_count.fetch_add(1, Ordering::Relaxed);
        *self.last_failure.lock().unwrap() = Some(Instant::now());

        if failures + 1 >= self.config.failure_threshold {
            let mut state = self.state.lock().unwrap();
            *state = State::Open;
        }
    }

    pub fn failure_count(&self) -> u32 {
        self.failure_count.load(Ordering::Relaxed)
    }

    pub fn success_count(&self) -> u32 {
        self.success_count.load(Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_circuit_starts_closed() {
        let cb = CircuitBreaker::new(CircuitConfig::default());
        assert!(!cb.is_open());
    }

    #[test]
    fn test_circuit_opens_after_failures() {
        let cb = CircuitBreaker::new(CircuitConfig {
            failure_threshold: 3,
            recovery_timeout_secs: 60,
        });

        cb.record_failure();
        cb.record_failure();
        assert!(!cb.is_open());

        cb.record_failure();
        assert!(cb.is_open());
    }

    #[test]
    fn test_circuit_closes_after_success() {
        let cb = CircuitBreaker::new(CircuitConfig {
            failure_threshold: 2,
            recovery_timeout_secs: 60,
        });

        cb.record_failure();
        cb.record_failure();
        assert!(cb.is_open());

        // Simulate half-open by manually setting state
        *cb.state.lock().unwrap() = State::HalfOpen;
        cb.record_success();

        assert!(!cb.is_open());
        assert_eq!(cb.failure_count(), 0);
    }
}
