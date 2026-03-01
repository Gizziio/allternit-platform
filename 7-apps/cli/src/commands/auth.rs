//! Auth commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct AuthArgs {
    #[command(subcommand)]
    pub command: Option<AuthCommands>,
}

#[derive(clap::Subcommand, Debug, Clone)]
pub enum AuthCommands {
    /// Set authentication for a provider
    Set {
        provider: String,
        #[arg(long)]
        api_key: Option<String>,
    },
    /// Check authentication status
    Status,
    /// List configured providers
    List,
}

pub async fn handle_auth(_args: AuthArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Auth commands - not yet fully implemented");
    Ok(())
}
