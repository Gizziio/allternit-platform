//! Allternit API Server
//!
//! Provides endpoints for:
//! - Chat & Agents (agent chat, conversation, artifacts)
//! - Workspaces, Memory, Files, Inbox
//! - Visualization rendering (charts to SVG/PNG/PDF)
//! - Sandbox code execution (VM-based)
//! - Rails System integration (Ledger, Gate, Leases, Work)
//! - Cowork Runtime (persistent remote execution)
//! - Event streaming (WebSocket)
//! - SSH, Swarm, Workflows, Boards

use axum::Router;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tracing::info;

#[cfg(any(target_os = "linux", target_os = "macos"))]
use tracing::warn;

// Import from library
use allternit_api::aci_routes::aci_router;
use allternit_api::admin_mcp_tunnel_routes::router as admin_mcp_tunnel_router;
use allternit_api::agent_cloud_routes::router as agent_cloud_router;
use allternit_api::agent_operations_routes;
use allternit_api::federation_routes::router as federation_router;
use allternit_api::outcome_rubric_routes::router as outcome_rubric_router;
use allternit_api::page_agent_routes::page_agent_router;
use allternit_api::allternit_bus_routes::{allternit_bus_router, allternit_bus_webhook_router};
use allternit_api::quickstart_routes::router as quickstart_router;
use allternit_api::agent_preferences_routes::agent_preferences_router;
use allternit_api::agent_routes::agent_router;
use allternit_api::agent_runtime_routes::agent_runtime_router;
use allternit_api::agent_session_routes::agent_session_router;
use allternit_api::beta_deployment_routes::beta_deployment_router;
use allternit_api::beta_memory_store_routes::beta_memory_store_router;
use allternit_api::beta_session_routes::beta_session_router;
use allternit_api::beta_work_routes::beta_work_router;
use allternit_api::user_profile_routes::{enrollment_router, user_profile_router};
use allternit_api::agent_workspace_routes::agent_workspace_router;
use allternit_api::agents_v1_routes::agents_v1_router;
use allternit_api::alabs_routes::alabs_router;
use allternit_api::analytics_routes::analytics_router;
use allternit_api::artifact_routes::artifact_router;
use allternit_api::audit_log_routes::audit_log_router;
use allternit_api::auth::auth_middleware;
use allternit_api::automation_routes::automation_router;
use allternit_api::backend_install_routes::backend_install_router;
use allternit_api::bb::bb_router;
use allternit_api::board_routes::board_router;
use allternit_api::board_stream_routes::board_stream_router;
use allternit_api::bot_desktop_capacity;
use allternit_api::bot_desktop_queue;
use allternit_api::bot_desktop_routes::bot_desktop_router;
use allternit_api::bot_desktop_stream::bot_desktop_stream_router;
use allternit_api::brain_routes::{brain_git_router, brain_router};
use allternit_api::canvas_routes::canvas_router;
use allternit_api::checkpoints_routes::checkpoints_router;
use allternit_api::conversation_routes::conversation_router;
use allternit_api::cowork::background_service::CoworkBackgroundService;
use allternit_api::cowork::routes::{background_router, CoworkBgState};
use allternit_api::cowork_preferences_routes::cowork_preferences_router;
use allternit_api::cowork_routes::cowork_router;
use allternit_api::cowork_team_routes::cowork_team_router;
use allternit_api::db::DbHandle;
use allternit_api::design_connector_routes::{design_connector_router, DesignSkillCache};
use allternit_api::fallback_routes::fallback_router;
use allternit_api::file_routes::file_router;
use allternit_api::h5i_routes::h5i_router;
use allternit_api::har_api_routes::har_api_router;
use allternit_api::health::health_router;
use allternit_api::inference_router_routes::inference_router_router;
use allternit_api::hud_routes::hud_router;
use allternit_api::idempotency::idempotency_middleware;
use allternit_api::inbox_routes::inbox_router;
use allternit_api::library_routes::library_router;
use allternit_api::local_brain_routes::local_brain_router;
use allternit_api::local_engine_routes::local_engine_router;
use allternit_api::local_studio_routes::local_studio_router;
use allternit_api::mcp_routes::mcp_router;
use allternit_api::me_routes::me_router;
use allternit_api::memory_reconstruction_routes::memory_reconstruction_router;
use allternit_api::memory_routes::memory_router;
use allternit_api::metrics::metrics_router;
use allternit_api::oauth_routes::oauth_router;
use allternit_api::office_cli_routes::office_cli_router;
use allternit_api::office_engine_routes::{office_engine_router, office_engine_v1_router};
use allternit_api::office_routes::office_router;
use allternit_api::onboarding_routes::onboarding_router;
use allternit_api::orchestrator_routes::orchestrator_router;
use allternit_api::platform_static::platform_service;
use allternit_api::playground_routes::playground_router;
use allternit_api::provider_routes::provider_router;
use allternit_api::rate_limit::rate_limit_middleware;
use allternit_api::rails::{rails_router, RailsState};
use allternit_api::remote_control_routes::remote_control_router;
use allternit_api::research_task_routes::research_task_router;
use allternit_api::rails_client_impl::create_local_rails_client;
use allternit_api::runtime_backend_routes::runtime_backend_router;
use allternit_api::runtime_discover_routes::runtime_discover_router;
use allternit_api::sandbox_routes::sandbox_router;
use allternit_api::ssh_key_routes::ssh_key_router;
use allternit_api::ssh_routes::ssh_router;
use allternit_api::status_routes::status_router;
use allternit_api::stream::stream_router;
use allternit_api::swarm_routes::swarm_router;
use allternit_api::task_routes;
use allternit_api::team_skill_routes::team_skill_router;
use allternit_api::terminal_routes::{terminal_router, TerminalSessionStore};
use allternit_api::permission_policy::ApprovalStore;
use allternit_api::tool_routes;
use allternit_api::udemy_routes::udemy_router;
use allternit_api::v1_routes::{agent_chat_router, v1_router};
use allternit_api::viz_routes::viz_router;
use allternit_api::vm_session_routes::{new_vm_session_store, vm_session_router};
use allternit_api::web_proxy_routes::web_proxy_router;
use allternit_api::webhook_routes::webhook_router;
use allternit_api::webhook_subscription_routes::webhook_subscription_router;
use allternit_api::webhook_trigger_routes::{
    webhook_trigger_public_router, webhook_trigger_router,
};
use allternit_api::workflow_routes::workflow_router;
use allternit_api::workspace_routes::workspace_router;
use allternit_api::AppState;
use allternit_cowork_runtime::{
    JobId, Run as CoworkRun, RunId, RunManager, RunManagerConfig, RunMode, RunState,
};
use allternit_cowork_scheduler::{api::ApiState as SchedulerApiState, Scheduler};
use tokio::sync::RwLock;

