//! Allternit Cloud API Server
//!
//! Main entry point for the cloud deployment API.

use allternit_cloud_api::{init_db, model_router, routes, runtime, services, ApiState};
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
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite://allternit-cloud.db".to_string());
    let bind_addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:3001".to_string());

    // Validate environment in production
    let is_production = !std::env::var("Allternit_API_DEVELOPMENT_MODE")
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

    tracing::info!("Starting Allternit Cloud API server");
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
        Arc::new(services::RunServiceImpl::new(db.clone()).with_event_store(event_store.clone()));

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
    tracing::info!(
        "Rate limiter initialized: {} req/min",
        rate_limit_config.requests_per_minute
    );
    let rate_limiter = allternit_cloud_api::create_rate_limiter(rate_limit_config);

    // Create stricter public-route rate limiter for pairing and relay endpoints.
    let public_rate_limit_config = allternit_cloud_api::RateLimitConfig {
        requests_per_minute: std::env::var("PUBLIC_RATE_LIMIT_RPM")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30),
        window: std::time::Duration::from_secs(60),
    };
    tracing::info!(
        "Public rate limiter initialized: {} req/min",
        public_rate_limit_config.requests_per_minute
    );
    let public_rate_limiter = allternit_cloud_api::create_rate_limiter(public_rate_limit_config);

    // Create quota service for free-tier guardrails.
    let quota_service = Arc::new(services::QuotaService::new(db.clone()));
    tracing::info!("Quota service initialized");

    // Contabo runtime service for hosted runtimes: provisions and manages
    // workload containers on the Contabo VPS.
    let contabo_runtime_service = Arc::new(services::ContaboRuntimeService::new(
        db.clone(),
        std::env::var("HEADSCALE_API_KEY").ok(),
        std::env::var("ALLTERNIT_CLOUD_API_URL")
            .unwrap_or_else(|_| "https://api.allternit.com".to_string()),
    ));
    tracing::info!("Contabo runtime service initialized");

    // Create mesh enrollment service if a Headscale API key is available.
    let mesh_service = routes::mesh::MeshService::from_env();

    // Credential cipher for provider tokens and wizard checkpoints. In
    // production the key is required; in dev, secrets are stored plaintext
    // with a loud warning.
    let credential_cipher =
        allternit_cloud_core::CredentialCipher::from_env().map(std::sync::Arc::new);
    match (&credential_cipher, is_production) {
        (None, true) => {
            tracing::error!(
                "ALLTERNIT_CREDENTIALS_KEY must be set in production - provider tokens and wizard checkpoints require encryption at rest"
            );
            std::process::exit(1);
        }
        (None, false) => {
            tracing::warn!(
                "ALLTERNIT_CREDENTIALS_KEY unset - provider tokens and wizard checkpoints stored PLAINTEXT (dev only)"
            );
        }
        _ => tracing::info!("Credential cipher initialized"),
    }

    // Build the model router.
    let alias_map = model_router::catalog::starter_catalog();
    let model_router = match model_router::openrouter::OpenRouterConfig::from_env() {
        Some(config) => {
            tracing::info!("OpenRouter model router enabled");
            let provider = model_router::openrouter::OpenRouterProvider::new(config);
            model_router::ModelRouter::new(vec![provider], alias_map)
        }
        None => {
            if is_production {
                tracing::warn!(
                    "OPENROUTER_API_KEY not set - model router disabled in production"
                );
            } else {
                tracing::info!(
                    "OPENROUTER_API_KEY not set - model router disabled (set it to enable /v1/chat/completions)"
                );
            }
            model_router::ModelRouter::disabled(alias_map)
        }
    };

    // Create API state with shared services
    let state = Arc::new(ApiState {
        db,
        ssh_executor: allternit_cloud_ssh::SshExecutor::new(),
        event_tx,
        event_store,
        run_service,
        session_manager,
        rate_limiter,
        public_rate_limiter,
        cost_service,
        quota_service,
        contabo_runtime_service,
        mesh_service,
        credential_cipher,
        metrics_state: Arc::new(allternit_cloud_api::middleware::metrics::MetricsState::new()),
        model_router,
    });

    services::start_hosted_runtime_lifecycle_task(state.clone());

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

    // Start stale gizzi-instance garbage collection (startup sweep + hourly)
    allternit_cloud_api::routes::gizzi_instances::start_gizzi_instance_gc_task(state.db.clone());

    // Start executor service (background task): claims queued runs and
    // dispatches them to online registered gizzi instances.
    let executor_enabled = std::env::var("EXECUTOR_ENABLED")
        .map(|v| v.parse::<bool>().unwrap_or(true))
        .unwrap_or(true);

    if executor_enabled {
        let executor_config = services::ExecutorConfig::from_env();
        tracing::info!("Starting executor service...");
        services::start_executor_service(
            executor_config,
            services::ExecutorDeps {
                db: state.db.clone(),
                event_store: state.event_store.clone(),
                run_service: state.run_service.clone(),
            },
        );
    } else {
        tracing::info!("Executor service disabled");
    }

    // Start server
    tracing::info!("Starting API server on {}", bind_addr);
    allternit_cloud_api::start_server(state, &bind_addr).await?;

    Ok(())
}
