//! A2R Evaluation Harness
//!
//! Provides testing, benchmarking, and validation capabilities for the A2R platform.
//! Integrates with ontology runtime for constraint validation and DAG/WIH for task evaluation.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::time::{Duration, Instant};
use thiserror::Error;
use tracing::{debug, error, info, warn};

pub mod benchmark;
pub mod ci;
pub mod conformance;
pub mod drift;
pub mod golden;
pub mod report;
pub mod runner;
pub mod scoring;

use a2r_dag_wih_integration::{TaskState, WorkItemHeader};
use a2r_ontology_runtime::{DomainRegistry, OntologyError, ReasoningEngine, ValidationResult};
use benchmark::{BenchmarkConfig, BenchmarkResult, BenchmarkRunner};
use conformance::{ConformanceChecker, ConformanceRule, ConformanceViolation};
use report::{EvaluationReporter, ReportFormat};
use runner::{TestRunner, TestRunnerConfig};

// ============================================================================
// Core Types
// ============================================================================

/// A test suite containing multiple test cases
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestSuite {
    pub suite_id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub test_cases: Vec<TestCase>,
    #[serde(default)]
    pub setup: Option<TestHook>,
    #[serde(default)]
    pub teardown: Option<TestHook>,
}

/// A single test case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub test_id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub test_type: TestType,
    #[serde(default)]
    pub priority: TestPriority,
    #[serde(default)]
    pub timeout_secs: Option<u64>,
    #[serde(default)]
    pub retry_policy: Option<RetryPolicy>,
    #[serde(flatten)]
    pub definition: TestDefinition,
}

/// Type of test
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TestType {
    /// Unit test for individual components
    Unit,
    /// Integration test across components
    Integration,
    /// End-to-end system test
    E2e,
    /// Performance benchmark
    Benchmark,
    /// Conformance/validation test
    Conformance,
    /// Ontology constraint validation
    Ontology,
    /// Security test
    Security,
    /// Custom test type
    Custom(String),
}

/// Test priority
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum TestPriority {
    Critical,
    High,
    Medium,
    Low,
}

impl Default for TestPriority {
    fn default() -> Self {
        TestPriority::Medium
    }
}

/// Retry policy for flaky tests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    #[serde(default)]
    pub backoff_secs: u64,
}

/// Test definition variants
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "definition_type")]
pub enum TestDefinition {
    /// Rust code-based test
    Code {
        crate_path: String,
        test_fn: String,
    },
    /// Shell command test
    Shell {
        command: String,
        #[serde(default)]
        args: Vec<String>,
        #[serde(default)]
        expected_exit_code: Option<i32>,
        #[serde(default)]
        expected_output_contains: Vec<String>,
    },
    /// HTTP API test
    Http {
        method: HttpMethod,
        url: String,
        #[serde(default)]
        headers: HashMap<String, String>,
        #[serde(default)]
        body: Option<serde_json::Value>,
        #[serde(default)]
        expected_status: u16,
        #[serde(default)]
        expected_response: Option<serde_json::Value>,
    },
    /// Ontology constraint test
    Ontology {
        constraint_id: String,
        test_data: serde_json::Value,
        #[serde(default)]
        expected_valid: bool,
    },
    /// DAG task validation test
    DagTask {
        graph_id: String,
        task_id: String,
        #[serde(default)]
        expected_state: TaskState,
        #[serde(default)]
        validate_dependencies: bool,
    },
    /// Benchmark test
    Benchmark {
        config: BenchmarkConfig,
    },
    /// Conformance test
    Conformance {
        rules: Vec<ConformanceRule>,
    },
}

/// HTTP methods
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
    Patch,
    Head,
    Options,
}

/// Setup/teardown hook
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestHook {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub timeout_secs: u64,
}

// ============================================================================
// Test Results
// ============================================================================

/// Result of running a test suite
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestSuiteResult {
    pub suite_id: String,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub duration_ms: u64,
    pub summary: TestSummary,
    pub test_results: Vec<TestResult>,
    #[serde(default)]
    pub suite_log: Vec<String>,
}

/// Summary statistics for a test run
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TestSummary {
    pub total: usize,
    pub passed: usize,
    pub failed: usize,
    pub skipped: usize,
    pub errors: usize,
}

impl TestSummary {
    /// Calculate pass rate as percentage
    pub fn pass_rate(&self) -> f64 {
        if self.total == 0 {
            return 100.0;
        }
        (self.passed as f64 / self.total as f64) * 100.0
    }

