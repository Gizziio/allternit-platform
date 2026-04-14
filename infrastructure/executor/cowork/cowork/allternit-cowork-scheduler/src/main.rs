//! A2R Scheduler Daemon
//!
//! This daemon provides cron-based scheduling for cowork runs.
//! Uses tokio-cron-scheduler for job execution.
//!
//! Usage: a2r-scheduler --api-url http://localhost:3000 --port 3031

use clap::Parser;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info};

use a2r_cowork_scheduler as scheduler_lib;

/// Scheduler daemon configuration
#[derive(Parser, Debug)]
#[command(name = "a2r-cowork-scheduler")]
#[command(about = "A2R Cowork Scheduler - Cron scheduling for cowork runtime")]
struct Config {
    /// Data directory for SQLite database
    #[arg(long, default_value = "/var/lib/a2r/scheduler")]
    data_dir: PathBuf,

    /// API server URL (for triggering cowork runs)
    #[arg(long, default_value = "http://127.0.0.1:3000")]
    api_url: String,

    /// Port for the HTTP API
    #[arg(long, default_value = "3031")]
    port: u16,

    /// Run once and exit (for testing)
    #[arg(long)]
    once: bool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    let config = Config::parse();

    info!(
        version = %scheduler_lib::VERSION,
        data_dir = %config.data_dir.display(),
        api_url = %config.api_url,
        port = config.port,
        "Starting A2R Cowork Scheduler"
    );

    // Create data directory
    tokio::fs::create_dir_all(&config.data_dir).await?;

    let db_path = config.data_dir.join("scheduler.db");

    // Create and initialize scheduler
    let scheduler = Arc::new(RwLock::new(
        scheduler_lib::Scheduler::new(&db_path, &config.api_url)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create scheduler: {}", e))?,
    ));

    {
        let mut sched = scheduler.write().await;
        sched.start()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to start scheduler: {}", e))?;
    }

    info!("Scheduler initialized successfully");

    if config.once {
        // Run once mode - just list schedules
        info!("Running in once mode");

        let sched = scheduler.read().await;
        match sched.list_schedules().await {
            Ok(schedules) => {
                info!(count = schedules.len(), "Found schedules");
                for schedule in schedules {
                    info!(
                        id = %schedule.id,
                        name = %schedule.name,
                        enabled = schedule.enabled,
                        "Schedule"
                    );
                }
            }
            Err(e) => {
                error!(error = %e, "Failed to list schedules");
            }
        }

        return Ok(());
    }

    // Create API state
    let api_state = Arc::new(scheduler_lib::api::ApiState {
        scheduler: scheduler.clone(),
    });

    // Build API router
    let app = scheduler_lib::api::api_router(api_state);

    // Start HTTP API server
    info!(port = config.port, "Starting HTTP API server");
    
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", config.port))
        .await
        .map_err(|e| anyhow::anyhow!("Failed to bind to port {}: {}", config.port, e))?;
    
    info!("Scheduler running on http://0.0.0.0:{}", config.port);
    info!("Press Ctrl+C to stop.");

    // Run server and wait for shutdown signal
    tokio::select! {
        result = axum::serve(listener, app) => {
            result.map_err(|e| anyhow::anyhow!("Server error: {}", e))?;
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Shutdown signal received");
        }
    }

    info!("Scheduler shutting down");
    
    {
        let mut sched = scheduler.write().await;
        sched.shutdown().await?;
    }

    Ok(())
}
