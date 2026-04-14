//! ChangeSet Abstraction
//!
//! Provides atomic, diff-first patch management for file changes.
//! All file modifications must go through ChangeSet for auditability and rollback support.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

/// Unique identifier for a ChangeSet
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ChangeSetId(pub String);

impl ChangeSetId {
    pub fn new() -> Self {
        Self(format!("cs_{}", Uuid::new_v4().simple()))
    }
}

impl Default for ChangeSetId {
    fn default() -> Self {
        Self::new()
    }
}

/// Unique identifier for a Plan
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct PlanId(pub String);

impl PlanId {
    pub fn new() -> Self {
        Self(format!("plan_{}", Uuid::new_v4().simple()))
    }
}

impl Default for PlanId {
    fn default() -> Self {
        Self::new()
    }
}

/// A single file patch (diff)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Patch {
    /// File path relative to workspace
    pub path: PathBuf,
    /// Unified diff content
    pub diff: String,
    /// Original file hash (for conflict detection)
    pub original_hash: Option<String>,
    /// New file hash after applying patch
    pub new_hash: Option<String>,
    /// Whether this is a file creation
    #[serde(default)]
    pub is_new_file: bool,
    /// Whether this is a file deletion
    #[serde(default)]
    pub is_deletion: bool,
}

impl Patch {
    /// Create a new patch
    pub fn new(path: PathBuf, diff: String) -> Self {
        Self {
            path,
            diff,
            original_hash: None,
            new_hash: None,
            is_new_file: false,
            is_deletion: false,
        }
    }

    /// Mark as new file
    pub fn with_new_file(mut self) -> Self {
        self.is_new_file = true;
        self
    }

    /// Mark as deletion
    pub fn with_deletion(mut self) -> Self {
        self.is_deletion = true;
        self
    }

    /// Set original hash
    pub fn with_original_hash(mut self, hash: String) -> Self {
        self.original_hash = Some(hash);
        self
    }

    /// Set new hash
    pub fn with_new_hash(mut self, hash: String) -> Self {
        self.new_hash = Some(hash);
        self
    }
}

/// Verification result for a ChangeSet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    /// Whether verification passed
    pub success: bool,
    /// Verification errors
    #[serde(default)]
    pub errors: Vec<String>,
    /// Verification warnings
    #[serde(default)]
    pub warnings: Vec<String>,
    /// Test results (if applicable)
    #[serde(default)]
    pub test_results: Option<TestResults>,
}

impl VerificationResult {
    pub fn success() -> Self {
        Self {
            success: true,
            errors: Vec::new(),
            warnings: Vec::new(),
            test_results: None,
        }
    }

    pub fn failure(errors: Vec<String>) -> Self {
        Self {
            success: false,
            errors,
            warnings: Vec::new(),
            test_results: None,
        }
    }
}

/// Test results from verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResults {
    pub total: u32,
    pub passed: u32,
    pub failed: u32,
    pub skipped: u32,
}

/// Execution mode for the runtime
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionMode {
    /// Generate plan only, no execution
    Plan,
    /// Require approval for all changes
    Safe,
    /// Execute without approval
    Auto,
}

impl Default for ExecutionMode {
    fn default() -> Self {
        Self::Safe
    }
}

impl std::fmt::Display for ExecutionMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExecutionMode::Plan => write!(f, "plan"),
            ExecutionMode::Safe => write!(f, "safe"),
            ExecutionMode::Auto => write!(f, "auto"),
        }
    }
}

/// A ChangeSet represents a collection of atomic file changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeSet {
    /// Unique identifier
    pub id: ChangeSetId,
    /// Session ID that created this ChangeSet
    pub session_id: String,
    /// Optional plan ID this ChangeSet belongs to
    pub plan_id: Option<PlanId>,
    /// Collection of patches
    pub patches: Vec<Patch>,
    /// Verification result
    pub verification: Option<VerificationResult>,
    /// Whether ChangeSet has been applied
    #[serde(default)]
    pub applied: bool,
    /// Creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Optional description
    #[serde(default)]
    pub description: Option<String>,
}

