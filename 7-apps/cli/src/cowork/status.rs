//! Show current attachment status

use clap::Args;
use colored::Colorize;

use super::{get_api_url, get_current_attachment, print_header, print_info, print_success};

/// Status command arguments
#[derive(Args, Debug)]
pub struct StatusArgs {
    /// Show detailed information
    #[arg(short, long)]
    pub verbose: bool,
}

/// Execute the status command
pub async fn execute(args: StatusArgs) -> anyhow::Result<()> {
    print_header("Cowork Status");

    // Check for current attachment
    if let Some(attachment) = get_current_attachment()? {
        print_success("Currently attached to a run");
        println!();

        print_info("Run ID:", &attachment.run_id);
        print_info("Attachment ID:", &attachment.attachment_id);
        print_info("Token:", &format!("{}...", &attachment.reconnect_token[..16]));
        print_info("Last Cursor:", &attachment.last_cursor);

        // Fetch run details from API
        let client = reqwest::Client::new();
        let api_url = get_api_url();

        let run_response = client
            .get(format!(
                "{}/rails/cowork/runs/{}",
                api_url, attachment.run_id
            ))
            .send()
            .await;

        match run_response {
            Ok(response) if response.status().is_success() => {
                let run: serde_json::Value = response.json().await?;

                println!();
                print_info("Run State:", run["state"].as_str().unwrap_or("unknown"));
                print_info("Mode:", run["mode"].as_str().unwrap_or("unknown"));
                print_info("Entrypoint:", run["entrypoint"].as_str().unwrap_or("unknown"));

                if args.verbose {
                    println!();
                    print_info("Tenant:", run["tenant_id"].as_str().unwrap_or("unknown"));
                    print_info("Workspace:", run["workspace_id"].as_str().unwrap_or("unknown"));
                    print_info("Initiator:", run["initiator"].as_str().unwrap_or("unknown"));
                    print_info("Policy:", run["policy_profile"].as_str().unwrap_or("unknown"));
                    print_info("Created:", run["created_at"].as_str().unwrap_or("unknown"));
                    print_info("Updated:", run["updated_at"].as_str().unwrap_or("unknown"));

                    if let Some(completed_at) = run["completed_at"].as_str() {
                        print_info("Completed:", completed_at);
                    }
                }

                // List other attachments
                let attachments_response = client
                    .get(format!(
                        "{}/rails/cowork/runs/{}/attachments",
                        api_url, attachment.run_id
                    ))
                    .send()
                    .await;

                if let Ok(response) = attachments_response {
                    if response.status().is_success() {
                        let attachments: Vec<serde_json::Value> = response.json().await?;
                        let other_attachments: Vec<_> = attachments
                            .iter()
                            .filter(|a| {
                                a["id"].as_str() != Some(&attachment.attachment_id)
                            })
                            .collect();

                        if !other_attachments.is_empty() {
                            println!();
                            println!(
                                "  {} other session(s) attached:",
                                other_attachments.len()
                            );
                            for att in other_attachments {
                                let client_type = att["client_type"].as_str().unwrap_or("unknown");
                                let state = att["state"].as_str().unwrap_or("unknown");
                                println!(
                                    "    - {} session ({})",
                                    client_type,
                                    state.dimmed()
                                );
                            }
                        }
                    }
                }
            }
            _ => {
                println!();
                println!(
                    "  {} Could not fetch run details from API",
                    "⚠".yellow()
                );
            }
        }

        println!();
        println!("  Commands:");
        println!(
            "    {}  - Stream events from the run",
            "a2r cowork attach".cyan()
        );
        println!(
            "    {}  - Detach and keep running",
            "a2r cowork detach".cyan()
        );
        println!(
            "    {}    - View run logs",
            "a2r cowork logs".cyan()
        );
    } else {
        println!("  {} Not currently attached to any run", "○".dimmed());
        println!();
        println!("  Commands:");
        println!(
            "    {} <entrypoint>  - Start a new run",
            "a2r cowork start".cyan()
        );
        println!(
            "    {} <run_id>      - Attach to an existing run",
            "a2r cowork attach".cyan()
        );
        println!(
            "    {}              - List active runs",
            "a2r cowork list".cyan()
        );
    }

    Ok(())
}
