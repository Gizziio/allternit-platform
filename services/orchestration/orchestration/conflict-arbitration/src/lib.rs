//! A2R Conflict Arbitration Engine
//!
//! Implements SYSTEM_LAW.md LAW-SWM-003 (Conflict Arbitration)
//!
//! Features:
//! - Diff overlap detection
//! - Priority-based arbitration
//! - Evidence-based arbitration
//! - PR splitting for conflicts
//! - Merge arbiter integration

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

/// Conflict between two changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conflict {
    pub conflict_id: String,
    pub file_path: String,
    pub change_a: Change,
    pub change_b: Change,
    pub overlap_type: OverlapType,
    pub severity: ConflictSeverity,
}

/// A single change to a file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Change {
    pub change_id: String,
    pub run_id: String,
    pub wih_id: String,
    pub node_id: String,
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub content_hash: String,
    pub priority: i32,
    pub evidence: Vec<String>,  // Receipt IDs supporting this change
}

/// Type of overlap between changes
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OverlapType {
    /// Same lines modified
    DirectOverlap,
    /// Adjacent lines (within 3 lines)
    Adjacent,
    /// Same function/method modified
    SameFunction,
    /// Same logical block (e.g., same struct, same impl block)
    SameLogicalBlock,
    /// No overlap (compatible changes)
    None,
}

/// Severity of conflict
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConflictSeverity {
    /// Critical - must be resolved manually
    Critical,
    /// High - auto-resolution risky
    High,
    /// Medium - auto-resolution possible with evidence
    Medium,
    /// Low - safe to auto-resolve
    Low,
}

/// Arbitration decision
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrationDecision {
    pub conflict_id: String,
    pub decision: Decision,
    pub reason: String,
    pub evidence_considered: Vec<String>,
    pub auto_resolvable: bool,
}

/// Decision outcome
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Decision {
    /// Accept change A
    AcceptA,
    /// Accept change B
    AcceptB,
    /// Merge both changes
    Merge,
    /// Split into separate PRs
    Split,
    /// Manual resolution required
    ManualResolution,
}

/// Result of conflict detection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictDetectionResult {
    pub conflicts: Vec<Conflict>,
    pub compatible_changes: Vec<Change>,
    pub total_changes_analyzed: usize,
}

/// Result of arbitration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrationResult {
    pub decisions: Vec<ArbitrationDecision>,
    pub auto_resolved_count: usize,
    pub manual_resolution_required: usize,
    pub split_recommendations: Vec<SplitRecommendation>,
}

/// Recommendation for splitting changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitRecommendation {
    pub original_run_id: String,
    pub split_into: Vec<SplitGroup>,
    pub reason: String,
}

/// A group of changes that can be merged together
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitGroup {
    pub group_id: String,
    pub change_ids: Vec<String>,
    pub file_paths: HashSet<String>,
}

/// Configuration for conflict arbitration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrationConfig {
    pub adjacent_line_threshold: usize,  // Lines considered "adjacent"
    pub priority_weight: f32,  // Weight for priority-based arbitration
    pub evidence_weight: f32,  // Weight for evidence-based arbitration
    pub auto_resolve_threshold: f32,  // Confidence threshold for auto-resolution
}

impl Default for ArbitrationConfig {
    fn default() -> Self {
        Self {
            adjacent_line_threshold: 3,
            priority_weight: 0.4,
            evidence_weight: 0.6,
            auto_resolve_threshold: 0.8,
        }
    }
}

/// Conflict Arbitration Engine
pub struct ConflictArbitrationEngine {
    config: ArbitrationConfig,
}

impl ConflictArbitrationEngine {
    pub fn new(config: ArbitrationConfig) -> Self {
        Self { config }
    }

    pub fn with_defaults() -> Self {
        Self::new(ArbitrationConfig::default())
    }

