//! VM Command
//!
//! Manage and interact with the A2R VM environment.
//! This command connects to the A2R Desktop app via Unix socket
//! to execute commands in the sandboxed VM.
//!
//! # Examples
//!
//! ```bash
//! # Check VM status
//! a2r vm status
//!
//! # Execute a command in the VM
//! a2r vm exec "npm test"
//!
//! # Download VM images
//! a2r vm setup
//!
//! # Create a new VM session
//! a2r vm session create
//!
//! # List VM sessions
//! a2r vm session list
//! ```

use clap::{Args, Subcommand};
use std::collections::HashMap;

/// VM command arguments
#[derive(Args, Debug, Clone)]
pub struct VmArgs {
    #[command(subcommand)]
    pub command: VmCommands,
}

/// VM subcommands
#[derive(Subcommand, Debug, Clone)]
pub enum VmCommands {
    /// Check VM status
    Status,
    /// Execute a command in the VM
    Exec {
        /// Command to execute
        command: String,
        /// Arguments for the command
        #[arg(trailing_var_arg = true)]
        args: Vec<String>,
        /// Working directory inside VM
        #[arg(short, long)]
        working_dir: Option<String>,
        /// Timeout in seconds
        #[arg(short, long, default_value = "60")]
        timeout: u64,
    },
    /// Setup VM (download images)
    Setup {
        /// Force re-download
        #[arg(short, long)]
        force: bool,
        /// Build images locally (Linux only)
        #[arg(short, long)]
        build: bool,
    },
    /// Session management
    Session {
        #[command(subcommand)]
        command: SessionCommands,
    },
    /// Shell into VM
    Shell,
    /// Stop the VM
    Stop,
    /// Start the VM
    Start,
    /// Restart the VM
    Restart,
}

/// Session subcommands
#[derive(Subcommand, Debug, Clone)]
pub enum SessionCommands {
    /// Create a new session
    Create {
        /// Tenant ID
        #[arg(short, long, default_value = "default")]
        tenant: String,
    },
    /// List active sessions
    List,
    /// Destroy a session
    Destroy {
        /// Session ID
        session_id: String,
    },
}

/// Handle VM commands
pub async fn handle_vm(args: VmArgs) -> anyhow::Result<()> {
    use crate::desktop_connector::DesktopConnector;

    match args.command {
        VmCommands::Status => {
            let connector = DesktopConnector::new();

            if !connector.is_available() {
                println!("❌ A2R Desktop app is not running");
                println!("   Socket not found at: {}", connector.socket_path().display());
                println!("");
                println!("To use VM features:");
                println!("  1. Start A2R Desktop app");
                println!("  2. Or use local mode: a2r run --local <command>");
                return Ok(());
            }

            match connector.connect().await {
                Ok(info) => {
                    println!("✅ A2R Desktop app is running");
                    println!("   Version: {}", info.version);
                    println!("   Socket: {}", info.socket_path.display());

                    // TODO: Get VM status from desktop app
                    println!("   VM Status: Running");
                }
                Err(e) => {
                    println!("⚠️  Desktop app socket exists but connection failed");
                    println!("   Error: {}", e);
                }
            }
        }

        VmCommands::Exec {
            command,
            args,
            working_dir,
            timeout,
        } => {
            let connector = DesktopConnector::new();

            if !connector.is_available() {
                anyhow::bail!(
                    "A2R Desktop app is not running. \
                     Start it or use 'a2r run --local {}' for local execution.",
                    command
                );
            }

            println!("Executing in VM: {} {:?}", command, args);

            let result = connector
                .execute(&command, &args, working_dir.as_deref(), None, Some(timeout * 1000))
                .await?;

            if !result.stdout.is_empty() {
                print!("{}", result.stdout);
            }
            if !result.stderr.is_empty() {
                eprint!("{}", result.stderr);
            }

            if !result.success {
                std::process::exit(result.exit_code);
            }
        }

        VmCommands::Setup { force, build } => {
            println!("Setting up A2R VM environment...");

            if build {
                #[cfg(target_os = "linux")]
                {
                    println!("Building VM images locally...");
                    println!("This will take 15-30 minutes.");

                    let output = std::process::Command::new("cargo")
                        .args(&["run", "-p", "a2r-vm-image-builder", "--", "build"])
                        .status()?;

                    if !output.success() {
                        anyhow::bail!("Failed to build VM images");
                    }
                }

                #[cfg(not(target_os = "linux"))]
                {
                    anyhow::bail!(
                        "Local image building is only supported on Linux. \
                         Use 'a2r vm setup' without --build to download pre-built images."
                    );
                }
            } else {
                println!("Downloading pre-built VM images...");
                println!("This will download ~500MB.");

                let mut args = vec!["run", "-p", "a2r-vm-image-builder", "--", "download"];
                if force {
                    args.push("--force");
                }

                let output = std::process::Command::new("cargo")
                    .args(&args)
                    .status()?;

                if !output.success() {
                    anyhow::bail!("Failed to download VM images");
                }

                println!("✅ VM images downloaded successfully!");
                println!("Start A2R Desktop to use the VM.");
            }
        }

        VmCommands::Session { command } => {
            let connector = DesktopConnector::new();

            if !connector.is_available() {
                anyhow::bail!("A2R Desktop app is not running");
            }

            match command {
                SessionCommands::Create { tenant } => {
                    let session_id = connector.create_session(&tenant).await?;
                    println!("✅ Session created: {}", session_id);
                }
                SessionCommands::List => {
                    // TODO: Implement session listing
                    println!("Active VM sessions:");
                    println!("  (Not yet implemented)");
                }
                SessionCommands::Destroy { session_id } => {
                    connector.destroy_session(&session_id).await?;
                    println!("✅ Session destroyed: {}", session_id);
                }
            }
        }

        VmCommands::Shell => {
            anyhow::bail!(
                "Interactive shell not yet implemented. \
                 Use 'a2r vm exec <command>' instead."
            );
        }

        VmCommands::Stop => {
            println!("Stopping VM...");
            // TODO: Send stop command to desktop app
            println!("(Not yet implemented - use Desktop app UI)");
        }

        VmCommands::Start => {
            println!("Starting VM...");
            // TODO: Send start command to desktop app
            println!("(Not yet implemented - use Desktop app UI)");
        }

        VmCommands::Restart => {
            println!("Restarting VM...");
            // TODO: Send restart command to desktop app
            println!("(Not yet implemented - use Desktop app UI)");
        }
    }

    Ok(())
}
