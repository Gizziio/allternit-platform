//! Attach to an existing cowork run

use clap::Args;
use colored::Colorize;
use std::process;

use super::{
    confirm, get_api_url, get_session_id, print_error, print_header, print_info, print_success,
    save_attachment_state, AttachmentState,
};

/// Attach command arguments
#[derive(Args, Debug)]
pub struct AttachArgs {
    /// The run ID to attach to (or use --token for reattach)
    pub run_id: Option<String>,

    /// Reattach using a saved token
    #[arg(long)]
    pub token: Option<String>,

    /// Start streaming from this cursor position
    #[arg(long)]
    pub cursor: Option<String>,

    /// Attach in read-only mode (no input)
    #[arg(long)]
    pub readonly: bool,

    /// Force attach even if another session is active
    #[arg(long)]
    pub force: bool,
}

/// Execute the attach command
pub async fn execute(args: AttachArgs) -> anyhow::Result<()> {
    print_header("Attaching to Cowork Run");

    let client = reqwest::Client::new();
    let api_url = get_api_url();

    // Determine attachment method
    if let Some(token) = args.token {
        // Reattach using token
        print_info("Reattaching using token:", &format!("{}...", &token[..8.min(token.len())]));

        let request = serde_json::json!({
            "token": token,
            "cursor": args.cursor
        });

        let response = client
            .post(format!("{}/rails/cowork/reattach", api_url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            print_error(&format!("Failed to reattach: {}", error_text));
            process::exit(1);
        }

        let attachment: serde_json::Value = response.json().await?;
        let run_id = attachment["run_id"].as_str().unwrap_or("unknown");
        let new_token = attachment["reconnect_token"].as_str().unwrap_or("");

        // Save attachment state
        let state = AttachmentState {
            run_id: run_id.to_string(),
            attachment_id: attachment["id"].as_str().unwrap_or("").to_string(),
            reconnect_token: new_token.to_string(),
            last_cursor: args.cursor.unwrap_or_else(|| "0".to_string()),
        };
        save_attachment_state(&state)?;

        print_success(&format!("Reattached to run {}", run_id.cyan().bold()));
        println!();

        start_event_stream(run_id, &state).await?;
    } else if let Some(run_id) = args.run_id {
        // New attachment to a specific run
        print_info("Attaching to run:", &run_id);

        // First, get run info to check state
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

        print_info("Run state:", state);

        // Check if run is attachable
        if !["running", "paused", "awaiting_approval"].contains(&state) {
            print_error(&format!("Run is not attachable (state: {})", state));
            println!();
            println!("  Only runs in the following states can be attached:");
            println!("    - running");
            println!("    - paused");
            println!("    - awaiting_approval");
            process::exit(1);
        }

        // List current attachments
        let attachments_response = client
            .get(format!("{}/rails/cowork/runs/{}/attachments", api_url, run_id))
            .send()
            .await?;

        if attachments_response.status().is_success() {
            let attachments: Vec<serde_json::Value> = attachments_response.json().await?;
            if !attachments.is_empty() {
                println!();
                println!("  {} other session(s) currently attached:", attachments.len());
                for att in &attachments {
                    let client_type = att["client_type"].as_str().unwrap_or("unknown");
                    let session_id = att["client_session_id"].as_str().unwrap_or("unknown");
                    println!("    - {} session {}", client_type, session_id[..8.min(session_id.len())].to_string().dimmed());
                }

                if !args.force && !confirm("Another session is attached. Continue?") {
                    println!();
                    println!("  Attachment cancelled. Use --force to attach anyway.");
                    process::exit(0);
                }
            }
        }

        // Create attachment
        let session_id = get_session_id();
        let permissions = if args.readonly {
            serde_json::json!({
                "read": true,
                "write": false,
                "approve": false,
                "admin": false
            })
        } else {
            serde_json::json!({
                "read": true,
                "write": true,
                "approve": true,
                "admin": false
            })
        };

        let attach_request = serde_json::json!({
            "client_type": "terminal",
            "session_id": session_id,
            "permissions": permissions
        });

        let attach_response = client
            .post(format!("{}/rails/cowork/runs/{}/attach", api_url, run_id))
            .json(&attach_request)
            .send()
            .await?;

        if !attach_response.status().is_success() {
            let error_text = attach_response.text().await?;
            print_error(&format!("Failed to attach: {}", error_text));
            process::exit(1);
        }

        let attachment: serde_json::Value = attach_response.json().await?;
        let token = attachment["reconnect_token"].as_str().unwrap_or("");

        // Save attachment state
        let state = AttachmentState {
            run_id: run_id.to_string(),
            attachment_id: attachment["id"].as_str().unwrap_or("").to_string(),
            reconnect_token: token.to_string(),
            last_cursor: "0".to_string(),
        };
        save_attachment_state(&state)?;

        print_success(&format!("Attached to run {}", run_id.cyan().bold()));
        if args.readonly {
            println!("  (Read-only mode)");
        }
        println!();

        start_event_stream(&run_id, &state).await?;
    } else {
        // Try to reattach using saved state
        if let Some(saved_state) = super::get_current_attachment()? {
            print_info("Found saved attachment:", &saved_state.run_id);
            print_info("Reattaching...", "");

            let cursor = args.cursor.clone().or_else(|| Some(saved_state.last_cursor));
            let request = serde_json::json!({
                "token": saved_state.reconnect_token,
                "cursor": cursor
            });

            let response = client
                .post(format!("{}/rails/cowork/reattach", api_url))
                .json(&request)
                .send()
                .await?;

            if response.status().is_success() {
                let attachment: serde_json::Value = response.json().await?;
                let run_id = attachment["run_id"].as_str().unwrap_or("unknown");
                let new_token = attachment["reconnect_token"].as_str().unwrap_or("");

                let state = AttachmentState {
                    run_id: run_id.to_string(),
                    attachment_id: attachment["id"].as_str().unwrap_or("").to_string(),
                    reconnect_token: new_token.to_string(),
                    last_cursor: args.cursor.clone().unwrap_or_else(|| "0".to_string()),
                };
                save_attachment_state(&state)?;

                print_success(&format!("Reattached to run {}", run_id.cyan().bold()));
                println!();

                start_event_stream(run_id, &state).await?;
            } else {
                print_error("Saved attachment token is invalid or expired");
                println!();
                println!("  Please specify a run ID to attach:");
                println!("    {}", "a2r cowork attach <run_id>".cyan());
                process::exit(1);
            }
        } else {
            print_error("No run ID specified and no saved attachment found");
            println!();
            println!("  Usage:");
            println!("    a2r cowork attach <run_id>     # Attach to a specific run");
            println!("    a2r cowork attach --token <t>  # Reattach using a token");
            process::exit(1);
        }
    }

    Ok(())
}

/// Start streaming events from the run
async fn start_event_stream(run_id: &str, state: &AttachmentState) -> anyhow::Result<()> {
    println!("{}", "Streaming events from run...".dimmed());
    println!(
        "{}",
        "Press Ctrl+C to detach (run will continue remotely)\n".dimmed()
    );

    // TODO: Implement WebSocket event streaming
    // For now, show a placeholder
    println!("{}", "Event streaming not yet implemented".yellow());
    println!("  Run {} is executing remotely", run_id.cyan());
    println!(
        "  Use {} to reattach",
        format!("a2r cowork attach --token {}", &state.reconnect_token[..16])
            .cyan()
    );

    // Keep the process running until interrupted
    tokio::signal::ctrl_c().await?;

    println!();
    println!("  {} Detaching from run...", "→".yellow());
    println!("  Run {} will continue remotely", run_id.cyan());

    Ok(())
}
