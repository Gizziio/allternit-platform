//! DualRun Test Runner
//!
//! Runs Phase 2 DualRun tests comparing OpenClaw (reference) vs Native A2R implementations.
//! This is the key parity testing phase where both implementations run side-by-side.
//!
//! Usage:
//!   cargo run --bin dualrun-test -- [OPTIONS]
//!
//! Examples:
//!   cargo run --bin dualrun-test -- --openclaw-url http://localhost:18789
//!   cargo run --bin dualrun-test -- --component skill-registry
//!   cargo run --bin dualrun-test -- --all-components

use anyhow::{Context, Result};
use clap::Parser;
use std::path::PathBuf;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, warn, Level};

use a2r_openclaw_host::{components::OpenClawComponentFactory, rpc::OpenClawHttpClient};
use a2r_parity::{strangler::ComponentInput, HarnessConfig, ParityHarness};

/// DualRun test runner for Phase 2 parity testing
#[derive(Parser)]
#[command(name = "dualrun-test")]
#[command(about = "Phase 2 DualRun parity testing - OpenClaw vs Native A2R")]
struct Cli {
    /// OpenClaw HTTP API base URL
    #[arg(short, long, default_value = "http://localhost:18789")]
    openclaw_url: String,

    /// Authentication token for OpenClaw API
    #[arg(short, long)]
    token: Option<String>,

    /// Corpus output directory
    #[arg(
        short,
        long,
        default_value = ".migration/openclaw-absorption/corpus/dualrun"
    )]
    corpus_dir: PathBuf,

    /// Specific component to test
    #[arg(short, long)]
    component: Option<String>,

    /// Test all components
    #[arg(long)]
    all_components: bool,

    /// Number of iterations per test
    #[arg(short, long, default_value = "1")]
    iterations: usize,

    /// Tolerance for parity percentage (fail if below)
    #[arg(long, default_value = "95.0")]
    min_parity: f64,

    /// Verbose output
    #[arg(short, long)]
    verbose: bool,
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

    info!("╔════════════════════════════════════════════════════════════╗");
    info!("║              PHASE 2 DUALRUN PARITY TESTING                ║");
    info!("║         OpenClaw (Reference) vs Native A2R                 ║");
    info!("╚════════════════════════════════════════════════════════════╝");
    info!("");
    info!("OpenClaw URL: {}", cli.openclaw_url);
    info!("Corpus directory: {}", cli.corpus_dir.display());
    info!("Min parity threshold: {}%", cli.min_parity);
    info!("");

    // Create output directory
    tokio::fs::create_dir_all(&cli.corpus_dir)
        .await
        .context("Failed to create corpus directory")?;

    // Check if OpenClaw is reachable
    let client = if let Some(token) = &cli.token {
        OpenClawHttpClient::new(&cli.openclaw_url).with_auth(token)
    } else {
        OpenClawHttpClient::new(&cli.openclaw_url)
    };

    info!("Checking OpenClaw health...");
    match client.health_check().await {
        Ok(()) => info!("✅ OpenClaw is healthy"),
        Err(e) => {
            warn!("⚠️  OpenClaw health check failed: {}", e);
            warn!("Tests may fail if OpenClaw is not accessible");
        }
    }

    // Create parity harness
    let harness_config = HarnessConfig {
        corpus_dir: cli.corpus_dir.clone(),
        ..Default::default()
    };

    let mut harness = ParityHarness::new(harness_config)
        .await
        .context("Failed to create parity harness")?;

    // Create component factory with native implementations (Phase 2)
    let factory = if let Some(token) = &cli.token {
        OpenClawComponentFactory::new(&cli.openclaw_url)
            .with_auth(token)
            .with_native_implementations()
    } else {
        OpenClawComponentFactory::new(&cli.openclaw_url).with_native_implementations()
    };

    // Get list of component names before consuming factory
    let component_names: Vec<String> = vec![
        "skill-registry".to_string(),
        "session-manager".to_string(),
        "gateway-bridge".to_string(),
        "provider-router".to_string(),
    ];

    // Register all components in DualRun phase
    let components = factory.create_dualrun_components();
    for component in components {
        harness.register_component(component);
    }

    // Run tests
    let mut results = Vec::new();

    if let Some(component_name) = &cli.component {
        // Test specific component
        info!("Testing component: {}", component_name);
        let result = test_component(&harness, component_name, cli.iterations).await?;
        results.push((component_name.clone(), result));
    } else if cli.all_components {
        // Test all components
        for name in &component_names {
            info!("Testing component: {}", name);
            let result = test_component(&harness, name, cli.iterations).await?;
            results.push((name.clone(), result));
            sleep(Duration::from_millis(100)).await;
        }
    } else {
        // Test skill-registry by default
        info!("Testing default component: skill-registry");
        let result = test_component(&harness, "skill-registry", cli.iterations).await?;
        results.push(("skill-registry".to_string(), result));
    }

    // Print results
    info!("");
    info!("╔════════════════════════════════════════════════════════════╗");
    info!("║                    TEST RESULTS                            ║");
    info!("╚════════════════════════════════════════════════════════════╝");
    info!("");

    let mut all_passed = true;
    let mut total_parity = 0.0;

    for (name, result) in &results {
        let parity_pct = result.parity_percentage;
        total_parity += parity_pct;
        let status = if parity_pct >= cli.min_parity {
            "✅ PASS"
        } else {
            all_passed = false;
            "❌ FAIL"
        };

        info!("  {} - {}: {:.1}% parity", status, name, parity_pct);

        if !result.differences.is_empty() {
            info!("    Differences:");
            for diff in &result.differences {
                info!(
                    "      - {}: expected {:?}, got {:?}",
                    diff.path, diff.expected, diff.actual
                );
            }
        }
    }

    let avg_parity = total_parity / results.len() as f64;

    info!("");
    info!("Average parity: {:.1}%", avg_parity);
    info!("Min required: {}%", cli.min_parity);

    if all_passed {
        info!("");
        info!("✅ All components passed parity threshold!");
        info!("Components are ready to move to Graduate phase.");
        Ok(())
    } else {
        info!("");
        info!("❌ Some components failed parity threshold.");
        info!("Review differences and fix native implementations.");
        std::process::exit(1);
    }
}

