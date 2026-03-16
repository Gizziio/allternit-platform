//! Task graph commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct TaskGraphArgs {
    #[command(subcommand)]
    pub command: Option<TaskGraphCommands>,
}

#[derive(clap::Subcommand, Debug, Clone)]
pub enum TaskGraphCommands {
    /// List task graphs
    List,
    /// Install task graph
    Install { path: String },
    /// Execute task graph
    Run { id: String },
}

pub async fn handle_taskgraph(_command: TaskGraphCommands, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Task graph commands - not yet fully implemented");
    Ok(())
}

pub async fn handle_taskgraph_args(_args: crate::commands::taskgraph::TaskGraphArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Task graph commands - not yet fully implemented");
    Ok(())
}
