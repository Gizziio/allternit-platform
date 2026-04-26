//! TUI Binary - Entry point for the native TUI service
//!
//! This binary provides the command-line interface to the native TUI service
//! that was implemented as part of the OpenClaw absorption project.

use allternit_openclaw_host::{TuiConfig, TuiService, TuiTheme};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting Allternit Native TUI Service...");

    // Create TUI service with configuration (overridable via Allternit_TUI_CONFIG)
    let config = TuiConfig {
        theme: TuiTheme::default(),
        ..Default::default()
    };
    let mut tui_service = TuiService::with_config(config);

    // Initialize the service
    tui_service.initialize().await?;

    println!("TUI service initialized. Starting interactive mode...");

    // Run the interactive TUI
    match tui_service.run_interactive().await {
        Ok(()) => {
            println!("TUI exited normally");
        }
        Err(e) => {
            eprintln!("TUI error: {}", e);
        }
    }

    Ok(())
}
