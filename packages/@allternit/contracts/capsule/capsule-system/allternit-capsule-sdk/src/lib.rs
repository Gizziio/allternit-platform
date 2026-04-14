//! A2R Capsule SDK
//!
//! Implements the Capsule System for A2rchitech:
//! - Capsule definition and lifecycle
//! - Capsule Protocol (IPC)
//! - Capsule Registry
//! - Capsule Framework Registry
//!
//! Based on CapsuleProtocol.md specification

use allternit_harness_engineering::{EvidenceManifest, RiskTier};
use allternit_system_law::SystemLawEngine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

// ============================================================================
// Capsule Types and Definitions
// ============================================================================

/// Capsule status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CapsuleStatus {
    /// Capsule is being spawned
    Spawning,
    /// Capsule is active and running
    Active,
    /// Capsule is suspended (state preserved)
    Suspended,
    /// Capsule is resumed from suspension
    Resumed,
    /// Capsule completed normally
    Completed,
    /// Capsule failed
    Failed,
    /// Capsule destroyed
    Destroyed,
}

/// Capsule category
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum CapsuleCategory {
    /// Code-related capsules
    Code,
    /// Planning capsules
    Planning,
    /// Research capsules
    Research,
    /// Operations capsules
    Ops,
    /// Memory capsules
    Memory,
    /// Browser capsules
    Browser,
    /// Custom capsules
    Custom,
}

/// Capsule lifecycle policy
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CapsuleLifecycle {
    /// Ephemeral - exists only for current task, may auto-expire
    Ephemeral,
    /// Session - persists while session exists
    Session,
    /// Pinned - user explicitly pins
    Pinned,
    /// Archived - capsule instance no longer active, but artifacts persist
    Archived,
}

/// Canvas bundle for capsule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasBundle {
    pub canvas_id: String,
    pub view_type: String,
    pub bindings: CanvasBindings,
    pub interactions: Vec<CanvasInteraction>,
    pub risk: CanvasRisk,
    pub provenance_ui: ProvenanceUI,
}

/// Canvas bindings
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CanvasBindings {
    pub journal_refs: Vec<String>,
    pub artifact_refs: Vec<String>,
    pub repo_snapshot_ref: Option<String>,
}

/// Canvas interaction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasInteraction {
    pub id: String,
    pub interaction_type: String,
    pub risk: String,
    pub confirmation_required: bool,
}

/// Canvas risk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasRisk {
    pub class: String,
    pub reason: String,
}

/// Provenance UI settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProvenanceUI {
    pub show_trail: bool,
    pub expand_on_hover: bool,
}

/// Tool scope for capsule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolScope {
    pub allowed_tools: Vec<String>,
    pub denied_tools: Vec<String>,
    pub requires_confirmation: Vec<String>,
}

/// Sandbox policy for capsule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxPolicy {
    pub fs_mounts: Vec<FSMount>,
    pub network: NetworkPolicy,
    pub limits: ResourceLimits,
    pub secrets: SecretsPolicy,
}

/// Filesystem mount
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FSMount {
    pub path: String,
    pub mode: String, // deny, ro, rw
}

/// Network policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkPolicy {
    pub mode: String, // deny, allowlist
    pub allow: Vec<String>,
}

/// Resource limits
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub cpu_ms: u64,
    pub memory_mb: u64,
    pub timeout_ms: u64,
}

/// Secrets policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretsPolicy {
    pub mode: String, // none, vault_refs_only
    pub redact_outputs: bool,
}

/// Capsule provenance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleProvenance {
    pub framework_id: String,
    pub framework_version: String,
    pub agent_id: String,
    pub model_id: String,
    pub inputs: Vec<CapsuleInput>,
    pub tool_calls: Vec<String>,
}

/// Capsule input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleInput {
    pub input_type: String,
    pub ref_value: String,
    pub redacted: bool,
}

// ============================================================================
// Capsule Specification
// ============================================================================

/// CapsuleSpec - the canonical capsule definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleSpec {
    pub capsule_id: String,
    pub title: String,
    pub icon: String,
    pub category: CapsuleCategory,
    pub status: CapsuleLifecycle,
    pub run_ref: RunReference,
    pub bindings: CapsuleBindings,
    pub canvas_bundle: Vec<CanvasBundle>,
    pub tool_scope: ToolScope,
    pub sandbox_policy: SandboxPolicy,
    pub lifecycle: CapsuleLifecycleConfig,
    pub provenance: CapsuleProvenance,
}

