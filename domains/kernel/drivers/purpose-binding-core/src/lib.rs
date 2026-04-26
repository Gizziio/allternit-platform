//! Allternit Purpose Binding
//!
//! Implements explicit purpose enforcement for all tool calls.
//!
//! # Core Principles
//!
//! 1. **Purpose Required**: Every tool call MUST have an explicit purpose
//! 2. **Scope Check**: Purpose MUST be within WIH scope
//! 3. **Hard Gate**: Missing purpose = hard fail
//! 4. **Audit Trail**: All purpose bindings logged to receipts
//!
//! # Architecture
//!
//! ```text
//! Tool Call Request
//!        ↓
//! Purpose Binding Check
//!        ↓
//! ┌──────┴──────┐
//! │   Purpose   │
//! │   Provided? │
//! └──────┬──────┘
//!        │
//!    ┌───┴───┐
//!    │       │
//!   Yes     No → HARD FAIL
//!    │
//!    ↓
//! ┌──┴──────────────┐
//! │ Within WIH      │
//! │ Scope?          │
//! └──┬──────────────┘
//!    │
//! ┌──┴───┐
//! │      │
//! Yes   No → HARD FAIL
//! │
//! ↓
//! Allow Tool Call
//! ```

use allternit_harness_engineering::{HarnessEngineeringEngine, RiskTier};
use allternit_system_law::{SystemLawEngine, ViolationSeverity};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Purpose Binding Types
// ============================================================================

/// Purpose binding for a tool call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurposeBinding {
    pub binding_id: String,
    pub wih_id: String,
    pub tool_id: String,
    pub purpose: String,
    pub scope_hash: String,
    pub created_at: DateTime<Utc>,
    pub created_by: String,
    pub status: PurposeStatus,
}

/// Purpose status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PurposeStatus {
    /// Purpose bound, awaiting execution
    Pending,
    /// Purpose validated, execution allowed
    Validated,
    /// Purpose rejected, execution denied
    Rejected,
    /// Execution completed
    Completed,
}

/// Purpose validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PurposeValidationResult {
    pub binding_id: String,
    pub valid: bool,
    pub within_scope: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// WIH scope definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WihScope {
    pub wih_id: String,
    pub allowed_paths: Vec<String>,
    pub denied_paths: Vec<String>,
    pub allowed_tools: Vec<String>,
    pub denied_tools: Vec<String>,
    pub max_budget: Option<f32>,
    pub max_tokens: Option<u64>,
    pub max_time_seconds: Option<u64>,
}

// ============================================================================
// Purpose Binding Engine
// ============================================================================

/// Purpose Binding Engine
pub struct PurposeBindingEngine {
    bindings: Arc<RwLock<HashMap<String, PurposeBinding>>>,
    wih_scopes: Arc<RwLock<HashMap<String, WihScope>>>,
    system_law: Arc<SystemLawEngine>,
    harness: Arc<HarnessEngineeringEngine>,
}

use std::collections::HashMap;

impl PurposeBindingEngine {
    pub fn new(
        system_law: Arc<SystemLawEngine>,
        harness: Arc<HarnessEngineeringEngine>,
    ) -> Self {
        Self {
            bindings: Arc::new(RwLock::new(HashMap::new())),
            wih_scopes: Arc::new(RwLock::new(HashMap::new())),
            system_law,
            harness,
        }
    }

    /// Register WIH scope
    pub async fn register_wih_scope(&self, scope: WihScope) -> Result<(), PurposeBindingError> {
        let wih_id = scope.wih_id.clone();
        let mut scopes = self.wih_scopes.write().await;
        scopes.insert(wih_id, scope);
        Ok(())
    }

    /// Get WIH scope
    pub async fn get_wih_scope(&self, wih_id: &str) -> Option<WihScope> {
        let scopes = self.wih_scopes.read().await;
        scopes.get(wih_id).cloned()
    }

    /// Bind purpose to tool call
    pub async fn bind_purpose(
        &self,
        wih_id: &str,
        tool_id: &str,
        purpose: &str,
        created_by: &str,
    ) -> Result<PurposeBinding, PurposeBindingError> {
        // HARD GATE: Purpose cannot be empty
        if purpose.trim().is_empty() {
            return Err(PurposeBindingError::PurposeRequired);
        }

        // Check WIH scope exists
        let scope = self
            .get_wih_scope(wih_id)
            .await
            .ok_or_else(|| PurposeBindingError::WihNotFound(wih_id.to_string()))?;

        // HARD GATE: Tool must be allowed
        if scope.denied_tools.contains(&tool_id.to_string()) {
            return Err(PurposeBindingError::ToolDenied(tool_id.to_string()));
        }

        if !scope.allowed_tools.is_empty() && !scope.allowed_tools.contains(&tool_id.to_string()) {
            return Err(PurposeBindingError::ToolNotAllowed(tool_id.to_string()));
        }

        // Compute scope hash
        let scope_hash = self.compute_scope_hash(wih_id, tool_id, purpose);

        let binding_id = format!("pb_{}", Uuid::new_v4().simple());
        let binding = PurposeBinding {
            binding_id: binding_id.clone(),
            wih_id: wih_id.to_string(),
            tool_id: tool_id.to_string(),
            purpose: purpose.to_string(),
            scope_hash,
            created_at: Utc::now(),
            created_by: created_by.to_string(),
            status: PurposeStatus::Pending,
        };

        // Store binding
        let mut bindings = self.bindings.write().await;
        bindings.insert(binding_id.clone(), binding.clone());

        // Log purpose binding to SYSTEM_LAW
        self.system_law
            .record_violation(
                "LAW-PURPOSE-001",
                ViolationSeverity::Soft,
                &format!("Purpose bound: {} for tool {}", purpose, tool_id),
                serde_json::json!({
                    "binding_id": binding_id,
                    "wih_id": wih_id,
                    "tool_id": tool_id,
                    "created_by": created_by,
                }),
            )
            .await;

        Ok(binding)
    }

