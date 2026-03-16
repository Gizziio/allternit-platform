//! Tools commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct ToolsArgs {
    #[command(subcommand)]
    pub command: Option<ToolsCommands>,
}

#[derive(clap::Subcommand, Debug, Clone)]
pub enum ToolsCommands {
    /// List tools
    List,
    /// Execute tool
    Run { name: String },
}

pub async fn handle_tools(_command: ToolsCommands, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Tools commands - not yet fully implemented");
    Ok(())
}

pub async fn handle_tools_args(_args: crate::commands::tools::ToolsArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Tools commands - not yet fully implemented");
    Ok(())
}