/// Run reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunReference {
    pub run_id: String,
    pub session_id: String,
}

/// Capsule bindings
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CapsuleBindings {
    pub journal_refs: Vec<String>,
    pub repo_snapshot_ref: Option<String>,
    pub artifact_refs: Vec<String>,
}

/// Capsule lifecycle config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleLifecycleConfig {
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub close_behavior: String, // destroy, archive_to_journal
    pub exportable: bool,
}

// ============================================================================
// Capsule Framework
// ============================================================================

/// Capsule Framework specification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleFramework {
    pub framework_id: String,
    pub version: String,
    pub intent_patterns: Vec<IntentPattern>,
    pub default_capsule: DefaultCapsule,
    pub required_tools: Vec<String>,
    pub risk_class: RiskTier,
    pub sandbox_defaults: SandboxDefaults,
    pub acceptance_tests: Vec<String>,
}

/// Intent pattern for framework matching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentPattern {
    pub verbs: Vec<String>,
    pub entities: Vec<String>,
}

/// Default capsule template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DefaultCapsule {
    pub title: String,
    pub icon: String,
    pub category: CapsuleCategory,
    pub canvas_bundle: Vec<CanvasBundleTemplate>,
}

/// Canvas bundle template
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanvasBundleTemplate {
    pub view_type: String,
}

/// Sandbox defaults
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxDefaults {
    pub network: NetworkPolicy,
    pub fs_mounts: Vec<FSMount>,
}

// ============================================================================
// Capsule Registry
// ============================================================================

/// Capsule registry for runtime discovery
pub struct CapsuleRegistry {
    capsules: Arc<RwLock<HashMap<String, CapsuleSpec>>>,
    frameworks: Arc<RwLock<HashMap<String, CapsuleFramework>>>,
    system_law: Arc<SystemLawEngine>,
}

impl CapsuleRegistry {
    pub fn new(system_law: Arc<SystemLawEngine>) -> Self {
        Self {
            capsules: Arc::new(RwLock::new(HashMap::new())),
            frameworks: Arc::new(RwLock::new(HashMap::new())),
            system_law,
        }
    }

    /// Register a capsule framework
    pub async fn register_framework(&self, framework: CapsuleFramework) {
        let mut frameworks = self.frameworks.write().await;
        frameworks.insert(framework.framework_id.clone(), framework);
    }

    /// Get framework by ID
    pub async fn get_framework(&self, framework_id: &str) -> Option<CapsuleFramework> {
        let frameworks = self.frameworks.read().await;
        frameworks.get(framework_id).cloned()
    }

    /// Spawn a capsule from framework
    pub async fn spawn_capsule(
        &self,
        framework_id: &str,
        intent_tokens: &str,
        run_ref: RunReference,
    ) -> Result<CapsuleSpec, CapsuleError> {
        let frameworks = self.frameworks.read().await;
        let framework = frameworks
            .get(framework_id)
            .ok_or_else(|| CapsuleError::FrameworkNotFound(framework_id.to_string()))?;

        // Create capsule from framework template
        let capsule = self.create_capsule_from_framework(framework, intent_tokens, run_ref);

        // Validate capsule
        self.validate_capsule(&capsule)?;

        // Register capsule
        let mut capsules = self.capsules.write().await;
        capsules.insert(capsule.capsule_id.clone(), capsule.clone());

        Ok(capsule)
    }

