//! User Correction Tools Module
//!
//! Allows users to correct extraction results.

use crate::{ExtractedEntity, ExtractedRelationship, IvkgeError, VisualExtractionResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// User correction types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "correction_type", rename_all = "snake_case")]
pub enum UserCorrection {
    /// Add a new entity
    AddEntity { entity: ExtractedEntity },
    /// Remove an entity
    RemoveEntity { entity_id: String },
    /// Modify an entity
    ModifyEntity {
        entity_id: String,
        changes: HashMap<String, String>,
    },
    /// Add a relationship
    AddRelationship { relationship: ExtractedRelationship },
    /// Remove a relationship
    RemoveRelationship { relationship_id: String },
    /// Modify relationship
    ModifyRelationship {
        relationship_id: String,
        changes: HashMap<String, String>,
    },
    /// Merge entities
    MergeEntities {
        source_ids: Vec<String>,
        target_entity: ExtractedEntity,
    },
}

/// Correction record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CorrectionRecord {
    pub correction_id: String,
    pub extraction_id: String,
    pub correction: UserCorrection,
    pub applied_at: DateTime<Utc>,
    pub applied_by: Option<String>,
    pub status: CorrectionStatus,
}

/// Correction status
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CorrectionStatus {
    Pending,
    Applied,
    Rejected,
    Undone,
}

/// Correction manager
pub struct CorrectionManager {
    corrections: Arc<RwLock<HashMap<String, Vec<CorrectionRecord>>>>,
    extractions: Arc<RwLock<HashMap<String, VisualExtractionResult>>>,
}

impl CorrectionManager {
    /// Create a new correction manager
    pub fn new() -> Self {
        Self {
            corrections: Arc::new(RwLock::new(HashMap::new())),
            extractions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register an extraction for corrections
    pub async fn register_extraction(&self, extraction: VisualExtractionResult) {
        let mut extractions = self.extractions.write().await;
        extractions.insert(extraction.extraction_id.clone(), extraction);
    }

    /// Apply a correction
    pub async fn apply(
        &self,
        extraction_id: &str,
        correction: UserCorrection,
    ) -> Result<VisualExtractionResult, IvkgeError> {
        let mut extractions = self.extractions.write().await;

        let extraction = extractions
            .get_mut(extraction_id)
            .ok_or_else(|| IvkgeError::ExtractionNotFound(extraction_id.to_string()))?;

        // Apply the correction based on type
        match &correction {
            UserCorrection::AddEntity { entity } => {
                extraction.entities.push(entity.clone());
            }
            UserCorrection::RemoveEntity { entity_id } => {
                extraction.entities.retain(|e| e.entity_id != *entity_id);
            }
            UserCorrection::ModifyEntity { entity_id, changes } => {
                if let Some(entity) = extraction
                    .entities
                    .iter_mut()
                    .find(|e| e.entity_id == *entity_id)
                {
                    for (key, value) in changes {
                        if key == "name" {
                            entity.name = value.clone();
                        } else if key == "entity_type" {
                            entity.entity_type = value.clone();
                        } else {
                            entity.properties.insert(key.clone(), value.clone());
                        }
                    }
                }
            }
            UserCorrection::AddRelationship { relationship } => {
                extraction.relationships.push(relationship.clone());
            }
            UserCorrection::RemoveRelationship { relationship_id } => {
                extraction
                    .relationships
                    .retain(|r| r.relationship_id != *relationship_id);
            }
            UserCorrection::ModifyRelationship {
                relationship_id,
                changes,
            } => {
                if let Some(relationship) = extraction
                    .relationships
                    .iter_mut()
                    .find(|r| r.relationship_id == *relationship_id)
                {
                    for (key, value) in changes {
                        if key == "relationship_type" {
                            relationship.relationship_type = value.clone();
                        } else if key == "label" {
                            relationship.label = Some(value.clone());
                        }
                    }
                }
            }
            UserCorrection::MergeEntities {
                source_ids,
                target_entity,
            } => {
                // Remove source entities
                extraction
                    .entities
                    .retain(|e| !source_ids.contains(&e.entity_id));
                // Add merged entity
                extraction.entities.push(target_entity.clone());
            }
        }

        // Record the correction
        let record = CorrectionRecord {
            correction_id: format!("corr_{}", uuid::Uuid::new_v4().simple()),
            extraction_id: extraction_id.to_string(),
            correction: correction.clone(),
            applied_at: Utc::now(),
            applied_by: None,
            status: CorrectionStatus::Applied,
        };

        let mut corrections = self.corrections.write().await;
        corrections
            .entry(extraction_id.to_string())
            .or_insert_with(Vec::new)
            .push(record);

        Ok(extraction.clone())
    }

    /// Get correction history
    pub async fn get_history(&self, extraction_id: &str) -> Vec<CorrectionRecord> {
        let corrections = self.corrections.read().await;
        corrections.get(extraction_id).cloned().unwrap_or_default()
    }

    /// Undo a correction
    pub async fn undo(&self, correction_id: &str) -> Result<(), IvkgeError> {
        // Find and mark correction as undone
        let mut corrections = self.corrections.write().await;

        for (_, records) in corrections.iter_mut() {
            if let Some(record) = records
                .iter_mut()
                .find(|r| r.correction_id == correction_id)
            {
                if record.status == CorrectionStatus::Applied {
                    record.status = CorrectionStatus::Undone;
                    return Ok(());
                } else {
                    return Err(IvkgeError::InvalidCorrection(
                        "Correction not in applied state".to_string(),
                    ));
                }
            }
        }

        Err(IvkgeError::ExtractionNotFound(correction_id.to_string()))
    }
}

impl Default for CorrectionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::BoundingBox;

    #[tokio::test]
    async fn test_correction_manager_creation() {
        let manager = CorrectionManager::new();
        assert!(manager.corrections.read().await.is_empty());
    }

    #[tokio::test]
    async fn test_add_entity_correction() {
        let manager = CorrectionManager::new();

        // Create initial extraction
        let extraction = VisualExtractionResult {
            extraction_id: "test_extract".to_string(),
            source_type: crate::VisualSourceType::Screenshot,
            entities: vec![],
            relationships: vec![],
            ambiguity_report: None,
            ocr_text: None,
            created_at: Utc::now(),
        };

        manager.register_extraction(extraction).await;

        // Add entity correction
        let entity = ExtractedEntity {
            entity_id: "entity_1".to_string(),
            name: "New Entity".to_string(),
            entity_type: "component".to_string(),
            confidence: 1.0,
            bounding_box: None,
            properties: HashMap::new(),
        };

        let correction = UserCorrection::AddEntity { entity };
        let result = manager.apply("test_extract", correction).await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap().entities.len(), 1);
    }

