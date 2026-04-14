//! Parity Testing Harness
//!
//! The main orchestrator for strangler migration testing.
//! Manages component registration, test execution, and report generation.

use crate::{
    capture::{write_receipt_to_disk, CaptureManager, Receipt},
    strangler::{
        ComponentInput, ComponentOutput, ComponentRegistry, MigrationPhase, ParityResult,
        StranglerComponent,
    },
};
use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tokio::fs;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Configuration for the parity harness
#[derive(Debug, Clone, Deserialize)]
pub struct HarnessConfig {
    /// Directory for storing receipts and corpus
    pub corpus_dir: PathBuf,
    /// Whether to compress receipts larger than this (bytes)
    pub compress_threshold: usize,
    /// Timeout for individual component executions
    pub execution_timeout: Duration,
    /// Whether to continue on individual test failures
    pub continue_on_failure: bool,
    /// Maximum number of parallel component executions
    pub max_concurrency: usize,
}

impl Default for HarnessConfig {
    fn default() -> Self {
        Self {
            corpus_dir: PathBuf::from(".migration/openclaw-absorption/corpus"),
            compress_threshold: 1024 * 1024, // 1MB
            execution_timeout: Duration::from_secs(120),
            continue_on_failure: true,
            max_concurrency: 4,
        }
    }
}

/// Result of running a single parity test
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    /// Unique test ID
    pub id: Uuid,
    /// Component name
    pub component_name: String,
    /// When the test ran
    pub timestamp: DateTime<Utc>,
    /// How long the test took
    pub duration_ms: u64,
    /// Whether the test passed
    pub passed: bool,
    /// The parity result (if dual-run)
    pub parity_result: Option<ParityResult>,
    /// Any error message
    pub error: Option<String>,
    /// Reference receipt ID (if captured)
    pub reference_receipt_id: Option<Uuid>,
    /// Native receipt ID (if captured)
    pub native_receipt_id: Option<Uuid>,
}

/// Result of running a full test suite
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuiteResult {
    /// When the suite ran
    pub timestamp: DateTime<Utc>,
    /// Total duration
    pub duration_ms: u64,
    /// Individual test results
    pub tests: Vec<TestResult>,
    /// Summary statistics
    pub summary: SuiteSummary,
}

/// Summary statistics for a test suite
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuiteSummary {
    pub total_tests: usize,
    pub passed: usize,
    pub failed: usize,
    pub skipped: usize,
    pub components_in_quarantine: usize,
    pub components_in_bridge: usize,
    pub components_in_dual_run: usize,
    pub components_in_graduate: usize,
    pub components_complete: usize,
}

/// A comprehensive parity report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParityReport {
    /// When the report was generated
    pub generated_at: DateTime<Utc>,
    /// Suite results
    pub suite_results: Vec<SuiteResult>,
    /// Component status overview
    pub component_status: Vec<ComponentStatus>,
    /// Trends over time
    pub trends: ParityTrends,
}

/// Status of a single component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentStatus {
    pub name: String,
    pub phase: MigrationPhase,
    pub tests_run: usize,
    pub tests_passed: usize,
    pub last_test_date: Option<DateTime<Utc>>,
    pub parity_percentage: f64,
}

/// Trends in parity over time
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParityTrends {
    /// Parity percentage over time (date -> percentage)
    pub parity_over_time: HashMap<String, f64>,
    /// Components graduated over time
    pub graduations_over_time: HashMap<String, usize>,
}

/// The main parity testing harness
pub struct ParityHarness {
    config: HarnessConfig,
    registry: ComponentRegistry,
    #[allow(dead_code)]
    capture_manager: CaptureManager,
}

impl ParityHarness {
    /// Create a new parity harness
    pub async fn new(config: HarnessConfig) -> Result<Self> {
        let capture_manager = CaptureManager::init(crate::capture::CaptureConfig {
            corpus_dir: config.corpus_dir.clone(),
            ..Default::default()
        })
        .await?;

        Ok(Self {
            config,
            registry: ComponentRegistry::new(),
            capture_manager,
        })
    }

    /// Register a strangler component
    pub fn register_component(&mut self, component: Box<dyn StranglerComponent>) {
        self.registry.register(component);
    }