    /// Create capsule from framework
    fn create_capsule_from_framework(
        &self,
        framework: &CapsuleFramework,
        intent_tokens: &str,
        run_ref: RunReference,
    ) -> CapsuleSpec {
        let capsule_id = format!("cap_{}", Uuid::new_v4().simple());
        let now = Utc::now();

        CapsuleSpec {
            capsule_id,
            title: framework.default_capsule.title.clone(),
            icon: framework.default_capsule.icon.clone(),
            category: framework.default_capsule.category,
            status: CapsuleLifecycle::Session,
            run_ref: run_ref.clone(),
            bindings: CapsuleBindings {
                journal_refs: vec![format!("jrnl_{}", run_ref.run_id)],
                repo_snapshot_ref: None,
                artifact_refs: vec![],
            },
            canvas_bundle: framework
                .default_capsule
                .canvas_bundle
                .iter()
                .map(|t| CanvasBundle {
                    canvas_id: format!("cnv_{}", Uuid::new_v4().simple()),
                    view_type: t.view_type.clone(),
                    bindings: CanvasBindings::default(),
                    interactions: vec![],
                    risk: CanvasRisk {
                        class: "read".to_string(),
                        reason: "Default read-only capsule".to_string(),
                    },
                    provenance_ui: ProvenanceUI {
                        show_trail: true,
                        expand_on_hover: true,
                    },
                })
                .collect(),
            tool_scope: ToolScope {
                allowed_tools: framework.required_tools.clone(),
                denied_tools: vec![],
                requires_confirmation: vec![],
            },
            sandbox_policy: SandboxPolicy {
                fs_mounts: framework.sandbox_defaults.fs_mounts.clone(),
                network: framework.sandbox_defaults.network.clone(),
                limits: ResourceLimits {
                    cpu_ms: 600000,
                    memory_mb: 2048,
                    timeout_ms: 600000,
                },
                secrets: SecretsPolicy {
                    mode: "vault_refs_only".to_string(),
                    redact_outputs: true,
                },
            },
            lifecycle: CapsuleLifecycleConfig {
                created_at: now,
                updated_at: now,
                expires_at: None,
                close_behavior: "archive_to_journal".to_string(),
                exportable: true,
            },
            provenance: CapsuleProvenance {
                framework_id: framework.framework_id.clone(),
                framework_version: framework.version.clone(),
                agent_id: "agent_unknown".to_string(),
                model_id: "model_unknown".to_string(),
                inputs: vec![CapsuleInput {
                    input_type: "user_intent".to_string(),
                    ref_value: intent_tokens.to_string(),
                    redacted: false,
                }],
                tool_calls: vec![],
            },
        }
    }

    /// Validate capsule
    fn validate_capsule(&self, capsule: &CapsuleSpec) -> Result<(), CapsuleError> {
        // Validate bindings
        if capsule.bindings.journal_refs.is_empty() {
            return Err(CapsuleError::ValidationFailed(
                "Capsule must have at least one journal reference".to_string(),
            ));
        }

        // Validate tool scope
        if capsule.tool_scope.allowed_tools.is_empty() {
            return Err(CapsuleError::ValidationFailed(
                "Capsule must have at least one allowed tool".to_string(),
            ));
        }

        Ok(())
    }

    /// Get capsule by ID
    pub async fn get_capsule(&self, capsule_id: &str) -> Option<CapsuleSpec> {
        let capsules = self.capsules.read().await;
        capsules.get(capsule_id).cloned()
    }

    /// Update capsule
    pub async fn update_capsule(
        &self,
        capsule_id: &str,
        update: CapsuleUpdate,
    ) -> Result<CapsuleSpec, CapsuleError> {
        let mut capsules = self.capsules.write().await;
        let capsule = capsules
            .get_mut(capsule_id)
            .ok_or_else(|| CapsuleError::CapsuleNotFound(capsule_id.to_string()))?;

        // Apply update
        if let Some(status) = update.status {
            // In production, would validate state transitions
        }
        if let Some(bindings) = update.bindings {
            capsule.bindings = bindings;
        }
        if let Some(canvas_bundle) = update.canvas_bundle {
            capsule.canvas_bundle = canvas_bundle;
        }

        capsule.lifecycle.updated_at = Utc::now();

        Ok(capsule.clone())
    }

    /// Close capsule
    pub async fn close_capsule(
        &self,
        capsule_id: &str,
        mode: CloseMode,
    ) -> Result<(), CapsuleError> {
        let mut capsules = self.capsules.write().await;
        let capsule = capsules
            .get_mut(capsule_id)
            .ok_or_else(|| CapsuleError::CapsuleNotFound(capsule_id.to_string()))?;

        match mode {
            CloseMode::Destroy => {
                capsule.status = CapsuleLifecycle::Ephemeral;
                // In production, would clean up resources
            }
            CloseMode::ArchiveToJournal => {
                capsule.status = CapsuleLifecycle::Archived;
                // In production, would archive to journal
            }
        }

        capsule.lifecycle.updated_at = Utc::now();

        Ok(())
    }

    /// Pin capsule
    pub async fn pin_capsule(&self, capsule_id: &str) -> Result<(), CapsuleError> {
        let mut capsules = self.capsules.write().await;
        let capsule = capsules
            .get_mut(capsule_id)
            .ok_or_else(|| CapsuleError::CapsuleNotFound(capsule_id.to_string()))?;

        capsule.status = CapsuleLifecycle::Pinned;
        capsule.lifecycle.updated_at = Utc::now();

        Ok(())
    }

    /// List active capsules
    pub async fn list_active_capsules(&self) -> Vec<CapsuleSpec> {
        let capsules = self.capsules.read().await;
        capsules
            .values()
            .filter(|c| matches!(c.status, CapsuleLifecycle::Session | CapsuleLifecycle::Pinned))
            .cloned()
            .collect()
    }

