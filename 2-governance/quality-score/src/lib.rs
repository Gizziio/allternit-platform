//! A2R Quality Score System
//!
//! Implements LAW-QLT-001/002/003:
//! - Domain grades (architecture, tests, observability, boundaries, drift)
//! - Entropy score (rule violations, drift rate, coverage delta, doc mismatch)
//! - Quality optimization tracking

use a2rchitech_system_law::SystemLawEngine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

// ============================================================================
// Domain Grades (LAW-QLT-001)
// ============================================================================

/// Domain quality grade
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainGrade {
    pub domain: String,
    pub architecture_adherence: f32, // 0.0 - 1.0
    pub test_coverage: f32,          // 0.0 - 1.0
    pub observability_completeness: f32, // 0.0 - 1.0
    pub boundary_enforcement: f32,   // 0.0 - 1.0
    pub drift_frequency: f32,        // 0.0 - 1.0 (lower is better)
    pub overall_grade: char,         // A, B, C, D, F
    pub last_updated: DateTime<Utc>,
}

impl DomainGrade {
    /// Calculate overall grade from metrics
    pub fn calculate_grade(&self) -> char {
        let score = (self.architecture_adherence * 0.25
            + self.test_coverage * 0.25
            + self.observability_completeness * 0.20
            + self.boundary_enforcement * 0.20
            + (1.0 - self.drift_frequency) * 0.10)
            * 100.0;

        match score as u32 {
            90..=100 => 'A',
            80..=89 => 'B',
            70..=79 => 'C',
            60..=69 => 'D',
            _ => 'F',
        }
    }
}

// ============================================================================
// Entropy Score (LAW-QLT-002)
// ============================================================================

/// Entropy score for system health
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntropyScore {
    pub score_id: String,
    pub rule_violations: usize,
    pub drift_rate: f32,
    pub test_coverage_delta: f32,
    pub documentation_mismatch: f32,
    pub total_score: f32, // Higher = more entropy (worse)
    pub timestamp: DateTime<Utc>,
}

impl EntropyScore {
    /// Calculate total entropy score
    pub fn calculate(&mut self) {
        // Weighted entropy calculation
        self.total_score = (self.rule_violations as f32 * 10.0)
            + (self.drift_rate * 20.0)
            + (self.test_coverage_delta.abs() * 15.0)
            + (self.documentation_mismatch * 10.0);
    }
}

// ============================================================================
// Quality Status (LAW-QLT-003)
// ============================================================================

/// Overall quality status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityStatus {
    pub domain_grades: Vec<DomainGrade>,
    pub entropy_score: EntropyScore,
    pub trend: QualityTrend,
    pub recommendations: Vec<String>,
}

/// Quality trend
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum QualityTrend {
    Improving,
    Stable,
    Degrading,
}

// ============================================================================
// Quality Score Engine
// ============================================================================

/// Quality Score Engine
pub struct QualityScoreEngine {
    system_law: Arc<SystemLawEngine>,
    domain_grades: Arc<RwLock<Vec<DomainGrade>>>,
    entropy_history: Arc<RwLock<Vec<EntropyScore>>>,
}

