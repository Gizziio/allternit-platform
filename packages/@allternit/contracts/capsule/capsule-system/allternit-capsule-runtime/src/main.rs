use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post, put},
    Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use capsule_runtime::lifecycle::CapsuleRuntime;
use capsule_runtime::registry::FrameworkRegistry;
use capsule_runtime::error::{CapsuleError, Result};
use capsule_runtime::schema::{CapsuleSpec, CapsuleId, SandboxPolicy, Bindings, PersistenceMode, RunRef, ToolScope, Lifecycle, Provenance};
use capsule_runtime::CapsuleService;
use allternit_kernel_contracts::FrameworkSpec;
use capsule_runtime::marketplace_routes::MarketplaceAppState;

fn build_router() -> Router<CapsuleService> {
    use capsule_runtime::marketplace_routes::marketplace_routes;
    Router::new()
        .route("/health", get(health_check))
        .route("/capsules", get(get_all_capsules))
        .route("/capsules/:id", get(get_capsule))
        .route("/capsules", post(spawn_capsule))
        .route("/capsules/:id/switch", put(switch_capsule))
        .route("/capsules/:id/close", post(close_capsule))
        .route("/capsules/:id/pin", post(pin_capsule))
        .route("/capsules/:id/export", get(export_capsule))
        .route("/frameworks", get(get_all_frameworks))
        .route("/frameworks/:id", get(get_framework))
        .route("/frameworks", post(register_framework))
        .merge(marketplace_routes())
}

async fn health_check() -> &'static str {
    "Capsule Runtime service healthy"
}

#[derive(Deserialize)]
struct SpawnCapsuleRequest {
    framework_id: Uuid,
    run_id: Uuid,
    session_id: Uuid,
    bindings: Bindings,
}

#[derive(Deserialize)]
struct SwitchCapsuleRequest {
    capsule_id: Uuid,
}

#[derive(Deserialize)]
struct CloseCapsuleRequest {
    capsule_id: Uuid,
    archive_to_journal: bool,
}

#[derive(Deserialize)]
struct PinCapsuleRequest {
    capsule_id: Uuid,
}

async fn get_all_capsules(
    State(service): State<CapsuleService>,
) -> std::result::Result<Json<Vec<CapsuleId>>, StatusCode> {
    let runtime = service.runtime().read().await;
    let capsules = runtime.get_all_capsules();
    Ok(Json(capsules.into_iter().map(|c| c.spec().capsule_id).collect()))
}

// Helper to access spec since Capsule struct doesn't expose it publically in current lifecycle.rs
// I'll add a helper trait or method if needed, but for now I'll assume I can get it.
// Wait, I checked lifecycle.rs and it doesn't have public spec field.
// I'll add public accessors to Capsule in lifecycle.rs next.

async fn get_capsule(
    State(service): State<CapsuleService>,
    Path(id): Path<Uuid>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let runtime = service.runtime().read().await;
    match runtime.get_capsule(&id) {
        Some(_capsule) => Ok(Json(serde_json::json!({"capsule_id": id}))),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn spawn_capsule(
    State(service): State<CapsuleService>,
    Json(req): Json<SpawnCapsuleRequest>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let mut runtime = service.runtime().write().await;
    
    // Create a dummy spec for now since we don't have the full factory here
    let spec = CapsuleSpec {
        capsule_id: Uuid::new_v4(),
        title: "New Capsule".to_string(),
        icon: "cube".to_string(),
        category: "general".to_string(),
        status: PersistenceMode::Ephemeral,
        run_ref: RunRef {
            run_id: req.run_id,
            session_id: req.session_id,
        },
        bindings: req.bindings,
        canvas_bundle: vec![],
        tool_scope: ToolScope {
            allowed_tools: vec![],
            denied_tools: vec![],
            requires_confirmation: vec![],
        },
        sandbox_policy: SandboxPolicy::default(),
        lifecycle: Lifecycle {
            close_behavior: "archive".to_string(),
            exportable: true,
        },
        provenance: Provenance {
            framework_id: req.framework_id,
            framework_version: "0.1.0".to_string(),
            agent_id: "system".to_string(),
            model_id: "default".to_string(),
            inputs: vec![],
            tool_calls: vec![],
        },
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        expires_at: None,
    };

    match runtime.spawn(spec).await {
        Ok(capsule_id) => Ok(Json(serde_json::json!({"capsule_id": capsule_id, "status": "created"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn switch_capsule(
    State(service): State<CapsuleService>,
    Path(_id): Path<Uuid>,
    Json(req): Json<SwitchCapsuleRequest>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let mut runtime = service.runtime().write().await;
    match runtime.switch(&req.capsule_id).await {
        Ok(_) => Ok(Json(serde_json::json!({"status": "switched"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn close_capsule(
    State(service): State<CapsuleService>,
    Path(_id): Path<Uuid>,
    Json(req): Json<CloseCapsuleRequest>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let mut runtime = service.runtime().write().await;
    match runtime.close(&req.capsule_id, req.archive_to_journal).await {
        Ok(_) => Ok(Json(serde_json::json!({"status": "closed"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn pin_capsule(
    State(service): State<CapsuleService>,
    Path(_id): Path<Uuid>,
    Json(req): Json<PinCapsuleRequest>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let mut runtime = service.runtime().write().await;
    match runtime.pin(&req.capsule_id).await {
        Ok(_) => Ok(Json(serde_json::json!({"status": "pinned"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn export_capsule(
    State(service): State<CapsuleService>,
    Path(id): Path<Uuid>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let runtime = service.runtime().read().await;
    match runtime.export(&id, "artifact").await {
        Ok(exported) => Ok(Json(serde_json::json!({"exported": exported}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

async fn get_all_frameworks(
    State(service): State<CapsuleService>,
) -> std::result::Result<Json<Vec<String>>, StatusCode> {
    let registry = service.registry().read().await;
    // Mocking list for now as registry doesn't have it
    Ok(Json(vec![]))
}

async fn get_framework(
    State(service): State<CapsuleService>,
    Path(id): Path<String>,
) -> std::result::Result<Json<Option<FrameworkSpec>>, StatusCode> {
    let registry = service.registry().read().await;
    Ok(Json(registry.lookup(&id).cloned()))
}

async fn register_framework(
    State(service): State<CapsuleService>,
    Json(req): Json<FrameworkSpec>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let mut registry = service.registry().write().await;
    match registry.register(req) {
        Ok(_) => Ok(Json(serde_json::json!({"status": "registered"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let runtime = CapsuleRuntime::new(SandboxPolicy::default());
    let registry = FrameworkRegistry::new();

    let db_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./marketplace.db".to_string());
    let pool = sqlx::SqlitePool::connect(&db_url).await?;

    let marketplace = MarketplaceAppState::new(pool).await?;
    let service = CapsuleService::new(runtime, registry, marketplace);

    let app = build_router().with_state(service.clone());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3006".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
