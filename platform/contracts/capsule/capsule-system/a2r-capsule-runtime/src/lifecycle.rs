use std::collections::HashMap;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use crate::schema::{CapsuleSpec, CapsuleId, PersistenceMode, SandboxPolicy, ToolScope, Lifecycle, Provenance, Bindings, CanvasBundle};
use crate::error::{CapsuleError, Result};

pub struct Capsule {
    spec: CapsuleSpec,
    runtime_state: CapsuleState,
}

impl Capsule {
    pub fn spec(&self) -> &CapsuleSpec {
        &self.spec
    }
}

#[derive(Debug, Clone)]
pub enum CapsuleState {
    Active,
    Paused,
    Closed,
}

pub struct CapsuleRuntime {
    capsules: HashMap<CapsuleId, Capsule>,
    sandbox: crate::sandbox::Sandbox,
}

impl CapsuleRuntime {
    pub fn new(sandbox_policy: SandboxPolicy) -> Self {
        Self {
            capsules: HashMap::new(),
            sandbox: crate::sandbox::Sandbox::new(sandbox_policy),
        }
    }

    pub async fn spawn(&mut self, spec: CapsuleSpec) -> Result<CapsuleId> {
        self.sandbox.enforce_resource_limits("spawn_operation").await?;

        let capsule = Capsule {
            spec: spec.clone(),
            runtime_state: CapsuleState::Active,
        };

        let capsule_id = capsule.spec.capsule_id;
        self.capsules.insert(capsule_id, capsule);

        Ok(capsule_id)
    }

    pub async fn switch(&mut self, capsule_id: &CapsuleId) -> Result<()> {
        if let Some(capsule) = self.capsules.get_mut(capsule_id) {
            capsule.runtime_state = CapsuleState::Active;
            capsule.spec.updated_at = Utc::now();
            Ok(())
        } else {
            Err(CapsuleError::NotFound(capsule_id.to_string()))
        }
    }

    pub async fn close(&mut self, capsule_id: &CapsuleId, archive_to_journal: bool) -> Result<()> {
        if let Some(mut capsule) = self.capsules.remove(capsule_id) {
            capsule.runtime_state = CapsuleState::Closed;

            if archive_to_journal {
            }

            Ok(())
        } else {
            Err(CapsuleError::NotFound(capsule_id.to_string()))
        }
    }

    pub async fn pin(&mut self, capsule_id: &CapsuleId) -> Result<()> {
        if let Some(mut capsule) = self.capsules.get_mut(capsule_id) {
            capsule.spec.status = crate::schema::PersistenceMode::Pinned;
            Ok(())
        } else {
            Err(CapsuleError::NotFound(capsule_id.to_string()))
        }
    }

    pub async fn export(&self, capsule_id: &CapsuleId, format: &str) -> Result<String> {
        if let Some(capsule) = self.capsules.get(capsule_id) {
            match format {
                "artifact" => Ok(serde_json::to_string(&capsule.spec)?),
                "miniapp" => Ok(serde_json::to_string(&capsule.spec)?),
                _ => Err(CapsuleError::InvalidExport(format!("Unknown export format: {}", format))),
            }
        } else {
            Err(CapsuleError::NotFound(capsule_id.to_string()))
        }
    }

    pub fn get_capsule(&self, capsule_id: &CapsuleId) -> Option<&Capsule> {
        self.capsules.get(capsule_id)
    }

    pub fn get_all_capsules(&self) -> Vec<&Capsule> {
        self.capsules.values().collect()
    }
}
