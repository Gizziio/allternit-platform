//! Cowork Runtime CLI Commands
//!
//! Provides terminal interface for managing runs in the Cowork Runtime.

use anyhow::Result;
use clap::{Args, Subcommand};
use serde::Deserialize;
use std::io::{self, Write};

use crate::client::KernelClient;
use futures::StreamExt;

/// Cowork command arguments
#[derive(Args, Debug)]
pub struct CoworkArgs {
    #[command(subcommand)]
    pub command: CoworkCommands,
}

/// Cowork subcommands
#[derive(Subcommand, Debug)]
pub enum CoworkCommands {
    /// List all runs
    #[command(visible_alias = "ls")]
    List {
        /// Filter by status
        #[arg(short, long)]
        status: Option<String>,
        /// Filter by mode (local/remote/cloud)
        #[arg(short, long)]
        mode: Option<String>,
        /// Limit number of results
        #[arg(short, long, default_value = "20")]
        limit: usize,
    },
    
    /// Create and start a new run
    #[command(visible_alias = "new")]
    Start {
        /// Run name
        name: String,
        /// Execution mode (local/remote/cloud)
        #[arg(short, long, default_value = "local")]
        mode: String,
        /// Command to execute
        #[arg(short, long)]
        command: Option<String>,
        /// Working directory
        #[arg(short, long)]
        working_dir: Option<String>,
        /// Auto-attach after starting
        #[arg(short, long)]
        attach: bool,
        /// Environment variables (KEY=value)
        #[arg(short, long)]
        env: Vec<String>,
        
        // Remote mode options
        /// Remote host (for remote mode)
        #[arg(long, requires = "mode_eq_remote")]
        host: Option<String>,
        /// Remote SSH port (for remote mode)
        #[arg(long, requires = "mode_eq_remote")]
        port: Option<u16>,
        /// Remote username (for remote mode)
        #[arg(long, requires = "mode_eq_remote")]
        username: Option<String>,
        /// SSH private key path (for remote mode)
        #[arg(long, requires = "mode_eq_remote")]
        ssh_key: Option<String>,
        
        // Cloud mode options
        /// Cloud instance type (for cloud mode)
        #[arg(long, requires = "mode_eq_cloud")]
        instance_type: Option<String>,
        /// Cloud region (for cloud mode)
        #[arg(long, requires = "mode_eq_cloud")]
        region: Option<String>,
        /// Cloud provider (hetzner/aws)
        #[arg(long, requires = "mode_eq_cloud")]
        provider: Option<String>,
        /// Storage size in GB (for cloud mode)
        #[arg(long, requires = "mode_eq_cloud")]
        storage_gb: Option<i32>,
    },
    
    /// Attach to a running run
    Attach {
        /// Run ID
        run_id: String,
    },
    
    /// Detach from a run (keep it running)
    Detach {
        /// Run ID (optional, uses current if not specified)
        run_id: Option<String>,
    },
    
    /// Stop/cancel a run
    #[command(visible_aliases = ["stop", "kill"])]
    Stop {
        /// Run ID
        run_id: String,
        /// Force immediate stop
        #[arg(short, long)]
        force: bool,
    },
    
    /// View logs for a run
    Logs {
        /// Run ID
        run_id: String,
        /// Follow log output
        #[arg(short, long)]
        follow: bool,
        /// Number of lines to show
        #[arg(short, long, default_value = "100")]
        lines: usize,
        /// Show since timestamp
        #[arg(long)]
        since: Option<String>,
    },
    
    /// Get run details
    #[command(visible_alias = "info")]
    Show {
        /// Run ID
        run_id: String,
    },
    
    /// Pause a run
    Pause {
        /// Run ID
        run_id: String,
    },
    
    /// Resume a paused run
    Resume {
        /// Run ID
        run_id: String,
    },
    
    /// Schedule management
    #[command(subcommand)]
    Schedule(ScheduleCommands),
    
    /// Approval management
    #[command(subcommand, name = "approval")]
    Approval(ApprovalCommands),
    
    /// Checkpoint management
    #[command(subcommand)]
    Checkpoint(CheckpointCommands),
}

/// Schedule subcommands
#[derive(Subcommand, Debug)]
pub enum ScheduleCommands {
    /// List all schedules
    #[command(visible_alias = "ls")]
    List {
        /// Show only enabled schedules
        #[arg(short, long)]
        enabled: bool,
    },
    
    /// Create a new schedule
    Create {
        /// Schedule name
        name: String,
        /// Cron expression or natural language (e.g., "daily at 9am")
        #[arg(short, long)]
        schedule: String,
        /// Command to execute
        #[arg(short, long)]
        command: String,
        /// Working directory
        #[arg(short, long)]
        working_dir: Option<String>,
        /// Enable immediately
        #[arg(short, long, default_value = "true")]
        enabled: bool,
    },
    
    /// Enable a schedule
    Enable {
        /// Schedule ID
        schedule_id: String,
    },
    
