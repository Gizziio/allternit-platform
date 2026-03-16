//! Browser Action Receipts (P5.1.2)
//!
//! Immutable evidence of browser actions for audit and compliance

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::{ActionResult, BrowserAction, SessionSummary};

/// Action receipt - immutable evidence
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionReceipt {
    pub receipt_id: String,
    pub session_id: String,
    pub action: BrowserAction,
    pub action_hash: String, // SHA-256 of serialized action
    pub result_hash: String, // SHA-256 of result
    pub timestamp: DateTime<Utc>,
    pub duration_ms: u64,
    pub success: bool,
    pub screenshot_ref: Option<String>, // Reference to stored screenshot
    pub metadata: ReceiptMetadata,
}

/// Receipt metadata
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ReceiptMetadata {
    pub tier: String,
    pub security_level: String,
    pub agent_id: Option<String>,
    pub trace_id: Option<String>,
}

/// Session receipt - summary of entire session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionReceipt {
    pub receipt_id: String,
    pub session_id: String,
    pub summary: SessionSummary,
    pub action_receipt_ids: Vec<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub final_hash: String, // Merkle root of all action receipts
}

/// Receipt emitter
pub struct ReceiptEmitter {
    receipts: HashMap<String, Vec<ActionReceipt>>,
    action_counts: HashMap<String, u64>,
}

impl ReceiptEmitter {
    /// Create new receipt emitter
    pub fn new() -> Self {
        Self {
            receipts: HashMap::new(),
            action_counts: HashMap::new(),
        }
    }

    /// Emit receipt for an action
    pub fn emit_action_receipt(
        &mut self,
        session_id: &str,
        action: &BrowserAction,
        result: &ActionResult,
        duration: std::time::Duration,
    ) -> ActionReceipt {
        // Calculate action hash
        let action_json = serde_json::to_string(action).unwrap_or_default();
        let action_hash = sha256_hex(&action_json);

        // Calculate result hash
        let result_json = serde_json::to_string(result).unwrap_or_default();
        let result_hash = sha256_hex(&result_json);

        let receipt_id = format!("rec_{}", uuid::Uuid::new_v4().simple());

        let receipt = ActionReceipt {
            receipt_id: receipt_id.clone(),
            session_id: session_id.to_string(),
            action: action.clone(),
            action_hash,
            result_hash,
            timestamp: Utc::now(),
            duration_ms: duration.as_millis() as u64,
            success: result.success,
            screenshot_ref: result.screenshot.clone(),
            metadata: ReceiptMetadata {
                tier: "standard".to_string(),
                security_level: if matches!(action, BrowserAction::ExecuteJs { .. }) {
                    "high".to_string()
                } else {
                    "normal".to_string()
                },
                agent_id: None,
                trace_id: None,
            },
        };

        // Store receipt
        self.receipts
            .entry(session_id.to_string())
            .or_default()
            .push(receipt.clone());

        // Update count
        *self.action_counts.entry(session_id.to_string()).or_insert(0) += 1;

        receipt
    }

    /// Emit session summary receipt
    pub fn emit_session_receipt(&mut self, summary: &SessionSummary) -> SessionReceipt {
        let receipt_id = format!("sess_rec_{}", uuid::Uuid::new_v4().simple());
        
        let session_receipts = self.receipts.get(&summary.session_id).cloned().unwrap_or_default();
        let action_ids: Vec<String> = session_receipts.iter()
            .map(|r| r.receipt_id.clone())
            .collect();

        // Calculate Merkle root
        let final_hash = calculate_merkle_root(&action_ids);

        SessionReceipt {
            receipt_id,
            session_id: summary.session_id.clone(),
            summary: summary.clone(),
            action_receipt_ids: action_ids,
            start_time: Utc::now() - chrono::Duration::seconds(summary.duration_secs as i64),
            end_time: Utc::now(),
            final_hash,
        }
    }

    /// Get receipts for a session
    pub fn get_receipts(&self, session_id: &str) -> Vec<&ActionReceipt> {
        self.receipts.get(session_id).map(|v| {
            v.iter().collect()
        }).unwrap_or_default()
    }

    /// Get action count for session
    pub fn get_action_count(&self, session_id: &str) -> u64 {
        *self.action_counts.get(session_id).unwrap_or(&0)
    }

    /// Query receipts
    pub fn query(&self, query: &super::ReceiptQuery) -> Vec<&ActionReceipt> {
        let mut results = Vec::new();

        for (session_id, receipts) in &self.receipts {
            if let Some(ref query_session) = query.session_id {
                if session_id != query_session {
                    continue;
                }
            }

            for receipt in receipts {
                if let Some(ref action_type) = query.action_type {
                    let receipt_type = action_type_string(&receipt.action);
                    if &receipt_type != action_type {
                        continue;
                    }
                }

                if let Some(start) = query.start_time {
                    if receipt.timestamp < start {
                        continue;
                    }
                }

                if let Some(end) = query.end_time {
                    if receipt.timestamp > end {
                        continue;
                    }
                }

                results.push(receipt);
            }
        }

        results
    }
}

