use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;
use a2rchitech_kernel_contracts;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CapsuleSpec {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub capsule_type: Option<String>,
    pub goal: Goal,
    pub evidence: Vec<EvidenceObject>,
    pub ui: UISpec,
    pub actions: Vec<ActionSpec>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub bindings: Vec<BindingSpec>,
    pub update_rules: Vec<UpdateRule>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interaction: Option<InteractionSpec>,
    pub provenance: Provenance,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Goal {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tokens: Option<Vec<IntentToken>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IntentToken {
    pub kind: IntentTokenKind,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum IntentTokenKind {
    Intent,
    Entity,
    Constraint,
    Risk,
    Confidence,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceObject {
    pub evidence_id: String,
    pub kind: EvidenceKind,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snapshot_ref: Option<String>,
    pub extracted_schema: serde_json::Value,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum EvidenceKind {
    Url,
    Doc,
    Pdf,
    Note,
    Repo,
    Diff,
    TestRun,
    Log,
    Artifact,
    Dataset,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UISpec {
    pub a2ui_payload: A2UIPayload,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub surface_policy: Option<SurfacePolicy>,
}

pub use a2ui_types::{A2UIPayload, ComponentNode};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SurfacePolicy {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub component_whitelist: Vec<String>,
    #[serde(default)]
    pub no_code_execution: bool,
}

impl Default for SurfacePolicy {
    fn default() -> Self {
        Self {
            component_whitelist: Vec::new(),
            no_code_execution: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ActionSpec {
    pub action_id: String,
    pub label: String,
    pub safety_tier: SafetyTier,
    pub tool_ref: String,
    pub input_schema: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ui_affordance: Option<UIAffordance>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SafetyTier {
    Read,
    Write,
    Exec,
    Danger,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum UIAffordance {
    Button,
    Menu,
    FormSubmit,
    DragDrop,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UpdateRule {
    pub when: WhenCondition,
    pub then: ThenAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WhenCondition {
    pub event: EventType,
    pub filter: serde_json::Value,
}

impl Default for WhenCondition {
    fn default() -> Self {
        Self {
            event: EventType::EvidenceAdded,
            filter: serde_json::json!({}),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    EvidenceAdded,
    EvidenceRemoved,
    GoalChanged,
    JournalEvent,
    UserAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ThenAction {
    pub strategy: UpdateStrategy,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub diff_mode: Option<DiffMode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStrategy {
    RecompileFull,
    RecompilePartial,
    PatchUi,
    PatchDataModel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DiffMode {
    StableIds,
    PositionAware,
    ContentHash,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BindingSpec {
    pub from: String,
    pub to: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transform: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct InteractionSpec {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub physics_profile: Option<PhysicsProfile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub token_semantics: Option<TokenSemantics>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub motion_semantics: Option<MotionSemantics>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PhysicsProfile {
    StructuredLight,
    StructuredStrong,
    FreeformLight,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TokenSemantics {
    #[serde(default)]
    pub drag_to_refine: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub snap_zones: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MotionSemantics {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub risk_heat: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confidence_fog: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub constraint_gravity: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Provenance {
    pub run_id: String,
    pub created_at_ms: i64,
    pub source_links: Vec<SourceLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SourceLink {
    pub evidence_id: String,
    pub uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anchor: Option<String>,
}

#[derive(Debug, Error)]
pub enum CapsuleSpecError {
    #[error("Invalid capsule ID: {0}")]
    InvalidCapsuleId(String),
    #[error("Invalid evidence ID: {0}")]
    InvalidEvidenceId(String),
    #[error("JSON validation failed: {0}")]
    JsonValidation(String),
    #[error("Serialization error: {0}")]
    Serialization(String),
}

impl CapsuleSpec {
    pub fn validate(&self) -> Result<(), CapsuleSpecError> {
        Uuid::parse_str(&self.id)
            .map_err(|_| CapsuleSpecError::InvalidCapsuleId(self.id.clone()))?;

        for evidence in &self.evidence {
            Uuid::parse_str(&evidence.evidence_id)
                .map_err(|_| CapsuleSpecError::InvalidEvidenceId(evidence.evidence_id.clone()))?;
        }

        Ok(())
    }

    pub fn generate(goal_text: impl Into<String>, run_id: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            capsule_type: None,
            goal: Goal {
                text: goal_text.into(),
                tokens: None,
            },
            evidence: Vec::new(),
            ui: UISpec {
                a2ui_payload: a2ui_types::A2UIPayload {
                    schema_version: "a2ui.v0.1".to_string(),
                    data_model: serde_json::json!({}),
                    surfaces: Vec::new(),
                    ui_state: None,
                },
                surface_policy: Some(SurfacePolicy::default()),
            },
            actions: Vec::new(),
            bindings: Vec::new(),
            update_rules: Vec::new(),
            interaction: None,
            provenance: Provenance {
                run_id: run_id.into(),
                created_at_ms: chrono::Utc::now().timestamp_millis(),
                source_links: Vec::new(),
            },
        }
    }

    pub fn from_kernel_contract(
        event_envelope: &a2rchitech_kernel_contracts::EventEnvelope,
        run_model: &a2rchitech_kernel_contracts::RunModel,
    ) -> Result<Self, CapsuleSpecError> {
        let goal_text = event_envelope.payload.get("goal_text")
            .and_then(|v| v.as_str())
            .unwrap_or("Default goal from event");

        let mut spec = Self::generate(goal_text, run_model.run_id.clone());

        // Map kernel contract fields to capsule spec
        spec.provenance.run_id = run_model.run_id.clone();
        spec.provenance.created_at_ms = run_model.created_at as i64;

        // Add source link from event envelope
        spec.provenance.source_links.push(SourceLink {
            evidence_id: event_envelope.event_id.clone(),
            uri: format!("event://{}", event_envelope.event_id),
            anchor: None,
        });

        Ok(spec)
    }

    pub fn to_kernel_contract_event(&self) -> a2rchitech_kernel_contracts::EventEnvelope {
        use a2rchitech_kernel_contracts::EventEnvelope;

        EventEnvelope::new(
            "capsule_created".to_string(),
            self.provenance.run_id.clone(),
            "default_tenant".to_string(),
            self.id.clone(),
            "capsule".to_string(),
            serde_json::json!({
                "capsule_id": self.id,
                "capsule_type": self.capsule_type,
                "goal_text": self.goal.text,
                "evidence_count": self.evidence.len(),
                "action_count": self.actions.len(),
            }),
        )
    }

    pub fn apply_verify_artifact(&mut self, artifact: &a2rchitech_kernel_contracts::VerifyArtifact) {
        // Apply verification results to the capsule spec
        // This could update the capsule's state based on verification results
        if !artifact.results.passed {
            // Add verification issues as evidence
            for issue in &artifact.results.issues {
                self.evidence.push(EvidenceObject {
                    evidence_id: format!("verify_{}", Uuid::new_v4()),
                    kind: EvidenceKind::Log,
                    title: format!("Verification Issue: {}", issue.issue_type),
                    uri: None,
                    snapshot_ref: None,
                    extracted_schema: serde_json::json!({
                        "issue_type": &issue.issue_type,
                        "description": &issue.description,
                        "severity": format!("{:?}", issue.severity),
                        "location": &issue.location,
                    }),
                    metadata: serde_json::json!({
                        "verified_by": &artifact.verified_by,
                        "timestamp": artifact.timestamp,
                    }),
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capsule_spec_validation() {
        let spec = CapsuleSpec::generate("test goal", "run-123");
        assert!(spec.validate().is_ok());
    }

    #[test]
    fn test_invalid_capsule_id() {
        let mut spec = CapsuleSpec::generate("test goal", "run-123");
        spec.id = "not-a-uuid".to_string();
        assert!(spec.validate().is_err());
    }

    #[test]
    fn test_serialization() {
        let spec = CapsuleSpec::generate("test goal", "run-123");
        let json = serde_json::to_string(&spec).unwrap();
        let deserialized: CapsuleSpec = serde_json::from_str(&json).unwrap();
        assert_eq!(spec, deserialized);
    }
}