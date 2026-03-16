//! Evidence (ev) commands
//!
//! Provides commands for managing evidence files in the system.

use anyhow::Result;
use clap::{Args, Subcommand};
use colored::Colorize;
use serde::Deserialize;
use std::io::{self, Write};

use crate::client::KernelClient;

/// Evidence command arguments
#[derive(Args, Debug, Clone)]
pub struct EvArgs {
    #[command(subcommand)]
    pub command: Option<EvCommands>,
}

/// Evidence subcommands
#[derive(Subcommand, Debug, Clone)]
pub enum EvCommands {
    /// List all evidence items
    #[command(visible_alias = "ls")]
    List {
        /// Filter by type
        #[arg(short, long)]
        ev_type: Option<String>,
        /// Filter by status
        #[arg(short, long)]
        status: Option<String>,
        /// Limit number of results
        #[arg(short, long, default_value = "20")]
        limit: usize,
    },
    
    /// Show evidence details
    #[command(visible_alias = "info")]
    Show {
        /// Evidence ID
        id: String,
    },
    
    /// Add new evidence file
    #[command(visible_alias = "add")]
    Add {
        /// File path to add as evidence
        file: String,
        /// Evidence type
        #[arg(short, long)]
        ev_type: Option<String>,
        /// Description
        #[arg(short, long)]
        description: Option<String>,
        /// Tags (comma-separated)
        #[arg(short, long)]
        tags: Option<String>,
    },
    
    /// Delete evidence
    #[command(visible_aliases = ["rm", "remove"])]
    Delete {
        /// Evidence ID
        id: String,
        /// Skip confirmation
        #[arg(short, long)]
        yes: bool,
    },
}

/// Evidence summary from API
#[derive(Debug, Deserialize)]
struct EvidenceSummary {
    id: String,
    #[serde(rename = "ev_type")]
    ev_type: String,
    status: String,
    #[serde(rename = "file_name")]
    file_name: String,
    #[serde(rename = "file_size")]
    file_size: Option<i64>,
    #[serde(rename = "created_at")]
    created_at: String,
    description: Option<String>,
}

/// Evidence details from API
#[derive(Debug, Deserialize)]
struct EvidenceDetails {
    id: String,
    #[serde(rename = "ev_type")]
    ev_type: String,
    status: String,
    #[serde(rename = "file_name")]
    file_name: String,
    #[serde(rename = "file_path")]
    file_path: Option<String>,
    #[serde(rename = "file_size")]
    file_size: Option<i64>,
    #[serde(rename = "file_hash")]
    file_hash: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
    metadata: Option<serde_json::Value>,
    #[serde(rename = "created_at")]
    created_at: String,
    #[serde(rename = "updated_at")]
    updated_at: Option<String>,
    #[serde(rename = "created_by")]
    created_by: Option<String>,
}

/// Handler for evidence args (wrapper for main entry point)
pub async fn handle_ev_args(args: EvArgs, client: &KernelClient) -> Result<()> {
    if let Some(command) = args.command {
        handle_ev(command, client).await
    } else {
        // Default to list if no subcommand
        handle_ev(EvCommands::List { ev_type: None, status: None, limit: 20 }, client).await
    }
}

/// Main handler for evidence commands
pub async fn handle_ev(command: EvCommands, client: &KernelClient) -> Result<()> {
    match command {
        EvCommands::List { ev_type, status, limit } => {
            list_evidence(client, ev_type, status, limit).await
        }
        EvCommands::Show { id } => {
            show_evidence(client, &id).await
        }
        EvCommands::Add { file, ev_type, description, tags } => {
            add_evidence(client, &file, ev_type, description, tags).await
        }
        EvCommands::Delete { id, yes } => {
            delete_evidence(client, &id, yes).await
        }
    }
}

/// List evidence items with optional filtering
async fn list_evidence(
    client: &KernelClient,
    ev_type: Option<String>,
    status: Option<String>,
    limit: usize,
) -> Result<()> {
    // Build query parameters
    let mut params = vec![];
    if let Some(t) = ev_type {
        params.push(format!("type={}", t));
    }
    if let Some(s) = status {
        params.push(format!("status={}", s));
    }
    params.push(format!("limit={}", limit));
    
    let path = if params.is_empty() {
        "/api/v1/evidence".to_string()
    } else {
        format!("/api/v1/evidence?{}", params.join("&"))
    };
    
    let evidence: Vec<EvidenceSummary> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to fetch evidence: {}", e))?;
    
    if evidence.is_empty() {
        println!("{}", "No evidence items found".yellow());
        return Ok(());
    }
    
    // Print header
    println!("{:<36} {:<12} {:<12} {:<20} {:<12} {:<20}",
        "ID", "TYPE", "STATUS", "FILE", "SIZE", "CREATED");
    println!("{}", "-".repeat(120));
    
    // Print evidence items
    for item in &evidence {
        let size_str = item.file_size.map(|s| format_size(s)).unwrap_or_else(|| "-".to_string());
        let created = item.created_at.chars().take(19).collect::<String>();
        
        let status_colored = match item.status.as_str() {
            "verified" => item.status.green(),
            "pending" => item.status.yellow(),
            "rejected" => item.status.red(),
            _ => item.status.normal(),
        };
        
        println!("{:<36} {:<12} {:<12} {:<20} {:<12} {:<20}",
            &item.id[..8.min(item.id.len())],
            item.ev_type,
            status_colored,
            truncate(&item.file_name, 20),
            size_str,
            created
        );
    }
    
    println!("\nShowing {} evidence item(s)", evidence.len());
    
    Ok(())
}

