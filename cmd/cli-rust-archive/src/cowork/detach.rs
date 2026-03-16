//! Detach from the current cowork run

use clap::Args;
use colored::Colorize;
use std::process;

use super::{
    clear_attachment_state, get_api_url, get_current_attachment, print_error, print_header,
    print_info, print_success,
};

/// Detach command arguments
#[derive(Args, Debug)]
pub struct DetachArgs {
    /// Don't confirm before detaching
    #[arg(short, long)]
    pub yes: bool,

    /// Stop the run after detaching (cancel it)
    #[arg(long)]
    pub stop: bool,
}

/// Execute the detach command
pub async fn execute(args: DetachArgs) -> anyhow::Result<()> {
    print_header("Detaching from Cowork Run");

    // Get current attachment
    let attachment = match get_current_attachment()? {
        Some(att) => att,
        None => {
            print_error("Not currently attached to any run");
            println!();
            println!("  Use {} to see active runs", "a2r cowork list".cyan());
            println!(
                "  Use {} to attach to a run",
                "a2r cowork attach <run_id>".cyan()
            );
            process::exit(1);
        }
    };

    print_info("Run ID:", &attachment.run_id);
    print_info("Attachment ID:", &attachment.attachment_id[..16]);
    println!();

    if args.stop {
        // Confirm stopping the run
        if !args.yes {
            println!(
                "  {} This will {} the run after detaching!",
                "⚠".yellow().bold(),
                "STOP".red().bold()
            );
            println!();

            print!(
                "{} {} ",
                "?".yellow().bold(),
                "Are you sure you want to stop this run? [y/N]:"
            );
            std::io::Write::flush(&mut std::io::stdout())?;

            let mut input = String::new();
            std::io::stdin().read_line(&mut input)?;

            if !matches!(input.trim().to_lowercase().as_str(), "y" | "yes") {
                println!();
                println!("  Cancelled. Run will continue.");
                return Ok(());
            }
        }
    } else {
        print_info("Note:", "Run will continue executing remotely after detach");
        println!();
    }

    let client = reqwest::Client::new();
    let api_url = get_api_url();

    // Call detach endpoint
    let response = client
        .post(format!(
            "{}/rails/cowork/attachments/{}/detach",
            api_url, attachment.attachment_id
        ))
        .send()
        .await?;

    if !response.status().is_success() {
        let error_text = response.text().await?;
        print_error(&format!("Failed to detach: {}", error_text));
        process::exit(1);
    }

    // Clear local attachment state
    clear_attachment_state()?;

    print_success("Detached successfully");

    if args.stop {
        // Stop (cancel) the run
        let stop_response = client
            .post(format!(
                "{}/rails/cowork/runs/{}/cancel",
                api_url, attachment.run_id
            ))
            .send()
            .await?;

        if stop_response.status().is_success() {
            print_success(&format!("Run {} stopped", attachment.run_id.cyan()));
        } else {
            let error_text = stop_response.text().await?;
            print_error(&format!("Failed to stop run: {}", error_text));
        }
    } else {
        println!();
        println!("  Run {} will continue remotely", attachment.run_id.cyan());
        println!();
        println!("  To reattach later, use:");
        println!(
            "    {}",
            format!("a2r cowork attach --token {}", attachment.reconnect_token).cyan()
        );
    }

    Ok(())
}