    /// Disable a schedule
    Disable {
        /// Schedule ID
        schedule_id: String,
    },
    
    /// Delete a schedule
    #[command(visible_alias = "rm")]
    Delete {
        /// Schedule ID
        schedule_id: String,
        /// Skip confirmation
        #[arg(short, long)]
        yes: bool,
    },
    
    /// Trigger a schedule immediately
    Trigger {
        /// Schedule ID
        schedule_id: String,
    },
}

/// Checkpoint subcommands
#[derive(Subcommand, Debug)]
pub enum CheckpointCommands {
    /// List checkpoints for a run
    #[command(visible_alias = "ls")]
    List {
        /// Run ID
        run_id: String,
    },
    
    /// Create a checkpoint
    Create {
        /// Run ID
        run_id: String,
        /// Checkpoint name
        #[arg(short, long)]
        name: Option<String>,
        /// Description
        #[arg(short, long)]
        description: Option<String>,
    },
    
    /// Show checkpoint details
    #[command(visible_alias = "info")]
    Show {
        /// Checkpoint ID
        checkpoint_id: String,
    },
    
    /// Restore run from checkpoint
    Restore {
        /// Run ID
        run_id: String,
        /// Checkpoint ID
        checkpoint_id: String,
    },
    
    /// Delete a checkpoint
    #[command(visible_alias = "rm")]
    Delete {
        /// Checkpoint ID
        checkpoint_id: String,
        /// Skip confirmation
        #[arg(short, long)]
        yes: bool,
    },
}

/// Approval subcommands
#[derive(Subcommand, Debug)]
pub enum ApprovalCommands {
    /// List pending approvals
    #[command(visible_alias = "ls")]
    List {
        /// Filter by run ID
        #[arg(short, long)]
        run_id: Option<String>,
        /// Show all statuses (not just pending)
        #[arg(short, long)]
        all: bool,
    },
    
    /// Show approval details
    #[command(visible_alias = "info")]
    Show {
        /// Approval ID
        approval_id: String,
    },
    
    /// Approve a request
    #[command(visible_alias = "yes")]
    Approve {
        /// Approval ID
        approval_id: String,
        /// Optional message
        #[arg(short, long)]
        message: Option<String>,
    },
    
    /// Deny a request
    #[command(visible_aliases = ["reject", "no"])]
    Deny {
        /// Approval ID
        approval_id: String,
        /// Optional reason
        #[arg(short, long)]
        reason: Option<String>,
    },
}

/// Run summary from API
#[derive(Debug, Deserialize)]
struct RunSummary {
    id: String,
    name: String,
    mode: String,
    status: String,
    completed_steps: i32,
    total_steps: Option<i32>,
    created_at: String,
    updated_at: String,
}

/// Run details from API
#[derive(Debug, Deserialize)]
struct RunDetails {
    id: String,
    name: String,
    description: Option<String>,
    mode: String,
    status: String,
    step_cursor: Option<String>,
    total_steps: Option<i32>,
    completed_steps: i32,
    config: serde_json::Value,
    created_at: String,
    started_at: Option<String>,
    completed_at: Option<String>,
    error_message: Option<String>,
}

/// Event from API
#[derive(Debug, Deserialize)]
struct Event {
    id: String,
    sequence: i64,
    event_type: String,
    payload: serde_json::Value,
    created_at: String,
}

/// Schedule summary from API
#[derive(Debug, Deserialize)]
struct ScheduleSummary {
    id: String,
    name: String,
    enabled: bool,
    cron_expr: String,
    #[serde(rename = "natural_lang")]
    natural_lang: Option<String>,
    #[serde(rename = "next_run_at")]
    next_run_at: Option<String>,
    #[serde(rename = "run_count")]
    run_count: i32,
}

/// Approval summary from API
#[derive(Debug, Deserialize)]
struct ApprovalSummary {
    id: String,
    #[serde(rename = "run_id")]
    run_id: String,
    status: String,
    priority: String,
    title: String,
    #[serde(rename = "action_type")]
    action_type: Option<String>,
    #[serde(rename = "created_at")]
    created_at: String,
    #[serde(rename = "responded_at")]
    responded_at: Option<String>,
}

/// Approval details from API
#[derive(Debug, Deserialize)]
struct ApprovalDetails {
    id: String,
    #[serde(rename = "run_id")]
    run_id: String,
    #[serde(rename = "step_cursor")]
    step_cursor: Option<String>,
    status: String,
    priority: String,
    title: String,
    description: Option<String>,
    #[serde(rename = "action_type")]
    action_type: Option<String>,
    #[serde(rename = "action_params")]
    action_params: Option<serde_json::Value>,
    reasoning: Option<String>,
    #[serde(rename = "requested_by")]
    requested_by: Option<String>,
    #[serde(rename = "responded_by")]
    responded_by: Option<String>,
    #[serde(rename = "response_message")]
    response_message: Option<String>,
    #[serde(rename = "created_at")]
    created_at: String,
    #[serde(rename = "responded_at")]
    responded_at: Option<String>,
}

