//! # A2R Replay Service (N12)
//!
//! Determinism envelope and replay contract implementation.
//!
//! ## Features
//!
//! - Capture execution context for deterministic replay
//! - Store non-deterministic outputs (timestamps, network responses)
//! - Replay executions with captured context
//!
//! ## Shell UI Integration
//!
//! Control Center → Runtime Environment → Determinism:
//! - Enable/Disable replay capture
//! - Capture Level: None, Minimal, Full
//! - View replay history

use a2r_driver_interface::{DeterminismEnvelope, ExecutionId};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Replay capture level
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CaptureLevel {
    #[default]
    None,
    Minimal,
    Full,
}

/// Captured non-deterministic output
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapturedOutput {
    pub tool_id: String,
    pub invocation_hash: String,
    pub output_hash: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Replay manifest for an execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReplayManifest {
    pub run_id: ExecutionId,
    pub envelope: DeterminismEnvelope,
    pub captured_outputs: Vec<CapturedOutput>,
    pub timestamps: Vec<TimestampRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimestampRecord {
    pub event: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// Replay engine
pub struct ReplayEngine {
    manifests: HashMap<ExecutionId, ReplayManifest>,
    capture_level: CaptureLevel,
}

impl ReplayEngine {
    pub fn new() -> Self {
        Self {
            manifests: HashMap::new(),
            capture_level: CaptureLevel::None,
        }
    }

    pub fn with_capture_level(capture_level: CaptureLevel) -> Self {
        Self {
            manifests: HashMap::new(),
            capture_level,
        }
    }

    /// Start capturing a new execution
    pub fn start_capture(&mut self, run_id: ExecutionId, envelope: DeterminismEnvelope) {
        if matches!(self.capture_level, CaptureLevel::None) {
            return;
        }

        let manifest = ReplayManifest {
            run_id,
            envelope,
            captured_outputs: vec![],
            timestamps: vec![],
        };

        self.manifests.insert(run_id, manifest);
    }

    /// Record a timestamp event
    pub fn record_timestamp(&mut self, run_id: ExecutionId, event: impl Into<String>) {
        if matches!(self.capture_level, CaptureLevel::None) {
            return;
        }

        if let Some(manifest) = self.manifests.get_mut(&run_id) {
            manifest.timestamps.push(TimestampRecord {
                event: event.into(),
                timestamp: chrono::Utc::now(),
            });
        }
    }

    /// Capture tool output for replay
    pub fn capture_output(
        &mut self,
        run_id: ExecutionId,
        tool_id: impl Into<String>,
        invocation_hash: impl Into<String>,
        output_hash: impl Into<String>,
    ) {
        if matches!(self.capture_level, CaptureLevel::None) {
            return;
        }

        if let Some(manifest) = self.manifests.get_mut(&run_id) {
            manifest.captured_outputs.push(CapturedOutput {
                tool_id: tool_id.into(),
                invocation_hash: invocation_hash.into(),
                output_hash: output_hash.into(),
                timestamp: chrono::Utc::now(),
            });
        }
    }

    /// Complete capture and store manifest
    pub fn complete_capture(&mut self, run_id: ExecutionId) -> Option<ReplayManifest> {
        self.manifests.remove(&run_id)
    }

    /// Replay an execution using captured manifest
    pub fn replay(&self, run_id: ExecutionId) -> Result<ReplayResult, ReplayError> {
        let Some(manifest) = self.manifests.get(&run_id) else {
            return Err(ReplayError::ManifestNotFound(run_id));
        };

        Ok(ReplayResult {
            run_id,
            envelope: manifest.envelope.clone(),
            can_replay: !matches!(self.capture_level, CaptureLevel::None),
        })
    }

    /// Get capture level
    pub fn capture_level(&self) -> CaptureLevel {
        self.capture_level
    }

    /// Set capture level
    pub fn set_capture_level(&mut self, level: CaptureLevel) {
        self.capture_level = level;
    }

    /// Get manifest for a run
    pub fn get_manifest(&self, run_id: ExecutionId) -> Option<&ReplayManifest> {
        self.manifests.get(&run_id)
    }

    /// List all captured manifests
    pub fn list_manifests(&self) -> Vec<&ReplayManifest> {
        self.manifests.values().collect()
    }
}

impl Default for ReplayEngine {
    fn default() -> Self {
        Self::new()
    }
}

/// Replay result
#[derive(Debug, Clone)]
pub struct ReplayResult {
    pub run_id: ExecutionId,
    pub envelope: DeterminismEnvelope,
    pub can_replay: bool,
}

/// Replay error
#[derive(Debug, thiserror::Error)]
pub enum ReplayError {
    #[error("Replay manifest not found for run: {0}")]
    ManifestNotFound(ExecutionId),

    #[error("Replay failed: {0}")]
    ReplayFailed(String),
}

/// Generate hash for deterministic replay
pub fn generate_replay_hash(inputs: &[u8]) -> String {
    blake3::hash(inputs).to_hex().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_level() {
        let mut engine = ReplayEngine::new();
        assert!(matches!(engine.capture_level(), CaptureLevel::None));

        engine.set_capture_level(CaptureLevel::Full);
        assert!(matches!(engine.capture_level(), CaptureLevel::Full));
    }

    #[test]
    fn test_no_capture_when_disabled() {
        let mut engine = ReplayEngine::new(); // CaptureLevel::None

        let run_id = ExecutionId::new();
        let envelope = DeterminismEnvelope {
            env_spec_hash: "test".to_string(),
            tool_versions: HashMap::new(),
            policy_hash: "test".to_string(),
            inputs_hash: "test".to_string(),
            time_frozen: false,
            seed: None,
        };

        engine.start_capture(run_id, envelope);
        engine.record_timestamp(run_id, "test_event");

        // Should not capture when level is None
        assert!(engine.get_manifest(run_id).is_none());
    }
}
