//! bb-compatible agent IDE surface.
//!
//! Provides `/api/v1/bb/*` routes and the data layer for bb-style
//! projects, threads, environments, hosts, and events.

pub mod contracts;
pub mod db;
pub mod models;
pub mod routes;

pub use routes::bb_router;
