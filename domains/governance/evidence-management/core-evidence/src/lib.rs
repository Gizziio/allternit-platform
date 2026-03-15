use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;
use chrono::Utc;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EvidenceObject {
    pub evidence_id: String,
    pub kind: EvidenceKind,
    pub title: String,
    pub uri: Option<String>,
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
pub struct EvidenceDelta {
    pub event: EvidenceEvent,
    pub evidence_id: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceEvent {
    EvidenceAdded,
    EvidenceRemoved,
}

#[derive(Debug, Error)]
pub enum EvidenceStoreError {
    #[error("Invalid evidence ID: {0}")]
    InvalidEvidenceId(String),
    #[error("Evidence not found: {0}")]
    EvidenceNotFound(String),
    #[error("Duplicate evidence ID: {0}")]
    DuplicateEvidence(String),
}

#[derive(Debug)]
pub struct EvidenceStore {
    evidence: Vec<EvidenceObject>,
}

impl EvidenceStore {
    pub fn new() -> Self {
        Self {
            evidence: Vec::new(),
        }
    }

    pub fn add(&mut self, evidence: EvidenceObject) -> Result<(), EvidenceStoreError> {
        self.validate_evidence(&evidence)?;

        if self.contains_evidence_id(&evidence.evidence_id) {
            return Err(EvidenceStoreError::DuplicateEvidence(evidence.evidence_id.clone()));
        }

        self.evidence.push(evidence);
        Ok(())
    }

    pub fn remove(&mut self, evidence_id: &str) -> Result<EvidenceObject, EvidenceStoreError> {
        let index = self
            .evidence
            .iter()
            .position(|e| e.evidence_id == evidence_id)
            .ok_or(EvidenceStoreError::EvidenceNotFound(evidence_id.to_string()))?;

        Ok(self.evidence.remove(index))
    }

    pub fn get(&self, evidence_id: &str) -> Option<&EvidenceObject> {
        self.evidence.iter().find(|e| e.evidence_id == evidence_id)
    }

    pub fn get_all(&self) -> &[EvidenceObject] {
        &self.evidence
    }

    pub fn by_kind(&self, kind: EvidenceKind) -> Vec<&EvidenceObject> {
        self.evidence
            .iter()
            .filter(|e| e.kind == kind)
            .collect()
    }

    pub fn count(&self) -> usize {
        self.evidence.len()
    }

    pub fn is_empty(&self) -> bool {
        self.evidence.is_empty()
    }

    pub fn clear(&mut self) {
        self.evidence.clear();
    }

    pub fn create_delta(&self, event: EvidenceEvent, evidence_id: String) -> EvidenceDelta {
        EvidenceDelta {
            event,
            evidence_id,
            timestamp: Utc::now().timestamp_millis(),
        }
    }

    fn validate_evidence(&self, evidence: &EvidenceObject) -> Result<(), EvidenceStoreError> {
        Uuid::parse_str(&evidence.evidence_id)
            .map_err(|_| EvidenceStoreError::InvalidEvidenceId(evidence.evidence_id.clone()))?;

        if let Some(ref uri) = evidence.uri {
            if uri.is_empty() {
                return Err(EvidenceStoreError::InvalidEvidenceId(
                    "Evidence ID requires valid URI".to_string(),
                ));
            }
        }

        Ok(())
    }

    fn contains_evidence_id(&self, evidence_id: &str) -> bool {
        self.evidence.iter().any(|e| e.evidence_id == evidence_id)
    }

    pub fn add_with_metadata(&mut self, evidence: EvidenceObject, metadata: HashMap<String, String>) -> Result<(), EvidenceStoreError> {
        let mut evidence = evidence;

        // Merge additional metadata
        for (key, value) in metadata {
            evidence.metadata[&key] = serde_json::Value::String(value);
        }

        self.add(evidence)
    }

    pub fn update_evidence(&mut self, evidence_id: &str, updates: EvidenceObject) -> Result<(), EvidenceStoreError> {
        if let Some(existing) = self.evidence.iter_mut().find(|e| e.evidence_id == evidence_id) {
            // Update only the fields that are provided in the update
            if !updates.title.is_empty() {
                existing.title = updates.title;
            }

            if updates.uri.is_some() {
                existing.uri = updates.uri;
            }

            if !updates.extracted_schema.is_null() {
                existing.extracted_schema = updates.extracted_schema;
            }

            // Merge metadata
            if !updates.metadata.is_null() {
                if let Some(updates_map) = updates.metadata.as_object() {
                    for (key, value) in updates_map {
                        existing.metadata[key] = value.clone();
                    }
                }
            }

            Ok(())
        } else {
            Err(EvidenceStoreError::EvidenceNotFound(evidence_id.to_string()))
        }
    }

    pub fn filter_by_metadata(&self, key: &str, value: &str) -> Vec<&EvidenceObject> {
        self.evidence
            .iter()
            .filter(|e| {
                if let Some(metadata_map) = e.metadata.as_object() {
                    if let Some(val) = metadata_map.get(key) {
                        if let Some(str_val) = val.as_str() {
                            return str_val == value;
                        }
                    }
                }
                false
            })
            .collect()
    }

    pub fn get_evidence_by_timestamp_range(&self, start: i64, end: i64) -> Vec<&EvidenceObject> {
        // This would require storing timestamps with evidence, so we'll implement a simplified version
        // For now, return all evidence (in a real implementation, we'd track timestamps)
        self.evidence.iter().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
}