    /// Switch to capsule (for tab semantics)
    pub async fn switch_capsule(&self, capsule_id: &str) -> Result<CapsuleSpec, CapsuleError> {
        // In production, would update UI focus and restore state
        self.get_capsule(capsule_id)
            .await
            .ok_or_else(|| CapsuleError::CapsuleNotFound(capsule_id.to_string()))
    }

    /// Export capsule
    pub async fn export_capsule(
        &self,
        capsule_id: &str,
        _target: ExportTarget,
    ) -> Result<String, CapsuleError> {
        let capsules = self.capsules.read().await;
        let capsule = capsules
            .get(capsule_id)
            .ok_or_else(|| CapsuleError::CapsuleNotFound(capsule_id.to_string()))?;

        if !capsule.lifecycle.exportable {
            return Err(CapsuleError::ExportFailed(
                "Capsule is not exportable".to_string(),
            ));
        }

        // In production, would generate actual export
        let export_ref = format!("export_{}", Uuid::new_v4().simple());

        Ok(export_ref)
    }
}

/// Capsule update
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CapsuleUpdate {
    pub status: Option<CapsuleLifecycle>,
    pub bindings: Option<CapsuleBindings>,
    pub canvas_bundle: Option<Vec<CanvasBundle>>,
}

/// Close mode
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum CloseMode {
    Destroy,
    ArchiveToJournal,
}

/// Export target
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportTarget {
    Artifact,
    MiniAppPackage,
    ShareLink,
}

// ============================================================================
// Capsule Errors
// ============================================================================

/// Capsule error types
#[derive(Debug, thiserror::Error)]
pub enum CapsuleError {
    #[error("Framework not found: {0}")]
    FrameworkNotFound(String),

    #[error("Capsule not found: {0}")]
    CapsuleNotFound(String),

    #[error("Validation failed: {0}")]
    ValidationFailed(String),

    #[error("Export failed: {0}")]
    ExportFailed(String),

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

    fn create_test_framework() -> CapsuleFramework {
        CapsuleFramework {
            framework_id: "fwk_diff_review".to_string(),
            version: "1.0.0".to_string(),
            intent_patterns: vec![IntentPattern {
                verbs: vec!["review".to_string(), "fix".to_string()],
                entities: vec!["repo".to_string(), "file".to_string()],
            }],
            default_capsule: DefaultCapsule {
                title: "Diff Review".to_string(),
                icon: "diff".to_string(),
                category: CapsuleCategory::Code,
                canvas_bundle: vec![CanvasBundleTemplate {
                    view_type: "diff_review".to_string(),
                }],
            },
            required_tools: vec!["git.diff".to_string(), "fs.read".to_string()],
            risk_class: RiskTier::Medium,
            sandbox_defaults: SandboxDefaults {
                network: NetworkPolicy {
                    mode: "deny".to_string(),
                    allow: vec![],
                },
                fs_mounts: vec![FSMount {
                    path: "/workspace".to_string(),
                    mode: "ro".to_string(),
                }],
            },
            acceptance_tests: vec!["AT-CAPSULE-001".to_string()],
        }
    }

