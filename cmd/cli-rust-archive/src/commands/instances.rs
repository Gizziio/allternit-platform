//! Instance commands
//!
//! Provides commands for managing cloud instances (Hetzner, AWS, etc.).

use anyhow::Result;
use clap::{Args, Subcommand};
use colored::Colorize;
use serde::Deserialize;
use std::io::{self, Write};
use std::process::Command as ProcessCommand;

use crate::client::KernelClient;

/// Instance command arguments
#[derive(Args, Debug, Clone)]
pub struct InstancesArgs {
    #[command(subcommand)]
    pub command: Option<InstanceCommands>,
}

/// Instance subcommands
#[derive(Subcommand, Debug, Clone)]
pub enum InstanceCommands {
    /// List all cloud instances
    #[command(visible_alias = "ls")]
    List {
        /// Filter by provider
        #[arg(short, long)]
        provider: Option<String>,
        /// Filter by status
        #[arg(short, long)]
        status: Option<String>,
        /// Filter by region
        #[arg(short, long)]
        region: Option<String>,
    },
    
    /// Create a new cloud instance
    #[command(visible_alias = "new")]
    Create {
        /// Cloud provider (hetzner, aws, gcp, etc.)
        #[arg(long, default_value = "hetzner")]
        provider: String,
        /// Region/location
        #[arg(long, default_value = "fsn1")]
        region: String,
        /// Instance type/size
        #[arg(long, default_value = "cx21")]
        instance_type: String,
        /// Instance name
        #[arg(short, long)]
        name: Option<String>,
        /// Image/OS to use
        #[arg(long, default_value = "ubuntu-22.04")]
        image: String,
        /// Storage size in GB
        #[arg(long)]
        storage_gb: Option<i32>,
        /// SSH key name (must exist in provider)
        #[arg(long)]
        ssh_key: Option<String>,
        /// Startup script or user data
        #[arg(long)]
        user_data: Option<String>,
        /// Labels/tags (key=value,key2=value2)
        #[arg(long)]
        labels: Option<String>,
        /// Wait for instance to be ready
        #[arg(long)]
        wait: bool,
    },
    
    /// Show instance details
    #[command(visible_alias = "info")]
    Show {
        /// Instance ID
        id: String,
    },
    
    /// Destroy an instance
    #[command(visible_aliases = ["delete", "rm", "remove"])]
    Destroy {
        /// Instance ID
        id: String,
        /// Skip confirmation
        #[arg(short, long)]
        yes: bool,
        /// Force destroy (ignore errors)
        #[arg(short, long)]
        force: bool,
    },
    
    /// SSH into an instance
    Ssh {
        /// Instance ID
        id: String,
        /// SSH user (default depends on image)
        #[arg(short, long)]
        user: Option<String>,
        /// SSH port
        #[arg(short, long, default_value = "22")]
        port: u16,
        /// SSH private key file
        #[arg(short, long)]
        identity_file: Option<String>,
        /// Additional SSH options
        #[arg(last = true)]
        args: Vec<String>,
    },
    
    /// Start a stopped instance
    Start {
        /// Instance ID
        id: String,
    },
    
    /// Stop a running instance
    Stop {
        /// Instance ID
        id: String,
    },
    
    /// Reboot an instance
    Reboot {
        /// Instance ID
        id: String,
    },
}

/// Instance summary from API
#[derive(Debug, Deserialize)]
struct InstanceSummary {
    id: String,
    name: String,
    provider: String,
    region: String,
    #[serde(rename = "instance_type")]
    instance_type: String,
    status: String,
    #[serde(rename = "public_ip")]
    public_ip: Option<String>,
    #[serde(rename = "private_ip")]
    private_ip: Option<String>,
    #[serde(rename = "created_at")]
    created_at: String,
    #[serde(rename = "running_since")]
    running_since: Option<String>,
    labels: Option<serde_json::Value>,
}

/// Instance details from API
#[derive(Debug, Deserialize)]
struct InstanceDetails {
    id: String,
    name: String,
    provider: String,
    region: String,
    #[serde(rename = "instance_type")]
    instance_type: String,
    status: String,
    image: String,
    #[serde(rename = "public_ip")]
    public_ip: Option<String>,
    #[serde(rename = "private_ip")]
    private_ip: Option<String>,
    #[serde(rename = "ssh_port")]
    ssh_port: Option<u16>,
    #[serde(rename = "ssh_user")]
    ssh_user: Option<String>,
    #[serde(rename = "storage_gb")]
    storage_gb: i32,
    #[serde(rename = "memory_mb")]
    memory_mb: Option<i32>,
    cpus: Option<i32>,
    #[serde(rename = "created_at")]
    created_at: String,
    #[serde(rename = "started_at")]
    started_at: Option<String>,
    #[serde(rename = "terminated_at")]
    terminated_at: Option<String>,
    labels: Option<serde_json::Value>,
    metadata: Option<serde_json::Value>,
}

