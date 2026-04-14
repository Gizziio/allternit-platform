use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

pub type CapsuleId = Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PersistenceMode {
    Ephemeral,
    Session,
    Pinned,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FileSystemMode {
    Deny,
    ReadOnly,
    ReadWrite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SandboxPolicy {
    pub filesystem_mounts: Vec<FilesystemMount>,
    pub network: NetworkPolicy,
    pub limits: ResourceLimits,
    pub secrets: SecretPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct FilesystemMount {
    pub path: String,
    pub mode: FileSystemMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SecretPolicy {
    pub mode: String,
    pub redact_outputs: bool,
    pub vault_refs_only: bool,
}

impl Default for SecretPolicy {
    fn default() -> Self {
        Self {
            mode: "standard".to_string(),
            redact_outputs: true,
            vault_refs_only: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ResourceLimits {
    pub cpu_ms: u64,
    pub memory_mb: u64,
    pub timeout_ms: u64,
}

impl Default for ResourceLimits {
    fn default() -> Self {
        Self {
            cpu_ms: 1000,
            memory_mb: 128,
            timeout_ms: 5000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct NetworkPolicy {
    pub mode: String,
    pub allowlist: Vec<String>,
}

impl Default for NetworkPolicy {
    fn default() -> Self {
        Self {
            mode: "deny".to_string(),
            allowlist: vec![],
        }
    }
}

impl Default for SandboxPolicy {
    fn default() -> Self {
        Self {
            filesystem_mounts: vec![],
            network: NetworkPolicy::default(),
            limits: ResourceLimits::default(),
            secrets: SecretPolicy::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ToolScope {
    pub allowed_tools: Vec<String>,
    pub denied_tools: Vec<String>,
    pub requires_confirmation: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CapsuleSpec {
    pub capsule_id: CapsuleId,
    pub title: String,
    pub icon: String,
    pub category: String,
    pub status: PersistenceMode,
    pub run_ref: RunRef,
    pub bindings: Bindings,
    pub canvas_bundle: Vec<CanvasBundle>,
    pub tool_scope: ToolScope,
    pub sandbox_policy: SandboxPolicy,
    pub lifecycle: Lifecycle,
    pub provenance: Provenance,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RunRef {
    pub run_id: Uuid,
    pub session_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Bindings {
    pub journal_refs: Vec<Uuid>,
    pub repo_snapshot_ref: Option<String>,
    pub artifact_refs: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CanvasBundle {
    pub canvas_id: Uuid,
    pub view_type: String,
    pub bindings: Bindings,
    pub interactions: Vec<String>,
    pub risk: RiskLevel,
    pub provenance_ui: ProvenanceUI,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Read,
    Write,
    Exec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ProvenanceUI {
    pub show_trail: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Lifecycle {
    pub close_behavior: String,
    pub exportable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct Provenance {
    pub framework_id: Uuid,
    pub framework_version: String,
    pub agent_id: String,
    pub model_id: String,
    pub inputs: Vec<InputRef>,
    pub tool_calls: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct InputRef {
    pub r#type: String,
    pub ref_id: Uuid,
    pub redacted: bool,
}
