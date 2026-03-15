//! Start a new cowork run

use clap::Args;
use colored::Colorize;
use std::process;

use super::{get_api_url, get_session_id, print_error, print_header, print_info, print_success};

/// Start command arguments
#[derive(Args, Debug)]
pub struct StartArgs {
    /// The entrypoint to execute (e.g., "agent:plan", "skill:analyze")
    pub entrypoint: String,

    /// Arguments to pass to the entrypoint
    pub args: Vec<String>,

    /// Run mode (interactive, cowork, scheduled)
    #[arg(short, long, default_value = "cowork")]
    pub mode: String,

    /// Policy profile to use
    #[arg(short, long)]
    pub policy: Option<String>,

    /// Tenant ID
    #[arg(long, env = "A2R_TENANT_ID", default_value = "default")]
    pub tenant: String,

    /// Workspace ID
    #[arg(long, env = "A2R_WORKSPACE_ID", default_value = "default")]
    pub workspace: String,

    /// Initiator (user/agent identity)
    #[arg(long, env = "A2R_INITIATOR", default_value = "user")]
    pub initiator: String,

    /// Don't attach immediately after starting
    #[arg(long)]
    pub no_attach: bool,
}

/// Execute the start command
pub async fn execute(args: StartArgs) -> anyhow::Result<()> {
    print_header("Starting Cowork Run");

    print_info("Entrypoint:", &args.entrypoint);
    if !args.args.is_empty() {
        print_info("Arguments:", &args.args.join(" "));
    }
    print_info("Mode:", &args.mode);
    print_info("Tenant:", &args.tenant);
    print_info("Workspace:", &args.workspace);
    print_info("Initiator:", &args.initiator);
    println!();

    let client = reqwest::Client::new();
    let api_url = get_api_url();

    // Build the request
    let request = serde_json::json!({
        "tenant_id": args.tenant,
        "workspace_id": args.workspace,
        "initiator": args.initiator,
        "mode": args.mode,
        "entrypoint": args.entrypoint,
        "policy_profile": args.policy,
    });

    // Send the request
    let response = client
        .post(format!("{}/rails/cowork/runs", api_url))
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        print_error(&format!("Failed to create run: {}", error_text));
        process::exit(1);
    }

    let run: serde_json::Value = response.json().await?;
    let run_id = run["id"].as_str().unwrap_or("unknown");

    print_success(&format!("Run created with ID: {}", run_id.cyan().bold()));
    print_info("State:", run["state"].as_str().unwrap_or("unknown"));
    print_info("Created:", run["created_at"].as_str().unwrap_or("unknown"));
    println!();

    // Attach to the run unless --no-attach was specified
    if !args.no_attach {
        print_info("Attaching to run...", "");

        let session_id = get_session_id();
        let attach_request = serde_json::json!({
            "client_type": "terminal",
            "session_id": session_id,
            "permissions": {
                "read": true,
                "write": true,
                "approve": true,
                "admin": true
            }
        });

        let attach_response = client
            .post(format!("{}/rails/cowork/runs/{}/attach", api_url, run_id))
            .json(&attach_request)
            .send()
            .await?;

        if !attach_response.status().is_success() {
            let error_text = attach_response.text().await?;
            print_error(&format!("Failed to attach: {}", error_text));
            println!();
            println!("  Run is still starting. You can attach later with:");
            println!(
                "    {}",
                format!("a2r cowork attach {}", run_id).cyan()
            );
            process::exit(1);
        }

        let attachment: serde_json::Value = attach_response.json().await?;
        let token = attachment["reconnect_token"].as_str().unwrap_or("");

        // Save attachment state
        let state = super::AttachmentState {
            run_id: run_id.to_string(),
            attachment_id: attachment["id"].as_str().unwrap_or("").to_string(),
            reconnect_token: token.to_string(),
            last_cursor: "0".to_string(),
        };
        super::save_attachment_state(&state)?;

        print_success(&format!(
            "Attached to run. Token: {}",
            token[..8.min(token.len())].dimmed()
        ));
        println!();

        // Start streaming events
        println!("{}", "Streaming events from run...".dimmed());
        println!("{}", "Press Ctrl+C to detach (run will continue remotely)\n".dimmed());

        // TODO: Implement event streaming from WebSocket
        // For now, just show a placeholder
        println!("{}", "Event streaming not yet implemented".yellow());
        println!("  Run {} is executing remotely", run_id.cyan());
        println!("  Use {} to reattach later", format!("a2r cowork attach {}", run_id).cyan());
    } else {
        println!();
        println!("  Run {} is starting remotely", run_id.cyan());
        println!("  Use {} to attach", format!("a2r cowork attach {}", run_id).cyan());
    }

    Ok(())
}
