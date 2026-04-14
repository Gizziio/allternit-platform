//! Phase 4: Migration Complete Tool
//!
//! Final tool for completing the OpenClaw strangler migration.
//!
//! Commands:
//!   status              Show completion status
//!   promote             Promote component to Complete phase
//!   verify              Verify component can be completed
//!   archive             Archive parity corpus
//!   report              Generate completion report
//!   finish              Check if migration is fully complete

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::{error, info, Level};

use a2r_openclaw_host::{completion::CompletionManager, feature_flags::global_registry};

/// Phase 4: Complete the OpenClaw strangler migration
#[derive(Parser)]
#[command(name = "migration-complete")]
#[command(about = "Complete the OpenClaw strangler migration (Phase 4)")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Verbose output
    #[arg(short, long, global = true)]
    verbose: bool,

    /// Corpus directory
    #[arg(long, default_value = ".migration/openclaw-absorption/corpus")]
    corpus_dir: PathBuf,

    /// Archive directory
    #[arg(long, default_value = ".migration/openclaw-absorption/archive")]
    archive_dir: PathBuf,
}

#[derive(Subcommand)]
enum Commands {
    /// Show completion status
    Status,

    /// Promote a component to Complete phase
    Promote {
        /// Component name
        component: String,

        /// User making the change
        #[arg(short, long, default_value = "admin")]
        user: String,
    },

    /// Verify component can be completed
    Verify {
        /// Component name
        component: String,
    },

    /// Archive parity corpus
    Archive,

