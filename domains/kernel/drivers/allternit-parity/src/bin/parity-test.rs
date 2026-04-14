//! Parity Test Runner CLI
//!
//! Command-line tool for running strangler migration parity tests.
//!
//! Usage:
//!   cargo run --bin parity-test -- [OPTIONS] [COMMAND]
//!
//! Commands:
//!   run [COMPONENT]     Run parity tests (all or specific component)
//!   replay <RECEIPT>    Replay a receipt for regression testing
//!   report              Generate comprehensive parity report
//!   status              Show component status overview
//!   graduate            List components ready to graduate
//!
//! Examples:
//!   cargo run --bin parity-test -- run
//!   cargo run --bin parity-test -- run skill-registry
//!   cargo run --bin parity-test -- replay 550e8400-e29b-41d4-a716-446655440000
//!   cargo run --bin parity-test -- report --output report.json

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use tracing::{info, Level};
use uuid::Uuid;

use a2r_parity::{strangler::MigrationPhase, HarnessConfig, ParityHarness};

/// Parity test runner for OpenClaw strangler migration
#[derive(Parser)]
#[command(name = "parity-test")]
#[command(about = "Parity testing for OpenClaw strangler migration")]
struct Cli {
    /// Corpus directory for receipts
    #[arg(short, long, default_value = ".migration/openclaw-absorption/corpus")]
    corpus_dir: PathBuf,

    /// Enable verbose output
    #[arg(short, long)]
    verbose: bool,

    /// Command to execute
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run parity tests
    Run {
        /// Component name (runs all if not specified)
        component: Option<String>,

        /// Output format
        #[arg(short, long, default_value = "pretty")]
        format: String,
    },

    /// Replay a receipt
    Replay {
        /// Receipt ID to replay
        receipt_id: Uuid,
    },

    /// Generate report
    Report {
        /// Output file
        #[arg(short, long)]
        output: Option<PathBuf>,
    },

    /// Show status
    Status {
        /// Show all components (including complete)
        #[arg(short, long)]
        all: bool,
    },

    /// List components ready to graduate
    Graduate,
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

    // Create harness
    let config = HarnessConfig {
        corpus_dir: cli.corpus_dir,
        ..Default::default()
    };

    let harness = ParityHarness::new(config)
        .await
        .context("Failed to create parity harness")?;

    match cli.command {
        Commands::Run { component, format } => {
            run_tests(&harness, component, &format).await?;
        }
        Commands::Replay { receipt_id } => {
            replay_receipt(&harness, receipt_id).await?;
        }
        Commands::Report { output } => {
            generate_report(&harness, output).await?;
        }
        Commands::Status { all } => {
            show_status(&harness, all).await?;
        }
        Commands::Graduate => {
            list_graduatable(&harness).await?;
        }
    }

    Ok(())
}

async fn run_tests(harness: &ParityHarness, component: Option<String>, format: &str) -> Result<()> {
    if let Some(name) = component {
        info!("Running parity test for component: {}", name);

        let input = a2r_parity::strangler::ComponentInput {
            data: serde_json::json!({"test": true}),
            context: serde_json::json!({"source": "cli"}),
        };

        let result = harness
            .run_parity_test(&name, input)
            .await
            .context(format!("Failed to run test for {}", name))?;

        match format {
            "json" => println!("{}", serde_json::to_string_pretty(&result)?),
            _ => print_test_result(&result),
        }
    } else {
        info!("Running full parity test suite");

        let suite_result = harness
            .run_full_suite()
            .await
            .context("Failed to run full suite")?;

        match format {
            "json" => println!("{}", serde_json::to_string_pretty(&suite_result)?),
            _ => print_suite_result(&suite_result),
        }
    }

    Ok(())
}

async fn replay_receipt(harness: &ParityHarness, receipt_id: Uuid) -> Result<()> {
    info!("Replaying receipt: {}", receipt_id);

    let result = harness
        .replay_receipt(receipt_id)
        .await
        .context("Failed to replay receipt")?;

    print_test_result(&result);

    Ok(())
}

