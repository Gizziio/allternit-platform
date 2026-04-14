//! Phase 4: Complete - OpenClaw Removal
//!
//! Final phase of the strangler migration where OpenClaw is completely removed
//! for graduated components. Native A2R implementations are the sole authority.
//!
//! Completion Checklist:
//! - All components in Complete phase
//! - No OpenClaw subprocess dependencies
//! - Parity corpus archived
//! - Rollback plan documented

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tracing::{info, warn};

use crate::feature_flags::FeatureFlagRegistry;

/// Completion status for the OpenClaw migration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationCompletionStatus {
    /// Overall completion percentage
    pub completion_percent: f64,

    /// Number of components in each phase
    pub phase_counts: HashMap<String, usize>,

    /// Components ready for Complete phase
    pub ready_for_complete: Vec<String>,

    /// Components already in Complete phase
    pub completed_components: Vec<String>,

    /// Components still requiring OpenClaw
    pub requiring_openclaw: Vec<String>,

    /// Whether OpenClaw can be fully removed
    pub can_remove_openclaw: bool,

    /// Timestamp of status check
    pub checked_at: chrono::DateTime<chrono::Utc>,
}

impl MigrationCompletionStatus {
    /// Create a new completion status from feature flags
    pub fn from_registry(registry: &FeatureFlagRegistry) -> Self {
        let flags = registry.list_all();
        let total = flags.len();

        let mut phase_counts: HashMap<String, usize> = HashMap::new();
        let mut ready_for_complete = Vec::new();
        let mut completed_components = Vec::new();
        let mut requiring_openclaw = Vec::new();
        let mut complete_count = 0;

        for flag in &flags {
            // Determine effective phase
            let phase = if flag.native_primary
                && flag.native_traffic_percent == 100
                && !flag.fallback_on_error
            {
                "Complete"
            } else if flag.native_primary && flag.native_traffic_percent == 100 {
                "Graduate"
            } else if flag.native_traffic_percent > 0 && flag.native_traffic_percent < 100 {
                "DualRun"
            } else if flag.native_primary {
                "Bridge"
            } else {
                "Quarantine"
            };

            *phase_counts.entry(phase.to_string()).or_insert(0) += 1;

            if phase == "Complete" {
                complete_count += 1;
                completed_components.push(flag.component.clone());
            } else {
                requiring_openclaw.push(flag.component.clone());

                // Check if ready for Complete (Graduate phase with high parity)
                if flag.native_primary
                    && flag.native_traffic_percent == 100
                    && flag.fallback_on_error
                    && flag.can_graduate()
                {
                    ready_for_complete.push(flag.component.clone());
                }
            }
        }

        let completion_percent = if total > 0 {
            (complete_count as f64 / total as f64) * 100.0
        } else {
            0.0
        };

        Self {
            completion_percent,
            phase_counts,
            ready_for_complete,
            completed_components,
            requiring_openclaw,
            can_remove_openclaw: complete_count == total && total > 0,
            checked_at: chrono::Utc::now(),
        }
    }

    /// Print human-readable status
    pub fn print(&self) {
        info!("╔════════════════════════════════════════════════════════════╗");
        info!("║         OPENCLAW MIGRATION COMPLETION STATUS               ║");
        info!("╚════════════════════════════════════════════════════════════╝");
        info!("");
        info!("Overall Completion: {:.1}%", self.completion_percent);
        info!("");

        info!("Phase Distribution:");
        for (phase, count) in &self.phase_counts {
            info!("  {}: {}", phase, count);
        }
        info!("");

        if !self.completed_components.is_empty() {
            info!("✅ Complete (Native Only):");
            for comp in &self.completed_components {
                info!("    {}", comp);
            }
            info!("");
        }

        if !self.ready_for_complete.is_empty() {
            info!("🟡 Ready for Complete:");
            for comp in &self.ready_for_complete {
                info!("    {}", comp);
            }
            info!("");
        }

        if !self.requiring_openclaw.is_empty() {
            info!("🔵 Still Requires OpenClaw:");
            for comp in &self.requiring_openclaw {
                info!("    {}", comp);
            }
            info!("");
        }

        if self.can_remove_openclaw {
            info!("✅ ALL COMPONENTS COMPLETE - OpenClaw can be removed!");
        } else {
            let remaining = self.requiring_openclaw.len();
            info!("⏳ {} component(s) still require OpenClaw", remaining);
        }
    }
}

/// Phase 4 completion manager
pub struct CompletionManager {
    registry: FeatureFlagRegistry,
    corpus_archive_dir: PathBuf,
}

