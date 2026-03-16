//! OpenClaw compatibility layer

use anyhow::Result;
use crate::bootstrap::BootstrapContext;
use crate::client::KernelClient;
use crate::config::ConfigManager;

/// Handle external OpenClaw-compatible commands
pub async fn handle_external(
    _words: &[String],
    _bootstrap: &BootstrapContext,
    _config_manager: &mut ConfigManager,
    _client: &KernelClient,
) -> Result<()> {
    // OpenClaw compatibility - pass through to kernel
    println!("OpenClaw compatibility - command not yet implemented");
    Ok(())
}