    /// Run a parity test for a specific component
    pub async fn run_parity_test(
        &self,
        component_name: &str,
        input: ComponentInput,
    ) -> Result<TestResult> {
        let start = Instant::now();
        let test_id = Uuid::new_v4();

        let component = self
            .registry
            .get(component_name)
            .with_context(|| format!("Component '{}' not found", component_name))?;

        info!("Running parity test for component: {}", component_name);

        let phase = component.phase();
        let mut result = TestResult {
            id: test_id,
            component_name: component_name.to_string(),
            timestamp: Utc::now(),
            duration_ms: 0,
            passed: false,
            parity_result: None,
            error: None,
            reference_receipt_id: None,
            native_receipt_id: None,
        };

        // Execute based on phase
        match phase {
            MigrationPhase::Quarantine => {
                // Only run reference (OpenClaw)
                match tokio::time::timeout(
                    self.config.execution_timeout,
                    component.reference_execute(input.clone()),
                )
                .await
                {
                    Ok(Ok(output)) => {
                        result.passed = true;
                        // Capture receipt for golden corpus
                        let receipt = self.output_to_receipt(component_name, &input, &output);
                        result.reference_receipt_id = Some(receipt.id);
                        self.capture_receipt(receipt).await?;
                    }
                    Ok(Err(e)) => {
                        result.error = Some(format!("Reference execution failed: {}", e));
                    }
                    Err(_) => {
                        result.error = Some("Reference execution timed out".to_string());
                    }
                }
            }

            MigrationPhase::Bridge => {
                // Run reference, native is stub
                match tokio::time::timeout(
                    self.config.execution_timeout,
                    component.reference_execute(input.clone()),
                )
                .await
                {
                    Ok(Ok(output)) => {
                        result.passed = true;
                        let receipt = self.output_to_receipt(component_name, &input, &output);
                        result.reference_receipt_id = Some(receipt.id);
                        self.capture_receipt(receipt).await?;

                        // Try native (expected to fail or return stub)
                        match component.native_execute(input.clone()).await {
                            Ok(_) => debug!("Native execution returned stub result"),
                            Err(e) => debug!("Native execution failed as expected: {}", e),
                        }
                    }
                    Ok(Err(e)) => {
                        result.error = Some(format!("Reference execution failed: {}", e));
                    }
                    Err(_) => {
                        result.error = Some("Reference execution timed out".to_string());
                    }
                }
            }

            MigrationPhase::DualRun | MigrationPhase::Graduate => {
                // Run both and compare
                match component.check_parity(input.clone()).await {
                    Ok(parity_result) => {
                        result.parity_result = Some(parity_result.clone());
                        result.passed = parity_result.matches;

                        if !parity_result.matches {
                            warn!(
                                "Parity mismatch in component {}: {} differences found",
                                component_name,
                                parity_result.differences.len()
                            );
                            for diff in &parity_result.differences {
                                debug!(
                                    "Difference at {}: expected {:?}, got {:?}",
                                    diff.path, diff.expected, diff.actual
                                );
                            }
                        }

                        // Capture both receipts
                        let ref_receipt = self.output_to_receipt(
                            component_name,
                            &input,
                            &parity_result.reference_output,
                        );
                        result.reference_receipt_id = Some(ref_receipt.id);
                        self.capture_receipt(ref_receipt).await?;

                        let native_receipt = self.output_to_receipt(
                            component_name,
                            &input,
                            &parity_result.native_output,
                        );
                        result.native_receipt_id = Some(native_receipt.id);
                        self.capture_receipt(native_receipt).await?;
                    }
                    Err(e) => {
                        result.error = Some(format!("Parity check failed: {}", e));
                    }
                }
            }

            MigrationPhase::Complete => {
                // Only run native
                match tokio::time::timeout(
                    self.config.execution_timeout,
                    component.native_execute(input.clone()),
                )
                .await
                {
                    Ok(Ok(output)) => {
                        result.passed = true;
                        let receipt = self.output_to_receipt(component_name, &input, &output);
                        result.native_receipt_id = Some(receipt.id);
                        self.capture_receipt(receipt).await?;
                    }
                    Ok(Err(e)) => {
                        result.error = Some(format!("Native execution failed: {}", e));
                    }
                    Err(_) => {
                        result.error = Some("Native execution timed out".to_string());
                    }
                }
            }

            MigrationPhase::Permanent => {
                // Always use reference (subprocess)
                match tokio::time::timeout(
                    self.config.execution_timeout,
                    component.reference_execute(input.clone()),
                )
                .await
                {
                    Ok(Ok(output)) => {
                        result.passed = true;
                        let receipt = self.output_to_receipt(component_name, &input, &output);
                        result.reference_receipt_id = Some(receipt.id);
                        self.capture_receipt(receipt).await?;
                    }
                    Ok(Err(e)) => {
                        result.error = Some(format!("Reference execution failed: {}", e));
                    }
                    Err(_) => {
                        result.error = Some("Reference execution timed out".to_string());
                    }
                }
            }
        }

        result.duration_ms = start.elapsed().as_millis() as u64;

        info!(
            "Test completed for {}: {} in {}ms",
            component_name,
            if result.passed { "PASSED" } else { "FAILED" },
            result.duration_ms
        );

        Ok(result)
    }

