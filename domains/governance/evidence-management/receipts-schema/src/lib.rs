//! Allternit Receipts Schema
//!
//! Provides cryptographic receipts for tool and workflow execution.
//! Receipts serve as tamper-evident proofs of execution that can be verified
//! and audited.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tracing::info;

pub mod verification;
pub mod storage;
pub mod auto_emission;

use storage::ReceiptStore;

pub use auto_emission::{ReceiptAutoEmitter, AutoEmissionConfig, ToolExecutionContext, SystemLawReceiptIntegration};

// ============================================================================
// Core Receipt Types
// ============================================================================

/// A cryptographic receipt for tool/workflow execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Receipt {
    /// Unique receipt ID
    pub receipt_id: String,
    /// Timestamp when receipt was created
    pub created_at: DateTime<Utc>,
    /// Run ID (execution instance)
    pub run_id: String,
    /// Workflow ID
    pub workflow_id: String,
    /// Node ID in the workflow
    pub node_id: String,
    /// WIH (Work Item Header) ID
    pub wih_id: String,
    /// Tool ID
    pub tool_id: String,
    /// Receipt kind (injection_marker, context_pack_seal, tool_call_pre, tool_call_post, etc.)
    #[serde(default)]
    pub kind: String,
    /// Hash of tool definition
    pub tool_def_hash: String,
    /// Hash of policy decision
    pub policy_decision_hash: String,
    /// Hash of pre-tool event
    pub pretool_event_hash: String,
    /// Hashes of inputs
    pub input_hashes: Vec<String>,
    /// Hashes of outputs
    pub output_hashes: Vec<String>,
    /// Artifact manifest
    pub artifact_manifest: Vec<ArtifactEntry>,
    /// Write scope proof
    pub write_scope_proof: WriteScopeProof,
    /// Execution details
    pub execution: ExecutionDetails,
    /// Idempotency key
    pub idempotency_key: String,
    /// Retry count
    pub retry_count: u32,
    /// Trace ID for distributed tracing
    pub trace_id: String,
    /// Correlation ID for tracing across events
    #[serde(default)]
    pub correlation_id: String,
    /// Environment hash
    pub environment_hash: String,
    /// Additional metadata
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Artifact entry in the manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactEntry {
    /// File path
    pub path: String,
    /// Content hash
    pub hash: String,
    /// File size in bytes
    pub size: u64,
    /// Media type
    pub media_type: String,
}

/// Write scope proof
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WriteScopeProof {
    /// Declared write paths
    pub declared: Vec<String>,
    /// Actual written paths
    pub actual: Vec<String>,
}

/// Execution details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionDetails {
    /// Exit code
    pub exit_code: i32,
    /// Hash of stderr
    pub stderr_hash: String,
    /// Hash of stdout
    pub stdout_hash: String,
    /// Duration in milliseconds
    pub duration_ms: u64,
}

/// Receipt header (for verification)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptHeader {
    pub receipt_id: String,
    pub created_at: DateTime<Utc>,
    pub run_id: String,
    pub workflow_id: String,
    pub tool_id: String,
}

/// Receipt signature
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptSignature {
    pub algorithm: String,
    pub public_key_hash: String,
    pub signature: String,
}

/// Signed receipt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedReceipt {
    pub header: ReceiptHeader,
    pub payload_hash: String,
    pub signature: ReceiptSignature,
}

/// Receipt bundle (multiple receipts for a workflow)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptBundle {
    pub bundle_id: String,
    pub workflow_id: String,
    pub run_id: String,
    pub created_at: DateTime<Utc>,
    pub receipts: Vec<Receipt>,
    pub aggregate_hash: String,
}

// ============================================================================
// Receipt Builder
// ============================================================================

/// Builder for creating receipts
pub struct ReceiptBuilder {
    receipt: Receipt,
}