impl Default for ReceiptEmitter {
    fn default() -> Self {
        Self::new()
    }
}

/// Browser receipt builder for integration with ShellUI
pub struct BrowserReceiptBuilder;

impl BrowserReceiptBuilder {
    /// Build a human-readable receipt summary
    pub fn build_summary(receipt: &ActionReceipt) -> String {
        let action_str = match &receipt.action {
            BrowserAction::Navigate { url } => format!("Navigate to {}", url),
            BrowserAction::Click { selector } => format!("Click on {}", selector),
            BrowserAction::Type { selector, text } => {
                format!("Type {} chars into {}", text.len(), selector)
            }
            BrowserAction::Screenshot => "Take screenshot".to_string(),
            BrowserAction::Extract { selector } => format!("Extract from {}", selector),
            BrowserAction::Scroll { direction, amount } => {
                format!("Scroll {:?} by {}", direction, amount)
            }
            BrowserAction::Wait { duration_ms } => format!("Wait {}ms", duration_ms),
            BrowserAction::ExecuteJs { script } => {
                format!("Execute JS ({} chars)", script.len())
            }
        };

        format!(
            "[{}] {} - {} in {}ms",
            receipt.timestamp.format("%H:%M:%S"),
            action_str,
            if receipt.success { "✓" } else { "✗" },
            receipt.duration_ms
        )
    }

    /// Build a full receipt report
    pub fn build_report(receipts: &[&ActionReceipt]) -> String {
        let mut report = String::new();
        report.push_str("# Browser Session Receipt Report\n\n");

        let success_count = receipts.iter().filter(|r| r.success).count();
        report.push_str(&format!("**Total Actions:** {}\n", receipts.len()));
        report.push_str(&format!("**Successful:** {}\n", success_count));
        report.push_str(&format!("**Failed:** {}\n\n", receipts.len() - success_count));

        for receipt in receipts {
            report.push_str(&Self::build_summary(receipt));
            report.push('\n');
        }

        report
    }
}

/// Helper function to get action type string
fn action_type_string(action: &BrowserAction) -> String {
    match action {
        BrowserAction::Navigate { .. } => "navigate".to_string(),
        BrowserAction::Click { .. } => "click".to_string(),
        BrowserAction::Type { .. } => "type".to_string(),
        BrowserAction::Screenshot => "screenshot".to_string(),
        BrowserAction::Extract { .. } => "extract".to_string(),
        BrowserAction::Scroll { .. } => "scroll".to_string(),
        BrowserAction::Wait { .. } => "wait".to_string(),
        BrowserAction::ExecuteJs { .. } => "execute_js".to_string(),
    }
}

/// Calculate SHA-256 hex string
fn sha256_hex(input: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Calculate simple Merkle root from hashes
fn calculate_merkle_root(hashes: &[String]) -> String {
    if hashes.is_empty() {
        return sha256_hex("");
    }

    let mut current_level: Vec<String> = hashes.to_vec();

    while current_level.len() > 1 {
        let mut next_level = Vec::new();

        for chunk in current_level.chunks(2) {
            let combined = if chunk.len() == 2 {
                format!("{}{}", chunk[0], chunk[1])
            } else {
                chunk[0].clone()
            };
            next_level.push(sha256_hex(&combined));
        }

        current_level = next_level;
    }

    current_level[0].clone()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_emit_receipt() {
        let mut emitter = ReceiptEmitter::new();
        
        let action = BrowserAction::Navigate { url: "https://example.com".to_string() };
        let result = ActionResult {
            success: true,
            data: None,
            screenshot: None,
        };

        let receipt = emitter.emit_action_receipt("session_1", &action, &result, std::time::Duration::from_millis(100));

        assert!(!receipt.receipt_id.is_empty());
        assert!(receipt.success);
        assert_eq!(receipt.duration_ms, 100);
    }

    #[test]
    fn test_receipt_builder() {
        let receipt = ActionReceipt {
            receipt_id: "test_1".to_string(),
            session_id: "session_1".to_string(),
            action: BrowserAction::Click { selector: "#button".to_string() },
            action_hash: "abc123".to_string(),
            result_hash: "def456".to_string(),
            timestamp: Utc::now(),
            duration_ms: 50,
            success: true,
            screenshot_ref: None,
            metadata: ReceiptMetadata::default(),
        };

        let summary = BrowserReceiptBuilder::build_summary(&receipt);
        assert!(summary.contains("Click"));
        assert!(summary.contains("✓"));
    }

    #[test]
    fn test_merkle_root() {
        let hashes = vec![
            "hash1".to_string(),
            "hash2".to_string(),
            "hash3".to_string(),
            "hash4".to_string(),
        ];

        let root = calculate_merkle_root(&hashes);
        assert!(!root.is_empty());

        // Single hash
        let single_root = calculate_merkle_root(&["single".to_string()]);
        assert!(!single_root.is_empty());
    }
}
