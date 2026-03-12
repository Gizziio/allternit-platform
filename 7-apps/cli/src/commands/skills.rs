//! Skills commands
//!
//! Provides commands for managing installed skills and marketplace.

use anyhow::Result;
use clap::{Args, Subcommand};
use colored::Colorize;
use serde::Deserialize;
use std::io::{self, Write};

use crate::client::KernelClient;

/// Skills command arguments
#[derive(Args, Debug, Clone)]
pub struct SkillsArgs {
    #[command(subcommand)]
    pub command: Option<SkillsCommands>,
}

/// Skills subcommands
#[derive(Subcommand, Debug, Clone)]
pub enum SkillsCommands {
    /// List installed skills
    #[command(visible_alias = "ls")]
    List {
        /// Filter by category
        #[arg(short, long)]
        category: Option<String>,
        /// Show only enabled skills
        #[arg(short, long)]
        enabled: bool,
    },
    
    /// Search skills marketplace
    Search {
        /// Search query
        query: String,
        /// Filter by category
        #[arg(short, long)]
        category: Option<String>,
        /// Limit results
        #[arg(short, long, default_value = "20")]
        limit: usize,
    },
    
    /// Install a skill from marketplace
    Install {
        /// Skill ID or name
        id: String,
        /// Specific version to install
        #[arg(short, long)]
        version: Option<String>,
        /// Force reinstall if already installed
        #[arg(short, long)]
        force: bool,
    },
    
    /// Uninstall a skill
    #[command(visible_alias = "remove")]
    Uninstall {
        /// Skill ID
        id: String,
        /// Skip confirmation
        #[arg(short, long)]
        yes: bool,
    },
    
    /// Show skill information
    #[command(visible_alias = "info")]
    Info {
        /// Skill ID
        id: String,
        /// Show detailed configuration
        #[arg(short, long)]
        detailed: bool,
    },
}

/// Installed skill summary
#[derive(Debug, Deserialize)]
struct InstalledSkill {
    id: String,
    name: String,
    description: Option<String>,
    version: String,
    category: Option<String>,
    enabled: bool,
    #[serde(rename = "installed_at")]
    installed_at: String,
    #[serde(rename = "publisher_id")]
    publisher_id: Option<String>,
}

/// Marketplace skill
#[derive(Debug, Deserialize)]
struct MarketplaceSkill {
    id: String,
    name: String,
    description: Option<String>,
    version: String,
    category: Option<String>,
    #[serde(rename = "download_count")]
    download_count: Option<i64>,
    rating: Option<f64>,
    #[serde(rename = "publisher_name")]
    publisher_name: Option<String>,
    #[serde(rename = "is_installed")]
    is_installed: Option<bool>,
}

/// Skill details
#[derive(Debug, Deserialize)]
struct SkillDetails {
    id: String,
    name: String,
    description: Option<String>,
    version: String,
    category: Option<String>,
    enabled: bool,
    #[serde(rename = "installed_at")]
    installed_at: String,
    #[serde(rename = "publisher_id")]
    publisher_id: Option<String>,
    #[serde(rename = "publisher_name")]
    publisher_name: Option<String>,
    config: Option<serde_json::Value>,
    permissions: Option<Vec<String>>,
    #[serde(rename = "required_capabilities")]
    required_capabilities: Option<Vec<String>>,
    metadata: Option<serde_json::Value>,
}

/// Handler for skills args (wrapper for main entry point)
pub async fn handle_skills_args(args: SkillsArgs, client: &KernelClient) -> Result<()> {
    if let Some(command) = args.command {
        handle_skills(command, client).await
    } else {
        // Default to list if no subcommand
        handle_skills(SkillsCommands::List { category: None, enabled: false }, client).await
    }
}

/// Main handler for skills commands
pub async fn handle_skills(command: SkillsCommands, client: &KernelClient) -> Result<()> {
    match command {
        SkillsCommands::List { category, enabled } => {
            list_skills(client, category, enabled).await
        }
        SkillsCommands::Search { query, category, limit } => {
            search_skills(client, &query, category, limit).await
        }
        SkillsCommands::Install { id, version, force } => {
            install_skill(client, &id, version, force).await
        }
        SkillsCommands::Uninstall { id, yes } => {
            uninstall_skill(client, &id, yes).await
        }
        SkillsCommands::Info { id, detailed } => {
            show_skill_info(client, &id, detailed).await
        }
    }
}

/// List installed skills
async fn list_skills(
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
        "/api/v1/skills".to_string()
    } else {
        format!("/api/v1/skills?{}", params.join("&"))
    };
    
    let skills: Vec<InstalledSkill> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to fetch skills: {}", e))?;
    
    if skills.is_empty() {
        println!("{}", "No skills installed".yellow());
        println!("\nUse '{}' to find skills to install", "a2r skills search <query>".cyan());
        return Ok(());
    }
    
    // Print header
    println!("{:<36} {:<25} {:<12} {:<10} {:<15}",
        "ID", "NAME", "VERSION", "STATUS", "CATEGORY");
    println!("{}", "-".repeat(105));
    
    // Print skills
    for skill in &skills {
        let status = if skill.enabled {
            "● enabled".green()
        } else {
            "○ disabled".dimmed()
        };
        
        let category = skill.category.as_deref().unwrap_or("-");
        
        println!("{:<36} {:<25} {:<12} {:<10} {:<15}",
            &skill.id[..8.min(skill.id.len())],
            truncate(&skill.name, 25),
            skill.version,
            status,
            category
        );
        
        if let Some(desc) = &skill.description {
            println!("  {}", desc.dimmed());
        }
    }
    
    println!("\nShowing {} skill(s)", skills.len());
    
    Ok(())
}

