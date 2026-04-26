//! Feature Flag Control Tool
//!
//! Manage Phase 3 (Graduate) feature flags for OpenClaw strangler migration.
//!
//! Usage:
//!   cargo run --bin flagctl -- [COMMAND] [OPTIONS]
//!
//! Commands:
//!   status              Show current feature flag status
//!   graduate            Graduate a component to native primary
//!   rollback            Rollback a component to OpenClaw primary
//!   canary              Set canary traffic split
//!   parity              Update parity measurement
//!   ready               List components ready to graduate

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use tracing::{info, Level};

use allternit_openclaw_host::feature_flags::{
    global_registry, ComponentFeatureFlag, FeatureFlagRegistry,
};

/// Feature flag control for OpenClaw strangler migration
#[derive(Parser)]
#[command(name = "flagctl")]
#[command(about = "Control feature flags for OpenClaw strangler migration")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Verbose output
    #[arg(short, long, global = true)]
    verbose: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Show feature flag status
    Status {
        /// Component name (shows all if not specified)
        component: Option<String>,
    },

    /// Graduate a component to native primary
    Graduate {
        /// Component name
        component: String,

        /// User making the change
        #[arg(short, long, default_value = "admin")]
        user: String,
    },

    /// Rollback a component to OpenClaw primary
    Rollback {
        /// Component name
        component: String,

        /// User making the change
        #[arg(short, long, default_value = "admin")]
        user: String,
    },

    /// Set canary traffic split
    Canary {
        /// Component name
        component: String,

        /// Percentage of traffic to route to native (0-100)
        #[arg(short, long)]
        percent: u8,

        /// User making the change
        #[arg(short, long, default_value = "admin")]
        user: String,
    },

    /// Update parity measurement
    Parity {
        /// Component name
        component: String,

        /// Measured parity percentage
        #[arg(short, long)]
        value: f64,
    },

    /// List components ready to graduate
    Ready,

    /// Initialize all components to a phase
    Init {
        /// Phase to initialize to
        #[arg(short, long, default_value = "quarantine")]
        phase: String,
    },

    /// Export feature flags to JSON
    Export {
        /// Output file path
        #[arg(short, long)]
        output: Option<String>,
    },
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

    match cli.command {
        Commands::Status { component } => {
            show_status(registry, component).await?;
        }
        Commands::Graduate { component, user } => {
            graduate_component(registry, &component, &user).await?;
        }
        Commands::Rollback { component, user } => {
            rollback_component(registry, &component, &user).await?;
        }
        Commands::Canary {
            component,
            percent,
            user,
        } => {
            set_canary(registry, &component, percent, &user).await?;
        }
        Commands::Parity { component, value } => {
            update_parity(registry, &component, value).await?;
        }
        Commands::Ready => {
            list_ready(registry).await?;
        }
        Commands::Init { phase } => {
            initialize_phase(registry, &phase).await?;
        }
        Commands::Export { output } => {
            export_flags(registry, output).await?;
        }
    }

    Ok(())
}

async fn show_status(registry: &FeatureFlagRegistry, component: Option<String>) -> Result<()> {
    info!("╔════════════════════════════════════════════════════════════╗");
    info!("║              FEATURE FLAG STATUS                           ║");
    info!("╚════════════════════════════════════════════════════════════╝");
    info!("");

    if let Some(name) = component {
        if let Some(flag) = registry.get(&name) {
            print_flag(&flag);
        } else {
            info!("Component '{}' not found", name);
        }
    } else {
        let flags = registry.list_all();
        for flag in flags {
            print_flag(&flag);
            info!("");
        }
    }

    Ok(())
}

fn print_flag(flag: &ComponentFeatureFlag) {
    let phase = if flag.native_primary && flag.native_traffic_percent == 100 {
        if flag.fallback_on_error {
            "Graduate"
        } else {
            "Complete"
        }
    } else if flag.native_traffic_percent == 0 {
        if flag.native_primary {
            "Bridge"
        } else {
            "Quarantine"
        }
    } else {
        "DualRun"
    };

    let status = if flag.native_primary {
        "🟢 NATIVE PRIMARY"
    } else {
        "🔵 OPENCCLAW PRIMARY"
    };

    info!("📦 {} - {} ({})", flag.component, phase, status);
    info!(
        "   Traffic Split: {}% native / {}% OpenClaw",
        flag.native_traffic_percent,
        100 - flag.native_traffic_percent
    );
    info!(
        "   Fallback on Error: {}",
        if flag.fallback_on_error { "Yes" } else { "No" }
    );

    if let Some(parity) = flag.current_parity_percent {
        let parity_status = if flag.can_graduate() { "✅" } else { "❌" };
        info!(
            "   Parity: {:.1}% {} (min: {:.1}%)",
            parity, parity_status, flag.min_parity_percent
        );
    } else {
        info!(
            "   Parity: Not measured (min: {:.1}%)",
            flag.min_parity_percent
        );
    }

    info!(
        "   Last Updated: {} by {}",
        flag.last_updated, flag.updated_by
    );
    info!("   Notes: {}", flag.notes);
}

