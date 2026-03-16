//! A2R Command Line Interface
//!
//! Provides terminal access to A2R execution environments:
//! - macOS: Connects to desktop app's shared Apple VF VM (or --vm for ephemeral)
//! - Linux: Uses ProcessDriver by default (or --vm for Firecracker)
//! - SSH/VPS: Boots Firecracker VM per session

use clap::{Parser, Subcommand};
use colored::Colorize;
use tracing::{debug, info};

mod commands;
mod config;
mod cowork;
mod driver_selection;
mod error;
mod logging;
mod persistence;
mod sessions;
mod tokens;

use commands::{run::RunCommand, repl::ReplCommand, shell::ShellCommand};
use cowork::CoworkArgs;
use error::{CliError, Result};
use logging::LogFormat;

/// A2R Command Line Interface
#[derive(Parser)]
#[command(name = "a2r")]
#[command(about = "A2R - AI-native runtime environment")]
#[command(version = "0.1.0")]
struct Cli {
    /// Enable verbose output
    #[arg(short, long, global = true)]
    verbose: bool,

    /// Use VM isolation (slower, more secure)
    /// macOS: Boot ephemeral Apple VF VM instead of using shared desktop VM
    /// Linux: Use Firecracker VM instead of process driver
    #[arg(long, global = true)]
    vm: bool,
    
    /// Output logs in JSON format
    #[arg(long, global = true, env = "A2R_LOG_JSON")]
    json_logs: bool,
    
    /// Log level (trace, debug, info, warn, error)
    #[arg(long, global = true, env = "A2R_LOG_LEVEL")]
    log_level: Option<String>,

    /// Subcommand
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run a command in A2R environment
    #[command(alias = "r")]
    Run {
        /// Command to run
        #[arg(required = true)]
        command: Vec<String>,
        
        /// Working directory
        #[arg(short, long)]
        workdir: Option<String>,
        
        /// Environment variables (KEY=value)
        #[arg(short, long)]
        env: Vec<String>,
        
        /// Timeout in seconds
        #[arg(short, long, default_value = "300")]
        timeout: u64,
        
        /// Language/runtime (auto-detected if not specified)
        #[arg(short, long)]
        language: Option<String>,
    },
    
    /// Start an interactive REPL session
    Repl {
        /// Language for REPL
        #[arg(default_value = "python")]
        language: String,
    },
    
    /// Start an interactive shell session
    Shell {
        /// Shell to use
        #[arg(default_value = "bash")]
        shell: String,
    },
    
    /// List active sessions
    #[command(alias = "ps")]
    Sessions,
    
    /// Kill/destroy a session
    Kill {
        /// Session ID or name
        session_id: String,
    },
    
    /// VM management commands
    Vm {
        #[command(subcommand)]
        command: VmCommands,
    },
    
    /// Check A2R status and connectivity
    Status,
    
    /// Login to A2R cloud
    Login,
    
    /// Logout from A2R cloud
    Logout,
    
    /// Cowork mode - persistent remote execution
    #[command(alias = "cw")]
    Cowork(CoworkArgs),
}

#[derive(Subcommand)]
enum VmCommands {
    /// List running VMs
    List,
    
    /// Boot a new VM
    Boot,
    
    /// Stop/destroy a VM
    Stop {
        /// VM ID
        vm_id: String,
    },
    
    /// Show VM logs
    Logs {
        /// VM ID
        vm_id: String,
    },
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();
    
    // Load config first to get logging settings
    let config = match config::load_config().await {
        Ok(cfg) => cfg,
        Err(e) => {
            eprintln!("{} Failed to load config: {}", "Error:".red().bold(), e);
            std::process::exit(1);
        }
    };
    
    // Determine log level (CLI arg > env var > config > default)
    let log_level = cli.log_level.as_ref()
        .cloned()
        .or_else(|| std::env::var("A2R_LOG_LEVEL").ok())
        .unwrap_or_else(|| if cli.verbose { "debug".to_string() } else { config.production.log_level.clone() });
    
    // Determine log format
    let log_format = if cli.json_logs || config.production.log_format == LogFormat::Json {
        LogFormat::Json
    } else {
        LogFormat::Pretty
    };
    
    // Initialize structured logging
    if let Err(e) = logging::init_logging(&log_level, log_format, None) {
        eprintln!("{} Failed to initialize logging: {}", "Warning:".yellow().bold(), e);
        // Fall back to basic logging
        logging::init_logging_simple(&log_level);
    }
    
    info!(
        target: "a2r::main",
        version = env!("CARGO_PKG_VERSION"),
        log_level = %log_level,
        ?log_format,
        "A2R CLI starting"
    );
    
    if let Err(e) = run(cli, config).await {
        tracing::error!(target: "a2r::main", error = %e, "CLI execution failed");
        eprintln!("{} {}", "Error:".red().bold(), e);
        std::process::exit(e.exit_code());
    }
    
    info!(target: "a2r::main", "A2R CLI exiting normally");
}

async fn run(cli: Cli, config: config::Config) -> Result<()> {
    
    match cli.command {
        Commands::Run { 
            command, 
            workdir, 
            env, 
            timeout,
            language,
        } => {
            let cmd = RunCommand {
                command,
                workdir,
                env,
                timeout,
                language,
                use_vm: cli.vm,
            };
            cmd.execute(config).await?;
        }
        
        Commands::Repl { language } => {
            let cmd = ReplCommand { language, use_vm: cli.vm };
            cmd.execute(config).await?;
        }
        
        Commands::Shell { shell } => {
            let cmd = ShellCommand { shell, use_vm: cli.vm };
            cmd.execute(config).await?;
        }
        
        Commands::Sessions => {
            commands::sessions::list_sessions(config).await?;
        }
        
        Commands::Kill { session_id } => {
            commands::sessions::kill_session(config, session_id).await?;
        }
        
        Commands::Vm { command } => {
            match command {
                VmCommands::List => commands::vm::list_vms(config).await?,
                VmCommands::Boot => commands::vm::boot_vm(config).await?,
                VmCommands::Stop { vm_id } => commands::vm::stop_vm(config, vm_id).await?,
                VmCommands::Logs { vm_id } => commands::vm::show_logs(config, vm_id).await?,
            }
        }
        
        Commands::Status => {
            commands::status::show_status(config).await?;
        }
        
        Commands::Login => {
            commands::auth::login(config).await?;
        }
        
        Commands::Logout => {
            commands::auth::logout(config).await?;
        }
        
        Commands::Cowork(args) => {
            cowork::execute(args).await
                .map_err(|e| CliError::Internal(e.to_string()))?;
        }
    }
    
    Ok(())
}
