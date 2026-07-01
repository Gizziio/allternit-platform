//! # Allternit Session Manager
//!
//! High-level session management that orchestrates execution drivers.
//! Provides a unified interface for creating, managing, and destroying
//! execution sessions across different backends (process, Firecracker, Apple VF).
//!
//! ## Architecture
//!
//! ```text
//! Session Manager
//!     ├── Process Driver (dev/testing - all platforms)
//!     ├── Firecracker Driver (Linux production VMs)
//!     └── Apple VF Driver (macOS production VMs)
//! ```
//!
//! ## Features
//!
//! - SQLite persistence for session state
//! - Automatic session cleanup for idle sessions
//! - Platform-appropriate driver selection
//! - Unified session lifecycle management

pub mod manager;
pub mod types;
pub mod protocol;

// Re-export main types
pub use manager::{SessionManager, ManagerConfig, SessionManagerError};
pub use types::*;
pub use protocol::GuestAgentClient;

/// Version of this crate
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_spec_creation() {
        let spec = SessionSpec::code_session("/workspace");
        assert_eq!(spec.working_dir, "/workspace");
        assert!(!spec.use_vm);
        
        let vm_spec = SessionSpec::vm_session("/workspace", "ubuntu:22.04");
        assert!(vm_spec.use_vm);
        assert_eq!(vm_spec.image, "ubuntu:22.04");
    }

    #[test]
    fn test_session_lifecycle() {
        let spec = SessionSpec::code_session("/workspace");
        let mut session = Session::new(spec);
        
        assert!(matches!(session.status, SessionStatus::Creating));
        assert!(!session.is_active());
        
        session.status = SessionStatus::Ready;
        assert!(session.is_active());
        assert!(!session.is_ended());
        
        session.status = SessionStatus::Stopped;
        assert!(!session.is_active());
        assert!(session.is_ended());
    }

    #[test]
    fn test_session_id_display() {
        let id = SessionId::new();
        let id_str = id.to_string();
        assert!(!id_str.is_empty());
        assert!(id_str.contains('-')); // UUID format
    }
}