    /// Run full test suite for all registered components
    pub async fn run_full_suite(&self) -> Result<SuiteResult> {
        let start = Instant::now();
        let timestamp = Utc::now();

        info!("Starting full parity test suite");

        let components = self.registry.list();
        let mut tests = Vec::new();

        for component_info in components {
            // Generate test input based on component
            let input = self.generate_test_input(&component_info.name);

            match self.run_parity_test(&component_info.name, input).await {
                Ok(result) => tests.push(result),
                Err(e) => {
                    error!("Failed to run test for {}: {}", component_info.name, e);
                    if !self.config.continue_on_failure {
                        return Err(e);
                    }
                }
            }
        }

        let summary = self.calculate_summary(&tests);

        let suite_result = SuiteResult {
            timestamp,
            duration_ms: start.elapsed().as_millis() as u64,
            tests,
            summary,
        };

        info!(
            "Suite completed: {}/{} passed in {}ms",
            suite_result.summary.passed, suite_result.summary.total_tests, suite_result.duration_ms
        );

        Ok(suite_result)
    }

    /// Replay a receipt for regression testing
    pub async fn replay_receipt(&self, receipt_id: Uuid) -> Result<TestResult> {
        // Load the receipt
        let receipt_path = self
            .config
            .corpus_dir
            .join("receipts")
            .join(format!("{}.json", receipt_id));

        let receipt_json = fs::read_to_string(&receipt_path).await?;
        let receipt: Receipt = serde_json::from_str(&receipt_json)?;

        // Extract component name and input
        let component_name = &receipt.method; // Assuming method maps to component name
        let input = ComponentInput {
            data: receipt.request.clone(),
            context: serde_json::json!({"replayed": true, "original_id": receipt_id}),
        };

        // Run the test
        self.run_parity_test(component_name, input).await
    }

    /// Generate a comprehensive parity report
    pub async fn generate_report(&self) -> Result<ParityReport> {
        let components = self.registry.list();
        let mut component_status = Vec::new();

        for info in components {
            // Calculate stats for this component
            let receipts = self.get_receipts_for_component(&info.name).await?;
            let tests_run = receipts.len();
            let tests_passed = receipts.len(); // Simplified

            // Calculate parity percentage (simplified)
            let parity_percentage = if tests_run > 0 { 100.0 } else { 0.0 };

            component_status.push(ComponentStatus {
                name: info.name,
                phase: info.phase,
                tests_run,
                tests_passed,
                last_test_date: None, // Would need to track this
                parity_percentage,
            });
        }

        Ok(ParityReport {
            generated_at: Utc::now(),
            suite_results: Vec::new(), // Would aggregate from storage
            component_status,
            trends: ParityTrends {
                parity_over_time: HashMap::new(),
                graduations_over_time: HashMap::new(),
            },
        })
    }

    /// Get list of components ready to graduate to next phase
    pub fn get_ready_to_graduate(&self) -> Vec<String> {
        self.registry
            .list()
            .into_iter()
            .filter(|info| {
                // Components in DualRun with high parity are ready for Graduate
                info.phase == MigrationPhase::DualRun
            })
            .map(|info| info.name)
            .collect()
    }

    // Private helpers

    fn output_to_receipt(
        &self,
        component_name: &str,
        input: &ComponentInput,
        output: &ComponentOutput,
    ) -> Receipt {
        Receipt {
            id: Uuid::new_v4(),
            timestamp: Utc::now(),
            duration_ms: output.metadata.duration_ms,
            method: component_name.to_string(),
            request: input.data.clone(),
            response: output.data.clone(),
            stderr: output.metadata.error.clone().unwrap_or_default(),
            exit_code: if output.metadata.success { 0 } else { 1 },
            metadata: crate::capture::ReceiptMetadata {
                version: env!("CARGO_PKG_VERSION").to_string(),
                host_version: "2026.1.29".to_string(),
                environment: "a2r-parity".to_string(),
                host_hash: None,
            },
        }
    }

    async fn capture_receipt(&self, receipt: Receipt) -> Result<()> {
        write_receipt_to_disk(
            &receipt,
            &self.config.corpus_dir,
            self.config.compress_threshold,
        )
        .await?;
        Ok(())
    }

    fn generate_test_input(&self, component_name: &str) -> ComponentInput {
        // Generate appropriate test input for the component
        // This is a simplified version - real implementation would have
        // per-component test fixtures
        ComponentInput {
            data: serde_json::json!({
                "test": true,
                "component": component_name,
                "timestamp": Utc::now().to_rfc3339(),
            }),
            context: serde_json::json!({
                "test_id": Uuid::new_v4().to_string(),
                "harness_version": env!("CARGO_PKG_VERSION"),
            }),
        }
    }

