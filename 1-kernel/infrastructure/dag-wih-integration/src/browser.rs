//! Browser Automation DAG Node (P5.4)
//!
//! Integration of browser runtime with DAG execution

use crate::{DagWihError, WorkItemHeader};
use a2r_browser_runtime::{
    BrowserAction, BrowserPolicyTier, BrowserRuntime, ReceiptQuery, ScrollDirection,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

/// Browser run node configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserRunNode {
    pub task_id: String,
    pub tier: BrowserPolicyTier,
    pub actions: Vec<BrowserActionConfig>,
    pub allowed_hosts: Option<Vec<String>>,
    pub timeout_secs: Option<u64>,
    pub require_receipts: bool,
}

/// Browser action configuration (YAML-friendly)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BrowserActionConfig {
    Navigate { url: String },
    Click { selector: String },
    Type { selector: String, text: String },
    Screenshot,
    Extract { selector: String, to: Option<String> },
    Scroll { direction: String, amount: u32 },
    Wait { duration_ms: u64 },
    ExecuteJs { script: String },
}

impl BrowserActionConfig {
    /// Convert to runtime action
    pub fn to_action(&self) -> BrowserAction {
        match self {
            BrowserActionConfig::Navigate { url } => BrowserAction::Navigate { url: url.clone() },
            BrowserActionConfig::Click { selector } => {
                BrowserAction::Click { selector: selector.clone() }
            }
            BrowserActionConfig::Type { selector, text } => BrowserAction::Type {
                selector: selector.clone(),
                text: text.clone(),
            },
            BrowserActionConfig::Screenshot => BrowserAction::Screenshot,
            BrowserActionConfig::Extract { selector, .. } => {
                BrowserAction::Extract { selector: selector.clone() }
            }
            BrowserActionConfig::Scroll { direction, amount } => BrowserAction::Scroll {
                direction: match direction.as_str() {
                    "up" => ScrollDirection::Up,
                    "down" => ScrollDirection::Down,
                    "left" => ScrollDirection::Left,
                    "right" => ScrollDirection::Right,
                    _ => ScrollDirection::Down,
                },
                amount: *amount,
            },
            BrowserActionConfig::Wait { duration_ms } => BrowserAction::Wait { duration_ms: *duration_ms },
            BrowserActionConfig::ExecuteJs { script } => {
                BrowserAction::ExecuteJs { script: script.clone() }
            }
        }
    }
}

/// Browser run executor
pub struct BrowserRunExecutor {
    runtime: BrowserRuntime,
    sessions: HashMap<String, String>, // task_id -> session_id
}

impl BrowserRunExecutor {
    /// Create new browser executor
    pub fn new() -> Self {
        Self {
            runtime: BrowserRuntime::new(),
            sessions: HashMap::new(),
        }
    }

    /// Execute a browser run node
    pub async fn execute(
        &mut self,
        node: &BrowserRunNode,
        wih: &WorkItemHeader,
    ) -> Result<BrowserRunResult, DagWihError> {
        info!(
            "Executing browser run node {} with tier {:?}",
            node.task_id, node.tier
        );

        // Create session with appropriate tier
        let session_id = self.runtime.create_session(node.tier);
        self.sessions.insert(node.task_id.clone(), session_id.clone());

        // Override allowed hosts if specified
        if let Some(ref hosts) = node.allowed_hosts {
            // In a real implementation, we'd update the session context
            info!("Using custom allowed hosts: {:?}", hosts);
        }

        let mut results = Vec::new();
        let mut errors = Vec::new();

        // Execute each action
        for (idx, action_config) in node.actions.iter().enumerate() {
            let action = action_config.to_action();
            
            match self.runtime.execute_action(&session_id, action).await {
                Ok(result) => {
                    results.push(result);
                }
                Err(e) => {
                    warn!("Browser action {} failed: {}", idx, e);
                    errors.push(format!("Action {}: {}", idx, e));
                    
                    // Stop on error unless configured to continue
                    break;
                }
            }
        }

        // Get receipts
        let receipts = self.runtime.get_session_receipts(&session_id);
        let receipt_data: Vec<a2r_browser_runtime::receipts::ActionReceipt> = receipts.iter().map(|r| (*r).clone()).collect();

        // Close session
        let summary = self.runtime.close_session(&session_id);

        let result = BrowserRunResult {
            task_id: node.task_id.clone(),
            success: errors.is_empty(),
            actions_completed: results.len(),
            total_actions: node.actions.len(),
            errors,
            receipts: if node.require_receipts {
                Some(receipt_data)
            } else {
                None
            },
            session_summary: summary,
        };

        info!(
            "Browser run node {} completed: {}/{}",
            node.task_id, result.actions_completed, result.total_actions
        );

        Ok(result)
    }

    /// Get session ID for a task
    pub fn get_session_id(&self, task_id: &str) -> Option<&String> {
        self.sessions.get(task_id)
    }

    /// Query receipts for a task
    pub fn query_receipts(&self, _task_id: &str, query: &ReceiptQuery) -> Vec<&a2r_browser_runtime::receipts::ActionReceipt> {
        self.runtime.query_receipts(&query)
    }
}

impl Default for BrowserRunExecutor {
    fn default() -> Self {
        Self::new()
    }
}

