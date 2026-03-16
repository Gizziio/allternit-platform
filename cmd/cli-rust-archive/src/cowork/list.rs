//! List active cowork runs

use clap::Args;
use colored::Colorize;

use super::{get_api_url, print_error, print_header, print_info};

/// List command arguments
#[derive(Args, Debug)]
pub struct ListArgs {
    /// Filter by state
    #[arg(short, long)]
    pub state: Option<String>,

    /// Show all runs (including completed)
    #[arg(short, long)]
    pub all: bool,

    /// Limit number of results
    #[arg(short, long, default_value = "20")]
    pub limit: usize,

    /// Output format (table, json)
    #[arg(short, long, default_value = "table")]
    pub format: String,
}

/// Execute the list command
pub async fn execute(args: ListArgs) -> anyhow::Result<()> {
    print_header("Active Cowork Runs");

    let client = reqwest::Client::new();
    let api_url = get_api_url();

    // Build query parameters
    let mut query = vec![];
    if let Some(state) = args.state {
        query.push(("state", state));
    }

    let response = client
        .get(format!("{}/rails/cowork/runs", api_url))
        .query(&query)
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        print_error(&format!("Failed to list runs: {}", error_text));
        return Ok(());
    }

    let runs: Vec<serde_json::Value> = response.json().await?;

    if runs.is_empty() {
        println!("  No runs found.");
        println!();
        println!(
            "  Start a new run with: {}",
            "a2r cowork start <entrypoint>".cyan()
        );
        return Ok(());
    }

    match args.format.as_str() {
        "json" => {
            println!("{}", serde_json::to_string_pretty(&runs)?);
        }
        _ => {
            // Table format
            println!(
                "  {:<36} {:<12} {:<16} {:<20} {}",
                "RUN ID".bold(),
                "STATE".bold(),
                "MODE".bold(),
                "ENTRYPOINT".bold(),
                "CREATED".bold()
            );
            println!(
                "  {}",
                "─".repeat(100).dimmed()
            );

            for run in runs.iter().take(args.limit) {
                let id = run["id"].as_str().unwrap_or("unknown");
                let state = run["state"].as_str().unwrap_or("unknown");
                let mode = run["mode"].as_str().unwrap_or("unknown");
                let entrypoint = run["entrypoint"].as_str().unwrap_or("unknown");
                let created = run["created_at"].as_str().unwrap_or("unknown");

                // Truncate long strings
                let id_short = &id[..8];
                let entrypoint_short = if entrypoint.len() > 16 {
                    format!("{}...", &entrypoint[..13])
                } else {
                    entrypoint.to_string()
                };
                let created_short = if created.len() > 19 {
                    created[..19].to_string()
                } else {
                    created.to_string()
                };

                // Colorize state
                let state_colored = match state {
                    "running" => state.green(),
                    "completed" => state.green(),
                    "failed" => state.red(),
                    "paused" => state.yellow(),
                    "awaiting_approval" => state.yellow(),
                    "recovering" => state.cyan(),
                    _ => state.normal(),
                };

                println!(
                    "  {:<36} {:<12} {:<16} {:<20} {}",
                    id_short.cyan(),
                    state_colored,
                    mode.dimmed(),
                    entrypoint_short,
                    created_short.dimmed()
                );
            }

            if runs.len() > args.limit {
                println!();
                println!(
                    "  ... and {} more (use --limit to show more)",
                    runs.len() - args.limit
                );
            }
        }
    }

    println!();
    print_info("Total:", &format!("{} run(s)", runs.len()));

    Ok(())
}
