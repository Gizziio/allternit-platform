//! Model commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct ModelArgs {
    #[command(subcommand)]
    pub command: Option<ModelCommands>,
}

#[derive(clap::Subcommand, Debug, Clone)]
pub enum ModelCommands {
    /// List available models
    List,
    /// Set current model
    Set { model: String },
    /// Get current model
    Get,
}

pub async fn handle_model(_command: ModelCommands, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Model commands - not yet fully implemented");
    Ok(())
}

pub async fn handle_model_args(_args: crate::commands::model::ModelArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Model commands - not yet fully implemented");
    Ok(())
}