impl ReceiptBuilder {
    /// Create a new receipt builder
    pub fn new(run_id: impl Into<String>, workflow_id: impl Into<String>) -> Self {
        Self {
            receipt: Receipt {
                receipt_id: format!("rcpt-{}", uuid::Uuid::new_v4().simple()),
                created_at: Utc::now(),
                run_id: run_id.into(),
                workflow_id: workflow_id.into(),
                node_id: String::new(),
                wih_id: String::new(),
                tool_id: String::new(),
                kind: String::new(),
                tool_def_hash: String::new(),
                policy_decision_hash: String::new(),
                pretool_event_hash: String::new(),
                input_hashes: Vec::new(),
                output_hashes: Vec::new(),
                artifact_manifest: Vec::new(),
                write_scope_proof: WriteScopeProof {
                    declared: Vec::new(),
                    actual: Vec::new(),
                },
                execution: ExecutionDetails {
                    exit_code: 0,
                    stderr_hash: String::new(),
                    stdout_hash: String::new(),
                    duration_ms: 0,
                },
                idempotency_key: format!("idem-{}", uuid::Uuid::new_v4().simple()),
                retry_count: 0,
                trace_id: format!("trace-{}", uuid::Uuid::new_v4().simple()),
                correlation_id: String::new(),
                environment_hash: String::new(),
                metadata: HashMap::new(),
            },
        }
    }

    pub fn node_id(mut self, node_id: impl Into<String>) -> Self {
        self.receipt.node_id = node_id.into();
        self
    }

    pub fn wih_id(mut self, wih_id: impl Into<String>) -> Self {
        self.receipt.wih_id = wih_id.into();
        self
    }

    pub fn tool_id(mut self, tool_id: impl Into<String>) -> Self {
        self.receipt.tool_id = tool_id.into();
        self
    }

    pub fn tool_def_hash(mut self, hash: impl Into<String>) -> Self {
        self.receipt.tool_def_hash = hash.into();
        self
    }

    pub fn policy_decision_hash(mut self, hash: impl Into<String>) -> Self {
        self.receipt.policy_decision_hash = hash.into();
        self
    }

    pub fn pretool_event_hash(mut self, hash: impl Into<String>) -> Self {
        self.receipt.pretool_event_hash = hash.into();
        self
    }

    pub fn input_hashes(mut self, hashes: Vec<String>) -> Self {
        self.receipt.input_hashes = hashes;
        self
    }

    pub fn output_hashes(mut self, hashes: Vec<String>) -> Self {
        self.receipt.output_hashes = hashes;
        self
    }

    pub fn add_artifact(mut self, path: impl Into<String>, hash: impl Into<String>, size: u64, media_type: impl Into<String>) -> Self {
        self.receipt.artifact_manifest.push(ArtifactEntry {
            path: path.into(),
            hash: hash.into(),
            size,
            media_type: media_type.into(),
        });
        self
    }

    pub fn write_scope(mut self, declared: Vec<String>, actual: Vec<String>) -> Self {
        self.receipt.write_scope_proof = WriteScopeProof { declared, actual };
        self
    }

    pub fn execution(mut self, exit_code: i32, stderr_hash: impl Into<String>, stdout_hash: impl Into<String>, duration_ms: u64) -> Self {
        self.receipt.execution = ExecutionDetails {
            exit_code,
            stderr_hash: stderr_hash.into(),
            stdout_hash: stdout_hash.into(),
            duration_ms,
        };
        self
    }

    pub fn retry_count(mut self, count: u32) -> Self {
        self.receipt.retry_count = count;
        self
    }

    pub fn environment_hash(mut self, hash: impl Into<String>) -> Self {
        self.receipt.environment_hash = hash.into();
        self
    }

    pub fn kind(mut self, kind: impl Into<String>) -> Self {
        self.receipt.kind = kind.into();
        self
    }

    pub fn correlation_id(mut self, correlation_id: impl Into<String>) -> Self {
        self.receipt.correlation_id = correlation_id.into();
        self
    }