#[tokio::main]
async fn main() {
    // Initialize tracing with filter to suppress noisy cron-scheduler errors.
    //
    // This is structured logging + local spans (`#[tracing::instrument]` now
    // on the LLM gateway, DLP, MCP-server, Slack-webhook, and eval-run
    // handlers), not exported distributed tracing. The workspace Cargo.toml
    // already pins `opentelemetry`/`opentelemetry_sdk`/`tracing-opentelemetry`/
    // `opentelemetry-http` (used by no crate in the repo today, confirmed by
    // grep), so the dependency choice is made — wiring a real
    // `tracing-opentelemetry` layer + OTLP exporter here is genuine follow-on
    // work, deliberately not attempted blind: this machine has no Rust
    // toolchain to compile-check it, there's no existing in-repo usage of
    // these pre-1.0 OTel crates to model the exact builder API from, and
    // guessing at that API surface risks landing code that looks right but
    // doesn't build against the pinned versions.
    let filter = tracing_subscriber::EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info,tokio_cron_scheduler=off"));
    if std::env::var("ALLTERNIT_LOG_FORMAT").as_deref() == Ok("json") {
        tracing_subscriber::fmt()
            .json()
            .with_env_filter(filter)
            .init();
    } else {
        tracing_subscriber::fmt().with_env_filter(filter).init();
    }

    info!("Allternit API Server starting...");
    info!("Version: 0.1.0");

    // Load unified configuration once and make it globally available.
    let app_config = allternit_api::init_app_config();
    info!("Configuration loaded");

    // Data directory for local state
    let data_dir = std::env::var("ALLTERNIT_DATA_DIR")
        .ok()
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| dirs::data_dir().map(|d| d.join("allternit")))
        .unwrap_or_else(|| PathBuf::from("/var/lib/allternit"));
    std::fs::create_dir_all(&data_dir).ok();

    // Encryption-key status. Desktop injects the key from Electron's signed
    // credential broker; VPS/headless installs use a private local runtime key.
    // allternit-api never accesses OS Keychain.
    if std::env::var("ALLTERNIT_ENCRYPTION_KEY")
        .ok()
        .filter(|s| !s.is_empty())
        .is_some()
        || std::env::var("ENCRYPTION_KEY")
            .ok()
            .filter(|s| !s.is_empty())
            .is_some()
    {
        info!("Connector token encryption: key configured via env");
    } else {
        info!("Connector token encryption: headless runtime key will be created on first use");
    }

    // Initialize SQLite database
    let db_path = data_dir.join("allternit.db");
    let db = DbHandle::new(db_path.clone()).expect("Failed to initialize SQLite database");
    info!("Database ready at {}", db_path.display());

    // Initialize passkey / WebAuthn state when configured.
    let passkey_state = match initialize_passkey_state(db.clone()) {
        Ok(Some(state)) => {
            info!("Passkey support enabled");
            Some(state)
        }
        Ok(None) => {
            info!("Passkey support disabled: ALLTERNIT_PASSKEY_RP_ID and ALLTERNIT_PASSKEY_RP_ORIGIN not both set");
            None
        }
        Err(e) => {
            tracing::warn!("Passkey support disabled: {e}");
            None
        }
    };

    // B5: seed published benchmark scores for LLM routing (idempotent).
    allternit_api::llm_gateway::benchmarks::sync_at_startup(&db);

    // Seed and load the Fabric SKU / capability-class catalog.
    if let Err(e) = allternit_api::fabric::sku::ResourceClassCatalog::seed_builtin(&db) {
        tracing::warn!("Failed to seed Fabric resource classes: {e}");
    }
    let resource_class_catalog =
        allternit_api::fabric::sku::ResourceClassCatalog::from_db(&db)
            .expect("Failed to load Fabric resource class catalog");

    // Seed the Fabric model catalog (OpenAI/Together/Fireworks prices).
    if let Err(e) = allternit_api::fabric::model_catalog::ModelCatalog::new(db.clone()).seed_builtin()
    {
        tracing::warn!("Failed to seed Fabric model catalog: {e}");
    }

    // Initialize the Private Fabric node provider pool.
    let fabric_node_pool = Arc::new(
        allternit_computer_cloud::providers::fabric_node::FabricNodePool::new(),
    );
    let fabric_node_provider =
        allternit_computer_cloud::providers::fabric_node::FabricNodeProvider::new(
            fabric_node_pool,
            "__system".to_string(),
        );

    // Build the Fabric provider registry (live providers from env + Private Fabric nodes).
    let fabric_provider_registry =
        allternit_api::fabric::build_provider_registry(fabric_node_provider.clone());
    info!(
        "Fabric provider registry initialized with {} provider(s)",
        fabric_provider_registry.providers().len()
    );

    // Build the Fabric price cache and scheduler.
    let fabric_price_cache = allternit_api::fabric::PriceCache::new(db.clone());
    let fabric_scheduler = allternit_api::fabric::Scheduler::new(
        allternit_api::fabric::CostEngine::default_engine(),
    )
    .with_price_cache(fabric_price_cache.clone());
    info!("Fabric scheduler initialized with price cache");

    // Optional canonical AllternitOS control-plane URL. When set, Fabric
    // resource creation goes through the OS lease API instead of the internal
    // Cloud scheduler.
    let os_control_plane = std::env::var("ALLTERNITOS_CONTROL_PLANE_URL")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|url| {
            info!(url = %url, "routing Fabric resource creation to canonical OS control plane");
            allternit_api::fabric::os_client::OsControlPlaneClient::new(url)
        });

    // Initialize unified auth configuration and JWKS manager for Clerk JWT verification
    let auth_config = allternit_api::auth::AuthConfig::from_app_config(app_config);
    let jwks = allternit_api::auth::JwksManager::new(&auth_config);
    info!("JWKS manager initialized");

    // Webhook secret for Clerk webhook verification
    let webhook_secret = app_config.clerk_webhook_secret();

    // Initialize VM driver (platform-specific)
    let vm_driver_set = initialize_vm_driver(&app_config).await;
    let vm_driver = vm_driver_set.dynamic;
    let incus_driver = vm_driver_set.incus;
    let desktop_host_registry =
        allternit_api::desktop_host_registry::DesktopHostRegistry::new(db.clone());
    let desktop_host_provisioner =
        allternit_computer_cloud::CloudProviderRegistry::from_env()
            .ok()
            .map(|providers| {
                allternit_api::desktop_host_provisioner::DesktopHostProvisioner::new(
                    desktop_host_registry.clone(),
                    providers,
                    incus_driver.clone(),
                )
            });

    // Initialize Rails service state
    let rails = RailsState::new(data_dir.clone())
        .await
        .expect("Failed to initialize Rails service state");

    // Initialize cowork scheduler (optional — no-op if DB path is unset)
    let cowork_scheduler = initialize_cowork_scheduler(&data_dir, app_config.api_port()).await;
    let scheduler_state = cowork_scheduler
        .clone()
        .map(|s| Arc::new(SchedulerApiState { scheduler: s }));

    // Initialize cowork background service
    let (cowork_background, bg_state) = initialize_cowork_background(&data_dir).await;

    // Initialize cowork runtime run manager (Rails-backed DAG/WIH lifecycle)
    let cowork_run_manager =
        initialize_cowork_run_manager(&data_dir, rails.clone(), &app_config).await;
    if let Some(ref manager) = cowork_run_manager {
        load_persisted_cowork_runs(&db, manager).await;
    }

    // Initialize office runtime state (load from disk or start empty)
    let office_runtime = Arc::new(tokio::sync::RwLock::new(
        allternit_api::office_routes::load_runtime_file(),
    ));

    // Initialize OfficeCLI document registry (load docs.json or start empty)
    let office_cli_dir = app_config.office_cli_dir();
    if let Err(e) = std::fs::create_dir_all(&office_cli_dir) {
        warn!("Failed to create office-cli directory: {e}");
    }
    let office_cli_docs = Arc::new(tokio::sync::RwLock::new(
        allternit_api::office_cli_routes::load_docs(&app_config),
    ));

    // Open Design skill cache — daemon-side discovery with hot-reload.
    let design_skill_cache = DesignSkillCache::new();
    {
        let cache = design_skill_cache.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(5));
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                interval.tick().await;
                cache.refresh(None).await;
            }
        });
    }

    let capacity_threshold = std::env::var("DESKTOP_AUTOSCALE_CPU_THRESHOLD")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.75)
        .clamp(0.0, 1.0);
    let memory_threshold = std::env::var("DESKTOP_AUTOSCALE_MEMORY_THRESHOLD")
        .ok()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.8)
        .clamp(0.0, 1.0);
    let _capacity_monitor = bot_desktop_capacity::init_capacity_monitor(capacity_threshold, memory_threshold);

    // Create application state
    let state = Arc::new(AppState {
        config: app_config.clone(),
        db,
        data_dir: data_dir.clone(),
        jwks,
        auth_config,
        vm_driver,
        incus_driver,
        desktop_host_registry,
        desktop_host_provisioner,
        bot_desktop_sessions: Arc::new(RwLock::new(HashMap::new())),
        rails,
        vm_sessions: new_vm_session_store(),
        cowork_scheduler,
        cowork_background,
        cowork_run_manager,
        webhook_secret,
        office_runtime,
        office_cli_docs,
        office_cli_watches: Arc::new(RwLock::new(HashMap::new())),
        office_cli_mcp_sessions: Arc::new(RwLock::new(HashMap::new())),
        design_skill_cache,
        terminal_sessions: TerminalSessionStore::new(),
        mcp_dispatcher: allternit_api::mcp_dispatcher::McpDispatcher::new(),
        approval_store: Arc::new(ApprovalStore::new()),
        passkey_state,
        resource_class_catalog,
        fabric_node_provider,
        fabric_provider_registry,
        fabric_scheduler,
        fabric_price_cache,
        os_control_plane,
    });

    // Refresh the Private Fabric node provider pool from the DB registry.
    {
        let state = Arc::clone(&state);
        let period = std::time::Duration::from_secs(
            std::env::var("FABRIC_NODE_REFRESH_INTERVAL_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(30),
        );
        tokio::spawn(async move {
            let registry = allternit_api::fabric::node_registry::FabricNodeRegistry::new(state.db.clone());
            let mut interval = tokio::time::interval(period);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                interval.tick().await;
                match registry.active_provider_nodes() {
                    Ok(nodes) => state.fabric_node_provider.sync_nodes(nodes),
                    Err(e) => tracing::warn!("Failed to refresh fabric node pool: {e}"),
                }
            }
        });
    }

    // Periodic Fabric provider health checks.
    {
        let state = Arc::clone(&state);
        let period = std::time::Duration::from_secs(
            std::env::var("FABRIC_PROVIDER_HEALTH_INTERVAL_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(60),
        );
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(period);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                interval.tick().await;
                for (kind, snapshot) in state.fabric_provider_registry.health_check_all().await {
                    if snapshot.healthy {
                        tracing::info!(provider = %kind, "Fabric provider healthy");
                    } else {
                        let message = snapshot.message.as_deref().unwrap_or("unhealthy");
                        tracing::warn!(provider = %kind, %message, "Fabric provider unhealthy");
                    }
                }
            }
        });
    }

    // Background usage-to-cost worker: convert unprocessed fabric_usage_events
    // into fabric_cost_events and ledger charges.
    {
        let state = Arc::clone(&state);
        let period = std::time::Duration::from_secs(
            std::env::var("FABRIC_USAGE_PROCESS_INTERVAL_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(60),
        );
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(period);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                interval.tick().await;
                let db = state.db.clone();
                match tokio::task::spawn_blocking(move || {
                    let ingestor = allternit_api::fabric::usage::UsageIngestor::new(db.clone());
                    let ledger = allternit_api::fabric::credits::CreditsLedger::new(db);
                    ingestor.run_batch(&ledger, 100)
                })
                .await
                {
                    Ok(Ok(processed)) => {
                        if processed > 0 {
                            tracing::info!(processed, "converted usage events to cost events");
                        }
                    }
                    Ok(Err(e)) => tracing::warn!(error = %e, "usage-to-cost batch failed"),
                    Err(e) => tracing::warn!(error = %e, "usage-to-cost task panicked"),
                }
            }
        });
    }

    // Background Fabric provider price-cache refresh.
    {
        let state = Arc::clone(&state);
        let period = std::time::Duration::from_secs(
            std::env::var("FABRIC_PROVIDER_PRICE_INTERVAL_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(300),
        );
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(period);
            interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                interval.tick().await;
                let db = state.db.clone();
                let registry = state.fabric_provider_registry.clone();
                let catalog = state.resource_class_catalog.clone();
                match allternit_api::fabric::price_cache::refresh_cache(
                    db,
                    &registry,
                    &catalog,
                    period * 2,
                )
                .await
                {
                    Ok(written) => {
                        if written > 0 {
                            tracing::info!(written, "refreshed Fabric provider price cache");
                        }
                    }
                    Err(e) => tracing::warn!(error = %e, "price cache refresh failed"),
                }
            }
        });
    }

    // Phase 5: start the in-process batch execution/polling worker.
    allternit_api::llm_gateway::batches::spawn_batch_worker(Arc::clone(&state));

    // Desktop capacity monitor and autoscale signaler.
    {
        let period = std::time::Duration::from_secs(
            std::env::var("DESKTOP_CAPACITY_MONITOR_INTERVAL_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(30),
        );
        bot_desktop_capacity::spawn_capacity_monitor(Arc::clone(&state), period);
    }

    // Desktop cloud host provisioner / autoscaler.
    {
        let period = std::time::Duration::from_secs(
            std::env::var("DESKTOP_HOST_PROVISIONER_INTERVAL_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(60),
        );
        allternit_api::desktop_host_provisioner::spawn_provisioner(Arc::clone(&state), period);
    }

    // Desktop provision queue worker: drains queued requests when capacity frees up.
    {
        let period = std::time::Duration::from_secs(
            std::env::var("DESKTOP_QUEUE_WORKER_INTERVAL_SECS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(10),
        );
        bot_desktop_queue::spawn_provision_queue_worker(Arc::clone(&state), period);
    }

    // OfficeCLI idle reaper: evicts stale docs, closes idle resident sessions,
    // kills idle watch processes and MCP sessions.
    {
        let state = Arc::clone(&state);
        tokio::spawn(async move {
            allternit_api::office_cli_routes::reap_idle_sessions(state).await;
        });
    }

    // Probe the officecli binary once at startup (non-fatal).
    {
        let config = app_config.clone();
        tokio::spawn(async move {
            let probe = tokio::time::timeout(
                Duration::from_secs(5),
                tokio::process::Command::new(config.officecli_bin())
                    .arg("--version")
                    .output(),
            )
            .await;
            match probe {
                Ok(Ok(out)) if out.status.success() => {
                    info!(
                        "officecli available: {}",
                        String::from_utf8_lossy(&out.stdout).trim()
                    );
                }
                _ => warn!("officecli binary not available — Office CLI routes will report unavailable"),
            }
        });
    }

    // ── Build V1 API routes (all merged, then nested under /api/v1) ───────────
    let v1_routes = provider_router()
        .merge(inbox_router())
        .merge(file_router())
        .merge(memory_router())
        .merge(me_router())
        .merge(local_brain_router())
        .merge(library_router())
        .merge(workflow_router())
        .merge(ssh_router())
        .merge(swarm_router())
        .merge(board_router())
        .merge(cowork_router())
        .merge(cowork_preferences_router())
        .merge(allternit_api::rails::routes_cowork::cowork_routes())
        .merge(agent_router())
        .merge(allternit_api::agent_email_routes::agent_email_router())
        .merge(agent_preferences_router())
        .merge(agent_workspace_router())
        .merge(agent_session_router())
        .merge(beta_session_router())
        .merge(beta_deployment_router())
        .merge(beta_work_router())
        .merge(webhook_subscription_router())
        .merge(webhook_trigger_router())
        .merge(beta_memory_store_router())
        .merge(memory_reconstruction_router())
        .merge(allternit_api::memory_notes_routes::memory_notes_router())
        .merge(research_task_router())
        .merge(user_profile_router())
        .merge(canvas_router())
        .merge(v1_router())
        .merge(allternit_bus_router())
        .merge(task_routes::task_router())
        .merge(agent_operations_routes::agent_operations_router())
        .merge(allternit_api::queue_routes::queue_router())
        .merge(audit_log_router())
        .merge(ssh_key_router())
        .merge(team_skill_router())
        .merge(udemy_router())
        .merge(agent_runtime_router())
        .merge(backend_install_router())
        .merge(runtime_discover_router())
        .merge(cowork_team_router())
        .merge(board_stream_router())
        .merge(runtime_backend_router())
        .merge(remote_control_router())
        .merge(agents_v1_router())
        .merge(
            bot_desktop_router().layer(axum::middleware::from_fn_with_state(
                state.clone(),
                allternit_api::bot_desktop_audit::desktop_audit_middleware,
            )),
        )
        .merge(allternit_api::bot_desktop_audit::bot_desktop_audit_router())
        .merge(allternit_api::connector_routes::connector_router())
        .merge(allternit_api::cloud_credentials_routes::cloud_credentials_router())
        .merge(allternit_api::usage_routes::usage_router())
        .merge(allternit_api::upload_routes::upload_router())
        .merge(allternit_api::llm_gateway::gateway_keys_router())
        .merge(allternit_api::llm_gateway::admin_routes::gateway_admin_router())
        .merge(inference_router_router())
        .merge(allternit_api::enterprise_auth::router())
        .merge(allternit_api::eval_routes::router())
        .merge(allternit_api::eval_metric_routes::router())
        .merge(allternit_api::fallback_credit_routes::router())
        .merge(allternit_api::fallback_retry_policy_routes::router())
        .merge(allternit_api::groundedness_check_routes::router())
        .merge(allternit_api::latency_budget_routes::router())
        .merge(allternit_api::prompt_leak_routes::router())
        .merge(allternit_api::server_tool_routes::router())
        .merge(allternit_api::sandbox_template_routes::router())
        .merge(allternit_api::skills_routes::skills_router())
        .merge(allternit_api::long_running_task_routes::long_running_task_router())
        .merge(allternit_api::bot_desktop_templates::router())
        .merge(allternit_api::bot_desktop_capacity::router())
        .merge(allternit_api::bot_desktop_queue::router())
        .merge(allternit_api::bot_desktop_billing::router())
        .merge(allternit_api::bot_desktop_admin::router())
        .merge(allternit_api::desktop_host_admin::router())
        .merge(allternit_api::fabric_node_routes::admin_router())
        .merge(allternit_api::fabric_admin_routes::router())
        .merge(allternit_api::fabric_credits_routes::router())
        .merge(allternit_api::fabric_resources_routes::router())
        .merge(allternit_api::fabric_usage_routes::router())
        .merge(agent_cloud_router())
        .merge(allternit_api::computer_routes::router())
        .merge(allternit_api::allternit_vault::router())
        .merge(passkey_router(&state))
        .merge(allternit_api::admin_workspace_routes::router())
        .merge(allternit_api::admin_service_account_routes::router())
        .merge(allternit_api::admin_access_token_routes::router())
        .merge(allternit_api::admin_spend_limit_routes::router())
        .merge(allternit_api::marketplace_routes::router())
        .merge(admin_mcp_tunnel_router())
        .merge(outcome_rubric_router())
        .merge(federation_router())
        .merge(quickstart_router())
        .merge(allternit_api::rbac_routes::router())
        .merge(allternit_api::external_keys_routes::router())
        .merge(allternit_api::scim_routes::router())
        .merge(allternit_api::admin_audit_routes::router())
        .merge(allternit_api::compliance_routes::router())
        .merge(allternit_api::data_residency_routes::router())
        .merge(allternit_api::device_attestation_routes::router())
        .merge(workspace_router())
        .merge(artifact_router())
        .merge(conversation_router())
        .merge(office_router())
        .merge(office_cli_router())
        .merge(office_engine_v1_router())
        .merge(orchestrator_router())
        .merge(alabs_router())
        .merge(automation_router())
        .merge(brain_router())
        .merge(hud_router());

    // ── Protected routes (require authentication) ─────────────────────────────
    let protected = Router::new()
        .nest("/api/v1", v1_routes)
        .nest("/api/v1", bb_router())
        // The tool registry is also served under /api/v1 because the
        // web/desktop surface (`native-agent-api.ts`, `recording.store.ts`,
        // `tool-registry.store.ts`) calls `/api/v1/tools[/execute]`.
        .nest("/api/v1", tool_routes::tool_router())
        // API routes (not under /v1)
        .nest("/api", agent_chat_router())
        .nest("/api", tool_routes::tool_router())
        .nest("/api", local_brain_router())
        .nest("/api", local_engine_router())
        .nest("/api", local_studio_router())
        .nest("/api", har_api_router())
        // Feature routes
        .nest("/viz", viz_router())
        .nest("/sandbox", sandbox_router())
        .nest("/vm-session", vm_session_router())
        .nest("/rails", rails_router())
        .nest("/api/rails", rails_router())
        .nest("/stream", stream_router())
        .nest("/ws/bots", bot_desktop_stream_router())
        .nest("/terminal", terminal_router())
        .nest(
            "/mcp",
            mcp_router().merge(allternit_api::mcp_server_routes::mcp_server_router()),
        )
        .nest("/metrics", metrics_router())
        .nest("/api", h5i_router())
        .nest("/api", oauth_router())
        .nest("/api", onboarding_router())
        .nest("/api", aci_router())
        .nest("/api", page_agent_router())
        .nest("/api", analytics_router())
        .nest("/api", playground_router())
        .nest("/api", checkpoints_router())
        .nest("/api", design_connector_router())
        .nest("/api", office_engine_router())
        .nest("/api", provider_router())
        // Idempotency replay for POST/PUT/PATCH on the protected surface.
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            idempotency_middleware,
        ))
        // Per-organization rate-limit enforcement.
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            rate_limit_middleware,
        ))
        // Auth middleware applied to everything above (runs first).
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    // ── Public routes (no authentication required) ────────────────────────────
    let mut public = Router::new()
        .nest("/health", health_router())
        .nest("/api", web_proxy_router())
        .nest("/beta", enrollment_router())
        .merge(status_router())
        .merge(webhook_router())
        .merge(webhook_trigger_public_router())
        .merge(allternit_api::benchmark_routes::benchmark_router())
        // Slack signs every request itself (`verify_slack_signature`), so
        // this is public the same way `webhook_router()` above is — no
        // Clerk session exists for a server-to-server call from Slack.
        .merge(allternit_api::slack_webhook_routes::slack_webhook_router())
        // Photon.codes inbound-message webhook is also server-to-server and
        // carries no Clerk session; route it to the recipient bot's inbox.
        .merge(allternit_bus_webhook_router())
        // mailflare inbound-email webhook is likewise server-to-server; it is
        // HMAC-verified per handler (ALLTERNIT_MAILFLARE_WEBHOOK_SECRET).
        .merge(allternit_api::agent_email_routes::agent_email_webhook_router())
        // OAuth provider redirect targets — the browser arrives from the
        // provider's consent screen with no Clerk JWT, so these must be
        // public: the curated-3 loopback callback (moved out of the protected
        // router) and the open-connector sidecar's `/oauth/callback` proxy.
        .merge(allternit_api::connector_routes::connector_public_router())
        // Internal-only: the ACU (computer-use) Python gateway has no Clerk
        // session, so these are gated by internal_auth::require_internal_token
        // per-handler instead of the Clerk auth_middleware layer above.
        .merge(allternit_api::internal_routes::internal_router())
        // Desktop Cloud host self-registration from bootstrap cloud-init.
        .merge(allternit_api::desktop_host_admin::public_router())
        // Private Fabric node daemon enrollment and heartbeat.
        .merge(allternit_api::fabric_node_routes::public_router())
        // Brain git smart-HTTP: git clients carry no Clerk JWT — they use
        // `allternit_git_` tokens (Basic password or Bearer), verified
        // per-handler by brain_routes and scoped to these routes only. The
        // management/read brain API stays on the protected router above.
        // Nested under /api/v1 so clone URLs issued by POST /api/v1/brains
        // resolve here.
        .nest("/api/v1", brain_git_router());

    // Fabric Model Gateway: OpenAI-shaped /v1 model catalog and the unified
    // /v1/responses endpoint. It is authenticated with the standard Clerk/
    // access-token middleware, then merged before the Gizzi LLM gateway so
    // the Fabric catalog owns /v1/models while /v1/chat/completions falls
    // through to the existing gateway.
    public = public.merge(
        allternit_api::fabric_model_routes::router().layer(axum::middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        )),
    );

    // LLM gateway: the OpenAI-compatible /v1 surface (chat completions,
    // models). It carries its own virtual-key middleware chain (llm_key auth
    // → rate limit → budget pre-check), so it mounts on the public router —
    // do NOT put it behind the Clerk auth middleware.
    public = public.nest(
        "/v1",
        allternit_api::llm_gateway::llm_gateway_router(state.clone()),
    );

    // Mount the offline platform UI at `/` when a static export is available.
    // This is intentionally last among the explicit public routes so that
    // `/health`, `/api`, `/status` and webhooks are served by their own routers.
    // Unknown paths fall back to `index.html` for SPA client-side routing.
    // When no static export is present, keep the 501 "not implemented" fallback.
    if let Some(service) = platform_service() {
        public = public.nest_service("/", service);
    } else {
        public = public.merge(fallback_router());
    }

    // Combine protected + public, then apply state
    let mut app = protected.merge(public).with_state(state.clone());

    // Mount cowork scheduler routes if scheduler is active
    if let Some(sstate) = scheduler_state {
        app = app.nest(
            "/cowork/scheduler",
            allternit_cowork_scheduler::api::api_router(sstate),
        );
    }

    // Mount cowork background service routes if service is active
    if let Some(bstate) = bg_state {
        app = app.merge(background_router(Arc::new(bstate)));
    }

    // Apply the CORS policy (see allternit_api::cors for the matrix). The
    // gate rejects cross-origin requests from origins outside the allowlist
    // with 403 and runs OUTSIDE the CORS layer — the layer would otherwise
    // answer OPTIONS preflights itself before the gate sees them. Allowed
    // requests pass through to the layer, which decorates responses with the
    // correct preflight and Vary headers. Credentials stay enabled because
    // the local UIs use `credentials: 'include'`.
    let app = if app_config.local_dev_bypass() {
        // Dev-bypass mode keeps the legacy permissive mirror-any-origin
        // behavior; no gate is installed.
        app.layer(allternit_api::cors::cors_layer_from_config(&app_config))
    } else {
        app.layer(allternit_api::cors::cors_layer_from_config(&app_config))
            .layer(axum::middleware::from_fn_with_state(
                allternit_api::cors::CorsGateState::new(app_config.cors_origins()),
                allternit_api::cors::origin_gate,
            ))
    };

    // Record request metrics for all non-preflight requests
    let app = app.layer(axum::middleware::from_fn(
        allternit_api::metrics::metrics_middleware,
    ));

    // Start server — port from config (env override supported), default 8013
    let port = app_config.api_port();
    let webhook_receiver_port = app_config.webhook_receiver_port();
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .unwrap();
    info!("Server listening on {}", listener.local_addr().unwrap());
    info!("Webhook receiver port configured to {}", webhook_receiver_port);
    info!("API Documentation:");
    info!("  - Health:         GET /health");
    info!("  - Status:         GET /status");
    info!("  - Chat:           POST /api/agent-chat");
    info!("  - Agents:         GET|POST /api/v1/agents");
    info!("  - Workspaces:     GET|POST /api/workspaces");
    info!("  - Memory:         GET|POST /api/v1/memory");
    info!("  - Files:          GET|POST /api/v1/files");
    info!("  - Inbox:          GET|POST /api/v1/inbox");
    info!("  - Visualization:  GET /viz/*");
    info!("  - Sandbox:        POST /sandbox/*");
    info!("  - VM Sessions:    POST|GET|DELETE /vm-session/*");
    info!("  - Rails System:   GET|POST /rails/*");
    info!("  - Event Stream:   WS /stream/ws/*");
    info!("  - Terminal:       POST /terminal/*");
    info!("  - Webhooks:       POST /webhooks/clerk/*");
    info!("  - LLM Gateway:    POST /v1/chat/completions, GET /v1/models (Bearer ak-...)");

    // Re-index Open Design skills on SIGHUP in production without restarting.
    {
        let cache = Arc::clone(&state).design_skill_cache.clone();
        tokio::spawn(async move {
            let mut sig = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::hangup())
                .expect("SIGHUP handler");
            loop {
                sig.recv().await;
                info!("SIGHUP received, re-indexing Open Design skills");
                cache.refresh(None).await;
            }
        });
    }

    axum::serve(listener, app).await.unwrap();
}