    /// Generate completion report
    Report {
        /// Output file (JSON)
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// Check if migration is fully complete
    Finish,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize tracing
    let level = if cli.verbose {
        Level::DEBUG
    } else {
        Level::INFO
    };
    tracing_subscriber::fmt().with_max_level(level).init();

    let registry = global_registry();
    let manager = CompletionManager::new(registry.clone(), cli.archive_dir.clone());

    match cli.command {
        Commands::Status => {
            show_status(&manager).await?;
        }
        Commands::Promote { component, user } => {
            promote_component(&manager, &component, &user).await?;
        }
        Commands::Verify { component } => {
            verify_component(&manager, &component).await?;
        }
        Commands::Archive => {
            archive_corpus(&manager, &cli.corpus_dir).await?;
        }
        Commands::Report { output } => {
            generate_report(&manager, output).await?;
        }
        Commands::Finish => {
            check_finish(&manager).await?;
        }
    }

    Ok(())
}

async fn show_status(manager: &CompletionManager) -> Result<()> {
    let status = manager.status();
    status.print();
    Ok(())
}

async fn promote_component(manager: &CompletionManager, component: &str, user: &str) -> Result<()> {
    info!("Promoting {} to Complete phase...", component);

    match manager.promote_to_complete(component, user) {
        Ok(()) => {
            info!("");
            info!("✅ {} promoted to Complete phase successfully!", component);
            info!("   OpenClaw fallback has been removed.");

            // Show updated status
            let status = manager.status();
            info!("");
            info!("Overall completion: {:.1}%", status.completion_percent);

            if status.can_remove_openclaw {
                info!("");
                info!("🎉 ALL COMPONENTS COMPLETE!");
                info!("Run 'migration-complete finish' to finalize.");
            }
            Ok(())
        }
        Err(e) => {
            error!("Failed to promote {}: {}", component, e);
            Err(e)
        }
    }
}

async fn verify_component(manager: &CompletionManager, component: &str) -> Result<()> {
    info!("Verifying {} can be completed...", component);
    info!("");

    let verification = manager.verify_completion(component);

    info!("Component: {}", verification.component);
    info!(
        "Can Complete: {}",
        if verification.can_complete {
            "✅ YES"
        } else {
            "❌ NO"
        }
    );

    if !verification.issues.is_empty() {
        info!("");
        info!("❌ Issues:");
        for issue in &verification.issues {
            info!("    - {}", issue);
        }
    }

    if !verification.warnings.is_empty() {
        info!("");
        info!("⚠️  Warnings:");
        for warning in &verification.warnings {
            info!("    - {}", warning);
        }
    }

    if verification.can_complete && verification.warnings.is_empty() {
        info!("");
        info!("✅ Component is ready to be promoted to Complete phase!");
    }

    Ok(())
}

async fn archive_corpus(manager: &CompletionManager, corpus_dir: &PathBuf) -> Result<()> {
    info!("Archiving parity corpus...");
    info!("Source: {}", corpus_dir.display());

    if !corpus_dir.exists() {
        return Err(anyhow::anyhow!(
            "Corpus directory does not exist: {}",
            corpus_dir.display()
        ));
    }

    let archive_path = manager
        .archive_corpus(corpus_dir)
        .await
        .context("Failed to archive corpus")?;

    info!("");
    info!("✅ Parity corpus archived successfully!");
    info!("Archive: {}", archive_path.display());
    info!("");
    info!("The corpus is preserved for audit purposes.");
    info!("You may now safely remove the source corpus if desired.");

    Ok(())
}

async fn generate_report(manager: &CompletionManager, output: Option<PathBuf>) -> Result<()> {
    let report = manager.generate_report();

    let json = serde_json::to_string_pretty(&report)?;

    if let Some(path) = output {
        tokio::fs::write(&path, &json).await?;
        info!("Report written to: {}", path.display());
    } else {
        println!("{}", json);
    }

    Ok(())
}

async fn check_finish(manager: &CompletionManager) -> Result<()> {
    info!("╔════════════════════════════════════════════════════════════╗");
    info!("║         MIGRATION COMPLETION CHECK                         ║");
    info!("╚════════════════════════════════════════════════════════════╝");
    info!("");

    let status = manager.status();

    if !status.can_remove_openclaw {
        error!("❌ Migration is NOT complete");
        info!("");
        info!("Components still requiring OpenClaw:");
        for comp in &status.requiring_openclaw {
            info!("    - {}", comp);
        }
        return Ok(());
    }

    info!("✅ All components are in Complete phase!");
    info!("");

    // Check completion checklist
    let report = manager.generate_report();
    let checklist = report.completion_checklist;

    info!("Completion Checklist:");
    info!(
        "  [{}] All components complete",
        if checklist.all_components_complete {
            "✅"
        } else {
            "❌"
        }
    );
    info!(
        "  [{}] Parity corpus archived",
        if checklist.parity_corpus_archived {
            "✅"
        } else {
            "⏳"
        }
    );
    info!(
        "  [{}] OpenClaw removed from config",
        if checklist.openclaw_removed_from_config {
            "✅"
        } else {
            "⏳"
        }
    );
    info!(
        "  [{}] Rollback plan documented",
        if checklist.rollback_plan_documented {
            "✅"
        } else {
            "⏳"
        }
    );
    info!(
        "  [{}] Monitoring configured",
        if checklist.monitoring_configured {
            "✅"
        } else {
            "⏳"
        }
    );
    info!(
        "  [{}] Team notified",
        if checklist.team_notified {
            "✅"
        } else {
            "⏳"
        }
    );

    if checklist.is_complete() {
        info!("");
        info!("╔════════════════════════════════════════════════════════════╗");
        info!("║              🎉 MIGRATION COMPLETE! 🎉                     ║");
        info!("╚════════════════════════════════════════════════════════════╝");
        info!("");
        info!("The OpenClaw strangler migration has been successfully completed.");
        info!("");
        info!("Summary:");
        info!("  - All components migrated to native A2R");
        info!("  - Parity testing verified");
        info!("  - OpenClaw subprocess can be removed");
        info!("");
        info!("Next steps:");
        info!("  1. Remove OpenClaw from deployment");
        info!("  2. Update documentation");
        info!("  3. Celebrate! 🎉");
    } else {
        info!("");
        info!("⏳ Remaining tasks:");
        for item in checklist.incomplete_items() {
            info!("    - {}", item);
        }
    }

    Ok(())
}
