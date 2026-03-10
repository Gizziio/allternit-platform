//! Autoland Command
//!
//! Handles autonomous implementation landing.

use anyhow::{anyhow, Result};
use clap::{Args, Subcommand};
use serde_json::json;

use crate::client::KernelClient;

#[derive(Args, Debug)]
pub struct AutolandArgs {
    #[command(subcommand)]
    pub command: AutolandSubcommands,
}

#[derive(Subcommand, Debug)]
pub enum AutolandSubcommands {
    /// Land a completed WIH (Implementation Run)
    Land {
        /// The WIH ID to land
        wih_id: String,
        /// Simulation mode - show impact without applying changes
        #[arg(long, default_value_t = false)]
        dry_run: bool,
        /// Automatically commit the changes to Git
        #[arg(long, default_value_t = false)]
        commit: bool,
    },
    /// Rollback a landed implementation
    Rollback {
        /// The WIH ID to rollback
        wih_id: String,
    },
    /// View Proof of Work for a run
    Pow {
        /// The run/WIH ID
        run_id: String,
    },
}

pub async fn handle_autoland_args(args: AutolandArgs, client: &KernelClient) -> Result<()> {
    match args.command {
        AutolandSubcommands::Rollback { wih_id } => {
            println!("🛡️  Rolling back WIH: {}...", wih_id);
            let payload = json!({ "wih_id": wih_id });
            
            let response = client
                .post::<serde_json::Value, serde_json::Value>("/api/v1/rails/gate/rollback", &payload)
                .await
                .map_err(|e| anyhow!(e))?;
                
            if response["result"]["success"].as_bool().unwrap_or(false) {
                println!("✅ Successfully rolled back WIH {}", wih_id);
            } else {
                println!("❌ Rollback failed for WIH {}: {:?}", wih_id, response);
            }
        }
        AutolandSubcommands::Land { wih_id, dry_run, commit } => {
            if dry_run {
                println!("🔍 [DRY RUN] Simulating autoland for WIH: {}...", wih_id);
            } else {
                println!("🚀 Autolanding WIH: {}...", wih_id);
            }
            
            let payload = json!({ "wih_id": wih_id, "dry_run": dry_run, "git_commit": commit });
            
            // Call the Rails Autoland endpoint via the API
            let response = client
                .post::<serde_json::Value, serde_json::Value>("/api/v1/rails/gate/autoland", &payload)
                .await
                .map_err(|e| anyhow!(e))?;
                
            let result = &response["result"];
            let success = result["success"].as_bool().unwrap_or(false);
            let impact = &result["impact"];

            if success || dry_run {
                if dry_run {
                    println!("✅ Dry run complete. Impact assessment:");
                } else {
                    println!("✅ Successfully landed implementation for WIH {}", wih_id);
                    println!("📁 Implementation Impact Report:");
                }

                if let Some(added) = impact["added"].as_array() {
                    if !added.is_empty() {
                        println!("  [+] Added {} files:", added.len());
                        for f in added.iter().take(5) {
                            println!("      - {}", f.as_str().unwrap_or("?"));
                        }
                        if added.len() > 5 { println!("      ... and {} more", added.len() - 5); }
                    }
                }

                if let Some(modified) = impact["modified"].as_array() {
                    if !modified.is_empty() {
                        println!("  [*] Modified {} files:", modified.len());
                        for f in modified.iter().take(5) {
                            println!("      - {}", f.as_str().unwrap_or("?"));
                        }
                        if modified.len() > 5 { println!("      ... and {} more", modified.len() - 5); }
                    }
                }

                if !dry_run {
                    if let Some(backup) = result["backup_dir"].as_str() {
                        println!("🛡️  Atomic rollback backup created at: {}", backup);
                    }
                }
            } else {
                println!("❌ Autoland failed for WIH {}: {:?}", wih_id, response);
            }
        }
        AutolandSubcommands::Pow { run_id } => {
            println!("🎥 Fetching Proof of Work for run: {}...", run_id);
            
            let response = client
                .get::<serde_json::Value>(&format!("/api/v1/operator/autoland/{}/proof_of_work", run_id))
                .await
                .map_err(|e| anyhow!(e))?;
                
            let events = response["events"].as_array();
            match events {
                Some(evs) => {
                    println!("Found {} events in Proof of Work log.", evs.len());
                    for ev in evs {
                        let ts = ev["timestamp"].as_str().unwrap_or("unknown");
                        let r#type = ev["type"].as_str().unwrap_or("unknown");
                        println!("[{}] {}", ts, r#type);
                        if let Some(payload) = ev.get("payload") {
                            if let Some(msg) = payload.get("message") {
                                println!("  > {}", msg);
                            } else if let Some(text) = payload.get("text") {
                                println!("  > {}", text);
                            }
                        }
                    }
                }
                None => println!("No events found for run {}", run_id),
            }
        }
    }
    Ok(())
}
