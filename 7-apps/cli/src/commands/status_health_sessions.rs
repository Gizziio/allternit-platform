//! Status, health, sessions commands

use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct StatusArgs;

#[derive(Args, Debug, Clone)]
pub struct HealthArgs;

#[derive(Args, Debug, Clone)]
pub struct SessionsArgs;

pub async fn handle_status(_args: StatusArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Status - not yet fully implemented");
    Ok(())
}

pub async fn handle_health(_args: HealthArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Health - not yet fully implemented");
    Ok(())
}

pub async fn handle_sessions(_args: SessionsArgs, _client: &crate::client::KernelClient) -> anyhow::Result<()> {
    println!("Sessions - not yet fully implemented");
    Ok(())
}
