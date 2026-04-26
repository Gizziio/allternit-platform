//! Receipt Auto-Emission Module
//!
//! Provides automatic receipt emission for tool execution and SYSTEM_LAW integration.
//! This module ensures all tool calls are automatically logged as receipts.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::info;

use crate::{Receipt, ReceiptBuilder, ReceiptManager, ReceiptError, ReceiptQuery};

/// Receipt auto-emitter configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoEmissionConfig {
    /// Enable auto-emission
    pub enabled: bool,
    /// Emit pre-tool receipts
    pub emit_pre_tool: bool,
    /// Emit post-tool receipts
    pub emit_post_tool: bool,
    /// Include tool inputs in receipt
    pub include_inputs: bool,
    /// Include tool outputs in receipt
    pub include_outputs: bool,
    /// Receipt storage path
    pub storage_path: String,
    /// Correlation ID prefix
    pub correlation_prefix: String,
}

impl Default for AutoEmissionConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            emit_pre_tool: true,
            emit_post_tool: true,
            include_inputs: false,
            include_outputs: false,
            storage_path: "/var/allternit/receipts".to_string(),
            correlation_prefix: "corr".to_string(),
        }
    }
}

/// Tool execution context for receipt emission
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionContext {
    /// Run ID
    pub run_id: String,
    /// Workflow ID
    pub workflow_id: String,
    /// Node ID
    pub node_id: String,
    /// WIH ID
    pub wih_id: String,
    /// Tool ID
    pub tool_id: String,
    /// Tool definition hash
    pub tool_def_hash: String,
    /// Policy decision hash
    pub policy_decision_hash: String,
    /// Input hashes
    pub input_hashes: Vec<String>,
    /// Output hashes
    pub output_hashes: Vec<String>,
    /// Execution duration in ms
    pub duration_ms: u64,
    /// Exit code
    pub exit_code: i32,
    /// Stderr hash
    pub stderr_hash: String,
    /// Stdout hash
    pub stdout_hash: String,
    /// Environment hash
    pub environment_hash: String,
    /// Created by (user/agent ID)
    pub created_by: String,
    /// Renderer type (human/agent)
    pub renderer: String,
}

/// Receipt auto-emitter
pub struct ReceiptAutoEmitter {
    config: AutoEmissionConfig,
    manager: Arc<ReceiptManager>,
    correlation_counter: Arc<RwLock<u64>>,
}

impl ReceiptAutoEmitter {
    /// Create a new auto-emitter
    pub fn new(config: AutoEmissionConfig) -> Self {
        let manager = Arc::new(ReceiptManager::new(&config.storage_path));
        Self {
            config,
            manager,
            correlation_counter: Arc::new(RwLock::new(0)),
        }
    }

    /// Get the receipt manager
    pub fn manager(&self) -> Arc<ReceiptManager> {
        self.manager.clone()
    }

    /// Generate correlation ID
    async fn generate_correlation_id(&self) -> String {
        let mut counter = self.correlation_counter.write().await;
        *counter += 1;
        format!("{}-{}-{}", self.config.correlation_prefix, Utc::now().timestamp(), *counter)
    }

    /// Emit pre-tool receipt
    pub async fn emit_pre_tool(&self, ctx: &ToolExecutionContext) -> Result<Receipt, ReceiptError> {
        if !self.config.enabled || !self.config.emit_pre_tool {
            return Err(ReceiptError::ValidationError("Pre-tool emission disabled".to_string()));
        }

        let correlation_id = self.generate_correlation_id().await;

        let receipt = ReceiptBuilder::new(&ctx.run_id, &ctx.workflow_id)
            .node_id(&ctx.node_id)
            .wih_id(&ctx.wih_id)
            .tool_id(&ctx.tool_id)
            .kind("tool_call_pre".to_string())
            .correlation_id(correlation_id)
            .tool_def_hash(&ctx.tool_def_hash)
            .policy_decision_hash(&ctx.policy_decision_hash)
            .input_hashes(ctx.input_hashes.clone())
            .environment_hash(&ctx.environment_hash)
            .metadata("renderer".to_string(), serde_json::json!(ctx.renderer))
            .metadata("created_by".to_string(), serde_json::json!(ctx.created_by))
            .metadata("phase".to_string(), serde_json::json!("pre_tool"))
            .build();

        self.manager.store_receipt(&receipt).await?;
        
        info!("Emitted pre-tool receipt: {} for tool {}", receipt.receipt_id, ctx.tool_id);
        Ok(receipt)
    }

