//! Cap (capsule) commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct CapArgs {
    #[command(subcommand)]
    pub command: Option<CapCommands>,
}

#[derive(clap::Subcommand, Debug, Clone)]
pub enum CapCommands {
    /// List capsules
    List,
    /// Get capsule info
    Get { id: String },
    /// Compile capsule
    Compile { id: String },
}

pub async fn handle_cap(_command: CapCommands, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Cap commands - not yet fully implemented");
    Ok(())
}

pub async fn handle_cap_args(_args: crate::commands::cap::CapArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Cap commands - not yet fully implemented");
    Ok(())
}