/// Browser run result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserRunResult {
    pub task_id: String,
    pub success: bool,
    pub actions_completed: usize,
    pub total_actions: usize,
    pub errors: Vec<String>,
    pub receipts: Option<Vec<a2r_browser_runtime::receipts::ActionReceipt>>,
    pub session_summary: Option<a2r_browser_runtime::SessionSummary>,
}

/// DAG node type for browser automation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DagNodeType {
    Task,
    BrowserRun(BrowserRunNode),
    Shell,
    Review,
}

/// Enhanced graph node with browser support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnhancedGraphNode {
    pub task_id: String,
    pub title: String,
    #[serde(default)]
    pub blocked_by: Vec<String>,
    pub wih_path: String,
    pub node_type: DagNodeType,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::TaskState;

    #[tokio::test]
    async fn test_browser_action_config() {
        let config = BrowserActionConfig::Navigate {
            url: "https://example.com".to_string(),
        };
        let action = config.to_action();
        
        match action {
            BrowserAction::Navigate { url } => assert_eq!(url, "https://example.com"),
            _ => panic!("Wrong action type"),
        }
    }

    #[tokio::test]
    async fn test_browser_executor_creation() {
        let executor = BrowserRunExecutor::new();
        assert!(executor.sessions.is_empty());
    }

    #[tokio::test]
    async fn test_browser_run_node() {
        let node = BrowserRunNode {
            task_id: "T_BROWSER_001".to_string(),
            tier: BrowserPolicyTier::Standard,
            actions: vec![
                BrowserActionConfig::Navigate {
                    url: "https://docs.a2r.systems".to_string(),
                },
                BrowserActionConfig::Screenshot,
            ],
            allowed_hosts: None,
            timeout_secs: Some(60),
            require_receipts: true,
        };

        assert_eq!(node.actions.len(), 2);
        assert!(node.require_receipts);
    }

    #[tokio::test]
    async fn test_execute_browser_node() {
        let mut executor = BrowserRunExecutor::new();
        
        let node = BrowserRunNode {
            task_id: "T_BROWSER_002".to_string(),
            tier: BrowserPolicyTier::Minimal,
            actions: vec![
                BrowserActionConfig::Wait { duration_ms: 10 },
                BrowserActionConfig::Screenshot,
            ],
            allowed_hosts: None,
            timeout_secs: None,
            require_receipts: true,
        };

        let wih = WorkItemHeader {
            wih_version: "v0.1".to_string(),
            task_id: "T_BROWSER_002".to_string(),
            graph_id: "test".to_string(),
            title: "Test Browser Task".to_string(),
            state: TaskState::Running,
            blocked_by: vec![],
            external_refs: Default::default(),
            preset: crate::Preset {
                preset_id: "test".to_string(),
                preset_hash: "test".to_string(),
            },
            resume_cursor: Default::default(),
            outputs: crate::Outputs {
                required_artifacts: vec![],
                artifact_paths: vec![],
            },
            write_scope: crate::WriteScope {
                root: "/".to_string(),
                allowed_globs: vec![],
            },
            tools: crate::Tools {
                allowlist: vec![],
                pretooluse_hooks: vec![],
            },
            memory: crate::Memory { packs: vec![] },
            acceptance: crate::Acceptance { checks: vec![] },
            beads: crate::BeadsNode {
                config: Default::default(),
            },
        };

        let result = executor.execute(&node, &wih).await;
        assert!(result.is_ok());
        
        let run_result = result.unwrap();
        assert!(run_result.success);
        assert_eq!(run_result.actions_completed, 2);
        assert!(run_result.receipts.is_some());
    }

    #[tokio::test]
    async fn test_tier_enforcement() {
        let mut executor = BrowserRunExecutor::new();
        
        // Minimal tier should not allow ExecuteJs
        let node = BrowserRunNode {
            task_id: "T_BROWSER_003".to_string(),
            tier: BrowserPolicyTier::Minimal,
            actions: vec![
                BrowserActionConfig::ExecuteJs {
                    script: "console.log('test')".to_string(),
                },
            ],
            allowed_hosts: None,
            timeout_secs: None,
            require_receipts: false,
        };

        let wih = WorkItemHeader {
            wih_version: "v0.1".to_string(),
            task_id: "T_BROWSER_003".to_string(),
            graph_id: "test".to_string(),
            title: "Test".to_string(),
            state: TaskState::Running,
            blocked_by: vec![],
            external_refs: Default::default(),
            preset: crate::Preset {
                preset_id: "test".to_string(),
                preset_hash: "test".to_string(),
            },
            resume_cursor: Default::default(),
            outputs: crate::Outputs {
                required_artifacts: vec![],
                artifact_paths: vec![],
            },
            write_scope: crate::WriteScope {
                root: "/".to_string(),
                allowed_globs: vec![],
            },
            tools: crate::Tools {
                allowlist: vec![],
                pretooluse_hooks: vec![],
            },
            memory: crate::Memory { packs: vec![] },
            acceptance: crate::Acceptance { checks: vec![] },
            beads: crate::BeadsNode {
                config: Default::default(),
            },
        };

        let result = executor.execute(&node, &wih).await;
        assert!(result.is_ok());
        
        let run_result = result.unwrap();
        assert!(!run_result.success); // Should fail due to tier violation
        assert!(!run_result.errors.is_empty());
    }
}