/// Initialize the cowork background service (autonomous loop) backed by SQLite.
async fn initialize_cowork_background(
    data_dir: &std::path::Path,
) -> (
    Option<allternit_api::cowork::background_service::BackgroundServiceHandle>,
    Option<CoworkBgState>,
) {
    let db_path = data_dir.join("cowork-background.db");
    match CoworkBackgroundService::new(&db_path) {
        Ok(svc) => {
            let handle = svc.handle();
            let shared = Arc::new(svc);
            CoworkBackgroundService::start(shared);
            info!(
                "Cowork background service started (db: {})",
                db_path.display()
            );
            let bg_state = CoworkBgState {
                handle: handle.clone(),
            };
            (Some(handle), Some(bg_state))
        }
        Err(e) => {
            tracing::warn!("Cowork background service init failed: {e}");
            (None, None)
        }
    }
}

/// Initialize the cowork runtime run manager backed by Rails DAGs/WIHs.
async fn initialize_cowork_run_manager(
    data_dir: &std::path::Path,
    rails: allternit_api::rails::RailsState,
    app_config: &allternit_api::config::AppConfig,
) -> Option<Arc<RunManager>> {
    let runtime_dir = data_dir.join("cowork-runtime");
    if let Err(e) = std::fs::create_dir_all(&runtime_dir) {
        warn!("Failed to create cowork-runtime directory: {e}");
        return None;
    }
    let rails_url = app_config.rails_url();
    let workspace_id = app_config.rails_workspace_id();

    let config = RunManagerConfig {
        data_dir: runtime_dir,
        rails_base_url: rails_url,
        attachment_timeout_secs: 300,
        lease_duration_secs: 60,
        max_checkpoint_age_hours: 24,
    };

    let rails_client = create_local_rails_client(rails, workspace_id);

    match RunManager::new(config, rails_client).await {
        Ok((manager, _event_tx)) => {
            info!("Cowork run manager initialized");
            Some(Arc::new(manager))
        }
        Err(e) => {
            warn!("Cowork run manager init failed: {e}");
            None
        }
    }
}

