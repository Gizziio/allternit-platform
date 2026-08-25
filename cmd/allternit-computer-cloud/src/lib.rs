//! Allternit Computer Cloud — control-plane service for agent desktops.
//!
//! This crate is the substrate-agnostic entry point. The first implemented
//! substrate is Incus (Linux/Windows VMs); Tart (macOS) is kept behind the
//! same `Substrate` trait.

pub mod driver;
pub mod incus_pool;
pub mod mesh;
pub mod routes;
pub mod router;
pub mod substrate;
pub mod tart;

pub use driver::IncusDriver;
pub use mesh::{MeshConfig, parse_tailscale_ip};
pub use router::SubstrateRouter;
pub use substrate::{ComputerSpec, ComputerState, SnapshotInfo, Substrate, SubstrateError};
pub use tart::TartDriver;