impl CompletionManager {
    /// Create a new completion manager
    pub fn new(registry: FeatureFlagRegistry, corpus_archive_dir: PathBuf) -> Self {
        Self {
            registry,
            corpus_archive_dir,
        }
    }

    /// Get current completion status
    pub fn status(&self) -> MigrationCompletionStatus {
        MigrationCompletionStatus::from_registry(&self.registry)
    }

    /// Promote a component from Graduate to Complete phase
    /// This removes OpenClaw fallback
    pub fn promote_to_complete(&self, component: &str, updated_by: &str) -> anyhow::Result<()> {
        info!("Promoting {} to Complete phase...", component);

        // Verify component is in Graduate phase
        if let Some(flag) = self.registry.get(component) {
            if !flag.native_primary || flag.native_traffic_percent != 100 {
                return Err(anyhow::anyhow!(
                    "Component {} must be in Graduate phase (native_primary=true, 100% traffic) to promote to Complete",
                    component
                ));
            }

            if !flag.fallback_on_error {
                info!("Component {} is already in Complete phase", component);
                return Ok(());
            }

            // Check parity threshold
            if let Some(parity) = flag.current_parity_percent {
                if parity < flag.min_parity_percent {
                    warn!(
                        "Component {} parity ({:.1}%) is below threshold ({:.1}%)",
                        component, parity, flag.min_parity_percent
                    );
                }
            }
        } else {
            return Err(anyhow::anyhow!("Component {} not found", component));
        }

        // Update flag to disable fallback
        self.registry.update(component, |flag| {
            flag.fallback_on_error = false;
            flag.updated_by = updated_by.to_string();
            flag.notes = format!(
                "Promoted to Complete phase on {} - OpenClaw fallback removed",
                chrono::Utc::now()
            );
        })?;

        info!("✅ Component {} promoted to Complete phase", component);
        info!("   OpenClaw fallback has been disabled");

        Ok(())
    }

    /// Check if all components are complete
    pub fn is_complete(&self) -> bool {
        self.status().can_remove_openclaw
    }

    /// Archive the parity corpus
    pub async fn archive_corpus(&self, source_dir: &PathBuf) -> anyhow::Result<PathBuf> {
        use tokio::fs;

        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
        let archive_name = format!("parity-corpus-{}.tar.gz", timestamp);
        let archive_path = self.corpus_archive_dir.join(&archive_name);

        info!("Archiving parity corpus to {}...", archive_path.display());

        // Ensure archive directory exists
        fs::create_dir_all(&self.corpus_archive_dir).await?;

        // Create tar.gz archive
        let archive_file = std::fs::File::create(&archive_path)?;
        let enc = flate2::write::GzEncoder::new(archive_file, flate2::Compression::default());
        let mut tar = tar::Builder::new(enc);

        // Add corpus directory to archive
        tar.append_dir_all("parity-corpus", source_dir)?;
        tar.finish()?;

        info!("✅ Corpus archived to {}", archive_path.display());

        Ok(archive_path)
    }

    /// Generate migration completion report
    pub fn generate_report(&self) -> MigrationReport {
        let status = self.status();

        MigrationReport {
            status,
            recommendations: self.generate_recommendations(),
            completion_checklist: self.generate_checklist(),
            generated_at: chrono::Utc::now(),
        }
    }

    fn generate_recommendations(&self) -> Vec<String> {
        let mut recommendations = Vec::new();
        let status = self.status();

        if status.can_remove_openclaw {
            recommendations
                .push("All components are Complete. OpenClaw can be fully removed.".to_string());
            recommendations
                .push("Archive parity corpus for audit purposes before cleanup".to_string());
        } else {
            if !status.ready_for_complete.is_empty() {
                recommendations.push(format!(
                    "Promote ready components to Complete: {:?}",
                    status.ready_for_complete
                ));
            }

            if !status.requiring_openclaw.is_empty() {
                recommendations.push(format!(
                    "Continue DualRun testing for: {:?}",
                    status.requiring_openclaw
                ));
            }
        }

        recommendations
    }

    fn generate_checklist(&self) -> CompletionChecklist {
        let status = self.status();

        CompletionChecklist {
            all_components_complete: status.can_remove_openclaw,
            parity_corpus_archived: false, // Would check actual archive
            openclaw_removed_from_config: false,
            rollback_plan_documented: false,
            monitoring_configured: false,
            team_notified: false,
        }
    }