    /// Detect conflicts between a set of changes
    pub fn detect_conflicts(&self, changes: &[Change]) -> ConflictDetectionResult {
        let mut conflicts = Vec::new();
        let mut compatible_changes = Vec::new();
        let mut conflict_ids = HashSet::new();

        // Group changes by file
        let mut changes_by_file: HashMap<&str, Vec<&Change>> = HashMap::new();
        for change in changes {
            changes_by_file
                .entry(&change.file_path)
                .or_insert_with(Vec::new)
                .push(change);
        }

        // Check for conflicts within each file
        for (file_path, file_changes) in &changes_by_file {
            for i in 0..file_changes.len() {
                for j in (i + 1)..file_changes.len() {
                    let change_a = file_changes[i];
                    let change_b = file_changes[j];

                    // Skip if same change (same run)
                    if change_a.run_id == change_b.run_id {
                        continue;
                    }

                    // Detect overlap
                    if let Some(overlap_type) = self.detect_overlap(change_a, change_b) {
                        let severity = self.calculate_severity(&overlap_type, change_a, change_b);
                        
                        let conflict_id = format!(
                            "conflict_{}_{}_{}",
                            file_path.replace('/', "_"),
                            change_a.change_id,
                            change_b.change_id
                        );

                        // Skip if already processed
                        if conflict_ids.contains(&conflict_id) {
                            continue;
                        }
                        conflict_ids.insert(conflict_id.clone());

                        conflicts.push(Conflict {
                            conflict_id,
                            file_path: file_path.to_string(),
                            change_a: change_a.clone(),
                            change_b: change_b.clone(),
                            overlap_type,
                            severity,
                        });
                    }
                }
            }
        }

        // Identify compatible changes (not involved in any conflict)
        let conflict_change_ids: HashSet<String> = conflicts
            .iter()
            .flat_map(|c| vec![c.change_a.change_id.clone(), c.change_b.change_id.clone()])
            .collect();

        for change in changes {
            if !conflict_change_ids.contains(change.change_id.as_str()) {
                compatible_changes.push(change.clone());
            }
        }

        ConflictDetectionResult {
            conflicts,
            compatible_changes,
            total_changes_analyzed: changes.len(),
        }
    }

    /// Detect overlap between two changes
    fn detect_overlap(&self, a: &Change, b: &Change) -> Option<OverlapType> {
        // Direct line overlap
        if a.start_line <= b.end_line && b.start_line <= a.end_line {
            return Some(OverlapType::DirectOverlap);
        }

        // Adjacent lines (within threshold)
        let gap = if a.end_line < b.start_line {
            b.start_line - a.end_line
        } else {
            a.start_line - b.end_line
        };

        if gap <= self.config.adjacent_line_threshold {
            return Some(OverlapType::Adjacent);
        }

        // No overlap detected
        None
    }

    /// Calculate conflict severity
    fn calculate_severity(
        &self,
        overlap_type: &OverlapType,
        a: &Change,
        b: &Change,
    ) -> ConflictSeverity {
        match overlap_type {
            OverlapType::DirectOverlap => {
                // Direct overlap is critical if both have high priority
                if a.priority >= 8 && b.priority >= 8 {
                    ConflictSeverity::Critical
                } else if a.priority >= 5 || b.priority >= 5 {
                    ConflictSeverity::High
                } else {
                    ConflictSeverity::Medium
                }
            }
            OverlapType::Adjacent => ConflictSeverity::Medium,
            OverlapType::SameFunction => ConflictSeverity::High,
            OverlapType::SameLogicalBlock => ConflictSeverity::Medium,
            OverlapType::None => ConflictSeverity::Low,
        }
    }