async fn generate_report(harness: &ParityHarness, output: Option<PathBuf>) -> Result<()> {
    info!("Generating parity report");

    let report = harness
        .generate_report()
        .await
        .context("Failed to generate report")?;

    let json = serde_json::to_string_pretty(&report)?;

    if let Some(path) = output {
        tokio::fs::write(&path, &json).await?;
        info!("Report written to: {}", path.display());
    } else {
        println!("{}", json);
    }

    Ok(())
}

async fn show_status(harness: &ParityHarness, all: bool) -> Result<()> {
    let report = harness.generate_report().await?;

    println!("╔════════════════════════════════════════════════════════════╗");
    println!("║           OPENCLAW STRANGLER MIGRATION STATUS             ║");
    println!("╚════════════════════════════════════════════════════════════╝");
    println!();

    // Group by phase
    let mut by_phase: std::collections::HashMap<MigrationPhase, Vec<_>> =
        std::collections::HashMap::new();
    for status in &report.component_status {
        if all || status.phase != MigrationPhase::Complete {
            by_phase.entry(status.phase).or_default().push(status);
        }
    }

    for phase in [
        MigrationPhase::Quarantine,
        MigrationPhase::Bridge,
        MigrationPhase::DualRun,
        MigrationPhase::Graduate,
        MigrationPhase::Complete,
        MigrationPhase::Permanent,
    ] {
        if let Some(components) = by_phase.get(&phase) {
            println!("\n📦 {:?} ({} components)", phase, components.len());
            println!("{}", "─".repeat(60));
            for c in components {
                let parity_str = format!("{:.1}%", c.parity_percentage);
                println!(
                    "  {:<30} Tests: {:>3}/{:<3}  Parity: {:>6}",
                    c.name, c.tests_passed, c.tests_run, parity_str
                );
            }
        }
    }

    println!();
    Ok(())
}

async fn list_graduatable(harness: &ParityHarness) -> Result<()> {
    let ready = harness.get_ready_to_graduate();

    if ready.is_empty() {
        println!("No components ready to graduate.");
        println!();
        println!("Components must be in DualRun phase with passing parity tests.");
    } else {
        println!("Components ready to graduate:");
        println!();
        for name in ready {
            println!("  ✅ {}", name);
        }
        println!();
        println!("To graduate a component, update its phase to MigrationPhase::Graduate");
    }

    Ok(())
}

fn print_test_result(result: &a2r_parity::TestResult) {
    let status = if result.passed {
        "✅ PASSED"
    } else {
        "❌ FAILED"
    };

    println!();
    println!("Test Result: {}", result.component_name);
    println!("{}", "─".repeat(60));
    println!("  Status:     {}", status);
    println!("  Duration:   {}ms", result.duration_ms);
    println!("  Timestamp:  {}", result.timestamp);

    if let Some(ref error) = result.error {
        println!("  Error:      {}", error);
    }

    if let Some(ref parity) = result.parity_result {
        println!();
        println!("  Parity Check:");
        println!("    Matches: {}", parity.matches);
        if !parity.differences.is_empty() {
            println!("    Differences:");
            for diff in &parity.differences {
                println!(
                    "      - {}: expected {:?}, got {:?}",
                    diff.path, diff.expected, diff.actual
                );
            }
        }
    }

    println!();
}

fn print_suite_result(result: &a2r_parity::SuiteResult) {
    let s = &result.summary;

    println!();
    println!("╔════════════════════════════════════════════════════════════╗");
    println!("║                 PARITY TEST SUITE RESULT                  ║");
    println!("╚════════════════════════════════════════════════════════════╝");
    println!();
    println!("  Duration:      {}ms", result.duration_ms);
    println!("  Timestamp:     {}", result.timestamp);
    println!();
    println!("  Total Tests:   {}", s.total_tests);
    println!("  ✅ Passed:     {}", s.passed);
    println!("  ❌ Failed:     {}", s.failed);
    if s.skipped > 0 {
        println!("  ⏭️  Skipped:   {}", s.skipped);
    }
    println!();
    println!("  Component Phases:");
    println!("    Quarantine:  {}", s.components_in_quarantine);
    println!("    Bridge:      {}", s.components_in_bridge);
    println!("    Dual-Run:    {}", s.components_in_dual_run);
    println!("    Graduate:    {}", s.components_in_graduate);
    println!("    Complete:    {}", s.components_complete);
    println!();
}
