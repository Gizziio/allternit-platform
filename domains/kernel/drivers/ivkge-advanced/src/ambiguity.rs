//! Ambiguity Detection and Resolution Module
//!
//! Detects and helps resolve ambiguities in visual extractions.

use crate::{ExtractedEntity, ExtractedRelationship, IvkgeError, VisualExtractionResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Ambiguity report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmbiguityReport {
    pub report_id: String,
    pub extraction_id: String,
    pub ambiguities: Vec<Ambiguity>,
    pub overall_confidence: f32,
    pub created_at: DateTime<Utc>,
}

/// Types of ambiguities
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "ambiguity_type", rename_all = "snake_case")]
pub enum Ambiguity {
    /// Entity type is unclear
    EntityTypeUnclear {
        entity_id: String,
        possible_types: Vec<String>,
        confidence_scores: Vec<f32>,
    },
    /// Relationship direction is ambiguous
    RelationshipDirectionAmbiguous {
        relationship_id: String,
        source: String,
        target: String,
        alternative_source: String,
        alternative_target: String,
    },
    /// Overlapping bounding boxes
    OverlappingElements {
        entity_ids: Vec<String>,
        overlap_percentage: f32,
    },
    /// Text OCR confidence is low
    LowOcrConfidence {
        entity_id: String,
        ocr_text: String,
        confidence: f32,
        alternatives: Vec<String>,
    },
    /// Multiple possible interpretations
    MultipleInterpretations {
        entity_id: String,
        interpretations: Vec<Interpretation>,
    },
}

/// Possible interpretation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Interpretation {
    pub interpretation_id: String,
    pub description: String,
    pub confidence: f32,
    pub supporting_evidence: Vec<String>,
}

/// Ambiguity resolution from user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AmbiguityResolution {
    pub ambiguity_id: String,
    pub resolution_type: ResolutionType,
    pub selected_option: Option<usize>,
    pub custom_value: Option<String>,
    pub notes: Option<String>,
}

/// Resolution type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionType {
    /// Select from options
    SelectOption,
    /// Provide custom value
    CustomValue,
    /// Skip/ignore this ambiguity
    Skip,
    /// Mark as uncertain
    MarkUncertain,
}

/// Ambiguity detector
pub struct AmbiguityDetector {
    entity_type_threshold: f32,
    overlap_threshold: f32,
    ocr_confidence_threshold: f32,
    resolutions: Arc<RwLock<HashMap<String, AmbiguityResolution>>>,
}