/// Load previously persisted cowork runs from SQLite into the runtime manager.
async fn load_persisted_cowork_runs(db: &allternit_api::db::DbHandle, manager: &Arc<RunManager>) {
    let conn = match db.connect() {
        Ok(c) => c,
        Err(e) => {
            warn!("Failed to connect to DB to load cowork runs: {e}");
            return;
        }
    };

    let mut stmt = match conn.prepare(
        "SELECT id, tenant_id, workspace_id, initiator, mode, state, entrypoint, dag_id,
                current_job_id, current_checkpoint_id, policy_profile, created_at, updated_at, completed_at
         FROM cowork_runs"
    ) {
        Ok(s) => s,
        Err(e) => {
            warn!("Failed to prepare cowork runs load query: {e}");
            return;
        }
    };

    let rows = match stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, String>(6)?,
            row.get::<_, String>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, Option<String>>(9)?,
            row.get::<_, String>(10)?,
            row.get::<_, String>(11)?,
            row.get::<_, String>(12)?,
            row.get::<_, Option<String>>(13)?,
        ))
    }) {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect::<Vec<_>>(),
        Err(e) => {
            warn!("Failed to load persisted cowork runs: {e}");
            return;
        }
    };

    for (
        id,
        tenant_id,
        workspace_id,
        initiator,
        mode_str,
        state_str,
        entrypoint,
        dag_id,
        current_job_id,
        current_checkpoint_id,
        policy_profile,
        created_at,
        updated_at,
        completed_at,
    ) in rows
    {
        let run_id = match uuid::Uuid::parse_str(&id) {
            Ok(u) => RunId(u),
            Err(_) => continue,
        };
        let mode = mode_str.parse::<RunMode>().unwrap_or(RunMode::Cowork);
        let state = state_str.parse::<RunState>().unwrap_or(RunState::Created);
        let current_job_id = current_job_id.and_then(|s| uuid::Uuid::parse_str(&s).ok().map(JobId));
        let created_at = chrono::DateTime::parse_from_rfc3339(&created_at)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        let updated_at = chrono::DateTime::parse_from_rfc3339(&updated_at)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|_| chrono::Utc::now());
        let completed_at = completed_at.and_then(|s| {
            chrono::DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&chrono::Utc))
                .ok()
        });

        let run = CoworkRun {
            id: run_id,
            tenant_id,
            workspace_id,
            initiator,
            mode,
            state,
            entrypoint,
            dag_id,
            current_job_id,
            current_checkpoint_id,
            policy_profile,
            created_at,
            updated_at,
            completed_at,
        };

        if let Err(e) = manager.load_run(run).await {
            warn!("Failed to load run {id} into run manager: {e}");
        }
    }

    info!("Loaded persisted cowork runs into run manager");
}

