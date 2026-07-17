//! allternit-mux — unified agent terminal multiplexer daemon.
//!
//! A long-running daemon owns real PTY sessions; clients attach, detach, and
//! control sessions/panes/agents over a newline-delimited JSON Unix socket API.
//! See docs/ALLTERNIT_MUX_PLAN.md for the design.

pub mod api;
pub mod client;
pub mod detect;
pub mod events;
pub mod manifest;
pub mod protocol;
pub mod pty;
pub mod session;

use std::path::PathBuf;

/// Default state directory: `~/.allternit/mux` (override: `ALLTERNIT_MUX_STATE_DIR`).
pub fn state_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("ALLTERNIT_MUX_STATE_DIR") {
        return PathBuf::from(dir);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join(".allternit").join("mux")
}

/// Default socket path: `<state_dir>/mux.sock` (override: `ALLTERNIT_MUX_SOCKET`).
pub fn socket_path() -> PathBuf {
    if let Ok(p) = std::env::var("ALLTERNIT_MUX_SOCKET") {
        return PathBuf::from(p);
    }
    state_dir().join("mux.sock")
}
