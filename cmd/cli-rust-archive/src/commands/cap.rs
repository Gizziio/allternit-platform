//! Capability (cap) commands
//!
//! Provides commands for managing system capabilities.

use anyhow::Result;
use clap::{Args, Subcommand};
use colored::Colorize;
use serde::Deserialize;

use crate::client::KernelClient;

/// Capability command arguments
#[derive(Args, Debug, Clone)]
pub struct CapArgs {
    #[command(subcommand)]
    pub command: Option<CapCommands>,
}

/// Capability subcommands
#[derive(Subcommand, Debug, Clone)]
pub enum CapCommands {
    /// List all system capabilities
    #[command(visible_alias = "ls")]
    List {
        /// Filter by category
        #[arg(short, long)]
        category: Option<String>,
        /// Show only enabled capabilities
        #[arg(short, long)]
        enabled: bool,
    },
    
    /// Check if capability is available
    Check {
        /// Capability name
        name: String,
    },
    
    /// Enable a capability
    Enable {
        /// Capability name
        name: String,
    },
    
    /// Disable a capability
    Disable {
        /// Capability name
        name: String,
    },
}

/// Capability summary from API
#[derive(Debug, Deserialize)]
struct CapabilitySummary {
    name: String,
    description: Option<String>,
    category: String,
    enabled: bool,
    available: bool,
    #[serde(rename = "required_features")]
    required_features: Option<Vec<String>>,
    #[serde(rename = "installed_version")]
    installed_version: Option<String>,
}

/// Capability details from API
#[derive(Debug, Deserialize)]
struct CapabilityDetails {
    name: String,
    description: Option<String>,
    category: String,
    enabled: bool,
    available: bool,
    #[serde(rename = "required_features")]
    required_features: Option<Vec<String>>,
    #[serde(rename = "missing_features")]
    missing_features: Option<Vec<String>>,
    #[serde(rename = "installed_version")]
    installed_version: Option<String>,
    #[serde(rename = "latest_version")]
    latest_version: Option<String>,
    config: Option<serde_json::Value>,
    metadata: Option<serde_json::Value>,
}

/// Handler for capability args (wrapper for main entry point)
pub async fn handle_cap_args(args: CapArgs, client: &KernelClient) -> Result<()> {
    if let Some(command) = args.command {
        handle_cap(command, client).await
    } else {
        // Default to list if no subcommand
        handle_cap(CapCommands::List { category: None, enabled: false }, client).await
    }
}

/// Main handler for capability commands
pub async fn handle_cap(command: CapCommands, client: &KernelClient) -> Result<()> {
    match command {
        CapCommands::List { category, enabled } => {
            list_capabilities(client, category, enabled).await
        }
        CapCommands::Check { name } => {
            check_capability(client, &name).await
        }
        CapCommands::Enable { name } => {
            enable_capability(client, &name).await
        }
        CapCommands::Disable { name } => {
            disable_capability(client, &name).await
        }
    }
}

/// List capabilities with optional filtering
async fn list_capabilities(
    client: &KernelClient,
    category: Option<String>,
    enabled_only: bool,
) -> Result<()> {
    // Build query parameters
    let mut params = vec![];
    if let Some(c) = category {
        params.push(format!("category={}", c));
    }
    if enabled_only {
        params.push("enabled=true".to_string());
    }
    
    let path = if params.is_empty() {
        "/api/v1/capabilities".to_string()
    } else {
        format!("/api/v1/capabilities?{}", params.join("&"))
    };
    
    let capabilities: Vec<CapabilitySummary> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to fetch capabilities: {}", e))?;
    
    if capabilities.is_empty() {
        println!("{}", "No capabilities found".yellow());
        return Ok(());
    }
    
    // Print header
    println!("{:<30} {:<15} {:<10} {:<12} {:<20}",
        "NAME", "CATEGORY", "STATUS", "AVAILABLE", "VERSION");
    println!("{}", "-".repeat(100));
    
    // Group by category for better readability
    let mut current_category = String::new();
    
    for cap in &capabilities {
        if cap.category != current_category {
            current_category = cap.category.clone();
            println!("{}", current_category.bold().underline());
        }
        
        let status_str = if cap.enabled {
            "● enabled".green()
        } else {
            "○ disabled".dimmed()
        };
        
        let available_str = if cap.available {
            "✓".green()
        } else {
            "✗".red()
        };
        
        let version = cap.installed_version.as_deref().unwrap_or("-");
        
        println!("  {:<28} {:<15} {:<10} {:<12} {:<20}",
            truncate(&cap.name, 28),
            "",
            status_str,
            available_str,
            version
        );
        
        if let Some(desc) = &cap.description {
            println!("    {}", desc.dimmed());
        }
    }
    
    println!("\nShowing {} capability(s)", capabilities.len());
    
    Ok(())
}

/// Check if a capability is available
async fn check_capability(client: &KernelClient, name: &str) -> Result<()> {
    let path = format!("/api/v1/capabilities/{}", name);
    
    match client.get::<CapabilityDetails>(&path).await {
        Ok(cap) => {
            println!("{} {}", "Capability:".bold(), cap.name);
            
            if let Some(desc) = cap.description {
                println!("  {}", desc);
            }
            
            println!("  {}: {}", "Category".bold(), cap.category);
            
            if cap.enabled {
                println!("  {}: {}", "Status".bold(), "enabled".green());
            } else {
                println!("  {}: {}", "Status".bold(), "disabled".dimmed());
            }
            
            if cap.available {
                println!("  {}: {}", "Available".bold(), "✓ Yes".green());
            } else {
                println!("  {}: {}", "Available".bold(), "✗ No".red());
            }
            
            if let Some(version) = cap.installed_version {
                println!("  {}: {}", "Version".bold(), version);
            }
            
            if let Some(features) = cap.required_features {
                if !features.is_empty() {
                    println!("  {}: {}", "Required Features".bold(), features.join(", "));
                }
            }
            
            if let Some(missing) = cap.missing_features {
                if !missing.is_empty() {
                    println!("  {}: {}", "Missing Features".bold(), 
                        missing.iter().map(|f| f.red().to_string()).collect::<Vec<_>>().join(", "));
                }
            }
            
            // Exit with appropriate code for scripting
            if cap.available {
                std::process::exit(0);
            } else {
                std::process::exit(1);
            }
        }
        Err(_) => {
            println!("{} Capability '{}' not found", "✗".red(), name);
            std::process::exit(2);
        }
    }
}

/// Enable a capability
async fn enable_capability(client: &KernelClient, name: &str) -> Result<()> {
    let path = format!("/api/v1/capabilities/{}/enable", name);
    
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to enable capability: {}", e))?;
    
    println!("{} Capability '{}' enabled", "✅".green(), name);
    Ok(())
}

/// Disable a capability
async fn disable_capability(client: &KernelClient, name: &str) -> Result<()> {
    let path = format!("/api/v1/capabilities/{}/disable", name);
    
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to disable capability: {}", e))?;
    
    println!("{} Capability '{}' disabled", "✅".green(), name);
    Ok(())
}

/// Truncate string to max length
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() > max_len {
        format!("{}...", &s[..max_len - 3])
    } else {
        s.to_string()
    }
}
