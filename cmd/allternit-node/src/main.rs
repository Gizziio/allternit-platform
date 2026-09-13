//! Allternit Node Daemon — always-on `node.core` presence without the
//! desktop app. The daemon adopts the paired runtime's identity and holds a
//! relay connection with a reduced, capability-gated surface so Fabric
//! Transport can use a paired machine (terminal, files, exec, metrics, and
//! launching the desktop app) regardless of whether Allternit Desktop runs.

use std::path::PathBuf;

use allternit_node_daemon::handlers::DaemonState;
use allternit_node_daemon::{config, identity, relay, service};
use clap::{Parser, Subcommand};

#[derive(Debug, Parser)]
#[command(name = "allternit-node", about = "Allternit Node Daemon — always-on node.core presence")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Run the daemon in the foreground (the service entry point).
    Run,
    /// Install the LaunchDaemon (macOS) / systemd unit (Linux).
    Install,
    /// Remove the service. The desktop app is never touched; the shared
    /// pairing identity is kept unless --purge is passed.
    Uninstall {
        /// Also remove the shared pairing identity and node config. This
        /// unpairs Allternit Desktop too.
        #[arg(long)]
        purge: bool,
    },
    /// Print service status.
    Status,
    /// Show recent daemon logs.
    Logs,
}

fn default_config_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    PathBuf::from(home)
        .join(".config")
        .join("allternit")
        .join("node-config.json")
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let cli = Cli::parse();
    match cli.command {
        Command::Run => {
            let config = config::NodeConfig::load()?;
            let identity = identity::RuntimeIdentity::load(&config.identity_path)?;
            let state = DaemonState::new(config.clone());
            tracing::info!(
                runtime_id = %identity.runtime_id,
                cloud = %config.cloud_api_url,
                "allternit-node {} starting (node.core: health, exec, fs, processes, metrics, launch, terminal)",
                env!("CARGO_PKG_VERSION"),
            );
            relay::run(config, identity, state).await;
            Ok(())
        }
        Command::Install => {
            let config = config::NodeConfig::load()?;
            let binary = std::env::current_exe()?;
            match service::install(&binary, &config.identity_path) {
                Ok(message) => {
                    println!("{message}");
                    Ok(())
                }
                Err(message) => {
                    eprintln!("{message}");
                    std::process::exit(1);
                }
            }
        }
        Command::Uninstall { purge } => {
            let config = config::NodeConfig::load().unwrap_or_default();
            match service::uninstall(&config.identity_path, &default_config_path(), purge) {
                Ok(message) => {
                    println!("{message}");
                    Ok(())
                }
                Err(message) => {
                    eprintln!("{message}");
                    std::process::exit(1);
                }
            }
        }
        Command::Status => {
            println!("{}", service::status());
            Ok(())
        }
        Command::Logs => {
            println!("{}", service::logs());
            Ok(())
        }
    }
}