    /// Validate purpose binding
    pub async fn validate_purpose(
        &self,
        binding_id: &str,
    ) -> Result<PurposeValidationResult, PurposeBindingError> {
        let bindings = self.bindings.read().await;
        let binding = bindings
            .get(binding_id)
            .ok_or_else(|| PurposeBindingError::BindingNotFound(binding_id.to_string()))?;

        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // Check purpose is still valid (not empty)
        if binding.purpose.trim().is_empty() {
            errors.push("Purpose is empty".to_string());
        }

        // Check WIH scope
        let scope = self
            .get_wih_scope(&binding.wih_id)
            .await
            .ok_or_else(|| PurposeBindingError::WihNotFound(binding.wih_id.clone()))?;

        // Check tool is still allowed
        if scope.denied_tools.contains(&binding.tool_id) {
            errors.push(format!("Tool {} is denied", binding.tool_id));
        }

        // Check budget constraints
        if let Some(max_budget) = scope.max_budget {
            // In production, would check actual budget usage
            if max_budget <= 0.0 {
                warnings.push("Budget exhausted".to_string());
            }
        }

        let within_scope = errors.is_empty();
        let valid = within_scope && warnings.is_empty();

        Ok(PurposeValidationResult {
            binding_id: binding_id.to_string(),
            valid,
            within_scope,
            errors,
            warnings,
        })
    }

    /// Check if tool call is allowed
    pub async fn check_tool_call_allowed(
        &self,
        wih_id: &str,
        tool_id: &str,
        purpose: &str,
    ) -> Result<bool, PurposeBindingError> {
        // If purpose is empty, hard fail
        if purpose.trim().is_empty() {
            return Ok(false);
        }

        // Get WIH scope
        let scope = self
            .get_wih_scope(wih_id)
            .await
            .ok_or_else(|| PurposeBindingError::WihNotFound(wih_id.to_string()))?;

        // Check tool denied
        if scope.denied_tools.contains(&tool_id) {
            return Ok(false);
        }

        // Check tool allowed (if allowlist exists)
        if !scope.allowed_tools.is_empty() && !scope.allowed_tools.contains(&tool_id) {
            return Ok(false);
        }

        // Check path constraints (if provided in purpose)
        // In production, would parse purpose for path references
        // and check against allowed/denied paths

        Ok(true)
    }

    /// Mark binding as validated
    pub async fn mark_validated(&self, binding_id: &str) -> Result<(), PurposeBindingError> {
        let mut bindings = self.bindings.write().await;
        let binding = bindings
            .get_mut(binding_id)
            .ok_or_else(|| PurposeBindingError::BindingNotFound(binding_id.to_string()))?;

        binding.status = PurposeStatus::Validated;

        Ok(())
    }

    /// Mark binding as completed
    pub async fn mark_completed(&self, binding_id: &str) -> Result<(), PurposeBindingError> {
        let mut bindings = self.bindings.write().await;
        let binding = bindings
            .get_mut(binding_id)
            .ok_or_else(|| PurposeBindingError::BindingNotFound(binding_id.to_string()))?;

        binding.status = PurposeStatus::Completed;

        Ok(())
    }

    /// Get binding by ID
    pub async fn get_binding(&self, binding_id: &str) -> Option<PurposeBinding> {
        let bindings = self.bindings.read().await;
        bindings.get(binding_id).cloned()
    }

    /// Get all bindings for WIH
    pub async fn get_bindings_for_wih(&self, wih_id: &str) -> Vec<PurposeBinding> {
        let bindings = self.bindings.read().await;
        bindings
            .values()
            .filter(|b| b.wih_id == wih_id)
            .cloned()
            .collect()
    }

