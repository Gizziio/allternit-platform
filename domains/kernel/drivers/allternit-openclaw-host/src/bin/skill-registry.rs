//! Skill Registry CLI - OC-006
//!
//! CLI tool for managing the skill metadata bridge between OpenClaw and A2R.
//!
//! ## Usage
//!
//! ```bash
//! # List all skills from OpenClaw vendor directory
//! skill-registry list --vendor-dir 3-adapters/vendor/openclaw/skills
//!
//! # Show skill details
//! skill-registry show github --vendor-dir 3-adapters/vendor/openclaw/skills
//!
//! # Check skill availability
//! skill-registry check --vendor-dir 3-adapters/vendor/openclaw/skills
//! ```

use a2r_openclaw_host::skills::SkillRegistry;
use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "skill-registry")]
#[command(about = "OpenClaw/A2R Skill Metadata Bridge")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// List all skills
    List {
        /// Path to OpenClaw vendor skills directory
        #[arg(short, long)]
        vendor_dir: PathBuf,
    },
    /// Show details for a specific skill
    Show {
        /// Skill ID
        id: String,
        /// Path to OpenClaw vendor skills directory
        #[arg(short, long)]
        vendor_dir: PathBuf,
    },
    /// Check skill availability
    Check {
        /// Path to OpenClaw vendor skills directory
        #[arg(short, long)]
        vendor_dir: PathBuf,
    },
    /// Show registry statistics
    Stats {
        /// Path to OpenClaw vendor skills directory
        #[arg(short, long)]
        vendor_dir: PathBuf,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::List { vendor_dir } => {
            let mut registry = SkillRegistry::new();

            if vendor_dir.exists() {
                let count = registry
                    .load_openclaw_skills(&vendor_dir)
                    .context("Failed to load OpenClaw skills")?;
                println!("✓ Loaded {} skills from {}", count, vendor_dir.display());
            } else {
                println!("⚠ Vendor directory not found: {}", vendor_dir.display());
            }

            let skills = registry.list_skills();

            if skills.is_empty() {
                println!("  No skills found");
            } else {
                println!(
                    "\n  {:<20} {:<15} {:<12}",
                    "Skill ID", "Availability", "Bridge"
                );
                println!("  {}", "─".repeat(60));

                for skill in skills {
                    let availability = format!("{:?}", skill.availability);
                    let bridge = if skill.bridge_active { "🌉" } else { "─" };
                    let native = if skill.native_implemented {
                        "🏠"
                    } else {
                        "─"
                    };

                    println!(
                        "  {:<20} {:<15} {}{}",
                        skill.id, availability, bridge, native
                    );
                }
            }
        }

        Commands::Show { id, vendor_dir } => {
            let mut registry = SkillRegistry::new();

            if vendor_dir.exists() {
                registry
                    .load_openclaw_skills(&vendor_dir)
                    .context("Failed to load OpenClaw skills")?;
            }

            match registry.get_skill(&id) {
                Some(skill) => {
                    println!("Skill: {}", skill.id);
                    println!("{}", "─".repeat(40));
                    println!("  Name:        {}", skill.manifest.name);
                    println!("  Description: {}", skill.manifest.description);
                    println!("  Availability: {:?}", skill.availability);
                    println!(
                        "  Native:      {}",
                        if skill.native_implemented {
                            "✓"
                        } else {
                            "✗"
                        }
                    );
                    println!(
                        "  Bridge:      {}",
                        if skill.bridge_active { "✓" } else { "✗" }
                    );
                }
                None => {
                    println!("Skill '{}' not found", id);
                }
            }
        }

        Commands::Check { vendor_dir } => {
            let mut registry = SkillRegistry::new();

            if vendor_dir.exists() {
                registry
                    .load_openclaw_skills(&vendor_dir)
                    .context("Failed to load OpenClaw skills")?;
            }

            let skills = registry.list_skills();
            let available: Vec<_> = skills
                .iter()
                .filter(|s| {
                    matches!(
                        s.availability,
                        a2r_openclaw_host::skills::registry::SkillAvailability::Available
                    )
                })
                .collect();
            let partial: Vec<_> = skills
                .iter()
                .filter(|s| {
                    matches!(
                        s.availability,
                        a2r_openclaw_host::skills::registry::SkillAvailability::Partial
                    )
                })
                .collect();
            let unavailable: Vec<_> = skills
                .iter()
                .filter(|s| {
                    matches!(
                        s.availability,
                        a2r_openclaw_host::skills::registry::SkillAvailability::Unavailable
                    )
                })
                .collect();

            println!("Skill Availability Check");
            println!("{}", "─".repeat(40));
            println!("  Available:   {}", available.len());
            println!("  Partial:     {}", partial.len());
            println!("  Unavailable: {}", unavailable.len());
            println!("  Total:       {}", skills.len());

            if !unavailable.is_empty() {
                println!("\nUnavailable skills:");
                for skill in unavailable {
                    println!("  - {}", skill.id);
                }
            }
        }

        Commands::Stats { vendor_dir } => {
            let mut registry = SkillRegistry::new();

            if vendor_dir.exists() {
                registry
                    .load_openclaw_skills(&vendor_dir)
                    .context("Failed to load OpenClaw skills")?;
            }

            let stats = registry.stats();

            println!("Skill Registry Statistics");
            println!("{}", "─".repeat(40));
            println!("  OpenClaw skills: {}", stats.openclaw_count);
            println!("  Native skills:   {}", stats.native_count);
            println!("  Bridge skills:   {}", stats.bridge_count);
        }
    }

    Ok(())
}