    /// Emit post-tool receipt
    pub async fn emit_post_tool(
        &self,
        ctx: &ToolExecutionContext,
        pre_receipt_id: &str,
    ) -> Result<Receipt, ReceiptError> {
        if !self.config.enabled || !self.config.emit_post_tool {
            return Err(ReceiptError::ValidationError("Post-tool emission disabled".to_string()));
        }

        // Get pre-tool receipt for correlation
        let pre_receipt = self.manager.get_receipt(pre_receipt_id).await?
            .ok_or_else(|| ReceiptError::NotFound(pre_receipt_id.to_string()))?;

        let receipt = ReceiptBuilder::new(&ctx.run_id, &ctx.workflow_id)
            .node_id(&ctx.node_id)
            .wih_id(&ctx.wih_id)
            .tool_id(&ctx.tool_id)
            .kind("tool_call_post".to_string())
            .correlation_id(pre_receipt.correlation_id.clone())
            .tool_def_hash(&ctx.tool_def_hash)
            .policy_decision_hash(&ctx.policy_decision_hash)
            .pretool_event_hash(pre_receipt.receipt_id.clone())
            .input_hashes(ctx.input_hashes.clone())
            .output_hashes(ctx.output_hashes.clone())
            .execution(ctx.exit_code, &ctx.stderr_hash, &ctx.stdout_hash, ctx.duration_ms)
            .environment_hash(&ctx.environment_hash)
            .metadata("renderer".to_string(), serde_json::json!(ctx.renderer))
            .metadata("created_by".to_string(), serde_json::json!(ctx.created_by))
            .metadata("phase".to_string(), serde_json::json!("post_tool"))
            .metadata("pre_receipt_id".to_string(), serde_json::json!(pre_receipt_id))
            .build();

        self.manager.store_receipt(&receipt).await?;
        
        info!("Emitted post-tool receipt: {} for tool {}", receipt.receipt_id, ctx.tool_id);
        Ok(receipt)
    }

    /// Emit single receipt for tool execution (when pre/post not needed)
    pub async fn emit_tool_receipt(&self, ctx: &ToolExecutionContext) -> Result<Receipt, ReceiptError> {
        if !self.config.enabled {
            return Err(ReceiptError::ValidationError("Auto-emission disabled".to_string()));
        }

        let correlation_id = self.generate_correlation_id().await;

        let receipt = ReceiptBuilder::new(&ctx.run_id, &ctx.workflow_id)
            .node_id(&ctx.node_id)
            .wih_id(&ctx.wih_id)
            .tool_id(&ctx.tool_id)
            .kind("tool_call".to_string())
            .correlation_id(correlation_id)
            .tool_def_hash(&ctx.tool_def_hash)
            .policy_decision_hash(&ctx.policy_decision_hash)
            .input_hashes(ctx.input_hashes.clone())
            .output_hashes(ctx.output_hashes.clone())
            .execution(ctx.exit_code, &ctx.stderr_hash, &ctx.stdout_hash, ctx.duration_ms)
            .environment_hash(&ctx.environment_hash)
            .metadata("renderer".to_string(), serde_json::json!(ctx.renderer))
            .metadata("created_by".to_string(), serde_json::json!(ctx.created_by))
            .build();

        self.manager.store_receipt(&receipt).await?;
        
        info!("Emitted tool receipt: {} for tool {}", receipt.receipt_id, ctx.tool_id);
        Ok(receipt)
    }

    /// Query receipts for a run
    pub async fn query_run_receipts(&self, run_id: &str) -> Result<Vec<Receipt>, ReceiptError> {
        let query = ReceiptQuery::by_run(run_id);
        self.manager.query_receipts(&query).await
    }

    /// Query receipts by correlation ID
    pub async fn query_correlation_receipts(&self, correlation_id: &str) -> Result<Vec<Receipt>, ReceiptError> {
        self.manager.query_by_correlation(correlation_id).await
    }

