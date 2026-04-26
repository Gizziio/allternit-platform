//! Allternit API Library
//!
//! Shared state and route handlers for the Allternit API.

pub mod chat_routes;
pub mod rails;
pub mod sandbox_routes;
pub mod stream;
pub mod terminal_routes;
pub mod viz_routes;
pub mod vm_session_routes;

use rails::RailsState;
use vm_session_routes::VmSessionStore;

/// Application state shared across all route handlers
pub struct AppState {
    /// VM execution driver (Firecracker on Linux, Apple VF on macOS)
    pub vm_driver: Option<Box<dyn allternit_driver_interface::ExecutionDriver>>,
    /// Rails service state (Ledger, Gate, Leases, etc.)
    pub rails: RailsState,
    /// Persistent VM sessions — each gizzi-code session gets one VM that stays
    /// alive for the entire session lifetime (not torn down between exec calls).
    pub vm_sessions: VmSessionStore,
}