impl QualityScoreEngine {
    pub fn new(system_law: Arc<SystemLawEngine>) -> Self {
        Self {
            system_law,
            domain_grades: Arc::new(RwLock::new(Vec::new())),
            entropy_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Update domain grade
    pub async fn update_domain_grade(&self, grade: DomainGrade) {
        let mut grades = self.domain_grades.write().await;
        
        // Remove existing grade for domain if present
        grades.retain(|g| g.domain != grade.domain);
        grades.push(grade);
    }

    /// Get domain grade
    pub async fn get_domain_grade(&self, domain: &str) -> Option<DomainGrade> {
        let grades = self.domain_grades.read().await;
        grades.iter().find(|g| g.domain == domain).cloned()
    }

    /// Record entropy score
    pub async fn record_entropy(&self, mut entropy: EntropyScore) {
        entropy.calculate();
        entropy.score_id = format!("entropy_{}", Uuid::new_v4().simple());
        entropy.timestamp = Utc::now();

        let mut history = self.entropy_history.write().await;
        history.push(entropy);

        // Keep only last 100 scores
        if history.len() > 100 {
            history.remove(0);
        }
    }

    /// Get current entropy score
    pub async fn get_current_entropy(&self) -> Option<EntropyScore> {
        let history = self.entropy_history.read().await;
        history.last().cloned()
    }

    /// Get quality status
    pub async fn get_status(&self) -> QualityStatus {
        let grades = self.domain_grades.read().await;
        let entropy = self.get_current_entropy().await;
        
        let trend = self.calculate_trend().await;
        let recommendations = self.generate_recommendations(&grades, &entropy).await;

        QualityStatus {
            domain_grades: grades.clone(),
            entropy_score: entropy.unwrap_or_else(|| EntropyScore {
                score_id: "none".to_string(),
                rule_violations: 0,
                drift_rate: 0.0,
                test_coverage_delta: 0.0,
                documentation_mismatch: 0.0,
                total_score: 0.0,
                timestamp: Utc::now(),
            }),
            trend,
            recommendations,
        }
    }

    /// Calculate quality trend
    async fn calculate_trend(&self) -> QualityTrend {
        let history = self.entropy_history.read().await;
        
        if history.len() < 2 {
            return QualityTrend::Stable;
        }

        let recent = history.last().unwrap().total_score;
        let previous = history[history.len() - 2].total_score;

        if recent < previous * 0.9 {
            QualityTrend::Improving
        } else if recent > previous * 1.1 {
            QualityTrend::Degrading
        } else {
            QualityTrend::Stable
        }
    }

    /// Generate recommendations
    async fn generate_recommendations(
        &self,
        grades: &[DomainGrade],
        entropy: &Option<EntropyScore>,
    ) -> Vec<String> {
        let mut recommendations = Vec::new();

        // Check domain grades
        for grade in grades {
            if grade.architecture_adherence < 0.7 {
                recommendations.push(format!(
                    "Improve architecture adherence in {} (current: {:.1}%)",
                    grade.domain,
                    grade.architecture_adherence * 100.0
                ));
            }
            if grade.test_coverage < 0.8 {
                recommendations.push(format!(
                    "Increase test coverage in {} (current: {:.1}%)",
                    grade.domain,
                    grade.test_coverage * 100.0
                ));
            }
        }

        // Check entropy
        if let Some(entropy) = entropy {
            if entropy.rule_violations > 0 {
                recommendations.push(format!(
                    "Fix {} rule violations",
                    entropy.rule_violations
                ));
            }
            if entropy.drift_rate > 0.3 {
                recommendations.push("Reduce specification drift".to_string());
            }
        }

        recommendations
    }
}

use uuid::Uuid;

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_system_law() -> Arc<SystemLawEngine> {
        Arc::new(SystemLawEngine::new())
    }

    #[tokio::test]
    async fn test_domain_grade() {
        let engine = QualityScoreEngine::new(create_test_system_law());

        let grade = DomainGrade {
            domain: "test".to_string(),
            architecture_adherence: 0.9,
            test_coverage: 0.85,
            observability_completeness: 0.8,
            boundary_enforcement: 0.95,
            drift_frequency: 0.1,
            overall_grade: 'A',
            last_updated: Utc::now(),
        };

        engine.update_domain_grade(grade.clone()).await;

        let retrieved = engine.get_domain_grade("test").await;
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().domain, "test");
    }

    #[tokio::test]
    async fn test_entropy_score() {
        let engine = QualityScoreEngine::new(create_test_system_law());

        let mut entropy = EntropyScore {
            score_id: "test".to_string(),
            rule_violations: 5,
            drift_rate: 0.2,
            test_coverage_delta: -0.05,
            documentation_mismatch: 0.1,
            total_score: 0.0,
            timestamp: Utc::now(),
        };

        engine.record_entropy(entropy).await;

        let current = engine.get_current_entropy().await;
        assert!(current.is_some());
        assert!(current.unwrap().total_score > 0.0);
    }

    #[tokio::test]
    async fn test_quality_status() {
        let engine = QualityScoreEngine::new(create_test_system_law());

        // Add some data
        let grade = DomainGrade {
            domain: "test".to_string(),
            architecture_adherence: 0.9,
            test_coverage: 0.85,
            observability_completeness: 0.8,
            boundary_enforcement: 0.95,
            drift_frequency: 0.1,
            overall_grade: 'A',
            last_updated: Utc::now(),
        };
        engine.update_domain_grade(grade).await;

        let mut entropy = EntropyScore {
            score_id: "test".to_string(),
            rule_violations: 2,
            drift_rate: 0.1,
            test_coverage_delta: 0.0,
            documentation_mismatch: 0.05,
            total_score: 0.0,
            timestamp: Utc::now(),
        };
        engine.record_entropy(entropy).await;

        let status = engine.get_status().await;
        assert_eq!(status.domain_grades.len(), 1);
        assert_eq!(status.trend, QualityTrend::Stable);
    }

    #[tokio::test]
    async fn test_grade_calculation() {
        let grade = DomainGrade {
            domain: "test".to_string(),
            architecture_adherence: 0.95,
            test_coverage: 0.90,
            observability_completeness: 0.85,
            boundary_enforcement: 0.95,
            drift_frequency: 0.05,
            overall_grade: 'A',
            last_updated: Utc::now(),
        };

        let calculated = grade.calculate_grade();
        assert_eq!(calculated, 'A');
    }
}