    /// Check if all tests passed
    pub fn all_passed(&self) -> bool {
        self.failed == 0 && self.errors == 0
    }
}

/// Result of a single test
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub test_id: String,
    pub name: String,
    pub status: TestStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub duration_ms: u64,
    #[serde(default)]
    pub attempts: u32,
    #[serde(flatten)]
    pub details: TestResultDetails,
}

/// Test status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TestStatus {
    Passed,
    Failed,
    Skipped,
    Error,
    Timeout,
}

impl fmt::Display for TestStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TestStatus::Passed => write!(f, "PASSED"),
            TestStatus::Failed => write!(f, "FAILED"),
            TestStatus::Skipped => write!(f, "SKIPPED"),
            TestStatus::Error => write!(f, "ERROR"),
            TestStatus::Timeout => write!(f, "TIMEOUT"),
        }
    }
}

/// Detailed test result information
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case", tag = "result_type")]
pub enum TestResultDetails {
    Success {
        #[serde(default)]
        message: String,
    },
    Failure {
        #[serde(default)]
        assertion: String,
        #[serde(default)]
        expected: serde_json::Value,
        #[serde(default)]
        actual: serde_json::Value,
    },
    Error {
        #[serde(default)]
        error_type: String,
        #[serde(default)]
        message: String,
        #[serde(default)]
        stack_trace: Option<String>,
    },
    BenchmarkResult {
        result: BenchmarkResult,
    },
    ConformanceResult {
        #[serde(default)]
        violations: Vec<ConformanceViolation>,
    },
    OntologyResult {
        validation: ValidationResult,
    },
}

// ============================================================================
// Evaluation Harness
// ============================================================================

/// Main evaluation harness for running tests and benchmarks
pub struct EvaluationHarness {
    config: HarnessConfig,
    test_suites: HashMap<String, TestSuite>,
    domain_registry: Option<DomainRegistry>,
    reasoning_engine: Option<ReasoningEngine>,
    reporter: EvaluationReporter,
}

/// Harness configuration
#[derive(Debug, Clone)]
pub struct HarnessConfig {
    pub parallel_jobs: usize,
    pub default_timeout: Duration,
    pub fail_fast: bool,
    pub verbose: bool,
    pub report_format: ReportFormat,
    pub output_dir: std::path::PathBuf,
}

impl Default for HarnessConfig {
    fn default() -> Self {
        Self {
            parallel_jobs: num_cpus::get(),
            default_timeout: Duration::from_secs(300),
            fail_fast: false,
            verbose: false,
            report_format: ReportFormat::Json,
            output_dir: std::path::PathBuf::from(".a2r/evaluations"),
        }
    }
}

impl EvaluationHarness {
    /// Create a new evaluation harness
    pub fn new(config: HarnessConfig) -> Self {
        let reporter = EvaluationReporter::new(&config.output_dir, config.report_format.clone());
        
        Self {
            config,
            test_suites: HashMap::new(),
            domain_registry: None,
            reasoning_engine: None,
            reporter,
        }
    }

    /// Register a domain registry for ontology tests
    pub fn with_domain_registry(mut self, registry: DomainRegistry) -> Self {
        self.domain_registry = Some(registry);
        self
    }

    /// Register a reasoning engine for constraint tests
    pub fn with_reasoning_engine(mut self, engine: ReasoningEngine) -> Self {
        self.reasoning_engine = Some(engine);
        self
    }

    /// Load a test suite from file
    pub fn load_suite(&mut self, path: impl AsRef<std::path::Path>) -> Result<String, HarnessError> {
        let path = path.as_ref();
        let content = std::fs::read_to_string(path)
            .map_err(|e| HarnessError::IoError(format!("Failed to read suite {}: {}", path.display(), e)))?;
        
        let suite: TestSuite = serde_json::from_str(&content)
            .map_err(|e| HarnessError::ParseError(format!("Failed to parse suite {}: {}", path.display(), e)))?;
        
        let suite_id = suite.suite_id.clone();
        self.test_suites.insert(suite_id.clone(), suite);
        
        info!("Loaded test suite: {} from {}", suite_id, path.display());
        Ok(suite_id)
    }

    /// Register a test suite programmatically
    pub fn register_suite(&mut self, suite: TestSuite) -> String {
        let suite_id = suite.suite_id.clone();
        self.test_suites.insert(suite_id.clone(), suite);
        suite_id
    }