/// Checkpoint summary from API
#[derive(Debug, Deserialize)]
struct CheckpointSummary {
    id: String,
    name: Option<String>,
    #[serde(rename = "step_cursor")]
    step_cursor: String,
    resumable: bool,
    #[serde(rename = "created_at")]
    created_at: String,
}

/// Checkpoint details from API
#[derive(Debug, Deserialize)]
struct CheckpointDetails {
    id: String,
    #[serde(rename = "run_id")]
    run_id: String,
    name: Option<String>,
    description: Option<String>,
    #[serde(rename = "step_cursor")]
    step_cursor: String,
    #[serde(rename = "workspace_state")]
    workspace_state: Option<serde_json::Value>,
    #[serde(rename = "approval_state")]
    approval_state: Option<serde_json::Value>,
    context: Option<serde_json::Value>,
    resumable: bool,
    #[serde(rename = "created_at")]
    created_at: String,
    #[serde(rename = "restored_at")]
    restored_at: Option<String>,
}

/// Handler for cowork args (wrapper for main entry point)
pub async fn handle_cowork_args(args: CoworkArgs, client: &KernelClient) -> Result<()> {
    handle_cowork(args, client).await
}

/// Main handler for cowork commands
pub async fn handle_cowork(args: CoworkArgs, client: &KernelClient) -> Result<()> {
    match args.command {
        CoworkCommands::List { status, mode, limit } => {
            list_runs(client, status, mode, limit).await
        }
        CoworkCommands::Start { 
            name, mode, command, working_dir, attach, env,
            host, port, username, ssh_key,
            instance_type, region, provider, storage_gb,
        } => {
            start_run(
                client, name, mode, command, working_dir, attach, env,
                host, port, username, ssh_key,
                instance_type, region, provider, storage_gb,
            ).await
        }
        CoworkCommands::Attach { run_id } => {
            attach_run(client, &run_id).await
        }
        CoworkCommands::Detach { run_id } => {
            detach_run(client, run_id).await
        }
        CoworkCommands::Stop { run_id, force } => {
            stop_run(client, &run_id, force).await
        }
        CoworkCommands::Logs { run_id, follow, lines, since } => {
            show_logs(client, &run_id, follow, lines, since).await
        }
        CoworkCommands::Show { run_id } => {
            show_run(client, &run_id).await
        }
        CoworkCommands::Pause { run_id } => {
            pause_run(client, &run_id).await
        }
        CoworkCommands::Resume { run_id } => {
            resume_run(client, &run_id).await
        }
        CoworkCommands::Schedule(schedule_args) => {
            handle_schedule_commands(schedule_args, client).await
        }
        CoworkCommands::Approval(approval_args) => {
            handle_approval_commands(approval_args, client).await
        }
        CoworkCommands::Checkpoint(checkpoint_args) => {
            handle_checkpoint_commands(checkpoint_args, client).await
        }
    }
}

/// Handle schedule subcommands
async fn handle_schedule_commands(args: ScheduleCommands, client: &KernelClient) -> Result<()> {
    match args {
        ScheduleCommands::List { enabled } => {
            list_schedules(client, enabled).await
        }
        ScheduleCommands::Create { name, schedule, command, working_dir, enabled } => {
            create_schedule(client, name, schedule, command, working_dir, enabled).await
        }
        ScheduleCommands::Enable { schedule_id } => {
            enable_schedule(client, &schedule_id).await
        }
        ScheduleCommands::Disable { schedule_id } => {
            disable_schedule(client, &schedule_id).await
        }
        ScheduleCommands::Delete { schedule_id, yes } => {
            delete_schedule(client, &schedule_id, yes).await
        }
        ScheduleCommands::Trigger { schedule_id } => {
            trigger_schedule(client, &schedule_id).await
        }
    }
}

/// Handle approval subcommands
async fn handle_approval_commands(args: ApprovalCommands, client: &KernelClient) -> Result<()> {
    match args {
        ApprovalCommands::List { run_id, all } => {
            list_approvals(client, run_id, all).await
        }
        ApprovalCommands::Show { approval_id } => {
            show_approval(client, &approval_id).await
        }
        ApprovalCommands::Approve { approval_id, message } => {
            approve_request(client, &approval_id, message).await
        }
        ApprovalCommands::Deny { approval_id, reason } => {
            deny_request(client, &approval_id, reason).await
        }
    }
}

/// Handle checkpoint subcommands
async fn handle_checkpoint_commands(args: CheckpointCommands, client: &KernelClient) -> Result<()> {
    match args {
        CheckpointCommands::List { run_id } => {
            list_checkpoints(client, &run_id).await
        }
        CheckpointCommands::Create { run_id, name, description } => {
            create_checkpoint(client, &run_id, name, description).await
        }
        CheckpointCommands::Show { checkpoint_id } => {
            show_checkpoint(client, &checkpoint_id).await
        }
        CheckpointCommands::Restore { run_id, checkpoint_id } => {
            restore_checkpoint(client, &run_id, &checkpoint_id).await
        }
        CheckpointCommands::Delete { checkpoint_id, yes } => {
            delete_checkpoint(client, &checkpoint_id, yes).await
        }
    }
}

