//! Evidence (ev) commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct EvArgs {
    #[command(subcommand)]
    pub command: Option<EvCommands>,
}

#[derive(clap::Subcommand, Debug, Clone)]
pub enum EvCommands {
    /// List evidence
    List,
    /// Add evidence
    Add { path: String },
    /// Verify evidence
    Verify { id: String },
}

pub async fn handle_ev(_command: EvCommands, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Evidence commands - not yet fully implemented");
    Ok(())
}

pub async fn handle_ev_args(_args: crate::commands::ev::EvArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Evidence commands - not yet fully implemented");
    Ok(())
}