/// Handler for instance args (wrapper for main entry point)
pub async fn handle_instances_args(args: InstancesArgs, client: &KernelClient) -> Result<()> {
    if let Some(command) = args.command {
        handle_instances(command, client).await
    } else {
        // Default to list if no subcommand
        handle_instances(InstanceCommands::List { provider: None, status: None, region: None }, client).await
    }
}

/// Main handler for instance commands
pub async fn handle_instances(command: InstanceCommands, client: &KernelClient) -> Result<()> {
    match command {
        InstanceCommands::List { provider, status, region } => {
            list_instances(client, provider, status, region).await
        }
        InstanceCommands::Create { 
            provider, region, instance_type, name, image, 
            storage_gb, ssh_key, user_data, labels, wait 
        } => {
            create_instance(
                client, provider, region, instance_type, name, 
                image, storage_gb, ssh_key, user_data, labels, wait
            ).await
        }
        InstanceCommands::Show { id } => {
            show_instance(client, &id).await
        }
        InstanceCommands::Destroy { id, yes, force } => {
            destroy_instance(client, &id, yes, force).await
        }
        InstanceCommands::Ssh { id, user, port, identity_file, args } => {
            ssh_into_instance(client, &id, user, port, identity_file, args).await
        }
        InstanceCommands::Start { id } => {
            start_instance(client, &id).await
        }
        InstanceCommands::Stop { id } => {
            stop_instance(client, &id).await
        }
        InstanceCommands::Reboot { id } => {
            reboot_instance(client, &id).await
        }
    }
}

/// List cloud instances
async fn list_instances(
    client: &KernelClient,
    provider: Option<String>,
    status: Option<String>,
    region: Option<String>,
) -> Result<()> {
    // Build query parameters
    let mut params = vec![];
    if let Some(p) = provider {
        params.push(format!("provider={}", p));
    }
    if let Some(s) = status {
        params.push(format!("status={}", s));
    }
    if let Some(r) = region {
        params.push(format!("region={}", r));
    }
    
    let path = if params.is_empty() {
        "/api/v1/instances".to_string()
    } else {
        format!("/api/v1/instances?{}", params.join("&"))
    };
    
    let instances: Vec<InstanceSummary> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to fetch instances: {}", e))?;
    
    if instances.is_empty() {
        println!("{}", "No instances found".yellow());
        println!("\nUse '{}' to create an instance", 
            "a2r instances create --provider=hetzner --region=fsn1".cyan());
        return Ok(());
    }
    
    // Print header
    println!("{:<36} {:<20} {:<10} {:<12} {:<16} {:<15} {:<20}",
        "ID", "NAME", "PROVIDER", "REGION", "STATUS", "IP", "CREATED");
    println!("{}", "-".repeat(135));
    
    // Print instances
    for inst in &instances {
        let status_colored = match inst.status.as_str() {
            "running" => inst.status.green(),
            "stopped" => inst.status.yellow(),
            "pending" | "creating" => inst.status.cyan(),
            "error" | "terminated" => inst.status.red(),
            _ => inst.status.normal(),
        };
        
        let ip = inst.public_ip.as_deref().unwrap_or("-");
        let created = inst.created_at.chars().take(16).collect::<String>();
        
        println!("{:<36} {:<20} {:<10} {:<12} {:<16} {:<15} {:<20}",
            &inst.id[..8.min(inst.id.len())],
            truncate(&inst.name, 20),
            inst.provider,
            inst.region,
            status_colored,
            ip,
            created
        );
    }
    
    println!("\nShowing {} instance(s)", instances.len());
    
    Ok(())
}