/// List runs with optional filtering
async fn list_runs(
    client: &KernelClient,
    status: Option<String>,
    mode: Option<String>,
    limit: usize,
) -> Result<()> {
    // Build query parameters
    let mut params = vec![];
    if let Some(s) = status {
        params.push(format!("status={}", s));
    }
    if let Some(m) = mode {
        params.push(format!("mode={}", m));
    }
    params.push(format!("limit={}", limit));
    
    let path = if params.is_empty() {
        "/api/v1/runs".to_string()
    } else {
        format!("/api/v1/runs?{}", params.join("&"))
    };
    
    let runs: Vec<RunSummary> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to fetch runs: {}", e))?;
    
    if runs.is_empty() {
        println!("No runs found");
        return Ok(());
    }
    
    // Print header
    println!("{:<36} {:<20} {:<10} {:<12} {:<10} {:<20}",
        "ID", "NAME", "MODE", "STATUS", "PROGRESS", "CREATED");
    println!("{}", "-".repeat(110));
    
    // Print runs
    for run in &runs {
        let progress = if let Some(total) = run.total_steps {
            format!("{}/{}", run.completed_steps, total)
        } else {
            "-".to_string()
        };
        
        let created = run.created_at.chars().take(19).collect::<String>();
        
        println!("{:<36} {:<20} {:<10} {:<12} {:<10} {:<20}",
            &run.id[..8.min(run.id.len())],
            truncate(&run.name, 20),
            run.mode,
            run.status,
            progress,
            created
        );
    }
    
    println!("\nShowing {} run(s)", runs.len());
    
    Ok(())
}

/// Start a new run
async fn start_run(
    client: &KernelClient,
    name: String,
    mode: String,
    command: Option<String>,
    working_dir: Option<String>,
    attach: bool,
    env: Vec<String>,
    // Remote options
    host: Option<String>,
    port: Option<u16>,
    username: Option<String>,
    ssh_key: Option<String>,
    // Cloud options
    instance_type: Option<String>,
    region: Option<String>,
    provider: Option<String>,
    storage_gb: Option<i32>,
) -> Result<()> {
    // Parse environment variables
    let env_map: std::collections::HashMap<String, String> = env
        .iter()
        .filter_map(|e| {
            let parts: Vec<&str> = e.splitn(2, '=').collect();
            if parts.len() == 2 {
                Some((parts[0].to_string(), parts[1].to_string()))
            } else {
                None
            }
        })
        .collect();
    
    // Build config with mode-specific options
    let mut config = serde_json::json!({
        "command": command,
        "working_dir": working_dir,
        "env": if env_map.is_empty() { None } else { Some(env_map) },
    });
    
    // Add remote-specific options to config.extra
    if mode == "remote" {
        if let Some(h) = host {
            config["host"] = serde_json::json!(h);
        }
        if let Some(p) = port {
            config["port"] = serde_json::json!(p);
        }
        if let Some(u) = username {
            config["username"] = serde_json::json!(u);
        }
        if let Some(k) = ssh_key {
            // Read key file content
            match std::fs::read_to_string(&k) {
                Ok(key_content) => {
                    config["ssh_key"] = serde_json::json!(key_content);
                }
                Err(e) => {
                    eprintln!("⚠️  Warning: Failed to read SSH key: {}", e);
                }
            }
        }
    }
    
    // Add cloud-specific options to config.extra
    if mode == "cloud" {
        if let Some(it) = instance_type {
            config["instance_type"] = serde_json::json!(it);
        }
        if let Some(r) = region {
            config["region"] = serde_json::json!(r);
        }
        if let Some(p) = provider {
            config["provider"] = serde_json::json!(p);
        }
        if let Some(sg) = storage_gb {
            config["storage_gb"] = serde_json::json!(sg);
        }
    }
    
    let body = serde_json::json!({
        "name": name,
        "mode": mode,
        "config": config,
        "auto_start": true,
    });
    
    let run: RunDetails = client.post("/api/v1/runs", &body).await
        .map_err(|e| anyhow::anyhow!("Failed to create run: {}", e))?;
    
    println!("✅ Run created: {} ({})", run.name, &run.id[..8.min(run.id.len())]);
    println!("   Status: {}", run.status);
    
    if attach {
        println!();
        attach_run(client, &run.id).await?;
    }
    
    Ok(())
}

