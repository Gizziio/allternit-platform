use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use sqlx::sqlite::SqliteConnectOptions;
use std::path::Path as FsPath;
use uuid::Uuid;
use intent_graph_kernel::{
    Node, Edge, NodeType, NodeStatus, EdgeType, SourceRef,
    IGKError
};
use intent_graph_kernel::schema::ContextSlice;
use intent_graph_kernel::query::QueryEngine;
use intent_graph_kernel::mutation::MutationEngine;
use intent_graph_kernel::projection::ProjectionEngine;
use intent_graph_kernel::storage::Storage;

#[derive(Clone)]
pub struct IgkService {
    storage: Storage,
    query: QueryEngine,
    mutation: MutationEngine,
    projection: ProjectionEngine,
}

impl IgkService {
    pub fn new(pool: sqlx::SqlitePool) -> Self {
        let storage = Storage::new(pool.clone());
        let query = QueryEngine::new(storage.clone());
        let mutation = MutationEngine::new(storage.clone());
        let projection = ProjectionEngine::new(storage.clone());

        Self { storage, query, mutation, projection }
    }

    pub fn router(&self) -> Router<IgkService> {
        Router::new()
            .route("/health", get(health_check))
            .route("/nodes/:id", get(get_node))
            .route("/nodes", post(create_node))
            .route("/edges", post(create_edge))
            .route("/query/subgraph", post(get_subgraph))
            .route("/query/projections", post(get_projections))
            .route("/context/window", post(context_window))
    }
}

async fn health_check() -> &'static str {
    "IGK service healthy"
}

#[derive(Deserialize)]
struct GetNodeParams {
    id: Uuid,
}

async fn get_node(
    State(service): State<IgkService>,
    Path(params): Path<GetNodeParams>,
) -> std::result::Result<Json<Node>, StatusCode> {
    match service.query.get_node(&params.id).await {
        Ok(node) => Ok(Json(node)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(Deserialize)]
struct CreateNodeRequest {
    node_type: NodeType,
    priority: i32,
    owner: String,
    source_refs: Vec<SourceRef>,
    attributes: serde_json::Value,
    policy_decision: Option<String>,
}

async fn create_node(
    State(service): State<IgkService>,
    Json(req): Json<CreateNodeRequest>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let node = Node {
        node_id: Uuid::new_v4(),
        node_type: req.node_type,
        status: NodeStatus::Proposed,
        priority: req.priority,
        owner: req.owner,
        source_refs: req.source_refs,
        attributes: req.attributes,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    let result = match req.policy_decision {
        Some(policy) => {
            service.mutation.commit_create_node(&node, "system", Some(policy)).await.map(|_| ())
        }
        None => {
            service.storage.create_node(&node).await.map(|_| ())
        }
    };

    match result {
        Ok(_) => Ok(Json(serde_json::json!({"node_id": node.node_id, "status": "created"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[derive(Deserialize)]
struct CreateEdgeRequest {
    from_node_id: Uuid,
    to_node_id: Uuid,
    edge_type: EdgeType,
    metadata: serde_json::Value,
    policy_decision: Option<String>,
}

async fn create_edge(
    State(service): State<IgkService>,
    Json(req): Json<CreateEdgeRequest>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let edge = Edge {
        edge_id: Uuid::new_v4(),
        from_node_id: req.from_node_id,
        to_node_id: req.to_node_id,
        edge_type: req.edge_type,
        metadata: req.metadata,
        created_at: chrono::Utc::now(),
    };

    let result = match req.policy_decision {
        Some(policy) => {
            service.mutation.commit_create_edge(&edge, "system", Some(policy)).await.map(|_| ())
        }
        None => {
            service.storage.create_edge(&edge).await.map(|_| ())
        }
    };

    match result {
        Ok(_) => Ok(Json(serde_json::json!({"edge_id": edge.edge_id, "status": "created"}))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[derive(Deserialize)]
struct GetSubgraphRequest {
    root_node_id: Uuid,
    depth: Option<usize>,
}

async fn get_subgraph(
    State(service): State<IgkService>,
    Json(req): Json<GetSubgraphRequest>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    match service.query.get_subgraph(&req.root_node_id, req.depth).await {
        Ok((node, edges)) => Ok(Json(serde_json::json!({
            "node": node,
            "edges": edges,
            "edge_count": edges.len()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[derive(Deserialize)]
struct GetProjectionsRequest {
    root_node_id: Uuid,
}

async fn get_projections(
    State(service): State<IgkService>,
    Json(req): Json<GetProjectionsRequest>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    match service.projection.compute_temporal_projections(&req.root_node_id).await {
        Ok(nodes) => Ok(Json(serde_json::json!({
            "now": nodes.now.len(),
            "next": nodes.next.len(),
            "later": nodes.later.len()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

#[derive(Deserialize)]
struct ContextWindowRequest {
    root_node_id: Uuid,
    token_budget: usize,
}

async fn context_window(
    State(service): State<IgkService>,
    Json(req): Json<ContextWindowRequest>,
) -> std::result::Result<Json<serde_json::Value>, StatusCode> {
    let slice = ContextSlice {
        root_nodes: vec![req.root_node_id],
        edges: vec![],
        sources: vec![],
        token_budget: req.token_budget,
    };

    match service.projection.compute_context_window(&slice).await {
        Ok(window) => Ok(Json(serde_json::json!({
            "token_count": window.token_count,
            "budget": window.budget,
            "within_budget": window.within_budget,
            "node_count": window.nodes.len()
        }))),
        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
    }
}

pub async fn run_server(addr: &str) -> std::result::Result<(), Box<dyn std::error::Error>> {
    let db_path = std::env::var("IGK_DB_PATH").unwrap_or_else(|_| "igk.db".to_string());
    if let Some(parent) = FsPath::new(&db_path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true);
    let pool = sqlx::SqlitePool::connect_with(options).await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    let service = IgkService::new(pool);
    let app = service.router().with_state(service);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[tokio::main]
async fn main() -> std::result::Result<(), Box<dyn std::error::Error>> {
    let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3120".to_string());
    let addr = format!("{}:{}", host, port);
    run_server(&addr).await
}