    /// Run a single test suite
    pub async fn run_suite(&self, suite_id: &str) -> Result<TestSuiteResult, HarnessError> {
        let suite = self.test_suites.get(suite_id)
            .ok_or_else(|| HarnessError::SuiteNotFound(suite_id.to_string()))?;
        
        info!("Running test suite: {} ({} tests)", suite.name, suite.test_cases.len());
        
        let started_at = Utc::now();
        let mut suite_log = Vec::new();
        
        // Run setup if present
        if let Some(setup) = &suite.setup {
            info!("Running suite setup...");
            self.run_hook(setup, &mut suite_log).await?;
        }
        
        // Run all test cases
        let mut test_results = Vec::new();
        let mut summary = TestSummary::default();
        
        for test_case in &suite.test_cases {
            if self.config.fail_fast && (!summary.all_passed() || summary.errors > 0) {
                info!("Skipping test {} due to fail_fast policy", test_case.test_id);
                summary.skipped += 1;
                continue;
            }
            
            let result = self.run_test(test_case).await;
            
            match &result.status {
                TestStatus::Passed => summary.passed += 1,
                TestStatus::Failed => summary.failed += 1,
                TestStatus::Skipped => summary.skipped += 1,
                TestStatus::Error => summary.errors += 1,
                TestStatus::Timeout => summary.errors += 1,
            }
            summary.total += 1;
            
            test_results.push(result);
        }
        
        // Run teardown if present
        if let Some(teardown) = &suite.teardown {
            info!("Running suite teardown...");
            self.run_hook(teardown, &mut suite_log).await?;
        }
        
        let completed_at = Utc::now();
        let duration_ms = (completed_at - started_at).num_milliseconds() as u64;
        
        let suite_result = TestSuiteResult {
            suite_id: suite_id.to_string(),
            started_at,
            completed_at,
            duration_ms,
            summary,
            test_results,
            suite_log,
        };
        
        // Generate report
        self.reporter.report_suite(&suite_result).await?;
        
        info!(
            "Suite {} completed: {}/{} passed ({:.1}%)",
            suite_id,
            suite_result.summary.passed,
            suite_result.summary.total,
            suite_result.summary.pass_rate()
        );
        
        Ok(suite_result)
    }

    /// Run all registered test suites
    pub async fn run_all_suites(&self) -> Vec<Result<TestSuiteResult, HarnessError>> {
        let mut results = Vec::new();
        
        for suite_id in self.test_suites.keys() {
            results.push(self.run_suite(suite_id).await);
        }
        
        results
    }

    /// Run a single test case
    async fn run_test(&self, test_case: &TestCase) -> TestResult {
        let started_at = Utc::now();
        let mut attempts = 0;
        let max_attempts = test_case.retry_policy.as_ref().map(|r| r.max_attempts).unwrap_or(1);
        
        loop {
            attempts += 1;
            
            let result = self.run_test_once(test_case).await;
            
            if result.status == TestStatus::Passed || attempts >= max_attempts {
                let completed_at = Utc::now();
                let duration_ms = (completed_at - started_at).num_milliseconds() as u64;
                
                return TestResult {
                    test_id: test_case.test_id.clone(),
                    name: test_case.name.clone(),
                    status: result.status,
                    started_at,
                    completed_at,
                    duration_ms,
                    attempts,
                    details: result.details,
                };
            }
            
            // Retry with backoff
            if let Some(policy) = &test_case.retry_policy {
                tokio::time::sleep(Duration::from_secs(policy.backoff_secs * attempts as u64)).await;
            }
        }
    }

    /// Run a test once (no retries)
    async fn run_test_once(&self, test_case: &TestCase) -> TestResult {
        let timeout = test_case.timeout_secs
            .map(Duration::from_secs)
            .unwrap_or(self.config.default_timeout);
        
        match tokio::time::timeout(timeout, self.execute_test(test_case)).await {
            Ok(result) => result,
            Err(_) => TestResult {
                test_id: test_case.test_id.clone(),
                name: test_case.name.clone(),
                status: TestStatus::Timeout,
                started_at: Utc::now(),
                completed_at: Utc::now(),
                duration_ms: timeout.as_millis() as u64,
                attempts: 1,
                details: TestResultDetails::Error {
                    error_type: "Timeout".to_string(),
                    message: format!("Test exceeded timeout of {:?}", timeout),
                    stack_trace: None,
                },
            },
        }
    }