    pub fn metadata(mut self, key: impl Into<String>, value: serde_json::Value) -> Self {
        self.receipt.metadata.insert(key.into(), value);
        self
    }

    /// Build the receipt
    pub fn build(self) -> Receipt {
        self.receipt
    }
}

// ============================================================================
// Receipt Manager
// ============================================================================

/// Manager for creating, storing, and verifying receipts
pub struct ReceiptManager {
    store: ReceiptStore,
}

impl ReceiptManager {
    /// Create a new receipt manager
    pub fn new(storage_path: impl AsRef<std::path::Path>) -> Self {
        Self {
            store: ReceiptStore::new(storage_path),
        }
    }

    /// Create a receipt builder
    pub fn create_receipt(&self, run_id: impl Into<String>, workflow_id: impl Into<String>) -> ReceiptBuilder {
        ReceiptBuilder::new(run_id, workflow_id)
    }

    /// Store a receipt
    pub async fn store_receipt(&self, receipt: &Receipt) -> Result<(), ReceiptError> {
        // Validate receipt before storing
        self.validate_receipt(receipt).await?;
        
        self.store.save(receipt).await?;
        
        info!("Stored receipt: {}", receipt.receipt_id);
        Ok(())
    }

    /// Get a receipt by ID
    pub async fn get_receipt(&self, receipt_id: &str) -> Result<Option<Receipt>, ReceiptError> {
        self.store.load(receipt_id).await
    }

    /// Get receipts for a run
    pub async fn get_run_receipts(&self, run_id: &str) -> Result<Vec<Receipt>, ReceiptError> {
        self.store.load_by_run(run_id).await
    }

    /// Get receipts for a workflow
    pub async fn get_workflow_receipts(&self, workflow_id: &str) -> Result<Vec<Receipt>, ReceiptError> {
        self.store.load_by_workflow(workflow_id).await
    }

    /// Validate a receipt
    pub async fn validate_receipt(&self, receipt: &Receipt) -> Result<ValidationReport, ReceiptError> {
        let mut report = ValidationReport {
            receipt_id: receipt.receipt_id.clone(),
            valid: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        };

        // Check required fields
        if receipt.receipt_id.is_empty() {
            report.errors.push("Missing receipt_id".to_string());
        }

        if receipt.run_id.is_empty() {
            report.errors.push("Missing run_id".to_string());
        }

        if receipt.workflow_id.is_empty() {
            report.errors.push("Missing workflow_id".to_string());
        }

        if receipt.tool_id.is_empty() {
            report.errors.push("Missing tool_id".to_string());
        }

        // Check write scope integrity
        let scope_violations: Vec<_> = receipt.write_scope_proof.actual
            .iter()
            .filter(|path| !receipt.write_scope_proof.declared.contains(path))
            .cloned()
            .collect();

        if !scope_violations.is_empty() {
            report.warnings.push(format!(
                "Write scope violations: {:?}",
                scope_violations
            ));
        }

        // Check execution details
        if receipt.execution.duration_ms == 0 {
            report.warnings.push("Zero duration execution".to_string());
        }

        report.valid = report.errors.is_empty();

        Ok(report)
    }

    /// Create a receipt bundle for a workflow
    pub async fn create_bundle(&self, workflow_id: &str, run_id: &str) -> Result<ReceiptBundle, ReceiptError> {
        let receipts = self.get_run_receipts(run_id).await?;
        
        // Calculate aggregate hash
        let mut hasher = Sha256::new();
        for receipt in &receipts {
            hasher.update(receipt.receipt_id.as_bytes());
        }
        let aggregate_hash = hex::encode(hasher.finalize());

        let bundle = ReceiptBundle {
            bundle_id: format!("bundle-{}", uuid::Uuid::new_v4().simple()),
            workflow_id: workflow_id.to_string(),
            run_id: run_id.to_string(),
            created_at: Utc::now(),
            receipts,
            aggregate_hash,
        };

        Ok(bundle)
    }