impl AmbiguityDetector {
    /// Create a new ambiguity detector
    pub fn new() -> Self {
        Self {
            entity_type_threshold: 0.8,
            overlap_threshold: 0.5,
            ocr_confidence_threshold: 0.7,
            resolutions: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Detect ambiguities in extracted entities and relationships
    pub fn detect(
        &self,
        entities: &[ExtractedEntity],
        relationships: &[ExtractedRelationship],
    ) -> Option<AmbiguityReport> {
        let mut ambiguities = Vec::new();

        // Check for entity type ambiguity
        for entity in entities {
            if entity.confidence < self.entity_type_threshold {
                ambiguities.push(Ambiguity::EntityTypeUnclear {
                    entity_id: entity.entity_id.clone(),
                    possible_types: vec![entity.entity_type.clone()],
                    confidence_scores: vec![entity.confidence],
                });
            }
        }

        // Check for overlapping elements
        for (i, e1) in entities.iter().enumerate() {
            for (j, e2) in entities.iter().enumerate() {
                if i >= j {
                    continue;
                }

                if let (Some(bbox1), Some(bbox2)) = (&e1.bounding_box, &e2.bounding_box) {
                    let overlap = self.calculate_overlap(bbox1, bbox2);
                    if overlap > self.overlap_threshold {
                        ambiguities.push(Ambiguity::OverlappingElements {
                            entity_ids: vec![e1.entity_id.clone(), e2.entity_id.clone()],
                            overlap_percentage: overlap,
                        });
                    }
                }
            }
        }

        if ambiguities.is_empty() {
            None
        } else {
            Some(AmbiguityReport {
                report_id: format!("ambiguity_{}", uuid::Uuid::new_v4().simple()),
                extraction_id: String::new(), // Will be set by caller
                ambiguities,
                overall_confidence: self.calculate_overall_confidence(entities, relationships),
                created_at: Utc::now(),
            })
        }
    }

    /// Calculate overlap percentage between two bounding boxes
    fn calculate_overlap(&self, bbox1: &crate::BoundingBox, bbox2: &crate::BoundingBox) -> f32 {
        let x1 = bbox1.x.max(bbox2.x);
        let y1 = bbox1.y.max(bbox2.y);
        let x2 = (bbox1.x + bbox1.width).min(bbox2.x + bbox2.width);
        let y2 = (bbox1.y + bbox1.height).min(bbox2.y + bbox2.height);

        if x2 <= x1 || y2 <= y1 {
            return 0.0;
        }

        let intersection = (x2 - x1) as f32 * (y2 - y1) as f32;
        let area1 = bbox1.width as f32 * bbox1.height as f32;
        let area2 = bbox2.width as f32 * bbox2.height as f32;

        if area1 + area2 == 0.0 {
            return 0.0;
        }

        intersection / (area1 + area2 - intersection)
    }

    /// Calculate overall confidence score
    fn calculate_overall_confidence(
        &self,
        entities: &[ExtractedEntity],
        relationships: &[ExtractedRelationship],
    ) -> f32 {
        let total_confidence: f32 = entities
            .iter()
            .map(|e| e.confidence)
            .chain(relationships.iter().map(|r| r.confidence))
            .sum();

        let count = entities.len() + relationships.len();
        if count == 0 {
            0.0
        } else {
            total_confidence / count as f32
        }
    }

    /// Resolve an ambiguity
    pub async fn resolve(
        &self,
        extraction_id: &str,
        resolution: AmbiguityResolution,
    ) -> Result<VisualExtractionResult, IvkgeError> {
        // Store the resolution
        let mut resolutions = self.resolutions.write().await;
        resolutions.insert(resolution.ambiguity_id.clone(), resolution);

        // In a full implementation, this would update the extraction
        // based on the resolution

        Ok(VisualExtractionResult {
            extraction_id: extraction_id.to_string(),
            source_type: crate::VisualSourceType::Screenshot,
            entities: vec![],
            relationships: vec![],
            ambiguity_report: None,
            ocr_text: None,
            created_at: Utc::now(),
        })
    }

    /// Get stored resolutions
    pub async fn get_resolutions(&self) -> Vec<AmbiguityResolution> {
        let resolutions = self.resolutions.read().await;
        resolutions.values().cloned().collect()
    }
}

impl Default for AmbiguityDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::BoundingBox;

    #[test]
    fn test_ambiguity_detector_creation() {
        let detector = AmbiguityDetector::new();
        assert_eq!(detector.entity_type_threshold, 0.8);
        assert_eq!(detector.overlap_threshold, 0.5);
        assert_eq!(detector.ocr_confidence_threshold, 0.7);
    }

    #[test]
    fn test_overlap_calculation_no_overlap() {
        let detector = AmbiguityDetector::new();

        let bbox1 = BoundingBox {
            x: 0,
            y: 0,
            width: 10,
            height: 10,
        };
        let bbox2 = BoundingBox {
            x: 20,
            y: 20,
            width: 10,
            height: 10,
        };

        let overlap = detector.calculate_overlap(&bbox1, &bbox2);
        assert_eq!(overlap, 0.0);
    }

    #[test]
    fn test_overlap_calculation_full_overlap() {
        let detector = AmbiguityDetector::new();

        let bbox1 = BoundingBox {
            x: 0,
            y: 0,
            width: 10,
            height: 10,
        };
        let bbox2 = BoundingBox {
            x: 0,
            y: 0,
            width: 10,
            height: 10,
        };

        let overlap = detector.calculate_overlap(&bbox1, &bbox2);
        assert_eq!(overlap, 1.0);
    }

    #[test]
    fn test_overlap_calculation_partial_overlap() {
        let detector = AmbiguityDetector::new();

        let bbox1 = BoundingBox {
            x: 0,
            y: 0,
            width: 10,
            height: 10,
        };
        let bbox2 = BoundingBox {
            x: 5,
            y: 5,
            width: 10,
            height: 10,
        };

        let overlap = detector.calculate_overlap(&bbox1, &bbox2);
        assert!(overlap > 0.0);
        assert!(overlap < 1.0);
    }

    #[test]
    fn test_ambiguity_report_creation() {
        let report = AmbiguityReport {
            report_id: "report_1".to_string(),
            extraction_id: "extract_1".to_string(),
            ambiguities: vec![],
            overall_confidence: 0.85,
            created_at: Utc::now(),
        };

        assert_eq!(report.report_id, "report_1");
        assert_eq!(report.extraction_id, "extract_1");
        assert_eq!(report.overall_confidence, 0.85);
    }

    #[test]
    fn test_ambiguity_serialization() {
        let ambiguity = Ambiguity::EntityTypeUnclear {
            entity_id: "entity_1".to_string(),
            possible_types: vec!["button".to_string(), "link".to_string()],
            confidence_scores: vec![0.6, 0.4],
        };

        let serialized = serde_json::to_string(&ambiguity).unwrap();
        assert!(serialized.contains("entity_type_unclear"));
        assert!(serialized.contains("entity_1"));
    }

    #[test]
    fn test_resolution_serialization() {
        let resolution = AmbiguityResolution {
            ambiguity_id: "amb_1".to_string(),
            resolution_type: ResolutionType::SelectOption,
            selected_option: Some(0),
            custom_value: None,
            notes: Some("Selected first option".to_string()),
        };

        let serialized = serde_json::to_string(&resolution).unwrap();
        assert!(serialized.contains("select_option"));
        assert!(serialized.contains("amb_1"));
    }

    #[tokio::test]
    async fn test_ambiguity_resolution_storage() {
        let detector = AmbiguityDetector::new();

        let resolution = AmbiguityResolution {
            ambiguity_id: "amb_1".to_string(),
            resolution_type: ResolutionType::SelectOption,
            selected_option: Some(0),
            custom_value: None,
            notes: None,
        };

        let result = detector.resolve("extract_1", resolution).await;
        assert!(result.is_ok());

        let resolutions = detector.get_resolutions().await;
        assert_eq!(resolutions.len(), 1);
    }
}