/// Initialize the cowork task scheduler backed by SQLite.
async fn initialize_cowork_scheduler(
    data_dir: &std::path::Path,
    api_port: u16,
) -> Option<Arc<RwLock<Scheduler>>> {
    let db_path = data_dir.join("cowork-schedules.db");
    let api_url = format!("http://localhost:{}", api_port);

    match Scheduler::new(&db_path, api_url).await {
        Ok(scheduler) => {
            let shared = Arc::new(RwLock::new(scheduler));
            let s = shared.clone();
            if let Err(e) = s.read().await.start().await {
                tracing::warn!("Cowork scheduler start failed: {e}");
                return None;
            }
            info!("Cowork scheduler started (db: {})", db_path.display());
            Some(shared)
        }
        Err(e) => {
            tracing::warn!("Cowork scheduler init failed: {e}");
            None
        }
    }
}

/// Build a mesh VPN config from environment variables, if any are set.
fn build_mesh_config_from_env() -> Option<allternit_computer_cloud::MeshConfig> {
    let provider = std::env::var("ALLTERNIT_MESH_PROVIDER").ok()?;
    let auth_key = std::env::var("ALLTERNIT_MESH_AUTH_KEY").ok()?;
    let tags: Vec<String> = std::env::var("ALLTERNIT_MESH_TAGS")
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    match provider.as_str() {
        "tailscale" => Some(allternit_computer_cloud::MeshConfig::Tailscale { auth_key, tags }),
        "headscale" => {
            let server_url = std::env::var("ALLTERNIT_MESH_SERVER_URL").ok()?;
            Some(allternit_computer_cloud::MeshConfig::Headscale {
                server_url,
                auth_key,
                tags,
            })
        }
        other => {
            warn!(provider = %other, "Unknown ALLTERNIT_MESH_PROVIDER value");
            None
        }
    }
}

