//! Pane orchestrator for managing agent panes
//!
//! Provides high-level orchestration of tmux panes for agent execution.

use crate::tmux::{TmuxClient, commands::*};
use crate::types::{ErrorResponse, GridConfig, GridPane, Layout, Pane, PaneConfig, Session, SessionConfig, SessionMetadata};
use std::collections::HashMap;
use tracing::{debug, info, warn};

/// Pane orchestrator for managing agent execution panes
#[derive(Debug, Clone)]
pub struct PaneOrchestrator {
    tmux: TmuxClient,
}

impl PaneOrchestrator {
    /// Create a new pane orchestrator
    pub fn new() -> Self {
        Self {
            tmux: TmuxClient::new(),
        }
    }

    /// Spawn an agent pane with specific configuration
    pub async fn spawn_agent_pane(
        &self,
        session_id: &str,
        agent_name: &str,
        command: Option<&str>,
        wih_id: Option<&str>,
    ) -> Result<Pane, ErrorResponse> {
        info!("Spawning agent pane for {} in session {}", agent_name, session_id);

        let config = PaneConfig {
            name: agent_name.to_string(),
            command: command.map(|s| s.to_string()),
            working_dir: None,
            env: HashMap::new(),
            metadata: crate::types::PaneMetadata {
                agent_id: Some(agent_name.to_string()),
                wih_id: wih_id.map(|s| s.to_string()),
                pane_type: Some("agent".to_string()),
            },
        };

        let pane = self.tmux.create_pane(session_id, &config).await?;
        
        // Send agent identifier as first command if no specific command
        if command.is_none() {
            let _ = crate::tmux::send_keys(&pane.id, &format!("# Agent: {}", agent_name)).await;
        }

        info!("Spawned agent pane {} for {}", pane.id, agent_name);
        Ok(pane)
    }

    /// Create a grid layout with multiple agent panes
    pub async fn create_agent_grid(
        &self,
        grid_name: &str,
        agents: Vec<(String, Option<String>)>, // (agent_name, command)
        wih_context: Option<&str>,
    ) -> Result<Session, ErrorResponse> {
        info!("Creating agent grid '{}' with {} agents", grid_name, agents.len());

        // Create session with metadata
        let mut config = SessionConfig::new(grid_name);
        config.metadata = SessionMetadata {
            dag_id: None,
            wih_id: wih_context.map(|s| s.to_string()),
            owner: Some("orchestrator".to_string()),
            labels: vec!["agent-grid".to_string()],
        };

        let session = self.tmux.create_session(config).await?;

        // Create the grid layout
        self.arrange_grid(&session.name, agents).await?;

        info!("Created agent grid '{}' with session {}", grid_name, session.name);
        Ok(session)
    }

    /// Arrange panes in a grid layout
    async fn arrange_grid(
        &self,
        session: &str,
        panes: Vec<(String, Option<String>)>,
    ) -> Result<(), ErrorResponse> {
        if panes.is_empty() {
            return Ok(());
        }

        // Create additional panes
        for (i, (name, cmd)) in panes.iter().enumerate() {
            if i == 0 {
                // First pane already exists - send command
                if let Some(command) = cmd {
                    let pane_id = format!("{}:0", session);
                    crate::tmux::send_keys(&pane_id, command).await?;
                    crate::tmux::send_keys(&pane_id, "C-m").await?;
                }
            } else {
                // Create new pane
                let config = PaneConfig {
                    name: name.clone(),
                    command: cmd.clone(),
                    working_dir: None,
                    env: HashMap::new(),
                    metadata: crate::types::PaneMetadata {
                        agent_id: Some(name.clone()),
                        wih_id: None,
                        pane_type: Some("agent".to_string()),
                    },
                };
                self.tmux.create_pane(session, &config).await?;
            }
        }

        // Apply tiled layout
        crate::tmux::tmux_run(&[
            "select-layout".to_string(),
            "-t".to_string(),
            session.to_string(),
            "tiled".to_string(),
        ])
        .await?;

        Ok(())
    }

