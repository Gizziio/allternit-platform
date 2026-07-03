//! Allternit IO Service - The ONLY Permitted Side-Effect Path
//!
//! Implements SYSTEM_LAW.md:
//! - LAW-ONT-002: Only IO can execute side effects
//! - LAW-ONT-003: Deterministic execution with policy enforcement
//! - LAW-ONT-008: IO Idempotency & Replay
//!
//! Port: 3510
//! Bind: 127.0.0.1 (internal only)

use std::sync::Arc;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use allternit_tools_gateway::service::{create_router, IoServiceState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Allternit IO Service");
    tracing::info!("Ontology Compliance: LAW-ONT-002 (Only IO executes side effects)");

    // Get configuration from environment
    let host = std::env::var("ALLTERNIT_IO_SERVICE_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("ALLTERNIT_IO_SERVICE_PORT").unwrap_or_else(|_| "3510".to_string());
    let bind_addr = format!("{}:{}", host, port);

    tracing::info!("Bind address: {}", bind_addr);
    tracing::info!("Port: {} (documented in ARCHITECTURE.md)", port);

    // Initialize state
    let state = Arc::new(IoServiceState::new().await?);

    tracing::info!("IO Service initialized with ToolGateway and ToolRegistry");

    // Create router and start server
    let app = create_router(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr).await?;
    tracing::info!("Allternit IO Service listening on {}", bind_addr);

    axum::serve(listener, app).await?;

    Ok(())
}