/// Result of initializing VM drivers.
struct VmDriverSet {
    /// Driver exposed to the rest of the API through `ExecutionDriver`.
    dynamic: Option<Arc<dyn allternit_driver_interface::ExecutionDriver>>,
    /// Concrete Incus driver, kept separately so the control plane can add and
    /// remove cloud-provisioned hosts at runtime.
    incus: Option<Arc<allternit_computer_cloud::IncusDriver>>,
}

/// Initialize the appropriate VM driver for the platform
async fn initialize_vm_driver(
    app_config: &allternit_api::config::AppConfig,
) -> VmDriverSet {
    use allternit_driver_interface::ExecutionDriver;

    // Build every configured substrate driver. The heterogeneous router hides
    // Incus (Linux/Windows) and Tart (macOS) behind one ExecutionDriver handle.
    let mut incus_driver = None;
    let incus_urls: Vec<String> = std::env::var("INCUS_URLS")
        .ok()
        .filter(|s| !s.is_empty())
        .map(|s| s.split(',').map(|u| u.trim().to_string()).collect())
        .or_else(|| std::env::var("INCUS_URL").ok().map(|u| vec![u]))
        .unwrap_or_default();
    if !incus_urls.is_empty() {
        let fallback_vnc_host =
            std::env::var("INCUS_VNC_HOST").unwrap_or_else(|_| "localhost".to_string());
        let mesh = build_mesh_config_from_env();
        let driver_result = if incus_urls.len() == 1 {
            allternit_computer_cloud::IncusDriver::from_url(
                incus_urls.into_iter().next().unwrap(),
                fallback_vnc_host,
            )
        } else {
            allternit_computer_cloud::IncusDriver::from_urls(&incus_urls, fallback_vnc_host)
        };
        match driver_result {
            Ok(driver) => {
                let driver = if let Some(mesh) = mesh {
                    driver.with_mesh(mesh)
                } else {
                    driver
                };
                match driver.health_check().await {
                    Ok(health) => {
                        if health.healthy {
                            info!("Incus driver initialized from INCUS_URL");
                        } else {
                            warn!("Incus health check returned unhealthy: {:?}", health);
                        }
                        driver.recover_ports().await;
                        incus_driver = Some(Arc::new(driver));
                    }
                    Err(e) => warn!("Incus health check failed: {}", e),
                }
            }
            Err(e) => warn!("Failed to initialize Incus driver: {}", e),
        }
    }

    let mut tart_driver = None;
    if std::env::var("TART_HOST_URL").is_ok()
        || std::env::var("TART_HOST_URLS").is_ok()
        || std::env::var("TART_BIN").map_or(false, |s| !s.is_empty())
    {
        let mesh = build_mesh_config_from_env();
        match allternit_computer_cloud::TartDriver::from_env() {
            Ok(driver) => {
                let driver = if let Some(mesh) = mesh {
                    driver.with_mesh(mesh)
                } else {
                    driver
                };
                match driver.health_check().await {
                    Ok(health) => {
                        if health.healthy {
                            info!("Tart driver initialized");
                        } else {
                            warn!("Tart health check returned unhealthy: {:?}", health);
                        }
                        tart_driver = Some(Arc::new(driver));
                    }
                    Err(e) => warn!("Tart health check failed: {}", e),
                }
            }
            Err(e) => warn!("Failed to initialize Tart driver: {}", e),
        }
    }

    if incus_driver.is_some() || tart_driver.is_some() {
        let router = allternit_computer_cloud::SubstrateRouter::new(incus_driver.clone(), tart_driver);
        if router.has_any_driver() {
            info!("Substrate router initialized");
            return VmDriverSet {
                dynamic: Some(Arc::new(router)),
                incus: incus_driver,
            };
        }
    }

    // If OpenSandbox is explicitly configured, prefer it over the local
    // platform driver so bots can use a persistent cloud sandbox.
    if let Ok(open_sandbox_url) = std::env::var("OPEN_SANDBOX_URL") {
        use allternit_driver_interface::ExecutionDriver;
        use allternit_opensandbox_driver::{OpenSandboxConfig, OpenSandboxDriver};
        let config = OpenSandboxConfig::new(open_sandbox_url);
        let driver = OpenSandboxDriver::new(config);
        match driver.health_check().await {
            Ok(health) if health.healthy => {
                info!("OpenSandbox driver initialized from OPEN_SANDBOX_URL");
                return VmDriverSet {
                    dynamic: Some(Arc::new(driver)),
                    incus: None,
                };
            }
            Ok(health) => warn!("OpenSandbox health check returned unhealthy: {:?}", health),
            Err(e) => warn!("OpenSandbox health check failed: {}", e),
        }
    }

    // Get packaged VM directory from desktop app (if available)
    let vm_dir = app_config.vm_dir().map(|p| p.to_string_lossy().to_string());
    if let Some(ref dir) = vm_dir {
        info!("Using packaged VM directory: {}", dir);
    }

    #[cfg(target_os = "linux")]
    {
        use allternit_firecracker_driver::{FirecrackerConfig, FirecrackerDriver};

        let mut config = FirecrackerConfig::default();

        // Use packaged VM directory if available
        if let Some(dir) = vm_dir {
            config.vm_root_dir = std::path::PathBuf::from(dir);
        }

        match FirecrackerDriver::new(config).await {
            Ok(driver) => {
                info!("Firecracker driver initialized");
                return VmDriverSet {
                    dynamic: Some(Arc::new(driver)),
                    incus: None,
                };
            }
            Err(e) => {
                warn!("Failed to initialize Firecracker driver: {}", e);
                info!("Running without VM execution (visualization only)");
                return VmDriverSet {
                    dynamic: None,
                    incus: None,
                };
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        use allternit_apple_vf_driver::{AppleVFConfig, AppleVFDriver};

        let mut config = AppleVFConfig::default();

        // Use packaged VM directory if available
        if let Some(dir) = vm_dir {
            config.vm_storage_dir = std::path::PathBuf::from(&dir).join("vms");
            config.images_dir = std::path::PathBuf::from(&dir).join("images");
        }

        // Detect lume binary next to current executable
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let lume_path = exe_dir.join("lume");
                if lume_path.exists() {
                    info!("Found Lume binary at: {}", lume_path.display());
                    config = config.with_lume_bin(lume_path);
                }
            }
        }

        match AppleVFDriver::with_config(config) {
            Ok(driver) => {
                info!("Apple VF driver initialized (powered by Lume)");
                return VmDriverSet {
                    dynamic: Some(Arc::new(driver)),
                    incus: None,
                };
            }
            Err(e) => {
                warn!("Failed to initialize Apple VF driver: {}", e);
                info!("Running without VM execution (visualization only)");
                return VmDriverSet {
                    dynamic: None,
                    incus: None,
                };
            }
        }
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        info!("VM execution not supported on this platform");
        return VmDriverSet {
            dynamic: None,
            incus: None,
        };
    }
}