    /// Check if tool was already executed (for duplicate detection)
    pub async fn is_tool_executed(
        &self,
        run_id: &str,
        tool_id: &str,
        node_id: &str,
    ) -> Result<bool, ReceiptError> {
        let receipts = self.query_run_receipts(run_id).await?;
        
        Ok(receipts.iter().any(|r| {
            r.tool_id == tool_id && 
            r.node_id == node_id &&
            r.kind == "tool_call_post"
        }))
    }

    /// Get execution chain for a node
    pub async fn get_node_execution_chain(
        &self,
        run_id: &str,
        node_id: &str,
    ) -> Result<Vec<Receipt>, ReceiptError> {
        let receipts = self.query_run_receipts(run_id).await?;
        
        let mut chain: Vec<Receipt> = receipts.into_iter()
            .filter(|r| r.node_id == node_id)
            .collect();
        
        // Sort by creation time
        chain.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        
        Ok(chain)
    }
}

/// SYSTEM_LAW integration for receipts
pub struct SystemLawReceiptIntegration {
    emitter: Arc<ReceiptAutoEmitter>,
}

impl SystemLawReceiptIntegration {
    /// Create new SYSTEM_LAW integration
    pub fn new(emitter: Arc<ReceiptAutoEmitter>) -> Self {
        Self { emitter }
    }

    /// Log receipt to SYSTEM_LAW
    pub async fn log_receipt_to_system_law(&self, receipt: &Receipt) -> Result<(), ReceiptError> {
        // In a real implementation, this would call the SYSTEM_LAW engine
        // For now, we just log it
        info!(
            "SYSTEM_LAW: Receipt {} - kind: {} - tool: {} - node: {}",
            receipt.receipt_id,
            receipt.kind,
            receipt.tool_id,
            receipt.node_id
        );
        Ok(())
    }

    /// Query receipts for SYSTEM_LAW audit
    pub async fn query_for_audit(
        &self,
        run_id: &str,
        start_time: DateTime<Utc>,
        end_time: DateTime<Utc>,
    ) -> Result<Vec<Receipt>, ReceiptError> {
        let receipts = self.emitter.query_run_receipts(run_id).await?;
        
        // Filter by time range
        Ok(receipts.into_iter()
            .filter(|r| r.created_at >= start_time && r.created_at <= end_time)
            .collect())
    }

    /// Detect violations from receipts
    pub async fn detect_violations(&self, receipts: &[Receipt]) -> Vec<ReceiptViolation> {
        let mut violations = Vec::new();

        for receipt in receipts {
            // Check for write scope violations
            if !receipt.write_scope_proof.declared.is_empty() {
                for path in &receipt.write_scope_proof.actual {
                    if !receipt.write_scope_proof.declared.contains(path) {
                        violations.push(ReceiptViolation {
                            receipt_id: receipt.receipt_id.clone(),
                            violation_type: "write_scope_violation".to_string(),
                            severity: "high".to_string(),
                            description: format!("Write to undeclared path: {}", path),
                        });
                    }
                }
            }

            // Check for execution failures
            if receipt.execution.exit_code != 0 {
                violations.push(ReceiptViolation {
                    receipt_id: receipt.receipt_id.clone(),
                    violation_type: "execution_failure".to_string(),
                    severity: "medium".to_string(),
                    description: format!("Tool {} exited with code {}", receipt.tool_id, receipt.execution.exit_code),
                });
            }
        }

        violations
    }
}