    #[tokio::test]
    async fn test_register_framework() {
        let registry = CapsuleRegistry::new(create_test_system_law());
        let framework = create_test_framework();

        registry.register_framework(framework).await;

        let retrieved = registry.get_framework("fwk_diff_review").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().version, "1.0.0");
    }

    #[tokio::test]
    async fn test_spawn_capsule() {
        let registry = CapsuleRegistry::new(create_test_system_law());
        let framework = create_test_framework();
        registry.register_framework(framework).await;

        let run_ref = RunReference {
            run_id: "run_001".to_string(),
            session_id: "sess_001".to_string(),
        };

        let capsule = registry
            .spawn_capsule("fwk_diff_review", "review this diff", run_ref)
            .await;

        assert!(capsule.is_ok());
        let capsule = capsule.unwrap();
        assert_eq!(capsule.title, "Diff Review");
        assert_eq!(capsule.category, CapsuleCategory::Code);
        assert!(!capsule.bindings.journal_refs.is_empty());
    }

    #[tokio::test]
    async fn test_get_capsule() {
        let registry = CapsuleRegistry::new(create_test_system_law());
        let framework = create_test_framework();
        registry.register_framework(framework).await;

        let run_ref = RunReference {
            run_id: "run_001".to_string(),
            session_id: "sess_001".to_string(),
        };

        let capsule = registry
            .spawn_capsule("fwk_diff_review", "review this diff", run_ref)
            .await
            .unwrap();

        let retrieved = registry.get_capsule(&capsule.capsule_id).await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().title, "Diff Review");
    }

    #[tokio::test]
    async fn test_update_capsule() {
        let registry = CapsuleRegistry::new(create_test_system_law());
        let framework = create_test_framework();
        registry.register_framework(framework).await;

        let run_ref = RunReference {
            run_id: "run_001".to_string(),
            session_id: "sess_001".to_string(),
        };

        let capsule = registry
            .spawn_capsule("fwk_diff_review", "review this diff", run_ref)
            .await
            .unwrap();

        let update = CapsuleUpdate {
            bindings: Some(CapsuleBindings {
                journal_refs: vec!["jrnl_001".to_string()],
                repo_snapshot_ref: Some("git:abc123".to_string()),
                artifact_refs: vec![],
            }),
            ..Default::default()
        };

        let updated = registry.update_capsule(&capsule.capsule_id, update).await;
        assert!(updated.is_ok());
    }

    #[tokio::test]
    async fn test_close_capsule() {
        let registry = CapsuleRegistry::new(create_test_system_law());
        let framework = create_test_framework();
        registry.register_framework(framework).await;

        let run_ref = RunReference {
            run_id: "run_001".to_string(),
            session_id: "sess_001".to_string(),
        };

        let capsule = registry
            .spawn_capsule("fwk_diff_review", "review this diff", run_ref)
            .await
            .unwrap();

        let result = registry.close_capsule(&capsule.capsule_id, CloseMode::ArchiveToJournal).await;
        assert!(result.is_ok());

        let retrieved = registry.get_capsule(&capsule.capsule_id).await.unwrap();
        assert_eq!(retrieved.status, CapsuleLifecycle::Archived);
    }

    #[tokio::test]
    async fn test_pin_capsule() {
        let registry = CapsuleRegistry::new(create_test_system_law());
        let framework = create_test_framework();
        registry.register_framework(framework).await;

        let run_ref = RunReference {
            run_id: "run_001".to_string(),
            session_id: "sess_001".to_string(),
        };

        let capsule = registry
            .spawn_capsule("fwk_diff_review", "review this diff", run_ref)
            .await
            .unwrap();

        let result = registry.pin_capsule(&capsule.capsule_id).await;
        assert!(result.is_ok());

        let retrieved = registry.get_capsule(&capsule.capsule_id).await.unwrap();
        assert_eq!(retrieved.status, CapsuleLifecycle::Pinned);
    }

    #[tokio::test]
    async fn test_list_active_capsules() {
        let registry = CapsuleRegistry::new(create_test_system_law());
        let framework = create_test_framework();
        registry.register_framework(framework).await;

        let run_ref = RunReference {
            run_id: "run_001".to_string(),
            session_id: "sess_001".to_string(),
        };

        // Spawn multiple capsules
        registry
            .spawn_capsule("fwk_diff_review", "review 1", run_ref.clone())
            .await
            .unwrap();
        registry
            .spawn_capsule("fwk_diff_review", "review 2", run_ref.clone())
            .await
            .unwrap();

        let active = registry.list_active_capsules().await;
        assert_eq!(active.len(), 2);
    }

    #[tokio::test]
    async fn test_spawn_capsule_no_journal_refs() {
        let registry = CapsuleRegistry::new(create_test_system_law());

        // Register a framework with no default journal refs
        let framework = CapsuleFramework {
            framework_id: "fwk_test".to_string(),
            version: "1.0.0".to_string(),
            intent_patterns: vec![],
            default_capsule: DefaultCapsule {
                title: "Test".to_string(),
                icon: "test".to_string(),
                category: CapsuleCategory::Custom,
                canvas_bundle: vec![],
            },
            required_tools: vec![],
            risk_class: RiskTier::Low,
            sandbox_defaults: SandboxDefaults {
                network: NetworkPolicy {
                    mode: "deny".to_string(),
                    allow: vec![],
                },
                fs_mounts: vec![],
            },
            acceptance_tests: vec![],
        };
        registry.register_framework(framework).await;

        let run_ref = RunReference {
            run_id: "run_001".to_string(),
            session_id: "sess_001".to_string(),
        };

        // Should fail validation because no journal refs
        let result = registry
            .spawn_capsule("fwk_test", "test", run_ref)
            .await;

        assert!(result.is_err());
    }
}
