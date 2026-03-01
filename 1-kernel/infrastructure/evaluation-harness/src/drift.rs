//! Drift Detection System
//!
//! Detects performance, behavior, and quality drift over time.
//! Tracks metrics across DAG executions and PRs.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, warn};

/// Drift detection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftConfig {
    /// Time window for baseline comparison
    pub baseline_window_days: i64,
    /// Threshold for significant drift (percentage)
    pub drift_threshold_percent: f64,
    /// Metrics to track for drift
    pub tracked_metrics: Vec<String>,
    /// Alert channels
    pub alert_channels: Vec<AlertChannel>,
}

impl Default for DriftConfig {
    fn default() -> Self {
        Self {
            baseline_window_days: 7,
            drift_threshold_percent: 5.0,
            tracked_metrics: vec![
                "execution_time_ms".to_string(),
                "memory_usage_mb".to_string(),
                "success_rate".to_string(),
                "test_coverage".to_string(),
            ],
            alert_channels: vec![AlertChannel::Log],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertChannel {
    Log,
    Webhook(String),
    Email(Vec<String>),
}

/// Historical metric data point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricDataPoint {
    pub timestamp: DateTime<Utc>,
    pub value: f64,
    pub metadata: HashMap<String, String>,
}

/// Metric time series
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricSeries {
    pub metric_name: String,
    pub data_points: Vec<MetricDataPoint>,
}

/// Drift detection result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftResult {
    pub metric_name: String,
    pub baseline_value: f64,
    pub current_value: f64,
    pub drift_percent: f64,
    pub drift_detected: bool,
    pub severity: DriftSeverity,
    pub timestamp: DateTime<Utc>,
    pub recommendation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DriftSeverity {
    None,
    Low,
    Medium,
    High,
    Critical,
}

/// Drift detector
#[derive(Clone)]
pub struct DriftDetector {
    config: DriftConfig,
    metrics_store: HashMap<String, MetricSeries>,
}

impl DriftDetector {
    /// Create a new drift detector
    pub fn new(config: DriftConfig) -> Self {
        Self {
            config,
            metrics_store: HashMap::new(),
        }
    }

    /// Record a metric data point
    pub fn record_metric(
        &mut self,
        metric_name: impl Into<String>,
        value: f64,
        metadata: HashMap<String, String>,
    ) {
        let name = metric_name.into();
        let data_point = MetricDataPoint {
            timestamp: Utc::now(),
            value,
            metadata,
        };

        let series = self.metrics_store.entry(name.clone()).or_insert_with(|| MetricSeries {
            metric_name: name,
            data_points: Vec::new(),
        });

        series.data_points.push(data_point);
        
        // Keep only last 30 days of data
        let cutoff = Utc::now() - Duration::days(30);
        series.data_points.retain(|dp| dp.timestamp > cutoff);
    }

    /// Detect drift for a specific metric
    pub fn detect_drift(&self, metric_name: &str) -> Option<DriftResult> {
        let series = self.metrics_store.get(metric_name)?;
        
        if series.data_points.len() < 2 {
            return None;
        }

        // Calculate baseline (average of older data points)
        let cutoff = Utc::now() - Duration::days(self.config.baseline_window_days);
        let baseline_points: Vec<_> = series.data_points
            .iter()
            .filter(|dp| dp.timestamp < cutoff)
            .collect();

        if baseline_points.is_empty() {
            // Use first half as baseline
            let half = series.data_points.len() / 2;
            let baseline_value = series.data_points[..half]
                .iter()
                .map(|dp| dp.value)
                .sum::<f64>() / half as f64;
            
            let current_value = series.data_points[half..]
                .iter()
                .map(|dp| dp.value)
                .sum::<f64>() / (series.data_points.len() - half) as f64;

            return Some(self.calculate_drift(metric_name, baseline_value, current_value));
        }

        let baseline_value = baseline_points
            .iter()
            .map(|dp| dp.value)
            .sum::<f64>() / baseline_points.len() as f64;

        let recent_points: Vec<_> = series.data_points
            .iter()
            .filter(|dp| dp.timestamp >= cutoff)
            .collect();

        let current_value = recent_points
            .iter()
            .map(|dp| dp.value)
            .sum::<f64>() / recent_points.len() as f64;

        Some(self.calculate_drift(metric_name, baseline_value, current_value))
    }

    /// Calculate drift between baseline and current
    fn calculate_drift(&self, metric_name: &str, baseline: f64, current: f64) -> DriftResult {
        let drift_percent = if baseline == 0.0 {
            if current == 0.0 { 0.0 } else { 100.0 }
        } else {
            ((current - baseline) / baseline) * 100.0
        };

        let drift_detected = drift_percent.abs() >= self.config.drift_threshold_percent;
        
        let severity = if drift_detected {
            match drift_percent.abs() {
                d if d >= 50.0 => DriftSeverity::Critical,
                d if d >= 20.0 => DriftSeverity::High,
                d if d >= 10.0 => DriftSeverity::Medium,
                _ => DriftSeverity::Low,
            }
        } else {
            DriftSeverity::None
        };

        let recommendation = if drift_detected {
            Some(format!(
                "{} drift of {:.1}% detected. Investigate recent changes.",
                if drift_percent > 0.0 { "Performance degradation" } else { "Improvement" },
                drift_percent.abs()
            ))
        } else {
            None
        };

        DriftResult {
            metric_name: metric_name.to_string(),
            baseline_value: baseline,
            current_value: current,
            drift_percent,
            drift_detected,
            severity,
            timestamp: Utc::now(),
            recommendation,
        }
    }

    /// Detect drift for all tracked metrics
    pub fn detect_all_drift(&self) -> Vec<DriftResult> {
        self.config.tracked_metrics
            .iter()
            .filter_map(|metric| self.detect_drift(metric))
            .collect()
    }

    /// Alert on detected drift
    pub fn alert_on_drift(&self, results: &[DriftResult]) {
        for result in results.iter().filter(|r| r.drift_detected) {
            warn!(
                "Drift detected: {} = {:.2} (baseline: {:.2}, drift: {:.1}%)",
                result.metric_name,
                result.current_value,
                result.baseline_value,
                result.drift_percent
            );

            for channel in &self.config.alert_channels {
                match channel {
                    AlertChannel::Log => {
                        info!("Drift alert: {:?}", result);
                    }
                    AlertChannel::Webhook(url) => {
                        info!("Would send drift alert to webhook: {}", url);
                    }
                    AlertChannel::Email(emails) => {
                        info!("Would send drift alert to emails: {:?}", emails);
                    }
                }
            }
        }
    }

    /// Get drift report
    pub fn get_drift_report(&self) -> DriftReport {
        let results = self.detect_all_drift();
        let critical_count = results.iter().filter(|r| r.severity == DriftSeverity::Critical).count();
        let high_count = results.iter().filter(|r| r.severity == DriftSeverity::High).count();

        DriftReport {
            generated_at: Utc::now(),
            config: self.config.clone(),
            results,
            summary: DriftSummary {
                total_metrics: self.config.tracked_metrics.len(),
                drift_detected_count: critical_count + high_count,
                critical_count,
                high_count,
            },
        }
    }
}

/// Drift report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftReport {
    pub generated_at: DateTime<Utc>,
    pub config: DriftConfig,
    pub results: Vec<DriftResult>,
    pub summary: DriftSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriftSummary {
    pub total_metrics: usize,
    pub drift_detected_count: usize,
    pub critical_count: usize,
    pub high_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_drift_detection() {
        let config = DriftConfig::default();
        let mut detector = DriftDetector::new(config);

        // Record baseline metrics
        for i in 0..10 {
            detector.record_metric(
                "test_metric",
                100.0 + i as f64,
                HashMap::new(),
            );
        }

        // Record drifted metrics
        for i in 0..5 {
            detector.record_metric(
                "test_metric",
                150.0 + i as f64,
                HashMap::new(),
            );
        }

        let result = detector.detect_drift("test_metric").unwrap();
        assert!(result.drift_detected);
        assert!(result.drift_percent > 0.0);
    }

    #[test]
    fn test_no_drift() {
        let config = DriftConfig::default();
        let mut detector = DriftDetector::new(config);

        // Record consistent metrics
        for i in 0..20 {
            detector.record_metric(
                "stable_metric",
                100.0 + (i as f64 * 0.1),
                HashMap::new(),
            );
        }

        let result = detector.detect_drift("stable_metric").unwrap();
        assert!(!result.drift_detected);
        assert_eq!(result.severity, DriftSeverity::None);
    }
}