/// Test result for a component
struct ComponentTestResult {
    parity_percentage: f64,
    differences: Vec<Difference>,
}

struct Difference {
    path: String,
    expected: String,
    actual: String,
}

/// Test a single component
async fn test_component(
    harness: &ParityHarness,
    component_name: &str,
    iterations: usize,
) -> Result<ComponentTestResult> {
    let mut differences = Vec::new();
    let mut matches = 0;
    let mut total = 0;

    // Test cases for each component type
    let test_cases = match component_name {
        "skill-registry" => vec![("skills.list", serde_json::json!({}))],
        "session-manager" => vec![("sessions.list", serde_json::json!({}))],
        "gateway-bridge" => vec![("gateway.status", serde_json::json!({}))],
        "provider-router" => vec![("providers.list", serde_json::json!({}))],
        _ => vec![],
    };

    for _ in 0..iterations {
        for (method, params) in &test_cases {
            let input = ComponentInput {
                data: serde_json::json!({
                    "method": method,
                    "params": params,
                }),
                context: serde_json::json!({
                    "source": "dualrun-test",
                    "component": component_name,
                }),
            };

            match harness.run_parity_test(component_name, input).await {
                Ok(result) => {
                    total += 1;
                    if result.passed {
                        matches += 1;
                    } else if let Some(parity) = result.parity_result {
                        for diff in &parity.differences {
                            differences.push(Difference {
                                path: diff.path.clone(),
                                expected: format!("{:?}", diff.expected),
                                actual: format!("{:?}", diff.actual),
                            });
                        }
                    }
                }
                Err(e) => {
                    warn!("Test failed for {}: {}", component_name, e);
                }
            }
        }
    }

    let parity_percentage = if total > 0 {
        (matches as f64 / total as f64) * 100.0
    } else {
        0.0
    };

    Ok(ComponentTestResult {
        parity_percentage,
        differences,
    })
}