/// Create a new cloud instance
async fn create_instance(
    client: &KernelClient,
    provider: String,
    region: String,
    instance_type: String,
    name: Option<String>,
    image: String,
    storage_gb: Option<i32>,
    ssh_key: Option<String>,
    user_data: Option<String>,
    labels: Option<String>,
    wait: bool,
) -> Result<()> {
    // Generate name if not provided
    let name = name.unwrap_or_else(|| {
        format!("a2r-{}-{:x}", provider, rand::random::<u16>())
    });
    
    // Parse labels
    let label_map: Option<serde_json::Value> = labels.map(|l| {
        let mut map = serde_json::Map::new();
        for pair in l.split(',') {
            let parts: Vec<&str> = pair.splitn(2, '=').collect();
            if parts.len() == 2 {
                map.insert(parts[0].to_string(), serde_json::Value::String(parts[1].to_string()));
            }
        }
        serde_json::Value::Object(map)
    });
    
    // Read user data from file if provided
    let user_data_content = if let Some(ud) = user_data {
        if std::path::Path::new(&ud).exists() {
            Some(std::fs::read_to_string(&ud)?)
        } else {
            Some(ud)
        }
    } else {
        None
    };
    
    let body = serde_json::json!({
        "name": name,
        "provider": provider,
        "region": region,
        "instance_type": instance_type,
        "image": image,
        "storage_gb": storage_gb,
        "ssh_key": ssh_key,
        "user_data": user_data_content,
        "labels": label_map,
    });
    
    println!("Creating instance in {} ({})...", provider, region);
    
    let instance: InstanceDetails = client.post("/api/v1/instances", &body).await
        .map_err(|e| anyhow::anyhow!("Failed to create instance: {}", e))?;
    
    println!("{} Instance created", "✅".green());
    println!("   ID: {}", instance.id);
    println!("   Name: {}", instance.name);
    println!("   Type: {}", instance.instance_type);
    println!("   Status: {}", instance.status);
    
    if let Some(ref ip) = instance.public_ip {
        println!("   IP: {}", ip);
    }
    
    if wait {
        println!("\nWaiting for instance to be ready...");
        // Poll for status
        let mut attempts = 0;
        let max_attempts = 60;
        
        while attempts < max_attempts {
            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
            
            let path = format!("/api/v1/instances/{}", instance.id);
            match client.get::<InstanceDetails>(&path).await {
                Ok(inst) => {
                    if inst.status == "running" {
                        println!("{} Instance is running!", "✅".green());
                        if let Some(ip) = inst.public_ip {
                            println!("   IP: {}", ip);
                            if let Some(user) = inst.ssh_user {
                                println!("\nConnect with: {}", 
                                    format!("ssh {}@{}", user, ip).cyan());
                            }
                        }
                        break;
                    } else if inst.status == "error" {
                        return Err(anyhow::anyhow!("Instance creation failed"));
                    }
                    print!("\r   Status: {} (attempt {}/{})", inst.status, attempts + 1, max_attempts);
                    io::stdout().flush()?;
                }
                Err(_) => {
                    print!("\r   Waiting... (attempt {}/{})" , attempts + 1, max_attempts);
                    io::stdout().flush()?;
                }
            }
            attempts += 1;
        }
        
        if attempts >= max_attempts {
            println!("\n{} Instance creation timed out", "⚠️".yellow());
            println!("   Check status with: {}", 
                format!("a2r instances show {}", instance.id).cyan());
        }
    } else {
        println!("\nCheck status with: {}", 
            format!("a2r instances show {}", instance.id).cyan());
    }
    
    Ok(())
}

/// Show instance details
async fn show_instance(client: &KernelClient, id: &str) -> Result<()> {
    let path = format!("/api/v1/instances/{}", id);
    let instance: InstanceDetails = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to get instance: {}", e))?;
    
    println!("{}", "Instance Details".bold().underline());
    println!("{}: {}", "ID".bold(), instance.id);
    println!("{}: {}", "Name".bold(), instance.name);
    println!("{}: {}", "Provider".bold(), instance.provider);
    println!("{}: {}", "Region".bold(), instance.region);
    
    let status_colored = match instance.status.as_str() {
        "running" => instance.status.green(),
        "stopped" => instance.status.yellow(),
        "pending" | "creating" => instance.status.cyan(),
        "error" | "terminated" => instance.status.red(),
        _ => instance.status.normal(),
    };
    println!("{}: {}", "Status".bold(), status_colored);
    
    println!("{}: {}", "Type".bold(), instance.instance_type);
    println!("{}: {}", "Image".bold(), instance.image);
    
    if let Some(cpus) = instance.cpus {
        println!("{}: {} vCPUs", "CPUs".bold(), cpus);
    }
    
    if let Some(memory) = instance.memory_mb {
        println!("{}: {} MB", "Memory".bold(), memory);
    }
    
    println!("{}: {} GB", "Storage".bold(), instance.storage_gb);
    
    let public_ip = instance.public_ip.clone();
    if let Some(ref ip) = public_ip {
        println!("{}: {}", "Public IP".bold(), ip);
    }
    
    if let Some(ip) = instance.private_ip {
        println!("{}: {}", "Private IP".bold(), ip);
    }
    
    println!("{}: {}", "Created".bold(), instance.created_at);
    
    if let Some(started) = instance.started_at {
        println!("{}: {}", "Started".bold(), started);
    }
    
    if let Some(labels) = instance.labels {
        if let Some(map) = labels.as_object() {
            if !map.is_empty() {
                println!("\n{}:", "Labels".bold());
                for (k, v) in map {
                    println!("  {}: {}", k, v.as_str().unwrap_or(""));
                }
            }
        }
    }
    
    if instance.status == "running" {
        if let Some(ref ip) = public_ip {
            let user = instance.ssh_user.as_deref().unwrap_or("root");
            println!("\n{}:", "Connect".bold());
            println!("  {}", format!("a2r instances ssh {}", id).cyan());
            println!("  {}", format!("ssh {}@{}", user, ip).cyan());
        }
    }
    
    Ok(())
}

