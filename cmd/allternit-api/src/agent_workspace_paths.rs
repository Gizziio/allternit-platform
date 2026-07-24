//! Shared on-disk location of per-agent workspace directories.
//!
//! Every route that reads from or writes to an agent workspace resolves the
//! base directory through here so the layout stays consistent:
//! `<data_dir>/allternit/agent-workspaces/<agent_id>`.

use std::path::PathBuf;

/// Resolve the workspace directory for an agent. Falls back to
/// `/var/lib/allternit` when the platform data dir is unavailable.
pub(crate) fn workspace_dir_for(agent_id: &str) -> PathBuf {
    let data_dir = dirs::data_dir()
        .map(|d| d.join("allternit"))
        .unwrap_or_else(|| PathBuf::from("/var/lib/allternit"));
    data_dir.join("agent-workspaces").join(agent_id)
}
