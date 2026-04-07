//! A2R Cloud API Server
//!
//! Main entry point for the cloud deployment API.

use allternit_cloud_api::{ApiState, init_db, services, runtime};
use std::sync::Arc;
use tokio::sync::broadcast;

fn init_logging() {
    let log_format = std::env::var("LOG_FORMAT").unwrap_or_else(|_| "pretty".to_string());
    let log_level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
    
    let env_filter = tracing_subscriber::EnvFilter::new(log_level);
    
    if log_format == "json" {
        // JSON format for production
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(env_filter)
            .with_target(true)
            .with_thread_ids(true)
            .with_thread_names(true)
            .with_line_number(true)
            .with_file(true)
            .init();
    } else {
        // Pretty format for development
        tracing_subscriber::fmt()
            .pretty()
            .with_env_filter(env_filter)
            .init();
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    init_logging();
    
    // Get configuration from environment
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite://a2r-cloud.db".to_string());
    let bind_addr = std::env::var("BIND_ADDR")
        .unwrap_or_else(|_| "0.0.0.0:3001".to_string());
    
    // Validate environment in production
    let is_production = !std::env::var("ALLTERNIT_API_DEVELOPMENT_MODE")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(false);
    
    if is_production {
        // In production, fail fast if required env vars are not set
        if std::env::var("DATABASE_URL").is_err() {
            tracing::error!("DATABASE_URL environment variable must be set in production");
            std::process::exit(1);
        }
        if std::env::var("HETZNER_API_TOKEN").is_err() {
            tracing::warn!("HETZNER_API_TOKEN not set - cloud runs will not be available");
        }
    }
    
    tracing::info!("Starting A2R Cloud API server");
    tracing::info!("Database: {}", database_url);
    tracing::info!("Bind address: {}", bind_addr);
    
    // Initialize database
    tracing::info!("Initializing database...");
    let db = init_db(&database_url).await?;
    tracing::info!("Database initialized");
    
    // Create broadcast channel for deployment events
    let (event_tx, _event_rx) = broadcast::channel::<allternit_cloud_api::DeploymentEvent>(100);
    
    // Create shared services
    tracing::info!("Initializing shared services...");
    
    // Shared event store
    let event_store: Arc<dyn services::EventStore> = 
        Arc::new(services::EventStoreImpl::new(db.clone()));
    
    // Shared session manager
    let session_manager = Arc::new(runtime::session_manager::SessionManager::new(db.clone()));
    
    // Shared run service
    let run_service: Arc<dyn services::RunService> = 
        Arc::new(services::RunServiceImpl::new(db.clone())
            .with_event_store(event_store.clone()));
    
    // Shared cost service
    let cost_service: Arc<dyn services::CostService> = 
        Arc::new(services::CostServiceImpl::new(db.clone()));
    
    tracing::info!("Shared services initialized");
    
    // Create rate limiter
    let rate_limit_config = allternit_cloud_api::RateLimitConfig {
        requests_per_minute: std::env::var("RATE_LIMIT_RPM")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60),
        window: std::time::Duration::from_secs(60),
    };
    tracing::info!("Rate limiter initialized: {} req/min", rate_limit_config.requests_per_minute);
    let rate_limiter = allternit_cloud_api::create_rate_limiter(rate_limit_config);
    
    // Create API state with shared services
    let state = Arc::new(ApiState {
        db,
        ssh_executor: allternit_cloud_ssh::SshExecutor::new(),
        event_tx,
        event_store,
        run_service,
        session_manager,
        rate_limiter,
        cost_service,
    });
    
    // Start scheduler service (background task)
    let scheduler_enabled = std::env::var("SCHEDULER_ENABLED")
        .map(|v| v.parse::<bool>().unwrap_or(true))
        .unwrap_or(true);
    
    if scheduler_enabled {
        let scheduler_config = services::SchedulerConfig::from_env();
        
        tracing::info!("Starting scheduler service...");
        services::start_scheduler_service(state.clone(), scheduler_config);
    } else {
        tracing::info!("Scheduler service disabled");
    }
    
    // Start cost tracking background task
    let cost_tracking_enabled = std::env::var("COST_TRACKING_ENABLED")
        .map(|v| v.parse::<bool>().unwrap_or(true))
        .unwrap_or(true);
    
    if cost_tracking_enabled {
        let db_clone = state.db.clone();
        tokio::spawn(async move {
            tracing::info!("Starting cost tracking background task");
            services::start_cost_tracking_task(db_clone).await;
        });
    } else {
        tracing::info!("Cost tracking disabled");
    }
    
    // Start server
    tracing::info!("Starting API server on {}", bind_addr);
    allternit_cloud_api::start_server(state, &bind_addr).await?;
    
    Ok(())
}