    /// Execute the actual test based on its definition
    async fn execute_test(&self, test_case: &TestCase) -> TestResult {
        let started_at = Utc::now();
        let instant_start = Instant::now();
        
        let (status, details) = match &test_case.definition {
            TestDefinition::Code { crate_path, test_fn } => {
                self.run_code_test(crate_path, test_fn).await
            }
            TestDefinition::Shell { command, args, expected_exit_code, expected_output_contains } => {
                self.run_shell_test(command, args, *expected_exit_code, expected_output_contains).await
            }
            TestDefinition::Http { method, url, headers, body, expected_status, expected_response } => {
                self.run_http_test(method, url, headers, body.as_ref(), *expected_status, expected_response.as_ref()).await
            }
            TestDefinition::Ontology { constraint_id, test_data, expected_valid } => {
                self.run_ontology_test(constraint_id, test_data, *expected_valid).await
            }
            TestDefinition::DagTask { graph_id, task_id, expected_state, validate_dependencies } => {
                self.run_dag_task_test(graph_id, task_id, expected_state, *validate_dependencies).await
            }
            TestDefinition::Benchmark { config } => {
                self.run_benchmark_test(config).await
            }
            TestDefinition::Conformance { rules } => {
                self.run_conformance_test(rules).await
            }
        };
        
        let completed_at = Utc::now();
        let duration_ms = instant_start.elapsed().as_millis() as u64;
        
        TestResult {
            test_id: test_case.test_id.clone(),
            name: test_case.name.clone(),
            status,
            started_at,
            completed_at,
            duration_ms,
            attempts: 1,
            details,
        }
    }

    /// Run code-based test
    async fn run_code_test(
        &self,
        _crate_path: &str,
        _test_fn: &str,
    ) -> (TestStatus, TestResultDetails) {
        // This would typically invoke cargo test on the specified crate/test
        // For now, return a placeholder
        (
            TestStatus::Skipped,
            TestResultDetails::Success {
                message: "Code tests not yet implemented".to_string(),
            },
        )
    }

    /// Run shell command test
    async fn run_shell_test(
        &self,
        command: &str,
        args: &[String],
        expected_exit_code: Option<i32>,
        expected_output_contains: &[String],
    ) -> (TestStatus, TestResultDetails) {
        use tokio::process::Command;
        
        let output = match Command::new(command)
            .args(args)
            .output()
            .await
        {
            Ok(o) => o,
            Err(e) => {
                return (
                    TestStatus::Error,
                    TestResultDetails::Error {
                        error_type: "ProcessError".to_string(),
                        message: format!("Failed to execute command: {}", e),
                        stack_trace: None,
                    },
                );
            }
        };
        
        let exit_code = output.status.code();
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        
        // Check exit code
        if let Some(expected) = expected_exit_code {
            if exit_code != Some(expected) {
                return (
                    TestStatus::Failed,
                    TestResultDetails::Failure {
                        assertion: "exit_code".to_string(),
                        expected: serde_json::json!(expected),
                        actual: serde_json::json!(exit_code),
                    },
                );
            }
        }
        
        // Check output contains expected strings
        for expected in expected_output_contains {
            if !stdout.contains(expected) && !stderr.contains(expected) {
                return (
                    TestStatus::Failed,
                    TestResultDetails::Failure {
                        assertion: "output_contains".to_string(),
                        expected: serde_json::json!(expected),
                        actual: serde_json::json!(stdout.to_string()),
                    },
                );
            }
        }
        
        (
            TestStatus::Passed,
            TestResultDetails::Success {
                message: format!("Command completed with exit code {:?}", exit_code),
            },
        )
    }

