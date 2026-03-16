//! Workspace Service
//!
//! Terminal workspace orchestration service with tmux integration.
//! Provides HTTP API and WebSocket streaming for managing terminal sessions and panes.

pub mod api;
pub mod state;
pub mod tmux;
pub mod types;

pub use types::{
    ErrorResponse, GridConfig, GridPane, Layout, LogLine, LogStreamConfig, Pane, PaneConfig,
    PaneMetadata, ServiceConfig, Session, SessionConfig, SessionId, SessionMetadata, SessionStatus,
};

/// Crate version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    #[test]
    fn test_version() {
        assert!(!super::VERSION.is_empty());
    }
}