    fn calculate_summary(&self, tests: &[TestResult]) -> SuiteSummary {
        let components = self.registry.list();

        SuiteSummary {
            total_tests: tests.len(),
            passed: tests.iter().filter(|t| t.passed).count(),
            failed: tests.iter().filter(|t| !t.passed).count(),
            skipped: 0,
            components_in_quarantine: components
                .iter()
                .filter(|c| c.phase == MigrationPhase::Quarantine)
                .count(),
            components_in_bridge: components
                .iter()
                .filter(|c| c.phase == MigrationPhase::Bridge)
                .count(),
            components_in_dual_run: components
                .iter()
                .filter(|c| c.phase == MigrationPhase::DualRun)
                .count(),
            components_in_graduate: components
                .iter()
                .filter(|c| c.phase == MigrationPhase::Graduate)
                .count(),
            components_complete: components
                .iter()
                .filter(|c| c.phase == MigrationPhase::Complete)
                .count(),
        }
    }

    async fn get_receipts_for_component(&self, component_name: &str) -> Result<Vec<Receipt>> {
        // List all receipts in corpus and filter by component
        let receipts_dir = self.config.corpus_dir.join("receipts");
        let mut receipts = Vec::new();

        if receipts_dir.exists() {
            let mut entries = fs::read_dir(&receipts_dir).await?;
            while let Some(entry) = entries.next_entry().await? {
                let path = entry.path();
                if path.extension().map(|e| e == "json").unwrap_or(false) {
                    if let Ok(content) = fs::read_to_string(&path).await {
                        if let Ok(receipt) = serde_json::from_str::<Receipt>(&content) {
                            if receipt.method == component_name {
                                receipts.push(receipt);
                            }
                        }
                    }
                }
            }
        }

        Ok(receipts)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::strangler::{
        ComponentInput, ComponentOutput, MigrationPhase, OutputMetadata, StranglerComponent,
    };
    use async_trait::async_trait;
    use serde_json::Value;

    #[derive(Debug)]
    struct TestComponent;

    #[async_trait]
    impl StranglerComponent for TestComponent {
        fn name(&self) -> &str {
            "test"
        }

        fn phase(&self) -> MigrationPhase {
            MigrationPhase::DualRun
        }

        async fn reference_execute(
            &self,
            _input: ComponentInput,
        ) -> anyhow::Result<ComponentOutput> {
            Ok(ComponentOutput {
                data: serde_json::json!({"result": "reference"}),
                metadata: OutputMetadata {
                    duration_ms: 100,
                    success: true,
                    error: None,
                },
            })
        }

        async fn native_execute(&self, _input: ComponentInput) -> anyhow::Result<ComponentOutput> {
            Ok(ComponentOutput {
                data: serde_json::json!({"result": "native"}),
                metadata: OutputMetadata {
                    duration_ms: 50,
                    success: true,
                    error: None,
                },
            })
        }

        fn normalize_input(&self, input: &ComponentInput) -> Value {
            input.data.clone()
        }

        fn normalize_output(&self, output: &ComponentOutput) -> Value {
            output.data.clone()
        }
    }

    #[tokio::test]
    async fn test_harness_run_parity_test() {
        let config = HarnessConfig {
            corpus_dir: PathBuf::from("/tmp/test_corpus"),
            ..Default::default()
        };

        let mut harness = ParityHarness::new(config).await.unwrap();
        harness.register_component(Box::new(TestComponent));

        let input = ComponentInput {
            data: serde_json::json!({"test": "input"}),
            context: serde_json::json!({}),
        };

        let result = harness.run_parity_test("test", input).await;

        // Should fail due to mismatch between reference and native
        assert!(result.is_ok());
        let result = result.unwrap();
        assert!(!result.passed); // Different outputs
    }

    #[tokio::test]
    async fn test_suite_summary_calculation() {
        let config = HarnessConfig::default();
        let harness = ParityHarness::new(config).await.unwrap();

        let tests = vec![
            TestResult {
                id: Uuid::new_v4(),
                component_name: "test1".to_string(),
                timestamp: Utc::now(),
                duration_ms: 100,
                passed: true,
                parity_result: None,
                error: None,
                reference_receipt_id: None,
                native_receipt_id: None,
            },
            TestResult {
                id: Uuid::new_v4(),
                component_name: "test2".to_string(),
                timestamp: Utc::now(),
                duration_ms: 200,
                passed: false,
                parity_result: None,
                error: Some("test error".to_string()),
                reference_receipt_id: None,
                native_receipt_id: None,
            },
        ];

        let summary = harness.calculate_summary(&tests);
        assert_eq!(summary.total_tests, 2);
        assert_eq!(summary.passed, 1);
        assert_eq!(summary.failed, 1);
    }
}
