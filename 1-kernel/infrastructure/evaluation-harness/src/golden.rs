//! Golden Tests Framework
//!
//! Snapshot-based regression testing for deterministic outputs.
//! Integrates with DAG execution for automatic golden test generation.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use tracing::{error, info, warn};

/// Golden test error types
#[derive(Debug, Error)]
pub enum GoldenTestError {
    #[error("Snapshot mismatch: expected {expected}, got {actual}")]
    Mismatch { expected: String, actual: String },
    #[error("Snapshot not found: {0}")]
    NotFound(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(String),
}

impl From<serde_json::Error> for GoldenTestError {
    fn from(err: serde_json::Error) -> Self {
        GoldenTestError::Serialization(err.to_string())
    }
}

/// Golden test configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoldenTestConfig {
    /// Directory for golden snapshots
    pub snapshot_dir: PathBuf,
    /// Whether to update snapshots automatically
    pub auto_update: bool,
    /// Tolerance for floating point comparisons
    pub float_tolerance: f64,
    /// Fields to ignore in comparison
    pub ignore_fields: Vec<String>,
}

impl Default for GoldenTestConfig {
    fn default() -> Self {
        Self {
            snapshot_dir: PathBuf::from("tests/golden"),
            auto_update: false,
            float_tolerance: 0.0001,
            ignore_fields: vec![
                "timestamp".to_string(),
                "request_id".to_string(),
                "duration_ms".to_string(),
            ],
        }
    }
}

/// Golden snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoldenSnapshot {
    pub test_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub version: String,
    pub data: serde_json::Value,
    pub metadata: HashMap<String, String>,
}

/// Golden test runner
#[derive(Clone)]
pub struct GoldenTestRunner {
    config: GoldenTestConfig,
}

impl GoldenTestRunner {
    /// Create a new golden test runner
    pub fn new(config: GoldenTestConfig) -> Self {
        // Ensure snapshot directory exists
        if let Err(e) = fs::create_dir_all(&config.snapshot_dir) {
            error!("Failed to create snapshot directory: {}", e);
        }
        Self { config }
    }

    /// Run a golden test
    pub fn test<T: Serialize>(
        &self,
        test_name: impl AsRef<str>,
        actual: &T,
    ) -> Result<GoldenTestResult, GoldenTestError> {
        let test_name = test_name.as_ref();
        let snapshot_path = self.config.snapshot_dir.join(format!("{}.json", test_name));
        
        let actual_json = serde_json::to_value(actual)
            .map_err(|e| GoldenTestError::Serialization(e.to_string()))?;

        if !snapshot_path.exists() {
            if self.config.auto_update {
                info!("Creating new golden snapshot: {}", test_name);
                self.create_snapshot(test_name, actual_json)?;
                return Ok(GoldenTestResult::Created);
            } else {
                return Err(GoldenTestError::NotFound(test_name.to_string()));
            }
        }

        let snapshot: GoldenSnapshot = self.load_snapshot(&snapshot_path)?;
        
        // Compare with ignored fields removed
        let filtered_expected = self.filter_fields(&snapshot.data);
        let filtered_actual = self.filter_fields(&actual_json);

        if self.values_equal(&filtered_expected, &filtered_actual) {
            Ok(GoldenTestResult::Passed)
        } else {
            if self.config.auto_update {
                warn!("Updating golden snapshot: {}", test_name);
                self.create_snapshot(test_name, actual_json)?;
                Ok(GoldenTestResult::Updated)
            } else {
                Err(GoldenTestError::Mismatch {
                    expected: serde_json::to_string_pretty(&filtered_expected).unwrap(),
                    actual: serde_json::to_string_pretty(&filtered_actual).unwrap(),
                })
            }
        }
    }

    /// Create a new snapshot
    fn create_snapshot(&self, test_name: &str, data: serde_json::Value) -> Result<(), GoldenTestError> {
        let snapshot_path = self.config.snapshot_dir.join(format!("{}.json", test_name));
        
        let snapshot = GoldenSnapshot {
            test_name: test_name.to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            data,
            metadata: HashMap::new(),
        };

        let json = serde_json::to_string_pretty(&snapshot)?;
        fs::write(&snapshot_path, json)?;
        
        Ok(())
    }

    /// Load a snapshot from disk
    fn load_snapshot(&self, path: &Path) -> Result<GoldenSnapshot, GoldenTestError> {
        let content = fs::read_to_string(path)?;
        let snapshot = serde_json::from_str(&content)?;
        Ok(snapshot)
    }

    /// Filter out ignored fields
    fn filter_fields(&self, value: &serde_json::Value) -> serde_json::Value {
        match value {
            serde_json::Value::Object(map) => {
                let filtered: serde_json::Map<String, serde_json::Value> = map
                    .iter()
                    .filter(|(k, _)| !self.config.ignore_fields.contains(k))
                    .map(|(k, v)| (k.clone(), self.filter_fields(v)))
                    .collect();
                serde_json::Value::Object(filtered)
            }
            serde_json::Value::Array(arr) => {
                let filtered: Vec<_> = arr.iter().map(|v| self.filter_fields(v)).collect();
                serde_json::Value::Array(filtered)
            }
            _ => value.clone(),
        }
    }