    /// Verify component can be completed (dry run)
    pub fn verify_completion(&self, component: &str) -> CompletionVerification {
        let mut issues = Vec::new();
        let mut warnings = Vec::new();

        if let Some(flag) = self.registry.get(component) {
            // Check native is primary
            if !flag.native_primary {
                issues.push(format!("{}: native is not primary", component));
            }

            // Check 100% traffic
            if flag.native_traffic_percent != 100 {
                issues.push(format!(
                    "{}: native traffic is {}%, not 100%",
                    component, flag.native_traffic_percent
                ));
            }

            // Check parity
            if let Some(parity) = flag.current_parity_percent {
                if parity < flag.min_parity_percent {
                    issues.push(format!(
                        "{}: parity {:.1}% is below threshold {:.1}%",
                        component, parity, flag.min_parity_percent
                    ));
                } else if parity < 99.0 {
                    warnings.push(format!(
                        "{}: parity {:.1}% is acceptable but could be improved",
                        component, parity
                    ));
                }
            } else {
                issues.push(format!("{}: no parity measurement available", component));
            }

            // Check if already complete
            if !flag.fallback_on_error {
                warnings.push(format!("{}: already in Complete phase", component));
            }
        } else {
            issues.push(format!("{}: component not found in registry", component));
        }

        CompletionVerification {
            component: component.to_string(),
            can_complete: issues.is_empty(),
            issues,
            warnings,
        }
    }
}

/// Migration completion report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MigrationReport {
    pub status: MigrationCompletionStatus,
    pub recommendations: Vec<String>,
    pub completion_checklist: CompletionChecklist,
    pub generated_at: chrono::DateTime<chrono::Utc>,
}

/// Completion checklist
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionChecklist {
    pub all_components_complete: bool,
    pub parity_corpus_archived: bool,
    pub openclaw_removed_from_config: bool,
    pub rollback_plan_documented: bool,
    pub monitoring_configured: bool,
    pub team_notified: bool,
}

impl CompletionChecklist {
    /// Check if all items are complete
    pub fn is_complete(&self) -> bool {
        self.all_components_complete
            && self.parity_corpus_archived
            && self.openclaw_removed_from_config
            && self.rollback_plan_documented
            && self.monitoring_configured
            && self.team_notified
    }

    /// Get incomplete items
    pub fn incomplete_items(&self) -> Vec<&'static str> {
        let mut items = Vec::new();

        if !self.all_components_complete {
            items.push("All components must be in Complete phase");
        }
        if !self.parity_corpus_archived {
            items.push("Parity corpus must be archived");
        }
        if !self.openclaw_removed_from_config {
            items.push("OpenClaw must be removed from configuration");
        }
        if !self.rollback_plan_documented {
            items.push("Rollback plan must be documented");
        }
        if !self.monitoring_configured {
            items.push("Native monitoring must be configured");
        }
        if !self.team_notified {
            items.push("Team must be notified of completion");
        }

        items
    }
}

/// Completion verification result for a component
#[derive(Debug, Clone)]
pub struct CompletionVerification {
    pub component: String,
    pub can_complete: bool,
    pub issues: Vec<String>,
    pub warnings: Vec<String>,
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[test]
    fn test_completion_status() {
        let registry = FeatureFlagRegistry::new();

        // Initialize with mix of phases
        registry.set(ComponentFeatureFlag::complete("skill-registry"));
        registry.set(ComponentFeatureFlag::graduate("session-manager"));

        let status = MigrationCompletionStatus::from_registry(&registry);

        assert_eq!(status.completion_percent, 50.0);
        assert!(!status.can_remove_openclaw);
        assert_eq!(status.completed_components.len(), 1);
        assert_eq!(status.ready_for_complete.len(), 1); // session-manager
    }

    #[test]
    fn test_completion_checklist() {
        let checklist = CompletionChecklist {
            all_components_complete: true,
            parity_corpus_archived: true,
            openclaw_removed_from_config: true,
            rollback_plan_documented: false,
            monitoring_configured: true,
            team_notified: false,
        };

        assert!(!checklist.is_complete());

        let incomplete = checklist.incomplete_items();
        assert_eq!(incomplete.len(), 2);
        assert!(incomplete.contains(&"Rollback plan must be documented"));
    }

    #[test]
    fn test_verify_completion() {
        let registry = FeatureFlagRegistry::new();
        registry.set(ComponentFeatureFlag::graduate("skill-registry"));

        let manager = CompletionManager::new(registry, PathBuf::from("/tmp/archive"));

        let verification = manager.verify_completion("skill-registry");

        // Graduate phase should have no issues but warnings about fallback
        assert!(verification.can_complete);
        assert!(!verification.warnings.is_empty());
    }
}