/// Initialize WebAuthn / passkey support when the relying-party env vars are set.
///
/// `ALLTERNIT_PASSKEY_RP_ID` is the domain suffix bound to credentials (e.g.
/// `allternit.com`). `ALLTERNIT_PASSKEY_RP_ORIGIN` is the full origin where
/// registration/authentication happens (e.g. `https://platform.allternit.com`).
/// The extension sidepanel cannot itself be an RP origin because it runs under
/// `chrome-extension://<id>`; the platform page is the primary passkey surface.
fn initialize_passkey_state(
    db: allternit_api::db::DbHandle,
) -> anyhow::Result<Option<allternit_api::passkey_routes::PasskeyState>> {
    let rp_id = match std::env::var("ALLTERNIT_PASSKEY_RP_ID") {
        Ok(v) if !v.trim().is_empty() => v.trim().to_owned(),
        _ => return Ok(None),
    };
    let rp_origin_str = match std::env::var("ALLTERNIT_PASSKEY_RP_ORIGIN") {
        Ok(v) if !v.trim().is_empty() => v.trim().to_owned(),
        _ => return Ok(None),
    };
    let rp_origin = rp_origin_str
        .parse::<url::Url>()
        .map_err(|e| anyhow::anyhow!("invalid ALLTERNIT_PASSKEY_RP_ORIGIN: {e}"))?;
    Ok(Some(allternit_api::passkey_routes::PasskeyState::new(
        rp_id, rp_origin, db,
    )?))
}

/// Return the passkey router when passkey support is enabled, otherwise an empty router.
fn passkey_router(state: &Arc<AppState>) -> Router<Arc<AppState>> {
    match state.passkey_state.as_ref() {
        Some(passkey_state) => {
            allternit_api::passkey_routes::passkey_router(passkey_state.clone())
        }
        None => Router::new(),
    }
}