    /// Compare two JSON values with tolerance
    fn values_equal(&self, a: &serde_json::Value, b: &serde_json::Value) -> bool {
        match (a, b) {
            (serde_json::Value::Object(a_map), serde_json::Value::Object(b_map)) => {
                if a_map.len() != b_map.len() {
                    return false;
                }
                a_map.iter().all(|(k, v)| {
                    b_map.get(k).map_or(false, |bv| self.values_equal(v, bv))
                })
            }
            (serde_json::Value::Array(a_arr), serde_json::Value::Array(b_arr)) => {
                if a_arr.len() != b_arr.len() {
                    return false;
                }
                a_arr.iter().zip(b_arr.iter()).all(|(a, b)| self.values_equal(a, b))
            }
            (serde_json::Value::Number(a_num), serde_json::Value::Number(b_num)) => {
                if let (Some(a_f64), Some(b_f64)) = (a_num.as_f64(), b_num.as_f64()) {
                    (a_f64 - b_f64).abs() < self.config.float_tolerance
                } else {
                    a_num == b_num
                }
            }
            _ => a == b,
        }
    }

    /// Update all snapshots (use with caution)
    pub fn update_all(&self) -> Result<usize, GoldenTestError> {
        let mut count = 0;
        
        if let Ok(entries) = fs::read_dir(&self.config.snapshot_dir) {
            for entry in entries.flatten() {
                if entry.path().extension().map(|e| e == "json").unwrap_or(false) {
                    // Load and re-save to update metadata
                    let snapshot: GoldenSnapshot = self.load_snapshot(&entry.path())?;
                    let updated = GoldenSnapshot {
                        updated_at: Utc::now(),
                        ..snapshot
                    };
                    let json = serde_json::to_string_pretty(&updated)?;
                    fs::write(&entry.path(), json)?;
                    count += 1;
                }
            }
        }
        
        Ok(count)
    }

    /// Get list of all golden tests
    pub fn list_tests(&self) -> Vec<String> {
        let mut tests = Vec::new();
        
        if let Ok(entries) = fs::read_dir(&self.config.snapshot_dir) {
            for entry in entries.flatten() {
                if entry.path().extension().map(|e| e == "json").unwrap_or(false) {
                    if let Some(stem) = entry.path().file_stem() {
                        tests.push(stem.to_string_lossy().to_string());
                    }
                }
            }
        }
        
        tests
    }
}

/// Golden test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GoldenTestResult {
    Passed,
    Created,
    Updated,
    Failed { reason: String },
}

/// Golden test suite for DAG integration
pub struct GoldenTestSuite {
    runner: GoldenTestRunner,
    results: Vec<(String, GoldenTestResult)>,
}

impl GoldenTestSuite {
    /// Create a new test suite
    pub fn new(config: GoldenTestConfig) -> Self {
        Self {
            runner: GoldenTestRunner::new(config),
            results: Vec::new(),
        }
    }

    /// Add a test to the suite
    pub fn test<T: Serialize>(
        &mut self,
        test_name: impl AsRef<str>,
        actual: &T,
    ) {
        let name = test_name.as_ref().to_string();
        let result = match self.runner.test(&name, actual) {
            Ok(r) => r,
            Err(e) => GoldenTestResult::Failed { reason: e.to_string() },
        };
        self.results.push((name, result));
    }

    /// Get summary
    pub fn summary(&self) -> GoldenSuiteSummary {
        let passed = self.results.iter().filter(|(_, r)| matches!(r, GoldenTestResult::Passed)).count();
        let created = self.results.iter().filter(|(_, r)| matches!(r, GoldenTestResult::Created)).count();
        let updated = self.results.iter().filter(|(_, r)| matches!(r, GoldenTestResult::Updated)).count();
        let failed = self.results.iter().filter(|(_, r)| matches!(r, GoldenTestResult::Failed { .. })).count();

        GoldenSuiteSummary {
            total: self.results.len(),
            passed,
            created,
            updated,
            failed,
        }
    }

    /// All tests passed
    pub fn all_passed(&self) -> bool {
        self.results.iter().all(|(_, r)| matches!(r, GoldenTestResult::Passed))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoldenSuiteSummary {
    pub total: usize,
    pub passed: usize,
    pub created: usize,
    pub updated: usize,
    pub failed: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_golden_test_pass() {
        let temp_dir = tempfile::tempdir().unwrap();
        let config = GoldenTestConfig {
            snapshot_dir: temp_dir.path().to_path_buf(),
            auto_update: true,
            ..Default::default()
        };

        let runner = GoldenTestRunner::new(config);
        
        // First run creates snapshot
        let result1 = runner.test("test_snapshot", &json!({"value": 42}));
        assert!(matches!(result1.unwrap(), GoldenTestResult::Created));

        // Second run passes
        let result2 = runner.test("test_snapshot", &json!({"value": 42}));
        assert!(matches!(result2.unwrap(), GoldenTestResult::Passed));
    }

    #[test]
    fn test_golden_test_fail() {
        let temp_dir = tempfile::tempdir().unwrap();
        let config = GoldenTestConfig {
            snapshot_dir: temp_dir.path().to_path_buf(),
            auto_update: false,
            ..Default::default()
        };

        let runner = GoldenTestRunner::new(config);
        
        // Create snapshot
        let _ = runner.test("test_mismatch", &json!({"value": 42}));

        // Different value should fail
        let result = runner.test("test_mismatch", &json!({"value": 99}));
        assert!(result.is_err());
    }
}