async fn graduate_component(
    registry: &FeatureFlagRegistry,
    component: &str,
    user: &str,
) -> Result<()> {
    info!("Graduating component '{}' to native primary...", component);

    // Check if we have parity data
    if let Some(flag) = registry.get(component) {
        if let Some(parity) = flag.current_parity_percent {
            if parity < flag.min_parity_percent {
                info!(
                    "⚠️  Warning: Parity ({:.1}%) is below minimum ({:.1}%)",
                    parity, flag.min_parity_percent
                );
                info!("Use --force to graduate anyway (not implemented)");
                return Ok(());
            }
        } else {
            info!("⚠️  Warning: No parity data available");
        }
    }

    registry
        .graduate_component(component, user)
        .context("Failed to graduate component")?;

    info!("✅ Component '{}' graduated successfully", component);
    info!("   Native is now primary with fallback enabled");

    Ok(())
}

async fn rollback_component(
    registry: &FeatureFlagRegistry,
    component: &str,
    user: &str,
) -> Result<()> {
    info!(
        "Rolling back component '{}' to OpenClaw primary...",
        component
    );

    registry
        .rollback_component(component, user)
        .context("Failed to rollback component")?;

    info!("✅ Component '{}' rolled back successfully", component);
    info!("   OpenClaw is now primary");

    Ok(())
}

async fn set_canary(
    registry: &FeatureFlagRegistry,
    component: &str,
    percent: u8,
    user: &str,
) -> Result<()> {
    let percent = percent.min(100);

    info!(
        "Setting canary for '{}' to {}% native traffic...",
        component, percent
    );

    registry
        .set_canary(component, percent, user)
        .context("Failed to set canary")?;

    info!("✅ Canary set successfully");
    info!(
        "   {}% of traffic will route to native implementation",
        percent
    );

    Ok(())
}

async fn update_parity(registry: &FeatureFlagRegistry, component: &str, value: f64) -> Result<()> {
    info!("Updating parity for '{}' to {:.1}%...", component, value);

    registry
        .update(component, |flag| {
            flag.update_parity(value);
        })
        .context("Failed to update parity")?;

    let can_graduate = registry
        .get(component)
        .map(|f| f.can_graduate())
        .unwrap_or(false);

    if can_graduate {
        info!("✅ Parity updated - component is ready to graduate!");
    } else {
        info!("⚠️  Parity updated - still below graduation threshold");
    }

    Ok(())
}

async fn list_ready(registry: &FeatureFlagRegistry) -> Result<()> {
    info!("╔════════════════════════════════════════════════════════════╗");
    info!("║          COMPONENTS READY TO GRADUATE                      ║");
    info!("╚════════════════════════════════════════════════════════════╝");
    info!("");

    let ready = registry.ready_to_graduate();

    if ready.is_empty() {
        info!("No components are ready to graduate.");
        info!("");
        info!("To be ready, a component must:");
        info!("  1. Have parity measurement >= minimum threshold");
        info!("  2. Not already be in native primary mode");
    } else {
        for component in ready {
            if let Some(flag) = registry.get(&component) {
                if let Some(parity) = flag.current_parity_percent {
                    info!("  ✅ {} - {:.1}% parity", component, parity);
                }
            }
        }
        info!("");
        info!("Run 'flagctl graduate <component>' to graduate a component.");
    }

    Ok(())
}

async fn initialize_phase(registry: &FeatureFlagRegistry, phase: &str) -> Result<()> {
    info!("Initializing all components to '{}' phase...", phase);

    let components = vec![
        "skill-registry",
        "session-manager",
        "gateway-bridge",
        "provider-router",
    ];

    for component in components {
        let flag = match phase {
            "quarantine" => ComponentFeatureFlag::quarantine(component),
            "bridge" => ComponentFeatureFlag::bridge(component),
            "dualrun" => ComponentFeatureFlag::dualrun(component),
            "graduate" => ComponentFeatureFlag::graduate(component),
            "complete" => ComponentFeatureFlag::complete(component),
            _ => {
                info!("Unknown phase: {}", phase);
                return Ok(());
            }
        };

        registry.set(flag);
        info!("  ✅ {} initialized to {}", component, phase);
    }

    info!("");
    info!("All components initialized to '{}' phase", phase);

    Ok(())
}

async fn export_flags(registry: &FeatureFlagRegistry, output: Option<String>) -> Result<()> {
    let flags = registry.list_all();
    let json = serde_json::to_string_pretty(&flags)?;

    if let Some(path) = output {
        tokio::fs::write(&path, &json).await?;
        info!("Feature flags exported to: {}", path);
    } else {
        println!("{}", json);
    }

    Ok(())
}
