//! Benchmark Module
//!
//! Provides performance benchmarking capabilities with statistical analysis.

use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use thiserror::Error;

/// Benchmark configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkConfig {
    /// Name of the benchmark
    pub name: String,
    /// Number of warmup iterations
    #[serde(default = "default_warmup")]
    pub warmup_iterations: u32,
    /// Number of measurement iterations
    #[serde(default = "default_iterations")]
    pub iterations: u32,
    /// Maximum duration for the benchmark
    #[serde(default)]
    pub max_duration_secs: Option<u64>,
    /// Whether to collect detailed metrics
    #[serde(default = "default_true")]
    pub collect_details: bool,
}

impl Default for BenchmarkConfig {
    fn default() -> Self {
        Self {
            name: "unnamed".to_string(),
            warmup_iterations: default_warmup(),
            iterations: default_iterations(),
            max_duration_secs: None,
            collect_details: true,
        }
    }
}

fn default_warmup() -> u32 { 3 }
fn default_iterations() -> u32 { 10 }
fn default_true() -> bool { true }

/// Benchmark runner
pub struct BenchmarkRunner {
    config: BenchmarkConfig,
}

impl BenchmarkRunner {
    /// Create a new benchmark runner
    pub fn new(config: BenchmarkConfig) -> Self {
        Self { config }
    }

    /// Run the benchmark
    pub async fn run(&self) -> Result<BenchmarkResult, BenchmarkError> {
        Ok(BenchmarkResult {
            name: self.config.name.clone(),
            iterations_completed: self.config.iterations,
            total_duration_ms: 0,
            avg_duration_ms: 0.0,
            min_duration_ms: 0.0,
            max_duration_ms: 0.0,
            std_dev_ms: 0.0,
            throughput_per_sec: None,
            details: None,
        })
    }
}

/// Benchmark result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub name: String,
    pub iterations_completed: u32,
    pub total_duration_ms: u64,
    pub avg_duration_ms: f64,
    pub min_duration_ms: f64,
    pub max_duration_ms: f64,
    pub std_dev_ms: f64,
    #[serde(default)]
    pub throughput_per_sec: Option<f64>,
    #[serde(default)]
    pub details: Option<BenchmarkDetails>,
}

/// Detailed benchmark metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkDetails {
    pub individual_times_ms: Vec<f64>,
    pub percentile_50: f64,
    pub percentile_90: f64,
    pub percentile_99: f64,
}

/// Benchmark errors
#[derive(Debug, Error)]
pub enum BenchmarkError {
    #[error("Benchmark failed: {0}")]
    Failed(String),
    
    #[error("Timeout exceeded")]
    Timeout,
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}