/// Destroy an instance
async fn destroy_instance(client: &KernelClient, id: &str, yes: bool, force: bool) -> Result<()> {
    if !yes {
        print!("Are you sure you want to destroy instance {}? [y/N] ", &id[..8.min(id.len())]);
        io::stdout().flush()?;
        
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("Cancelled");
            return Ok(());
        }
    }
    
    let path = format!("/api/v1/instances/{}{}", id, if force { "?force=true" } else { "" });
    client.delete(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to destroy instance: {}", e))?;
    
    println!("{} Instance destroyed", "✅".green());
    Ok(())
}

/// SSH into an instance
async fn ssh_into_instance(
    client: &KernelClient,
    id: &str,
    user: Option<String>,
    port: u16,
    identity_file: Option<String>,
    args: Vec<String>,
) -> Result<()> {
    // Get instance details
    let path = format!("/api/v1/instances/{}", id);
    let instance: InstanceDetails = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to get instance: {}", e))?;
    
    // Check if instance is running
    if instance.status != "running" {
        return Err(anyhow::anyhow!(
            "Instance is not running (status: {}). Start it with 'a2r instances start {}'",
            instance.status, id
        ));
    }
    
    // Get connection details
    let ip = instance.public_ip.ok_or_else(|| {
        anyhow::anyhow!("Instance does not have a public IP")
    })?;
    
    let ssh_user = user.or(instance.ssh_user).unwrap_or_else(|| "root".to_string());
    
    println!("Connecting to {}@{} (port {})...", ssh_user, ip, port);
    
    // Build SSH command
    let mut cmd = ProcessCommand::new("ssh");
    cmd.arg(format!("{}@{}", ssh_user, ip))
       .arg("-p")
       .arg(port.to_string())
       .arg("-o")
       .arg("StrictHostKeyChecking=accept-new")
       .arg("-o")
       .arg("UserKnownHostsFile=/dev/null");
    
    if let Some(key) = identity_file {
        cmd.arg("-i").arg(key);
    }
    
    // Add any additional args
    for arg in args {
        cmd.arg(arg);
    }
    
    // Execute SSH
    let status = cmd.status()?;
    
    if !status.success() {
        std::process::exit(status.code().unwrap_or(1));
    }
    
    Ok(())
}

/// Start an instance
async fn start_instance(client: &KernelClient, id: &str) -> Result<()> {
    let path = format!("/api/v1/instances/{}/start", id);
    
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to start instance: {}", e))?;
    
    println!("{} Instance {} starting", "✅".green(), id);
    println!("   Check status with: {}", format!("a2r instances show {}", id).cyan());
    Ok(())
}

/// Stop an instance
async fn stop_instance(client: &KernelClient, id: &str) -> Result<()> {
    let path = format!("/api/v1/instances/{}/stop", id);
    
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to stop instance: {}", e))?;
    
    println!("{} Instance {} stopping", "✅".green(), id);
    Ok(())
}

/// Reboot an instance
async fn reboot_instance(client: &KernelClient, id: &str) -> Result<()> {
    let path = format!("/api/v1/instances/{}/reboot", id);
    
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to reboot instance: {}", e))?;
    
    println!("{} Instance {} rebooting", "✅".green(), id);
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