    /// Compute scope hash
    fn compute_scope_hash(&self, wih_id: &str, tool_id: &str, purpose: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(wih_id.as_bytes());
        hasher.update(tool_id.as_bytes());
        hasher.update(purpose.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

// ============================================================================
// Purpose Binding Errors
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum PurposeBindingError {
    #[error("Purpose is required")]
    PurposeRequired,

    #[error("WIH not found: {0}")]
    WihNotFound(String),

    #[error("Binding not found: {0}")]
    BindingNotFound(String),

    #[error("Tool denied: {0}")]
    ToolDenied(String),

    #[error("Tool not allowed: {0}")]
    ToolNotAllowed(String),

    #[error("Purpose out of scope: {0}")]
    PurposeOutOfScope(String),

    #[error("Budget exceeded")]
    BudgetExceeded,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_system_law() -> Arc<SystemLawEngine> {
        Arc::new(SystemLawEngine::new())
    }

    fn create_test_harness() -> Arc<HarnessEngineeringEngine> {
        Arc::new(HarnessEngineeringEngine::new(create_test_system_law()))
    }

    fn create_test_scope(wih_id: &str) -> WihScope {
        WihScope {
            wih_id: wih_id.to_string(),
            allowed_paths: vec!["/src".to_string(), "/tests".to_string()],
            denied_paths: vec!["/secrets".to_string()],
            allowed_tools: vec!["read_file".to_string(), "write_file".to_string()],
            denied_tools: vec!["delete_file".to_string()],
            max_budget: Some(10.0),
            max_tokens: Some(100000),
            max_time_seconds: Some(3600),
        }
    }

    #[tokio::test]
    async fn test_bind_purpose_success() {
        let engine = PurposeBindingEngine::new(
            create_test_system_law(),
            create_test_harness(),
        );

        // Register WIH scope
        engine.register_wih_scope(create_test_scope("wih_001")).await.unwrap();

        // Bind purpose
        let binding = engine
            .bind_purpose("wih_001", "read_file", "Read config file", "user_001")
            .await;

        assert!(binding.is_ok());
        assert_eq!(binding.unwrap().wih_id, "wih_001");
    }

    #[tokio::test]
    async fn test_bind_purpose_empty_fails() {
        let engine = PurposeBindingEngine::new(
            create_test_system_law(),
            create_test_harness(),
        );

        engine.register_wih_scope(create_test_scope("wih_001")).await.unwrap();

        // Empty purpose should fail
        let result = engine
            .bind_purpose("wih_001", "read_file", "", "user_001")
            .await;

        assert!(matches!(result, Err(PurposeBindingError::PurposeRequired)));
    }

    #[tokio::test]
    async fn test_bind_purpose_denied_tool_fails() {
        let engine = PurposeBindingEngine::new(
            create_test_system_law(),
            create_test_harness(),
        );

        engine.register_wih_scope(create_test_scope("wih_001")).await.unwrap();

        // Denied tool should fail
        let result = engine
            .bind_purpose("wih_001", "delete_file", "Delete file", "user_001")
            .await;

        assert!(matches!(result, Err(PurposeBindingError::ToolDenied(_))));
    }

    #[tokio::test]
    async fn test_check_tool_call_allowed() {
        let engine = PurposeBindingEngine::new(
            create_test_system_law(),
            create_test_harness(),
        );

        engine.register_wih_scope(create_test_scope("wih_001")).await.unwrap();

        // Valid tool call
        let allowed = engine
            .check_tool_call_allowed("wih_001", "read_file", "Read file")
            .await
            .unwrap();
        assert!(allowed);

        // Empty purpose
        let allowed = engine
            .check_tool_call_allowed("wih_001", "read_file", "")
            .await
            .unwrap();
        assert!(!allowed);

        // Denied tool
        let allowed = engine
            .check_tool_call_allowed("wih_001", "delete_file", "Delete file")
            .await
            .unwrap();
        assert!(!allowed);
    }

    #[tokio::test]
    async fn test_validate_purpose() {
        let engine = PurposeBindingEngine::new(
            create_test_system_law(),
            create_test_harness(),
        );

        engine.register_wih_scope(create_test_scope("wih_001")).await.unwrap();

        let binding = engine
            .bind_purpose("wih_001", "read_file", "Read file", "user_001")
            .await
            .unwrap();

        let result = engine.validate_purpose(&binding.binding_id).await.unwrap();
        assert!(result.valid);
        assert!(result.within_scope);
    }

    #[tokio::test]
    async fn test_mark_binding_completed() {
        let engine = PurposeBindingEngine::new(
            create_test_system_law(),
            create_test_harness(),
        );

        engine.register_wih_scope(create_test_scope("wih_001")).await.unwrap();

        let binding = engine
            .bind_purpose("wih_001", "read_file", "Read file", "user_001")
            .await
            .unwrap();

        // Mark as validated
        engine.mark_validated(&binding.binding_id).await.unwrap();

        // Mark as completed
        engine.mark_completed(&binding.binding_id).await.unwrap();

        // Verify status
        let updated = engine.get_binding(&binding.binding_id).await.unwrap();
        assert_eq!(updated.status, PurposeStatus::Completed);
    }
}