    #[tokio::test]
    async fn test_remove_entity_correction() {
        let manager = CorrectionManager::new();

        let extraction = VisualExtractionResult {
            extraction_id: "test_extract".to_string(),
            source_type: crate::VisualSourceType::Screenshot,
            entities: vec![ExtractedEntity {
                entity_id: "entity_1".to_string(),
                name: "Entity 1".to_string(),
                entity_type: "component".to_string(),
                confidence: 0.9,
                bounding_box: None,
                properties: HashMap::new(),
            }],
            relationships: vec![],
            ambiguity_report: None,
            ocr_text: None,
            created_at: Utc::now(),
        };

        manager.register_extraction(extraction).await;

        // Remove entity correction
        let correction = UserCorrection::RemoveEntity {
            entity_id: "entity_1".to_string(),
        };

        let result = manager.apply("test_extract", correction).await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap().entities.len(), 0);
    }

    #[tokio::test]
    async fn test_correction_history() {
        let manager = CorrectionManager::new();

        let extraction = VisualExtractionResult {
            extraction_id: "test_extract".to_string(),
            source_type: crate::VisualSourceType::Screenshot,
            entities: vec![],
            relationships: vec![],
            ambiguity_report: None,
            ocr_text: None,
            created_at: Utc::now(),
        };

        manager.register_extraction(extraction).await;

        // Apply multiple corrections
        let entity1 = ExtractedEntity {
            entity_id: "e1".to_string(),
            name: "E1".to_string(),
            entity_type: "test".to_string(),
            confidence: 1.0,
            bounding_box: None,
            properties: HashMap::new(),
        };

        let entity2 = ExtractedEntity {
            entity_id: "e2".to_string(),
            name: "E2".to_string(),
            entity_type: "test".to_string(),
            confidence: 1.0,
            bounding_box: None,
            properties: HashMap::new(),
        };

        manager
            .apply(
                "test_extract",
                UserCorrection::AddEntity { entity: entity1 },
            )
            .await
            .unwrap();
        manager
            .apply(
                "test_extract",
                UserCorrection::AddEntity { entity: entity2 },
            )
            .await
            .unwrap();

        let history = manager.get_history("test_extract").await;
        assert_eq!(history.len(), 2);
    }

    #[test]
    fn test_correction_serialization() {
        let mut changes = HashMap::new();
        changes.insert("name".to_string(), "New Name".to_string());

        let correction = UserCorrection::ModifyEntity {
            entity_id: "entity_1".to_string(),
            changes,
        };

        let serialized = serde_json::to_string(&correction).unwrap();
        assert!(serialized.contains("modify_entity"));
        assert!(serialized.contains("entity_1"));
    }
}
