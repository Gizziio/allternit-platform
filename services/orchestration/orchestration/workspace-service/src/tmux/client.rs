//! High-level tmux client
//!
//! Provides a client interface for managing tmux sessions and panes.

use crate::types::{Pane, PaneConfig, Session, SessionConfig};
use crate::tmux::{
    capture_pane, create_pane, create_session, kill_pane, kill_session, list_panes, list_sessions,
    session_exists, TmuxResult,
};
use tracing::{info, warn};

/// High-level tmux client
#[derive(Debug, Clone)]
pub struct TmuxClient;

impl TmuxClient {
    /// Create a new tmux client
    pub fn new() -> Self {
        Self
    }

    /// Create a new session
    pub async fn create_session(&self, config: SessionConfig) -> TmuxResult<Session> {
        info!("Creating session: {}", config.name);

        if session_exists(&config.name).await {
            return Err(crate::types::ErrorResponse::new(
                "SESSION_EXISTS",
                format!("Session '{}' already exists", config.name),
            ));
        }

        let session = create_session(&config).await?;
        info!("Created session: {} ({} panes)", session.name, session.panes);

        Ok(session)
    }

    /// Get a session by name
    pub async fn get_session(&self, name: &str) -> TmuxResult<Session> {
        if !session_exists(name).await {
            return Err(crate::types::ErrorResponse::new(
                "SESSION_NOT_FOUND",
                format!("Session '{}' not found", name),
            ));
        }

        crate::tmux::get_session(name).await
    }

    /// List all sessions
    pub async fn list_sessions(&self) -> TmuxResult<Vec<Session>> {
        list_sessions().await
    }

    /// Kill a session
    pub async fn kill_session(&self, name: &str) -> TmuxResult<()> {
        info!("Killing session: {}", name);

        if !session_exists(name).await {
            return Err(crate::types::ErrorResponse::new(
                "SESSION_NOT_FOUND",
                format!("Session '{}' not found", name),
            ));
        }

        kill_session(name).await
    }

    /// Create a new pane in a session
    pub async fn create_pane(
        &self,
        session: &str,
        config: &PaneConfig,
    ) -> TmuxResult<Pane> {
        info!("Creating pane in session: {}", session);

        let pane = create_pane(session, config.command.as_deref()).await?;
        info!("Created pane: {} in {}", pane.id, session);

        Ok(pane)
    }

    /// List panes in a session
    pub async fn list_panes(&self, session: &str) -> TmuxResult<Vec<Pane>> {
        list_panes(session).await
    }

    /// Get a specific pane
    pub async fn get_pane(&self, pane_id: &str) -> TmuxResult<Option<Pane>> {
        // Extract session from pane_id (format: %N or session:%N)
        let session = if pane_id.starts_with('%') {
            // Need to find which session this pane belongs to
            let sessions = self.list_sessions().await?;
            let mut found_session = None;

            for s in sessions {
                let panes = list_panes(&s.name).await?;
                if panes.iter().any(|p| p.id == pane_id) {
                    found_session = Some(s.name);
                    break;
                }
            }

            found_session.ok_or_else(|| {
                crate::types::ErrorResponse::new("PANE_NOT_FOUND", "Pane not found in any session")
            })?
        } else {
            pane_id.split(':').next().unwrap_or(pane_id).to_string()
        };

        let panes = list_panes(&session).await?;
        Ok(panes.into_iter().find(|p| p.id == pane_id))
    }

    /// Capture pane output
    pub async fn capture_pane(&self, pane_id: &str, lines: Option<usize>) -> TmuxResult<String> {
        capture_pane(pane_id, lines).await
    }

    /// Kill a pane
    pub async fn kill_pane(&self, pane_id: &str) -> TmuxResult<()> {
        info!("Killing pane: {}", pane_id);
        kill_pane(pane_id).await
    }

    /// Create a grid layout with multiple panes
    pub async fn create_grid(
        &self,
        session_name: impl Into<String>,
        panes: Vec<(String, Option<String>)>, // (name, command)
    ) -> TmuxResult<Session> {
        let session_name = session_name.into();
        info!("Creating grid layout in session: {}", session_name);

        // Create the session
        let config = SessionConfig::new(&session_name);
        let _session = self.create_session(config).await?;

        // Create panes
        for (i, (_name, cmd)) in panes.iter().enumerate() {
            if i > 0 {
                // Split window for additional panes
                let _ = create_pane(&session_name, cmd.as_deref()).await?;
            } else if let Some(cmd) = cmd {
                // First pane - send command to it
                crate::tmux::send_keys(&format!("{}:0", session_name), cmd).await?;
                crate::tmux::send_keys(&format!("{}:0", session_name), "C-m").await?;
            }
        }

        // Select tiled layout
        let _ = crate::tmux::tmux_run(&[
            "select-layout".to_string(),
            "-t".to_string(),
            session_name.clone(),
            "tiled".to_string(),
        ]).await;

        info!("Created grid layout with {} panes in {}", panes.len(), session_name);

        // Refresh session info
        self.get_session(&session_name).await
    }

    /// Stream pane output
    pub async fn stream_pane(
        &self,
        pane_id: &str,
        tx: tokio::sync::mpsc::Sender<String>,
    ) -> TmuxResult<()> {
        use tokio::time::{interval, Duration};

        let mut last_output = String::new();
        let mut ticker = interval(Duration::from_millis(100));

        loop {
            ticker.tick().await;

            match capture_pane(pane_id, Some(50)).await {
                Ok(output) => {
                    if output != last_output {
                        // Send only new lines
                        let new_lines: Vec<&str> = output
                            .lines()
                            .skip(last_output.lines().count())
                            .collect();

                        for line in new_lines {
                            if tx.send(line.to_string()).await.is_err() {
                                return Ok(()); // Receiver dropped
                            }
                        }

                        last_output = output;
                    }
                }
                Err(e) => {
                    warn!("Failed to capture pane {}: {}", pane_id, e.message);
                    break;
                }
            }
        }

        Ok(())
    }
}

impl Default for TmuxClient {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tmux_client_new() {
        let client = TmuxClient::new();
        // Just test that we can create a client
        drop(client);
    }
}