    /// Verify a receipt bundle
    pub fn verify_bundle(&self, bundle: &ReceiptBundle) -> bool {
        // Recalculate aggregate hash
        let mut hasher = Sha256::new();
        for receipt in &bundle.receipts {
            hasher.update(receipt.receipt_id.as_bytes());
        }
        let calculated_hash = hex::encode(hasher.finalize());

        calculated_hash == bundle.aggregate_hash
    }

    /// Query receipts by multiple filters (LAW-AUT-004)
    pub async fn query_receipts(&self, query: &ReceiptQuery) -> Result<Vec<Receipt>, ReceiptError> {
        self.store.query_by_filters(query).await
    }

    /// Query receipts by kind (injection_marker, context_pack_seal, tool_call_pre, etc.)
    pub async fn query_by_kind(&self, kind: &str) -> Result<Vec<Receipt>, ReceiptError> {
        self.store.query_by_kind(kind).await
    }

    /// Query receipts by correlation_id (trace across events)
    pub async fn query_by_correlation(&self, correlation_id: &str) -> Result<Vec<Receipt>, ReceiptError> {
        self.store.query_by_correlation(correlation_id).await
    }
}

/// Validation report for a receipt
#[derive(Debug, Clone)]
pub struct ValidationReport {
    pub receipt_id: String,
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

// ============================================================================
// Query API (LAW-AUT-004)
// ============================================================================

/// Query parameters for receipt queries
#[derive(Debug, Clone, Default)]
pub struct ReceiptQuery {
    /// Filter by run ID
    pub run_id: Option<String>,
    /// Filter by workflow ID
    pub workflow_id: Option<String>,
    /// Filter by WIH ID
    pub wih_id: Option<String>,
    /// Filter by tool ID
    pub tool_id: Option<String>,
    /// Filter by receipt kind (injection_marker, context_pack_seal, tool_call_pre, etc.)
    pub kind: Option<String>,
    /// Filter by correlation ID
    pub correlation_id: Option<String>,
    /// Page size for pagination
    pub page_size: Option<usize>,
    /// Page offset for pagination
    pub page_offset: Option<usize>,
}

impl ReceiptQuery {
    /// Create a new query with run ID filter
    pub fn by_run(run_id: impl Into<String>) -> Self {
        Self {
            run_id: Some(run_id.into()),
            ..Default::default()
        }
    }

    /// Create a new query with workflow ID filter
    pub fn by_workflow(workflow_id: impl Into<String>) -> Self {
        Self {
            workflow_id: Some(workflow_id.into()),
            ..Default::default()
        }
    }

    /// Create a new query with kind filter
    pub fn by_kind(kind: impl Into<String>) -> Self {
        Self {
            kind: Some(kind.into()),
            ..Default::default()
        }
    }

