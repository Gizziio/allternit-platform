//! Run (one-shot intent) commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct RunArgs {
    /// Intent text
    #[arg(required = true)]
    pub intent: String,

    /// Agent ID
    #[arg(long)]
    pub agent: Option<String>,

    /// Model to use
    #[arg(long)]
    pub model: Option<String>,
}

pub async fn handle_run(_args: RunArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Run command - not yet fully implemented");
    Ok(())
}