    /// Arbitrate conflicts between changes
    pub fn arbitrate(&self, conflicts: &[Conflict]) -> ArbitrationResult {
        let mut decisions = Vec::new();
        let mut auto_resolved_count = 0;
        let mut manual_resolution_required = 0;
        let mut split_recommendations = Vec::new();

        for conflict in conflicts {
            let decision = self.arbitrate_conflict(conflict);
            
            if decision.auto_resolvable {
                auto_resolved_count += 1;
            } else {
                manual_resolution_required += 1;

                // Check if split is recommended
                if matches!(decision.decision, Decision::Split) {
                    split_recommendations.push(SplitRecommendation {
                        original_run_id: conflict.change_a.run_id.clone(),
                        split_into: vec![
                            SplitGroup {
                                group_id: format!("group_a_{}", conflict.change_a.change_id),
                                change_ids: vec![conflict.change_a.change_id.clone()],
                                file_paths: HashSet::from([conflict.change_a.file_path.clone()]),
                            },
                            SplitGroup {
                                group_id: format!("group_b_{}", conflict.change_b.change_id),
                                change_ids: vec![conflict.change_b.change_id.clone()],
                                file_paths: HashSet::from([conflict.change_b.file_path.clone()]),
                            },
                        ],
                        reason: format!(
                            "Conflicting changes in {} with {} overlap",
                            conflict.file_path,
                            match conflict.overlap_type {
                                OverlapType::DirectOverlap => "direct",
                                OverlapType::Adjacent => "adjacent",
                                OverlapType::SameFunction => "functional",
                                OverlapType::SameLogicalBlock => "logical",
                                OverlapType::None => "no",
                            }
                        ),
                    });
                }
            }

            decisions.push(decision);
        }

        ArbitrationResult {
            decisions,
            auto_resolved_count,
            manual_resolution_required,
            split_recommendations,
        }
    }

    /// Arbitrate a single conflict
    fn arbitrate_conflict(&self, conflict: &Conflict) -> ArbitrationDecision {
        // Calculate scores for each change
        let score_a = self.calculate_change_score(&conflict.change_a);
        let score_b = self.calculate_change_score(&conflict.change_b);

        let score_diff = (score_a - score_b).abs();
        let confidence = score_diff / (score_a + score_b).max(0.001);

        let (decision, reason) = if confidence >= self.config.auto_resolve_threshold {
            // High confidence - auto-resolve
            if score_a > score_b {
                (Decision::AcceptA, format!("Change A has higher score ({:.2} vs {:.2})", score_a, score_b))
            } else {
                (Decision::AcceptB, format!("Change B has higher score ({:.2} vs {:.2})", score_b, score_a))
            }
        } else if conflict.severity == ConflictSeverity::Critical {
            // Critical conflicts require manual resolution
            (
                Decision::ManualResolution,
                "Critical conflict requires manual resolution".to_string(),
            )
        } else if conflict.overlap_type == OverlapType::DirectOverlap {
            // Direct overlap - recommend split
            (
                Decision::Split,
                "Direct overlap - recommend splitting into separate PRs".to_string(),
            )
        } else {
            // Medium/low severity - attempt merge
            (
                Decision::Merge,
                "Non-critical overlap - merge may be possible".to_string(),
            )
        };

        // Collect evidence considered
        let mut evidence_considered: Vec<String> = Vec::new();
        evidence_considered.extend(conflict.change_a.evidence.iter().cloned());
        evidence_considered.extend(conflict.change_b.evidence.iter().cloned());

        ArbitrationDecision {
            conflict_id: conflict.conflict_id.clone(),
            decision,
            reason,
            evidence_considered,
            auto_resolvable: confidence >= self.config.auto_resolve_threshold,
        }
    }

    /// Calculate score for a change based on priority and evidence
    fn calculate_change_score(&self, change: &Change) -> f32 {
        // Priority score (normalized to 0-1)
        let priority_score = change.priority as f32 / 10.0;

        // Evidence score (number of supporting receipts)
        let evidence_score = (change.evidence.len() as f32 / 10.0).min(1.0);

        // Weighted combination
        priority_score * self.config.priority_weight
            + evidence_score * self.config.evidence_weight
    }

