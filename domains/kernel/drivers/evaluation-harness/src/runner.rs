//! Runner Module
//!
//! Test runner configuration and utilities.

use serde::{Deserialize, Serialize};

/// Test runner configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestRunnerConfig {
    /// Number of parallel workers
    #[serde(default = "default_workers")]
    pub workers: usize,
    /// Default timeout for tests
    #[serde(default = "default_timeout")]
    pub default_timeout_secs: u64,
    /// Whether to stop on first failure
    #[serde(default)]
    pub fail_fast: bool,
    /// Whether to capture output
    #[serde(default = "default_true")]
    pub capture_output: bool,
    /// Test filters
    #[serde(default)]
    pub filters: Vec<String>,
}

impl Default for TestRunnerConfig {
    fn default() -> Self {
        Self {
            workers: default_workers(),
            default_timeout_secs: default_timeout(),
            fail_fast: false,
            capture_output: true,
            filters: vec![],
        }
    }
}

fn default_workers() -> usize {
    num_cpus::get()
}

fn default_timeout() -> u64 {
    300
}

fn default_true() -> bool {
    true
}

/// Test runner
pub struct TestRunner {
    config: TestRunnerConfig,
}

impl TestRunner {
    /// Create a new test runner
    pub fn new(config: TestRunnerConfig) -> Self {
        Self { config }
    }

    /// Get the runner configuration
    pub fn config(&self) -> &TestRunnerConfig {
        &self.config
    }
}
