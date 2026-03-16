//! View logs from a cowork run

use clap::Args;
use colored::Colorize;
use std::process;

use super::{get_api_url, get_current_attachment, print_error, print_header, print_info};

/// Logs command arguments
#[derive(Args, Debug)]
pub struct LogsArgs {
    /// The run ID to view logs for (defaults to current attachment)
    pub run_id: Option<String>,

    /// Number of lines to show (default: 50)
    #[arg(short, long, default_value = "50")]
    pub lines: usize,

    /// Follow log output (like tail -f)
    #[arg(short, long)]
    pub follow: bool,

    /// Show logs from all jobs in the run
    #[arg(long)]
    pub all: bool,

    /// Filter by log level (debug, info, warn, error)
    #[arg(long)]
    pub level: Option<String>,
}

/// Execute the logs command
pub async fn execute(args: LogsArgs) -> anyhow::Result<()> {
    // Determine run ID
    let run_id = if let Some(id) = args.run_id {
        id
    } else if let Some(attachment) = get_current_attachment()? {
        println!(
            "  {} Using current attachment: {}",
            "→".dimmed(),
            attachment.run_id.cyan()
        );
        println!();
        attachment.run_id
    } else {
        print_error("No run ID specified and not currently attached");
        println!();
        println!("  Usage:");
        println!("    a2r cowork logs <run_id>     # View logs for a specific run");
        println!(
            "    a2r cowork attach <run_id>   # Attach first, then use 'logs' without args"
        );
        process::exit(1);
    };

    print_header(&format!("Logs for Run {}", &run_id[..8]));

    let client = reqwest::Client::new();
    let api_url = get_api_url();

    // First, get run info
    let run_response = client
        .get(format!("{}/rails/cowork/runs/{}", api_url, run_id))
        .send()
        .await?;

    if !run_response.status().is_success() {
        let error_text = run_response.text().await?;
        print_error(&format!("Run not found: {}", error_text));
        process::exit(1);
    }

    let run: serde_json::Value = run_response.json().await?;
    let state = run["state"].as_str().unwrap_or("unknown");

    print_info("State:", state);
    print_info("Entrypoint:", run["entrypoint"].as_str().unwrap_or("unknown"));
    println!();

    // TODO: Implement actual log fetching from Rails Ledger or Event Store
    // For now, show a placeholder
    println!("{}", "Fetching logs...".dimmed());
    println!();

    // Placeholder log output
    let placeholder_logs = vec![
        ("2024-01-15T09:00:00Z", "INFO", "Run started"),
        ("2024-01-15T09:00:01Z", "INFO", "Initializing execution context"),
        ("2024-01-15T09:00:02Z", "DEBUG", "Loading policy profile: default"),
        ("2024-01-15T09:00:03Z", "INFO", "Executing entrypoint"),
    ];

    for (timestamp, level, message) in placeholder_logs {
        let level_colored = match level {
            "DEBUG" => level.dimmed(),
            "INFO" => level.green(),
            "WARN" => level.yellow(),
            "ERROR" => level.red(),
            _ => level.normal(),
        };

        println!(
            "{} [{}] {}",
            timestamp.dimmed(),
            level_colored,
            message
        );
    }

    println!();
    println!(
        "  {}",
        "(Log streaming not yet implemented - placeholder data shown)"
            .yellow()
            .dimmed()
    );

    if args.follow {
        println!();
        println!("  Following logs... (Press Ctrl+C to exit)");
        tokio::signal::ctrl_c().await?;
    }

    Ok(())
}