/// Receipt violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiptViolation {
    pub receipt_id: String,
    pub violation_type: String,
    pub severity: String,
    pub description: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_context() -> ToolExecutionContext {
        ToolExecutionContext {
            run_id: "run-1".to_string(),
            workflow_id: "workflow-1".to_string(),
            node_id: "node-1".to_string(),
            wih_id: "wih-1".to_string(),
            tool_id: "read_file".to_string(),
            tool_def_hash: "hash-1".to_string(),
            policy_decision_hash: "hash-2".to_string(),
            input_hashes: vec!["input-hash".to_string()],
            output_hashes: vec!["output-hash".to_string()],
            duration_ms: 100,
            exit_code: 0,
            stderr_hash: "stderr".to_string(),
            stdout_hash: "stdout".to_string(),
            environment_hash: "env".to_string(),
            created_by: "agent-1".to_string(),
            renderer: "agent".to_string(),
        }
    }

    #[tokio::test]
    async fn test_auto_emitter_creation() {
        let temp_dir = TempDir::new().unwrap();
        let config = AutoEmissionConfig {
            storage_path: temp_dir.path().to_string_lossy().to_string(),
            ..Default::default()
        };

        let emitter = ReceiptAutoEmitter::new(config);
        assert!(emitter.config.enabled);
        assert!(emitter.config.emit_pre_tool);
        assert!(emitter.config.emit_post_tool);
    }

    #[tokio::test]
    async fn test_pre_post_tool_emission() {
        let temp_dir = TempDir::new().unwrap();
        let config = AutoEmissionConfig {
            storage_path: temp_dir.path().to_string_lossy().to_string(),
            ..Default::default()
        };

        let emitter = ReceiptAutoEmitter::new(config);
        let ctx = create_test_context();

        // Emit pre-tool receipt
        let pre_receipt = emitter.emit_pre_tool(&ctx).await.unwrap();
        assert_eq!(pre_receipt.kind, "tool_call_pre");
        assert_eq!(pre_receipt.tool_id, "read_file");

        // Emit post-tool receipt
        let post_receipt = emitter.emit_post_tool(&ctx, &pre_receipt.receipt_id).await.unwrap();
        assert_eq!(post_receipt.kind, "tool_call_post");
        assert_eq!(post_receipt.correlation_id, pre_receipt.correlation_id);
        assert_eq!(post_receipt.pretool_event_hash, pre_receipt.receipt_id);
    }

    #[tokio::test]
    async fn test_duplicate_detection() {
        let temp_dir = TempDir::new().unwrap();
        let config = AutoEmissionConfig {
            storage_path: temp_dir.path().to_string_lossy().to_string(),
            ..Default::default()
        };

        let emitter = ReceiptAutoEmitter::new(config);
        let ctx = create_test_context();

        // Emit receipt
        let receipt = emitter.emit_tool_receipt(&ctx).await.unwrap();

        // Query receipts and verify
        let receipts = emitter.query_run_receipts(&ctx.run_id).await.unwrap();
        assert_eq!(receipts.len(), 1);
        assert_eq!(receipts[0].tool_id, ctx.tool_id);
        assert_eq!(receipts[0].node_id, ctx.node_id);
    }

    #[tokio::test]
    async fn test_execution_chain() {
        let temp_dir = TempDir::new().unwrap();
        let config = AutoEmissionConfig {
            storage_path: temp_dir.path().to_string_lossy().to_string(),
            ..Default::default()
        };

        let emitter = ReceiptAutoEmitter::new(config);
        let ctx = create_test_context();

        // Emit pre-tool receipt
        let pre_receipt = emitter.emit_pre_tool(&ctx).await.unwrap();
        
        // Emit post-tool receipt with correct pre-receipt ID
        emitter.emit_post_tool(&ctx, &pre_receipt.receipt_id).await.unwrap();

        let chain = emitter.get_node_execution_chain(&ctx.run_id, &ctx.node_id).await.unwrap();
        assert_eq!(chain.len(), 2);
    }

    #[tokio::test]
    async fn test_violation_detection() {
        let temp_dir = TempDir::new().unwrap();
        let config = AutoEmissionConfig {
            storage_path: temp_dir.path().to_string_lossy().to_string(),
            ..Default::default()
        };

        let emitter = Arc::new(ReceiptAutoEmitter::new(config));
        let integration = SystemLawReceiptIntegration::new(emitter.clone());

        // Create receipt with write scope violation
        let mut ctx = create_test_context();
        ctx.exit_code = 1; // Non-zero exit code

        let receipt = emitter.emit_tool_receipt(&ctx).await.unwrap();

        // Detect violations
        let violations = integration.detect_violations(&[receipt]).await;
        assert!(!violations.is_empty());
        assert!(violations.iter().any(|v| v.violation_type == "execution_failure"));
    }
}
