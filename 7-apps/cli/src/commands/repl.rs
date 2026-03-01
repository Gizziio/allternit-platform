//! REPL (interactive chat) commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct ReplArgs;

pub async fn handle_repl(_client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("REPL - not yet fully implemented");
    Ok(())
}
