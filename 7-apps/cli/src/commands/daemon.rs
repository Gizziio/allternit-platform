//! Daemon commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct DaemonArgs {
    #[command(subcommand)]
    pub command: DaemonCommands,
}

#[derive(clap::Subcommand, Debug, Clone)]
pub enum DaemonCommands {
    /// Start the daemon
    Up,
    /// Stop the daemon
    Down,
    /// Check daemon status
    Status,
    /// Show daemon logs
    Logs {
        #[arg(short, long)]
        follow: bool,
    },
    /// Run diagnostics
    Doctor,
}

pub async fn handle_daemon(command: DaemonCommands, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    match command {
        DaemonCommands::Up => println!("Starting daemon..."),
        DaemonCommands::Down => println!("Stopping daemon..."),
        DaemonCommands::Status => println!("Daemon status: running"),
        DaemonCommands::Logs { follow } => {
            println!("Logs (follow={})", follow);
        }
        DaemonCommands::Doctor => println!("Running diagnostics..."),
    }
    Ok(())
}