    /// Arrange panes according to a specific layout
    pub async fn arrange_panes(
        &self,
        session: &str,
        layout: Layout,
    ) -> Result<(), ErrorResponse> {
        let layout_str = match layout {
            Layout::EvenHorizontal => "even-horizontal",
            Layout::EvenVertical => "even-vertical",
            Layout::MainHorizontal => "main-horizontal",
            Layout::MainVertical => "main-vertical",
            Layout::Tiled => "tiled",
            Layout::Custom(s) => &s,
        };

        crate::tmux::tmux_run(&[
            "select-layout".to_string(),
            "-t".to_string(),
            session.to_string(),
            layout_str.to_string(),
        ])
        .await
    }

    /// Create a custom grid layout
    pub async fn create_custom_grid(
        &self,
        config: &GridConfig,
    ) -> Result<Session, ErrorResponse> {
        info!("Creating custom grid '{}'", config.name);

        // Create session
        let session_config = SessionConfig::new(&config.name);
        let session = self.tmux.create_session(session_config).await?;

        // Create panes in grid positions
        for pane_config in &config.panes {
            let pane = self.tmux.create_pane(&session.name, &PaneConfig {
                name: pane_config.name.clone(),
                command: pane_config.config.command.clone(),
                working_dir: pane_config.config.working_dir.clone(),
                env: pane_config.config.env.clone(),
                metadata: pane_config.config.metadata.clone(),
            }).await?;

            debug!("Created pane {} at ({}, {})", pane.id, pane_config.col, pane_config.row);
        }

        // Apply layout
        self.arrange_panes(&session.name, Layout::Tiled).await?;

        Ok(session)
    }

    /// Get pane info with agent context
    pub async fn get_agent_pane(&self, pane_id: &str) -> Result<Option<AgentPaneInfo>, ErrorResponse> {
        let pane = self.tmux.get_pane(pane_id).await?;
        
        Ok(pane.map(|p| AgentPaneInfo {
            pane_id: p.id,
            session_id: p.session_id,
            agent_name: p.metadata.agent_id,
            wih_id: p.metadata.wih_id,
            current_command: p.current_command,
        }))
    }

    /// List all agent panes in a session
    pub async fn list_agent_panes(&self, session_id: &str) -> Result<Vec<AgentPaneInfo>, ErrorResponse> {
        let panes = self.tmux.list_panes(session_id).await?;
        
        Ok(panes
            .into_iter()
            .filter(|p| p.metadata.pane_type.as_deref() == Some("agent"))
            .map(|p| AgentPaneInfo {
                pane_id: p.id,
                session_id: p.session_id,
                agent_name: p.metadata.agent_id,
                wih_id: p.metadata.wih_id,
                current_command: p.current_command,
            })
            .collect())
    }

    /// Kill an agent pane
    pub async fn kill_agent_pane(&self, pane_id: &str) -> Result<(), ErrorResponse> {
        info!("Killing agent pane: {}", pane_id);
        self.tmux.kill_pane(pane_id).await
    }

    /// Resize a pane
    pub async fn resize_pane(
        &self,
        pane_id: &str,
        width: Option<u16>,
        height: Option<u16>,
    ) -> Result<(), ErrorResponse> {
        if let Some(w) = width {
            ResizePane::new(pane_id.to_string(), ResizeSize::Width(w))
                .run()
                .await
                .map_err(|e| ErrorResponse::new("RESIZE_FAILED", e.to_string()))?;
        }

        if let Some(h) = height {
            ResizePane::new(pane_id.to_string(), ResizeSize::Height(h))
                .run()
                .await
                .map_err(|e| ErrorResponse::new("RESIZE_FAILED", e.to_string()))?;
        }

        Ok(())
    }

    /// Send a command to an agent pane
    pub async fn send_command(
        &self,
        pane_id: &str,
        command: &str,
    ) -> Result<(), ErrorResponse> {
        crate::tmux::send_keys(pane_id, command).await?;
        crate::tmux::send_keys(pane_id, "C-m").await
    }
}

impl Default for PaneOrchestrator {
    fn default() -> Self {
        Self::new()
    }
}

/// Information about an agent pane
#[derive(Debug, Clone)]
pub struct AgentPaneInfo {
    pub pane_id: String,
    pub session_id: String,
    pub agent_name: Option<String>,
    pub wih_id: Option<String>,
    pub current_command: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_orchestrator_new() {
        let orch = PaneOrchestrator::new();
        drop(orch);
    }
}