    /// Run HTTP API test
    async fn run_http_test(
        &self,
        method: &HttpMethod,
        url: &str,
        headers: &HashMap<String, String>,
        body: Option<&serde_json::Value>,
        expected_status: u16,
        expected_response: Option<&serde_json::Value>,
    ) -> (TestStatus, TestResultDetails) {
        use reqwest::{Client, Method};
        
        let method = match method {
            HttpMethod::Get => Method::GET,
            HttpMethod::Post => Method::POST,
            HttpMethod::Put => Method::PUT,
            HttpMethod::Delete => Method::DELETE,
            HttpMethod::Patch => Method::PATCH,
            HttpMethod::Head => Method::HEAD,
            HttpMethod::Options => Method::OPTIONS,
        };
        
        let client = Client::new();
        let mut request = client.request(method, url);
        
        for (key, value) in headers {
            request = request.header(key, value);
        }
        
        if let Some(body) = body {
            request = request.json(body);
        }
        
        let response = match request.send().await {
            Ok(r) => r,
            Err(e) => {
                return (
                    TestStatus::Error,
                    TestResultDetails::Error {
                        error_type: "HttpError".to_string(),
                        message: format!("HTTP request failed: {}", e),
                        stack_trace: None,
                    },
                );
            }
        };
        
        let status = response.status().as_u16();
        
        // Check status code
        if status != expected_status {
            return (
                TestStatus::Failed,
                TestResultDetails::Failure {
                    assertion: "status_code".to_string(),
                    expected: serde_json::json!(expected_status),
                    actual: serde_json::json!(status),
                },
            );
        }
        
        // Check response body if expected
        if let Some(expected) = expected_response {
            match response.json::<serde_json::Value>().await {
                Ok(actual) => {
                    if &actual != expected {
                        return (
                            TestStatus::Failed,
                            TestResultDetails::Failure {
                                assertion: "response_body".to_string(),
                                expected: expected.clone(),
                                actual,
                            },
                        );
                    }
                }
                Err(e) => {
                    return (
                        TestStatus::Error,
                        TestResultDetails::Error {
                            error_type: "ParseError".to_string(),
                            message: format!("Failed to parse response: {}", e),
                            stack_trace: None,
                        },
                    );
                }
            }
        }
        
        (
            TestStatus::Passed,
            TestResultDetails::Success {
                message: format!("HTTP {} returned status {}", url, status),
            },
        )
    }

    /// Run ontology constraint test
    async fn run_ontology_test(
        &self,
        _constraint_id: &str,
        _test_data: &serde_json::Value,
        _expected_valid: bool,
    ) -> (TestStatus, TestResultDetails) {
        // This would use the reasoning engine to validate constraints
        // Placeholder implementation
        (
            TestStatus::Skipped,
            TestResultDetails::Success {
                message: "Ontology tests require reasoning engine".to_string(),
            },
        )
    }

    /// Run DAG task validation test
    async fn run_dag_task_test(
        &self,
        _graph_id: &str,
        _task_id: &str,
        _expected_state: &TaskState,
        _validate_dependencies: bool,
    ) -> (TestStatus, TestResultDetails) {
        // This would use the DAG/WIH integration to validate task state
        // Placeholder implementation
        (
            TestStatus::Skipped,
            TestResultDetails::Success {
                message: "DAG task tests require DAG engine".to_string(),
            },
        )
    }

    /// Run benchmark test
    async fn run_benchmark_test(
        &self,
        config: &BenchmarkConfig,
    ) -> (TestStatus, TestResultDetails) {
        let runner = BenchmarkRunner::new(config.clone());
        
        match runner.run().await {
            Ok(result) => (
                TestStatus::Passed,
                TestResultDetails::BenchmarkResult { result },
            ),
            Err(e) => (
                TestStatus::Error,
                TestResultDetails::Error {
                    error_type: "BenchmarkError".to_string(),
                    message: e.to_string(),
                    stack_trace: None,
                },
            ),
        }
    }

    /// Run conformance test
    async fn run_conformance_test(
        &self,
        rules: &[ConformanceRule],
    ) -> (TestStatus, TestResultDetails) {
        let checker = ConformanceChecker::new(rules.to_vec());
        
        match checker.check_all().await {
            Ok(violations) => {
                if violations.is_empty() {
                    (
                        TestStatus::Passed,
                        TestResultDetails::ConformanceResult { violations },
                    )
                } else {
                    (
                        TestStatus::Failed,
                        TestResultDetails::ConformanceResult { violations },
                    )
                }
            }
            Err(e) => (
                TestStatus::Error,
                TestResultDetails::Error {
                    error_type: "ConformanceError".to_string(),
                    message: e.to_string(),
                    stack_trace: None,
                },
            ),
        }
    }

    /// Run a setup/teardown hook
    async fn run_hook(
        &self,
        hook: &TestHook,
        _log: &mut Vec<String>,
    ) -> Result<(), HarnessError> {
        use tokio::process::Command;
        
        let output = Command::new(&hook.command)
            .args(&hook.args)
            .output()
            .await
            .map_err(|e| HarnessError::HookError(format!("Hook failed: {}", e)))?;
        
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(HarnessError::HookError(format!("Hook exited with error: {}", stderr)));
        }
        