    /// Set page size
    pub fn with_pagination(mut self, page_size: usize, offset: usize) -> Self {
        self.page_size = Some(page_size);
        self.page_offset = Some(offset);
        self
    }
}

// ============================================================================
// Utility Functions
// ============================================================================

/// Calculate SHA-256 hash of data
pub fn calculate_hash(data: impl AsRef<[u8]>) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Calculate hash of JSON-serializable data
pub fn calculate_json_hash<T: Serialize>(data: &T) -> Result<String, serde_json::Error> {
    let json = serde_json::to_vec(data)?;
    Ok(calculate_hash(json))
}

// ============================================================================
// Errors
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum ReceiptError {
    #[error("Storage error: {0}")]
    StorageError(String),
    
    #[error("Validation error: {0}")]
    ValidationError(String),
    
    #[error("Receipt not found: {0}")]
    NotFound(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_receipt_builder() {
        let receipt = ReceiptBuilder::new("run-1", "workflow-1")
            .node_id("node-1")
            .wih_id("wih-1")
            .tool_id("tool-1")
            .tool_def_hash("hash-1")
            .execution(0, "stderr-hash", "stdout-hash", 1000)
            .add_artifact("output.txt", "artifact-hash", 1024, "text/plain")
            .write_scope(vec!["/tmp/allowed".to_string()], vec!["/tmp/allowed".to_string()])
            .metadata("key", serde_json::json!("value"))
            .build();

        assert_eq!(receipt.run_id, "run-1");
        assert_eq!(receipt.workflow_id, "workflow-1");
        assert_eq!(receipt.node_id, "node-1");
        assert_eq!(receipt.tool_id, "tool-1");
        assert_eq!(receipt.execution.exit_code, 0);
        assert_eq!(receipt.execution.duration_ms, 1000);
        assert_eq!(receipt.artifact_manifest.len(), 1);
        assert!(receipt.metadata.contains_key("key"));
    }

    #[tokio::test]
    async fn test_receipt_manager() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ReceiptManager::new(temp_dir.path());

        let receipt = manager
            .create_receipt("run-1", "workflow-1")
            .tool_id("tool-1")
            .execution(0, "stderr", "stdout", 100)
            .build();

        // Store receipt
        manager.store_receipt(&receipt).await.unwrap();

        // Retrieve receipt
        let retrieved = manager.get_receipt(&receipt.receipt_id).await.unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().tool_id, "tool-1");
    }

    #[tokio::test]
    async fn test_receipt_validation() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ReceiptManager::new(temp_dir.path());

        let valid_receipt = manager
            .create_receipt("run-1", "workflow-1")
            .tool_id("tool-1")
            .execution(0, "stderr", "stdout", 100)
            .build();

        let report = manager.validate_receipt(&valid_receipt).await.unwrap();
        assert!(report.valid);

        // Test invalid receipt (missing tool_id)
        let invalid_receipt = Receipt {
            receipt_id: "test".to_string(),
            created_at: Utc::now(),
            run_id: "run-1".to_string(),
            workflow_id: "workflow-1".to_string(),
            node_id: "node-1".to_string(),
            wih_id: "wih-1".to_string(),
            tool_id: "".to_string(), // Invalid: empty
            kind: String::new(),
            tool_def_hash: "hash".to_string(),
            policy_decision_hash: "hash".to_string(),
            pretool_event_hash: "hash".to_string(),
            input_hashes: vec![],
            output_hashes: vec![],
            artifact_manifest: vec![],
            write_scope_proof: WriteScopeProof {
                declared: vec![],
                actual: vec![],
            },
            execution: ExecutionDetails {
                exit_code: 0,
                stderr_hash: "stderr".to_string(),
                stdout_hash: "stdout".to_string(),
                duration_ms: 100,
            },
            idempotency_key: "idem".to_string(),
            retry_count: 0,
            trace_id: "trace".to_string(),
            correlation_id: String::new(),
            environment_hash: "env".to_string(),
            metadata: HashMap::new(),
        };