    /// Generate PR split recommendations for a run
    pub fn recommend_splits(&self, _changes: &[Change], conflicts: &[Conflict]) -> Vec<SplitRecommendation> {
        let arbitration_result = self.arbitrate(conflicts);
        arbitration_result.split_recommendations
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_change(id: &str, run_id: &str, start: usize, end: usize, priority: i32) -> Change {
        Change {
            change_id: id.to_string(),
            run_id: run_id.to_string(),
            wih_id: "wih_test".to_string(),
            node_id: "n_test".to_string(),
            file_path: "src/main.rs".to_string(),
            start_line: start,
            end_line: end,
            content_hash: format!("hash_{}", id),
            priority,
            evidence: vec![format!("rcpt_{}", id)],
        }
    }

    #[test]
    fn test_detect_direct_overlap() {
        let engine = ConflictArbitrationEngine::with_defaults();
        
        let changes = vec![
            create_test_change("a", "run_1", 10, 20, 5),
            create_test_change("b", "run_2", 15, 25, 5),
        ];

        let result = engine.detect_conflicts(&changes);
        
        assert_eq!(result.conflicts.len(), 1);
        assert_eq!(result.conflicts[0].overlap_type, OverlapType::DirectOverlap);
    }

    #[test]
    fn test_detect_adjacent_overlap() {
        let engine = ConflictArbitrationEngine::with_defaults();
        
        let changes = vec![
            create_test_change("a", "run_1", 10, 20, 5),
            create_test_change("b", "run_2", 22, 30, 5),  // 2 lines gap
        ];

        let result = engine.detect_conflicts(&changes);
        
        assert_eq!(result.conflicts.len(), 1);
        assert_eq!(result.conflicts[0].overlap_type, OverlapType::Adjacent);
    }

    #[test]
    fn test_no_overlap() {
        let engine = ConflictArbitrationEngine::with_defaults();
        
        let changes = vec![
            create_test_change("a", "run_1", 10, 20, 5),
            create_test_change("b", "run_2", 50, 60, 5),  // Far apart
        ];

        let result = engine.detect_conflicts(&changes);
        
        assert_eq!(result.conflicts.len(), 0);
        assert_eq!(result.compatible_changes.len(), 2);
    }

    #[test]
    fn test_arbitration_priority() {
        let mut engine = ConflictArbitrationEngine::with_defaults();
        engine.config.auto_resolve_threshold = 0.3;  // Lower threshold for test

        let changes = vec![
            create_test_change("a", "run_1", 10, 20, 9),  // High priority
            create_test_change("b", "run_2", 15, 25, 3),  // Low priority
        ];

        let result = engine.detect_conflicts(&changes);
        let arbitration = engine.arbitrate(&result.conflicts);

        assert_eq!(arbitration.decisions.len(), 1);
        assert!(arbitration.decisions[0].auto_resolvable);

        // High priority change should win
        assert!(matches!(
            arbitration.decisions[0].decision,
            Decision::AcceptA
        ));
    }

    #[test]
    fn test_arbitration_evidence() {
        let mut engine = ConflictArbitrationEngine::with_defaults();
        engine.config.evidence_weight = 0.9;  // Heavily weight evidence
        engine.config.auto_resolve_threshold = 0.3;  // Lower threshold for test

        let change_a = Change {
            evidence: vec!["rcpt_1".to_string(), "rcpt_2".to_string(), "rcpt_3".to_string()],
            priority: 5,
            ..create_test_change("a", "run_1", 10, 20, 5)
        };

        let change_b = Change {
            evidence: vec![],  // No evidence
            priority: 5,
            ..create_test_change("b", "run_2", 15, 25, 5)
        };

        let conflict = Conflict {
            conflict_id: "conflict_test".to_string(),
            file_path: "src/main.rs".to_string(),
            change_a,
            change_b,
            overlap_type: OverlapType::DirectOverlap,
            severity: ConflictSeverity::High,
        };

        let decision = engine.arbitrate_conflict(&conflict);
        
        // Change with more evidence should win
        assert!(matches!(decision.decision, Decision::AcceptA));
    }
}
