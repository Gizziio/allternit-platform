use std::path::PathBuf;
use std::sync::Arc;
mod gate;
mod ledger;
mod leases;
mod receipts;
mod wih;
mod core;
mod prompt;
mod projections;
mod work;
mod index;
mod vault;
mod policy;

#[tokio::main]
async fn main() {
    // This is a simplified direct call to the Gate::autoland_wih implemented in gate.rs
}