/// Attach to a running run
async fn attach_run(client: &KernelClient, run_id: &str) -> Result<()> {
    // First, show run details
    let path = format!("/api/v1/runs/{}", run_id);
    let run: RunDetails = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to get run: {}", e))?;

    println!("Attaching to run: {} ({})", run.name, &run.id[..8.min(run.id.len())]);
    println!("Status: {}", run.status);
    println!();
    println!("Press Ctrl+C to detach (run will continue in background)");
    println!();

    let mut last_sequence: i64 = -1;
    let mut retry_count = 0;
    let max_retries = 5;

    loop {
        // Build path with cursor if we have one
        let events_path = if last_sequence >= 0 {
            format!("/api/v1/runs/{}/events/stream?cursor={}", run_id, last_sequence)
        } else {
            format!("/api/v1/runs/{}/events/stream", run_id)
        };

        // Use SSE streaming with raw response
        let response_result = client.get_raw(&events_path).await;

        match response_result {
            Ok(response) => {
                retry_count = 0; // Reset retry count on successful connection
                let mut stream = response.bytes_stream();

                // Process stream
                while let Some(chunk) = stream.next().await {
                    match chunk {
                        Ok(bytes) => {
                            let text = String::from_utf8_lossy(&bytes);
                            for line in text.lines() {
                                if line.starts_with("data: ") {
                                    let data = &line[6..];
                                    if let Ok(event) = serde_json::from_str::<Event>(data) {
                                        print_event(&event);
                                        last_sequence = event.sequence;
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("\n⚠️  Stream connection lost: {}. Retrying...", e);
                            break; // Break inner loop to retry connection
                        }
                    }
                }
            },
            Err(e) => {
                retry_count += 1;
                if retry_count > max_retries {
                    return Err(anyhow::anyhow!("Failed to reconnect to run stream after {} attempts: {}", max_retries, e));
                }
                eprintln!("\n⚠️  Failed to connect to stream: {}. Retrying in 2s (attempt {}/{})...", e, retry_count, max_retries);
            }
        }

        // Wait before retrying
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }
}
/// Print a single event
fn print_event(event: &Event) {
    match event.event_type.as_str() {
        "stdout" => {
            if let Some(content) = event.payload.get("content").and_then(|c| c.as_str()) {
                print!("{}", content);
            }
        }
        "stderr" => {
            if let Some(content) = event.payload.get("content").and_then(|c| c.as_str()) {
                eprint!("{}", content);
            }
        }
        "output" => {
            if let Some(content) = event.payload.get("content").and_then(|c| c.as_str()) {
                print!("{}", content);
            }
        }
        "step_started" => {
            if let Some(name) = event.payload.get("step_name").and_then(|n| n.as_str()) {
                println!("\n[STEP] Starting: {}", name);
            }
        }
        "step_completed" => {
            if let Some(name) = event.payload.get("step_name").and_then(|n| n.as_str()) {
                println!("[STEP] Completed: {}", name);
            }
        }
        "step_failed" => {
            if let Some(name) = event.payload.get("step_name").and_then(|n| n.as_str()) {
                println!("[STEP] Failed: {}", name);
            }
        }
        "approval_needed" => {
            if let Some(title) = event.payload.get("title").and_then(|t| t.as_str()) {
                println!("\n[APPROVAL NEEDED] {}", title);
            }
        }
        "approval_given" => {
            println!("[APPROVAL] Approved");
        }
        "approval_denied" => {
            println!("[APPROVAL] Denied");
        }
        _ => {
            // Ignore other events
        }
    }
}

/// Detach from a run
async fn detach_run(_client: &KernelClient, _run_id: Option<String>) -> Result<()> {
    // Detach is handled client-side by stopping the event stream
    println!("Detached from run");
    Ok(())
}

/// Stop/cancel a run
async fn stop_run(client: &KernelClient, run_id: &str, force: bool) -> Result<()> {
    let path = format!("/api/v1/runs/{}/cancel", run_id);
    
    if force {
        println!("Force stopping run {}...", &run_id[..8.min(run_id.len())]);
    } else {
        println!("Stopping run {}...", &run_id[..8.min(run_id.len())]);
    }
    
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to stop run: {}", e))?;
    
    println!("✅ Run stopped");
    
    Ok(())
}

/// Show logs for a run
async fn show_logs(
    client: &KernelClient,
    run_id: &str,
    follow: bool,
    lines: usize,
    _since: Option<String>,
) -> Result<()> {
    let path = format!("/api/v1/runs/{}/events?limit={}", run_id, lines);
    
    let events: Vec<Event> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to fetch logs: {}", e))?;
    
    for event in events {
        print_event(&event);
    }
    
    if follow {
        // Continue streaming
        let stream_path = format!("/api/v1/runs/{}/events/stream", run_id);
        let response = client.get_raw(&stream_path).await
            .map_err(|e| anyhow::anyhow!("Failed to start log stream: {}", e))?;
        let mut stream = response.bytes_stream();
        
        while let Some(chunk) = stream.next().await {
            match chunk {
                Ok(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    for line in text.lines() {
                        if line.starts_with("data: ") {
                            let data = &line[6..];
                            if let Ok(event) = serde_json::from_str::<Event>(data) {
                                print_event(&event);
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Stream error: {}", e);
                    break;
                }
            }
        }
    }
    
    Ok(())
}

/// Show run details
async fn show_run(client: &KernelClient, run_id: &str) -> Result<()> {
    let path = format!("/api/v1/runs/{}", run_id);
    let run: RunDetails = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to get run: {}", e))?;
    
    println!("Run: {}", run.name);
    println!("ID: {}", run.id);
    println!("Status: {}", run.status);
    println!("Mode: {}", run.mode);
    
    if let Some(desc) = run.description {
        println!("Description: {}", desc);
    }
    
    if let Some(cursor) = run.step_cursor {
        println!("Step: {}", cursor);
    }
    
    if let Some(total) = run.total_steps {
        println!("Progress: {}/{}", run.completed_steps, total);
    }
    
    println!("Created: {}", run.created_at);
    
    if let Some(started) = run.started_at {
        println!("Started: {}", started);
    }
    
    if let Some(completed) = run.completed_at {
        println!("Completed: {}", completed);
    }
    
    if let Some(error) = run.error_message {
        println!("Error: {}", error);
    }
    
    Ok(())
}

/// Pause a run
async fn pause_run(client: &KernelClient, run_id: &str) -> Result<()> {
    let path = format!("/api/v1/runs/{}/pause", run_id);
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to pause run: {}", e))?;
    println!("✅ Run paused");
    Ok(())
}

/// Resume a run
async fn resume_run(client: &KernelClient, run_id: &str) -> Result<()> {
    let path = format!("/api/v1/runs/{}/resume", run_id);
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to resume run: {}", e))?;
    println!("✅ Run resumed");
    Ok(())
}

/// List schedules
async fn list_schedules(client: &KernelClient, enabled_only: bool) -> Result<()> {
    let path = if enabled_only {
        "/api/v1/schedules?enabled=true".to_string()
    } else {
        "/api/v1/schedules".to_string()
    };
    
    let schedules: Vec<ScheduleSummary> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to fetch schedules: {}", e))?;
    
    if schedules.is_empty() {
        println!("No schedules found");
        return Ok(());
    }
    
    // Print header
    println!("{:<36} {:<20} {:<8} {:<20} {:<20}",
        "ID", "NAME", "ENABLED", "NEXT RUN", "SCHEDULE");
    println!("{}", "-".repeat(110));
    
    // Print schedules
    for schedule in &schedules {
        let next_run = schedule.next_run_at.as_ref()
            .map(|d| d.chars().take(16).collect())
            .unwrap_or_else(|| "-".to_string());
        
        let schedule_str = schedule.natural_lang.clone()
            .unwrap_or_else(|| schedule.cron_expr.clone());
        
        println!("{:<36} {:<20} {:<8} {:<20} {:<20}",
            &schedule.id[..8.min(schedule.id.len())],
            truncate(&schedule.name, 20),
            if schedule.enabled { "✓" } else { "✗" },
            next_run,
            truncate(&schedule_str, 20)
        );
    }
    
    println!("\nShowing {} schedule(s)", schedules.len());
    
    Ok(())
}

/// Create a schedule
async fn create_schedule(
    client: &KernelClient,
    name: String,
    schedule: String,
    command: String,
    working_dir: Option<String>,
    enabled: bool,
) -> Result<()> {
    let body = serde_json::json!({
        "name": name,
        "cron_expr": schedule,
        "job_template": {
            "command": command,
            "working_dir": working_dir,
        },
        "enabled": enabled,
    });
    
    let schedule: ScheduleSummary = client.post("/api/v1/schedules", &body).await
        .map_err(|e| anyhow::anyhow!("Failed to create schedule: {}", e))?;
    
    println!("✅ Schedule created: {} ({})", schedule.name, &schedule.id[..8.min(schedule.id.len())]);
    
    if let Some(next_run) = schedule.next_run_at {
        println!("   Next run: {}", next_run);
    }
    
    Ok(())
}

/// Enable a schedule
async fn enable_schedule(client: &KernelClient, schedule_id: &str) -> Result<()> {
    let path = format!("/api/v1/schedules/{}/enable", schedule_id);
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to enable schedule: {}", e))?;
    println!("✅ Schedule enabled");
    Ok(())
}

/// Disable a schedule
async fn disable_schedule(client: &KernelClient, schedule_id: &str) -> Result<()> {
    let path = format!("/api/v1/schedules/{}/disable", schedule_id);
    let _: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to disable schedule: {}", e))?;
    println!("✅ Schedule disabled");
    Ok(())
}

/// Delete a schedule
async fn delete_schedule(client: &KernelClient, schedule_id: &str, yes: bool) -> Result<()> {
    if !yes {
        print!("Are you sure you want to delete schedule {}? [y/N] ", &schedule_id[..8.min(schedule_id.len())]);
        io::stdout().flush()?;
        
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("Cancelled");
            return Ok(());
        }
    }
    
    let path = format!("/api/v1/schedules/{}", schedule_id);
    client.delete(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to delete schedule: {}", e))?;
    println!("✅ Schedule deleted");
    Ok(())
}

/// Trigger a schedule immediately
async fn trigger_schedule(client: &KernelClient, schedule_id: &str) -> Result<()> {
    let path = format!("/api/v1/schedules/{}/trigger", schedule_id);
    let result: serde_json::Value = client.post(&path, &serde_json::json!({})).await
        .map_err(|e| anyhow::anyhow!("Failed to trigger schedule: {}", e))?;
    
    if let Some(run_id) = result.get("run_id").and_then(|r| r.as_str()) {
        println!("✅ Schedule triggered, run created: {}", &run_id[..8.min(run_id.len())]);
    } else {
        println!("✅ Schedule triggered");
    }
    
    Ok(())
}

/// List approval requests
async fn list_approvals(
    client: &KernelClient,
    run_id: Option<String>,
    all: bool,
) -> Result<()> {
    // Build query parameters
    let mut params = vec![];
    if let Some(rid) = run_id {
        params.push(format!("run_id={}", rid));
    }
    if !all {
        params.push("status=pending".to_string());
    }
    params.push("limit=50".to_string());
    
    let path = if params.is_empty() {
        "/api/v1/approvals".to_string()
    } else {
        format!("/api/v1/approvals?{}", params.join("&"))
    };
    
    let approvals: Vec<ApprovalSummary> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to fetch approvals: {}", e))?;
    
    if approvals.is_empty() {
        if all {
            println!("No approval requests found");
        } else {
            println!("No pending approvals");
        }
        return Ok(());
    }
    
    // Print header
    println!("{:<36} {:<12} {:<10} {:<20} {:<20}",
        "ID", "STATUS", "PRIORITY", "TITLE", "ACTION");
    println!("{}", "-".repeat(100));
    
    // Print approvals
    for approval in &approvals {
        let status_icon = match approval.status.as_str() {
            "pending" => "⏳",
            "approved" => "✅",
            "denied" => "❌",
            "timed_out" => "⏱️",
            "cancelled" => "🚫",
            _ => "?",
        };
        
        println!("{:<36} {} {:<10} {:<20} {:<20}",
            &approval.id[..8.min(approval.id.len())],
            status_icon,
            approval.priority,
            truncate(&approval.title, 20),
            approval.action_type.as_deref().unwrap_or("-"),
        );
    }
    
    println!("\nShowing {} approval(s)", approvals.len());
    
    Ok(())
}

/// Show approval details
async fn show_approval(client: &KernelClient, approval_id: &str) -> Result<()> {
    let path = format!("/api/v1/approvals/{}", approval_id);
    let approval: ApprovalDetails = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to get approval: {}", e))?;
    
    let status_icon = match approval.status.as_str() {
        "pending" => "⏳",
        "approved" => "✅",
        "denied" => "❌",
        "timed_out" => "⏱️",
        "cancelled" => "🚫",
        _ => "?",
    };
    
    println!("{} {}", status_icon, approval.title);
    println!("ID: {}", approval.id);
    println!("Run: {}", &approval.run_id[..8.min(approval.run_id.len())]);
    println!("Status: {}", approval.status);
    println!("Priority: {}", approval.priority);
    
    if let Some(desc) = approval.description {
        println!("\nDescription: {}", desc);
    }
    
    if let Some(action) = approval.action_type {
        println!("\nAction: {}", action);
        if let Some(params) = approval.action_params {
            println!("Parameters: {}", serde_json::to_string_pretty(&params).unwrap_or_default());
        }
    }
    
    if let Some(reasoning) = approval.reasoning {
        println!("\nReasoning: {}", reasoning);
    }
    
    println!("\nCreated: {}", approval.created_at);
    
    if let Some(responded) = approval.responded_at {
        println!("Responded: {}", responded);
        if let Some(by) = approval.responded_by {
            println!("By: {}", by);
        }
        if let Some(msg) = approval.response_message {
            println!("Message: {}", msg);
        }
    }
    
    Ok(())
}

/// Approve a request
async fn approve_request(
    client: &KernelClient,
    approval_id: &str,
    message: Option<String>,
) -> Result<()> {
    let path = format!("/api/v1/approvals/{}/approve", approval_id);
    let body = serde_json::json!({
        "approved": true,
        "message": message,
    });
    
    let _: ApprovalDetails = client.post(&path, &body).await
        .map_err(|e| anyhow::anyhow!("Failed to approve request: {}", e))?;
    
    println!("✅ Request approved");
    Ok(())
}

/// Deny a request
async fn deny_request(
    client: &KernelClient,
    approval_id: &str,
    reason: Option<String>,
) -> Result<()> {
    let path = format!("/api/v1/approvals/{}/deny", approval_id);
    let body = serde_json::json!({
        "approved": false,
        "message": reason,
    });
    
    let _: ApprovalDetails = client.post(&path, &body).await
        .map_err(|e| anyhow::anyhow!("Failed to deny request: {}", e))?;
    
    println!("❌ Request denied");
    Ok(())
}

/// List checkpoints for a run
async fn list_checkpoints(client: &KernelClient, run_id: &str) -> Result<()> {
    let path = format!("/api/v1/runs/{}/checkpoints", run_id);
    let checkpoints: Vec<CheckpointSummary> = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to fetch checkpoints: {}", e))?;
    
    if checkpoints.is_empty() {
        println!("No checkpoints found for run {}", &run_id[..8.min(run_id.len())]);
        return Ok(());
    }
    
    // Print header
    println!("{:<36} {:<20} {:<20} {:<12} {:<20}",
        "ID", "NAME", "STEP", "RESUMABLE", "CREATED");
    println!("{}", "-".repeat(110));
    
    // Print checkpoints
    for checkpoint in &checkpoints {
        println!("{:<36} {:<20} {:<20} {:<12} {:<20}",
            &checkpoint.id[..8.min(checkpoint.id.len())],
            checkpoint.name.as_deref().unwrap_or("-"),
            checkpoint.step_cursor,
            if checkpoint.resumable { "✓" } else { "✗" },
            checkpoint.created_at.chars().take(19).collect::<String>()
        );
    }
    
    println!("\nShowing {} checkpoint(s)", checkpoints.len());
    
    Ok(())
}

/// Create a checkpoint
async fn create_checkpoint(
    client: &KernelClient,
    run_id: &str,
    name: Option<String>,
    description: Option<String>,
) -> Result<()> {
    let path = format!("/api/v1/runs/{}/checkpoints", run_id);
    let body = serde_json::json!({
        "name": name,
        "description": description,
    });
    
    let checkpoint: CheckpointDetails = client.post(&path, &body).await
        .map_err(|e| anyhow::anyhow!("Failed to create checkpoint: {}", e))?;
    
    println!("✅ Checkpoint created: {} ({})", 
        checkpoint.name.as_deref().unwrap_or("unnamed"),
        &checkpoint.id[..8.min(checkpoint.id.len())]
    );
    println!("   Step: {}", checkpoint.step_cursor);
    
    Ok(())
}

/// Show checkpoint details
async fn show_checkpoint(client: &KernelClient, checkpoint_id: &str) -> Result<()> {
    let path = format!("/api/v1/checkpoints/{}", checkpoint_id);
    let checkpoint: CheckpointDetails = client.get(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to get checkpoint: {}", e))?;
    
    println!("Checkpoint: {}", checkpoint.name.as_deref().unwrap_or("unnamed"));
    println!("ID: {}", checkpoint.id);
    println!("Run: {}", &checkpoint.run_id[..8.min(checkpoint.run_id.len())]);
    println!("Step: {}", checkpoint.step_cursor);
    println!("Resumable: {}", if checkpoint.resumable { "Yes" } else { "No" });
    
    if let Some(desc) = checkpoint.description {
        println!("Description: {}", desc);
    }
    
    if checkpoint.workspace_state.is_some() {
        println!("Workspace state: captured");
    }
    
    if checkpoint.approval_state.is_some() {
        println!("Approval state: captured");
    }
    
    println!("Created: {}", checkpoint.created_at);
    
    if let Some(restored) = checkpoint.restored_at {
        println!("Restored: {}", restored);
    }
    
    Ok(())
}

/// Restore run from checkpoint
async fn restore_checkpoint(
    client: &KernelClient,
    run_id: &str,
    checkpoint_id: &str,
) -> Result<()> {
    let path = format!("/api/v1/runs/{}/restore", run_id);
    let body = serde_json::json!({
        "checkpoint_id": checkpoint_id,
    });
    
    let run: RunDetails = client.post(&path, &body).await
        .map_err(|e| anyhow::anyhow!("Failed to restore checkpoint: {}", e))?;
    
    println!("✅ Run restored from checkpoint");
    println!("   Run: {} ({})", run.name, &run.id[..8.min(run.id.len())]);
    println!("   Status: {}", run.status);
    if let Some(cursor) = run.step_cursor {
        println!("   Step: {}", cursor);
    }
    
    Ok(())
}

/// Delete a checkpoint
async fn delete_checkpoint(
    client: &KernelClient,
    checkpoint_id: &str,
    yes: bool,
) -> Result<()> {
    if !yes {
        print!("Are you sure you want to delete checkpoint {}? [y/N] ", &checkpoint_id[..8.min(checkpoint_id.len())]);
        io::stdout().flush()?;
        
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("Cancelled");
            return Ok(());
        }
    }
    
    let path = format!("/api/v1/checkpoints/{}", checkpoint_id);
    client.delete(&path).await
        .map_err(|e| anyhow::anyhow!("Failed to delete checkpoint: {}", e))?;
    println!("✅ Checkpoint deleted");
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