/// Show evidence details
async fn show_evidence(client: &KernelClient, id: &str) -> Result<()> {
    let path = format!("/api/v1/evidence/{}", id);
    let evidence: EvidenceDetails = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to get evidence: {}", e))?;
    
    println!("{}", "Evidence Details".bold().underline());
    println!("{}: {}", "ID".bold(), evidence.id);
    println!("{}: {}", "Type".bold(), evidence.ev_type);
    
    let status_colored = match evidence.status.as_str() {
        "verified" => evidence.status.green(),
        "pending" => evidence.status.yellow(),
        "rejected" => evidence.status.red(),
        _ => evidence.status.normal(),
    };
    println!("{}: {}", "Status".bold(), status_colored);
    
    println!("{}: {}", "File".bold(), evidence.file_name);
    
    if let Some(path) = evidence.file_path {
        println!("{}: {}", "Path".bold(), path);
    }
    
    if let Some(size) = evidence.file_size {
        println!("{}: {}", "Size".bold(), format_size(size));
    }
    
    if let Some(hash) = evidence.file_hash {
        println!("{}: {}", "Hash".bold(), hash);
    }
    
    if let Some(desc) = evidence.description {
        println!("{}: {}", "Description".bold(), desc);
    }
    
    if let Some(tags) = evidence.tags {
        if !tags.is_empty() {
            println!("{}: {}", "Tags".bold(), tags.join(", "));
        }
    }
    
    if let Some(meta) = evidence.metadata {
        println!("{}: {}", "Metadata".bold(), serde_json::to_string_pretty(&meta).unwrap_or_default());
    }
    
    println!("{}: {}", "Created".bold(), evidence.created_at);
    
    if let Some(updated) = evidence.updated_at {
        println!("{}: {}", "Updated".bold(), updated);
    }
    
    if let Some(created_by) = evidence.created_by {
        println!("{}: {}", "Created By".bold(), created_by);
    }
    
    Ok(())
}

/// Add evidence file
async fn add_evidence(
    client: &KernelClient,
    file: &str,
    ev_type: Option<String>,
    description: Option<String>,
    tags: Option<String>,
) -> Result<()> {
    // Check if file exists
    let file_path = std::path::Path::new(file);
    if !file_path.exists() {
        return Err(anyhow::anyhow!("File not found: {}", file));
    }
    
    // Get file metadata
    let metadata = std::fs::metadata(file)?;
    let file_name = file_path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(file);
    
    // Parse tags
    let tag_list: Option<Vec<String>> = tags.map(|t| {
        t.split(',').map(|s| s.trim().to_string()).collect()
    });
    
    // Read file content (base64 encode for transfer)
    let file_content = std::fs::read(file)?;
    let file_base64 = data_encoding::BASE64.encode(&file_content);
    
    let body = serde_json::json!({
        "file_name": file_name,
        "file_data": file_base64,
        "file_size": metadata.len() as i64,
        "ev_type": ev_type.unwrap_or_else(|| "document".to_string()),
        "description": description,
        "tags": tag_list,
    });
    
    let evidence: EvidenceDetails = client.post("/api/v1/evidence", &body).await
        .map_err(|e| anyhow::anyhow!("Failed to add evidence: {}", e))?;
    
    println!("{} Evidence added successfully", "✅".green());
    println!("   ID: {}", evidence.id);
    println!("   File: {}", evidence.file_name);
    println!("   Type: {}", evidence.ev_type);
    
    Ok(())
}

/// Delete evidence
async fn delete_evidence(client: &KernelClient, id: &str, yes: bool) -> Result<()> {
    if !yes {
        print!("Are you sure you want to delete evidence {}? [y/N] ", &id[..8.min(id.len())]);
        io::stdout().flush()?;
        
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("Cancelled");
            return Ok(());
        }
    }
    
    let path = format!("/api/v1/evidence/{}", id);
    client.delete(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to delete evidence: {}", e))?;
    
    println!("{} Evidence deleted", "✅".green());
    Ok(())
}

/// Format file size to human readable
fn format_size(size: i64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = size as f64;
    let mut unit_idx = 0;
    
    while size >= 1024.0 && unit_idx < UNITS.len() - 1 {
        size /= 1024.0;
        unit_idx += 1;
    }
    
    format!("{:.1} {}", size, UNITS[unit_idx])
}

/// Truncate string to max length
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() > max_len {
        format!("{}...", &s[..max_len - 3])
    } else {
        s.to_string()
    }
}
