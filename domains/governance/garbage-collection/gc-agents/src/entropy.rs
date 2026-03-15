//! Entropy Score Module
//!
//! Implements LAW-QLT-002: Entropy Score calculation

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Entropy score (0-100, lower is better)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntropyScore {
    pub score: f64,
    pub total_issues: usize,
    pub critical_issues: usize,
    pub warning_issues: usize,
    pub info_issues: usize,
    pub calculated_at: DateTime<Utc>,
}

impl EntropyScore {
    pub fn new() -> Self {
        Self {
            score: 0.0,
            total_issues: 0,
            critical_issues: 0,
            warning_issues: 0,
            info_issues: 0,
            calculated_at: Utc::now(),
        }
    }

    /// Calculate entropy score from issues
    pub fn calculate(issues: &[crate::GcIssue]) -> Self {
        let critical = issues
            .iter()
            .filter(|i| matches!(i.severity, crate::IssueSeverity::Critical))
            .count();
        let warning = issues
            .iter()
            .filter(|i| matches!(i.severity, crate::IssueSeverity::Warning))
            .count();
        let info = issues
            .iter()
            .filter(|i| matches!(i.severity, crate::IssueSeverity::Info))
            .count();

        // Weighted score: critical=10, warning=5, info=1
        let score = (critical * 10 + warning * 5 + info * 1) as f64;

        Self {
            score,
            total_issues: issues.len(),
            critical_issues: critical,
            warning_issues: warning,
            info_issues: info,
            calculated_at: Utc::now(),
        }
    }
}

impl Default for EntropyScore {
    fn default() -> Self {
        Self::new()
    }
}

/// Entropy record for history tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntropyRecord {
    pub timestamp: DateTime<Utc>,
    pub score: f64,
    pub delta: f64,
    pub agent_name: String,
}

/// Entropy tracker
pub struct EntropyTracker {
    current: EntropyScore,
    history: Vec<EntropyRecord>,
    total_reduction: f64,
}

impl EntropyTracker {
    pub fn new() -> Self {
        Self {
            current: EntropyScore::new(),
            history: Vec::new(),
            total_reduction: 0.0,
        }
    }

    /// Record entropy reduction from GC agent run
    pub fn record_reduction(&mut self, reduction: f64) {
        let _old_score = self.current.score;
        self.current.score = (self.current.score - reduction).max(0.0);
        self.total_reduction += reduction;

        self.history.push(EntropyRecord {
            timestamp: Utc::now(),
            score: self.current.score,
            delta: -reduction,
            agent_name: "gc_agents".to_string(),
        });

        // Keep last 1000 records
        if self.history.len() > 1000 {
            self.history.remove(0);
        }
    }

    /// Update score from issues
    pub fn update_from_issues(&mut self, issues: &[crate::GcIssue]) {
        self.current = EntropyScore::calculate(issues);
    }

    /// Get current score
    pub fn current_score(&self) -> EntropyScore {
        self.current.clone()
    }

    /// Get history
    pub fn history(&self) -> Vec<EntropyRecord> {
        self.history.clone()
    }

    /// Get total reduction
    pub fn total_reduction(&self) -> f64 {
        self.total_reduction
    }
}

impl Default for EntropyTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{GcIssue, IssueSeverity};

    #[test]
    fn test_entropy_score_calculation() {
        let issues = vec![
            GcIssue {
                id: "1".to_string(),
                agent: "test".to_string(),
                severity: IssueSeverity::Critical,
                location: "test.rs".into(),
                description: "test".to_string(),
                suggestion: "test".to_string(),
                fixed: false,
                line_number: None,
            },
            GcIssue {
                id: "2".to_string(),
                agent: "test".to_string(),
                severity: IssueSeverity::Warning,
                location: "test.rs".into(),
                description: "test".to_string(),
                suggestion: "test".to_string(),
                fixed: false,
                line_number: None,
            },
        ];

        let score = EntropyScore::calculate(&issues);
        assert_eq!(score.score, 15.0); // 10 + 5
        assert_eq!(score.total_issues, 2);
        assert_eq!(score.critical_issues, 1);
        assert_eq!(score.warning_issues, 1);
    }

    #[test]
    fn test_entropy_tracker() {
        let mut tracker = EntropyTracker::new();

        tracker.record_reduction(5.0);
        assert_eq!(tracker.current_score().score, 0.0);
        assert_eq!(tracker.total_reduction(), 5.0);
    }
}
