//! Fast Route Handler
//!
//! Handles quick command routing for common operations before
//! falling through to the main command handler.

use anyhow::Result;

/// Try to handle a fast route command
/// 
/// Returns Ok(true) if the command was handled, Ok(false) to fall through to main handler
pub async fn try_handle() -> Result<bool> {
    // Check for quick commands that don't need full initialization
    let args: Vec<String> = std::env::args().collect();
    
    if args.len() < 2 {
        return Ok(false);
    }

    let cmd = &args[1];

    // Handle version flag
    if cmd == "--version" || cmd == "-V" {
        println!("a2rchitech {}", env!("CARGO_PKG_VERSION"));
        return Ok(true);
    }

    // Handle help flag
    if cmd == "--help" || cmd == "-h" {
        print_help();
        return Ok(true);
    }

    // Not a fast route command, fall through to main handler
    Ok(false)
}

/// Print help message
fn print_help() {
    println!("A2rchitech CLI - Sovereign OS Interface");
    println!();
    println!("USAGE:");
    println!("    a2 <COMMAND> [OPTIONS]");
    println!();
    println!("COMMANDS:");
    println!("    up, start       Start the brain daemon");
    println!("    down, stop      Stop the brain daemon");
    println!("    status, ps      Check system status");
    println!("    health          Fetch health from kernel");
    println!("    sessions        List stored/running sessions");
    println!("    doctor          Diagnostic tool");
    println!("    logs            Show daemon logs");
    println!("    daemon          Manage daemon lifecycle");
    println!();
    println!("    ev              Evidence management");
    println!("    cap             Capsule operations");
    println!("    j               Journal interaction");
    println!("    tools           Tool and action management");
    println!("    skills          Skills and publisher key management");
    println!();
    println!("    auth            Authentication and provider setup");
    println!("    model           Model selection and configuration");
    println!("    run             Send a one-shot intent");
    println!("    repl            Start an interactive chat session");
    println!("    tui             Launch the Operator Workspace (TUI)");
    println!("    rlm             RLM mode and session management");
    println!();
    println!("    voice           Voice operations (TTS and voice cloning)");
    println!("    webvm           WebVM operations");
    println!("    marketplace     Marketplace operations");
    println!("    brain           Brain session management");
    println!("    task            Task graph operations");
    println!();
    println!("OPTIONS:");
    println!("    --profile <PROFILE>    Runtime profile (overrides A2R_PROFILE)");
    println!("    --help, -h             Print help");
    println!("    --version, -V          Print version");
    println!();
    println!("OpenClaw-compatible native commands:");
    println!("  setup onboard configure dashboard reset uninstall update agent agents gateway");
    println!("  models memory message browser system docs acp nodes node devices approvals");
    println!("  sandbox cron dns hooks webhooks pairing plugins channels security directory");
}