        let report = manager.validate_receipt(&invalid_receipt).await.unwrap();
        assert!(!report.valid);
        assert!(report.errors.iter().any(|e| e.contains("tool_id")));
    }

    #[test]
    fn test_hash_calculation() {
        let data = "test data";
        let hash = calculate_hash(data);
        
        // SHA-256 of "test data" should be consistent
        assert_eq!(hash.len(), 64); // Hex encoded SHA-256 is 64 chars
        
        // Same data should produce same hash
        let hash2 = calculate_hash(data);
        assert_eq!(hash, hash2);
        
        // Different data should produce different hash
        let hash3 = calculate_hash("different data");
        assert_ne!(hash, hash3);
    }

    #[tokio::test]
    async fn test_bundle_creation() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ReceiptManager::new(temp_dir.path());

        // Create and store multiple receipts
        for i in 0..3 {
            let receipt = manager
                .create_receipt("run-1", "workflow-1")
                .tool_id(format!("tool-{}", i))
                .execution(0, "stderr", "stdout", 100)
                .build();
            
            manager.store_receipt(&receipt).await.unwrap();
        }

        // Create bundle
        let bundle = manager.create_bundle("workflow-1", "run-1").await.unwrap();
        
        assert_eq!(bundle.workflow_id, "workflow-1");
        assert_eq!(bundle.run_id, "run-1");
        assert_eq!(bundle.receipts.len(), 3);
        
        // Verify bundle
        assert!(manager.verify_bundle(&bundle));
    }

    #[tokio::test]
    async fn test_query_by_kind() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ReceiptManager::new(temp_dir.path());

        // Create receipts with different kinds
        let receipt1 = manager
            .create_receipt("run-1", "workflow-1")
            .tool_id("tool-1")
            .kind("tool_call_pre")
            .execution(0, "stderr", "stdout", 100)
            .build();

        let receipt2 = manager
            .create_receipt("run-1", "workflow-1")
            .tool_id("tool-2")
            .kind("tool_call_post")
            .execution(0, "stderr", "stdout", 100)
            .build();

        let receipt3 = manager
            .create_receipt("run-2", "workflow-1")
            .tool_id("tool-3")
            .kind("tool_call_pre")
            .execution(0, "stderr", "stdout", 100)
            .build();

        manager.store_receipt(&receipt1).await.unwrap();
        manager.store_receipt(&receipt2).await.unwrap();
        manager.store_receipt(&receipt3).await.unwrap();

        // Query by kind
        let query = ReceiptQuery::by_kind("tool_call_pre");
        let results = manager.query_receipts(&query).await.unwrap();
        assert_eq!(results.len(), 2);

        let results = manager.query_by_kind("tool_call_post").await.unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].tool_id, "tool-2");
    }

    #[tokio::test]
    async fn test_query_by_correlation() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ReceiptManager::new(temp_dir.path());

        let correlation_id = "corr-123";

        // Create receipts with same correlation ID
        for i in 0..3 {
            let receipt = manager
                .create_receipt("run-1", "workflow-1")
                .tool_id(format!("tool-{}", i))
                .correlation_id(correlation_id)
                .execution(0, "stderr", "stdout", 100)
                .build();
            manager.store_receipt(&receipt).await.unwrap();
        }

        // Query by correlation ID
        let results = manager.query_by_correlation(correlation_id).await.unwrap();
        assert_eq!(results.len(), 3);

        let query = ReceiptQuery::by_run("run-1").with_pagination(2, 0);
        let results = manager.query_receipts(&query).await.unwrap();
        assert_eq!(results.len(), 2);
    }

    #[tokio::test]
    async fn test_query_pagination() {
        let temp_dir = TempDir::new().unwrap();
        let manager = ReceiptManager::new(temp_dir.path());

        // Create 5 receipts
        for i in 0..5 {
            let receipt = manager
                .create_receipt("run-1", "workflow-1")
                .tool_id(format!("tool-{}", i))
                .kind("test_kind")
                .execution(0, "stderr", "stdout", 100)
                .build();
            manager.store_receipt(&receipt).await.unwrap();
        }

        // Test pagination
        let query = ReceiptQuery::by_run("run-1").with_pagination(2, 0);
        let page1 = manager.query_receipts(&query).await.unwrap();
        assert_eq!(page1.len(), 2);

        let query = ReceiptQuery::by_run("run-1").with_pagination(2, 2);
        let page2 = manager.query_receipts(&query).await.unwrap();
        assert_eq!(page2.len(), 2);

        let query = ReceiptQuery::by_run("run-1").with_pagination(2, 4);
        let page3 = manager.query_receipts(&query).await.unwrap();
        assert_eq!(page3.len(), 1);
    }
}