/// Search skills marketplace
async fn search_skills(
    client: &KernelClient,
    query: &str,
    category: Option<String>,
    limit: usize,
) -> Result<()> {
    // Build query parameters
    let mut params = vec![format!("q={}", urlencoding::encode(query))];
    if let Some(c) = category {
        params.push(format!("category={}", c));
    }
    params.push(format!("limit={}", limit));
    
    let path = format!("/api/v1/skills/marketplace?{}", params.join("&"));
    
    let skills: Vec<MarketplaceSkill> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to search skills: {}", e))?;
    
    if skills.is_empty() {
        println!("{}", format!("No skills found for '{}'", query).yellow());
        return Ok(());
    }
    
    println!("{} {}", "Search results for:".bold(), query.cyan());
    println!();
    
    // Print header
    println!("{:<36} {:<25} {:<12} {:<12} {:<15}",
        "ID", "NAME", "VERSION", "RATING", "CATEGORY");
    println!("{}", "-".repeat(105));
    
    // Print skills
    for skill in &skills {
        let rating_str = skill.rating.map(|r| format!("{:.1}★", r)).unwrap_or_else(|| "-".to_string());
        let category = skill.category.as_deref().unwrap_or("-");
        
        let installed_marker = if skill.is_installed.unwrap_or(false) {
            " ✓".green()
        } else {
            "".normal()
        };
        
        println!("{:<36} {:<25} {:<12} {:<12} {:<15}{}",
            &skill.id[..8.min(skill.id.len())],
            truncate(&skill.name, 25),
            skill.version,
            rating_str,
            category,
            installed_marker
        );
        
        if let Some(desc) = &skill.description {
            println!("  {}", desc.dimmed());
        }
        
        if let Some(publisher) = &skill.publisher_name {
            let downloads = skill.download_count.unwrap_or(0);
            println!("  By {} • {} downloads", publisher, downloads);
        }
    }
    
    println!("\nShowing {} result(s)", skills.len());
    println!("\nUse '{}' to install a skill", "a2r skills install <id>".cyan());
    
    Ok(())
}

/// Install a skill
async fn install_skill(
    client: &KernelClient,
    id: &str,
    version: Option<String>,
    force: bool,
) -> Result<()> {
    println!("Installing skill '{}'...", id.cyan());
    
    let body = serde_json::json!({
        "skill_id": id,
        "version": version,
        "force": force,
    });
    
    let result: serde_json::Value = client.post("/api/v1/skills/install", &body).await
        .map_err(|e| anyhow::anyhow!("Failed to install skill: {}", e))?;
    
    if let Some(name) = result.get("name").and_then(|n| n.as_str()) {
        println!("{} Skill '{}' installed successfully", "✅".green(), name);
    } else {
        println!("{} Skill installed successfully", "✅".green());
    }
    
    if let Some(version) = result.get("version").and_then(|v| v.as_str()) {
        println!("   Version: {}", version);
    }
    
    if let Some(warnings) = result.get("warnings").and_then(|w| w.as_array()) {
        if !warnings.is_empty() {
            println!("\n{}:", "Warnings".yellow());
            for warning in warnings {
                if let Some(msg) = warning.as_str() {
                    println!("  • {}", msg);
                }
            }
        }
    }
    
    Ok(())
}

/// Uninstall a skill
async fn uninstall_skill(client: &KernelClient, id: &str, yes: bool) -> Result<()> {
    if !yes {
        print!("Are you sure you want to uninstall skill {}? [y/N] ", &id[..8.min(id.len())]);
        io::stdout().flush()?;
        
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("Cancelled");
            return Ok(());
        }
    }
    
    let path = format!("/api/v1/skills/{}", id);
    client.delete(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to uninstall skill: {}", e))?;
    
    println!("{} Skill uninstalled", "✅".green());
    Ok(())
}

/// Show skill information
async fn show_skill_info(client: &KernelClient, id: &str, detailed: bool) -> Result<()> {
    let path = format!("/api/v1/skills/{}", id);
    let skill: SkillDetails = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to get skill info: {}", e))?;
    
    println!("{}", skill.name.bold().underline());
    println!("{}: {}", "ID".bold(), skill.id);
    
    if let Some(desc) = skill.description {
        println!("{}: {}", "Description".bold(), desc);
    }
    
    println!("{}: {}", "Version".bold(), skill.version);
    
    if let Some(category) = skill.category {
        println!("{}: {}", "Category".bold(), category);
    }
    
    if skill.enabled {
        println!("{}: {}", "Status".bold(), "enabled".green());
    } else {
        println!("{}: {}", "Status".bold(), "disabled".dimmed());
    }
    
    println!("{}: {}", "Installed".bold(), skill.installed_at);
    
    if let Some(publisher) = skill.publisher_name {
        println!("{}: {}", "Publisher".bold(), publisher);
    }
    
    if detailed {
        if let Some(permissions) = skill.permissions {
            if !permissions.is_empty() {
                println!("\n{}:", "Permissions".bold());
                for perm in permissions {
                    println!("  • {}", perm);
                }
            }
        }
        
        if let Some(capabilities) = skill.required_capabilities {
            if !capabilities.is_empty() {
                println!("\n{}:", "Required Capabilities".bold());
                for cap in capabilities {
                    println!("  • {}", cap);
                }
            }
        }
        
        if let Some(config) = skill.config {
            println!("\n{}:", "Configuration".bold());
            println!("{}", serde_json::to_string_pretty(&config).unwrap_or_default());
        }
        
        if let Some(metadata) = skill.metadata {
            println!("\n{}:", "Metadata".bold());
            println!("{}", serde_json::to_string_pretty(&metadata).unwrap_or_default());
        }
    } else {
        println!("\nUse '{}' for detailed information", 
            format!("a2r skills info {} --detailed", id).cyan());
    }
    
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