        Ok(())
    }

    /// Get all loaded suite IDs
    pub fn get_suite_ids(&self) -> Vec<&String> {
        self.test_suites.keys().collect()
    }

    /// Get a specific suite
    pub fn get_suite(&self, suite_id: &str) -> Option<&TestSuite> {
        self.test_suites.get(suite_id)
    }
}

// ============================================================================
// Errors
// ============================================================================

#[derive(Debug, Error)]
pub enum HarnessError {
    #[error("IO error: {0}")]
    IoError(String),
    
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("Test suite not found: {0}")]
    SuiteNotFound(String),
    
    #[error("Test not found: {0}")]
    TestNotFound(String),
    
    #[error("Hook error: {0}")]
    HookError(String),
    
    #[error("Ontology error: {0}")]
    OntologyError(#[from] OntologyError),
    
    #[error("Report error: {0}")]
    ReportError(String),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_suite() -> TestSuite {
        TestSuite {
            suite_id: "test-suite".to_string(),
            name: "Test Suite".to_string(),
            description: "A test suite for testing".to_string(),
            created_at: Utc::now(),
            tags: vec!["unit".to_string()],
            test_cases: vec![
                TestCase {
                    test_id: "test-1".to_string(),
                    name: "Shell Test".to_string(),
                    description: "Tests shell command execution".to_string(),
                    tags: vec![],
                    test_type: TestType::Unit,
                    priority: TestPriority::High,
                    timeout_secs: Some(30),
                    retry_policy: None,
                    definition: TestDefinition::Shell {
                        command: "echo".to_string(),
                        args: vec!["hello".to_string()],
                        expected_exit_code: Some(0),
                        expected_output_contains: vec!["hello".to_string()],
                    },
                },
            ],
            setup: None,
            teardown: None,
        }
    }

    #[tokio::test]
    async fn test_harness_creation() {
        let config = HarnessConfig::default();
        let harness = EvaluationHarness::new(config);
        
        assert!(harness.get_suite_ids().is_empty());
    }

    #[tokio::test]
    async fn test_suite_registration() {
        let config = HarnessConfig::default();
        let mut harness = EvaluationHarness::new(config);
        
        let suite = create_test_suite();
        let suite_id = harness.register_suite(suite);
        
        assert_eq!(harness.get_suite_ids().len(), 1);
        assert!(harness.get_suite(&suite_id).is_some());
    }

    #[tokio::test]
    async fn test_shell_test_execution() {
        let config = HarnessConfig::default();
        let harness = EvaluationHarness::new(config);
        
        let test_case = TestCase {
            test_id: "shell-test".to_string(),
            name: "Shell Test".to_string(),
            description: "Test shell execution".to_string(),
            tags: vec![],
            test_type: TestType::Unit,
            priority: TestPriority::High,
            timeout_secs: Some(10),
            retry_policy: None,
            definition: TestDefinition::Shell {
                command: "echo".to_string(),
                args: vec!["success".to_string()],
                expected_exit_code: Some(0),
                expected_output_contains: vec!["success".to_string()],
            },
        };
        
        let result = harness.run_test(&test_case).await;
        
        assert_eq!(result.status, TestStatus::Passed);
        assert_eq!(result.attempts, 1);
    }

    #[tokio::test]
    async fn test_suite_loading() {
        let temp_dir = TempDir::new().unwrap();
        let suite_path = temp_dir.path().join("test-suite.json");
        
        let suite = create_test_suite();
        let suite_json = serde_json::to_string_pretty(&suite).unwrap();
        std::fs::write(&suite_path, suite_json).unwrap();
        
        let config = HarnessConfig::default();
        let mut harness = EvaluationHarness::new(config);
        
        let suite_id = harness.load_suite(&suite_path).unwrap();
        
        assert_eq!(suite_id, "test-suite");
        assert!(harness.get_suite(&suite_id).is_some());
    }

    #[test]
    fn test_test_summary() {
        let summary = TestSummary {
            total: 10,
            passed: 8,
            failed: 1,
            skipped: 1,
            errors: 0,
        };
        
        assert_eq!(summary.pass_rate(), 80.0);
        assert!(!summary.all_passed());
        
        let perfect = TestSummary {
            total: 5,
            passed: 5,
            failed: 0,
            skipped: 0,
            errors: 0,
        };
        
        assert_eq!(perfect.pass_rate(), 100.0);
        assert!(perfect.all_passed());
    }
}