impl ChangeSet {
    /// Create a new ChangeSet
    pub fn new(session_id: String) -> Self {
        Self {
            id: ChangeSetId::new(),
            session_id,
            plan_id: None,
            patches: Vec::new(),
            verification: None,
            applied: false,
            created_at: chrono::Utc::now(),
            description: None,
        }
    }

    /// Add a patch to the ChangeSet
    pub fn add_patch(&mut self, patch: Patch) {
        self.patches.push(patch);
    }

    /// Set verification result
    pub fn set_verification(&mut self, result: VerificationResult) {
        self.verification = Some(result);
    }

    /// Mark as applied
    pub fn mark_applied(&mut self) {
        self.applied = true;
    }

    /// Get number of patches
    pub fn patch_count(&self) -> usize {
        self.patches.len()
    }

    /// Check if ChangeSet is empty
    pub fn is_empty(&self) -> bool {
        self.patches.is_empty()
    }
}

/// A Plan represents a structured execution plan with multiple steps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plan {
    /// Unique identifier
    pub id: PlanId,
    /// Session ID that created this Plan
    pub session_id: String,
    /// Plan description
    pub description: String,
    /// Plan steps
    pub steps: Vec<PlanStep>,
    /// Current step index
    #[serde(default)]
    pub current_step: usize,
    /// Whether plan is complete
    #[serde(default)]
    pub complete: bool,
    /// Creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl Plan {
    /// Create a new Plan
    pub fn new(session_id: String, description: String) -> Self {
        Self {
            id: PlanId::new(),
            session_id,
            description,
            steps: Vec::new(),
            current_step: 0,
            complete: false,
            created_at: chrono::Utc::now(),
        }
    }

    /// Add a step to the plan
    pub fn add_step(&mut self, step: PlanStep) {
        self.steps.push(step);
    }

    /// Mark current step as complete
    pub fn complete_current_step(&mut self) {
        if self.current_step < self.steps.len() {
            self.steps[self.current_step].complete = true;
            self.current_step += 1;
        }
        if self.current_step >= self.steps.len() {
            self.complete = true;
        }
    }
}

/// A step in a Plan
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanStep {
    /// Step description
    pub description: String,
    /// Step type
    pub step_type: PlanStepType,
    /// Whether step is complete
    #[serde(default)]
    pub complete: bool,
    /// Associated ChangeSet ID (if applicable)
    pub changeset_id: Option<ChangeSetId>,
}

/// Type of plan step
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanStepType {
    /// Read/analyze files
    Analyze,
    /// Create new file
    Create,
    /// Modify existing file
    Modify,
    /// Delete file
    Delete,
    /// Run command/test
    Command,
    /// Other action
    Other,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_changeset_creation() {
        let mut changeset = ChangeSet::new("session-123".to_string());
        assert!(changeset.is_empty());
        assert!(!changeset.applied);

        let patch = Patch::new(
            PathBuf::from("src/main.rs"),
            "@@ -1,3 +1,4 @@\n+use std::io;".to_string(),
        );
        changeset.add_patch(patch);

        assert_eq!(changeset.patch_count(), 1);
        assert!(!changeset.is_empty());
    }

    #[test]
    fn test_plan_creation() {
        let mut plan = Plan::new(
            "session-123".to_string(),
            "Implement feature X".to_string(),
        );

        plan.add_step(PlanStep {
            description: "Read existing code".to_string(),
            step_type: PlanStepType::Analyze,
            complete: false,
            changeset_id: None,
        });

        assert_eq!(plan.steps.len(), 1);
        assert!(!plan.complete);

        plan.complete_current_step();
        assert!(plan.steps[0].complete);
        assert_eq!(plan.current_step, 1);
    }

    #[test]
    fn test_execution_mode_display() {
        assert_eq!(ExecutionMode::Plan.to_string(), "plan");
        assert_eq!(ExecutionMode::Safe.to_string(), "safe");
        assert_eq!(ExecutionMode::Auto.to_string(), "auto");
    }

    #[test]
    fn test_changeset_id_generation() {
        let id1 = ChangeSetId::new();
        let id2 = ChangeSetId::new();
        assert_ne!(id1, id2);
        assert!(id1.0.starts_with("cs_"));
    }
}
