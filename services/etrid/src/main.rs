//! Etrid wallet service — HTTP entry point.
//!
//! Exposes:
//! - POST /wallets                create a wallet
//! - GET  /wallets/:agent_id      list wallets for an agent
//! - POST /wallets/:id/sign       sign a message
//! - POST /invoices               create a payment invoice
//! - GET  /health                 liveness

use allternit_etrid::{CreateWalletRequest, InvoiceRequest, SignRequest, WalletStore};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
struct AppState {
    store: Arc<Mutex<WalletStore>>,
}

#[tokio::main]
async fn main() {
    let state = AppState {
        store: Arc::new(Mutex::new(WalletStore::new())),
    };

    let app = Router::new()
        .route("/health", get(health))
        .route("/wallets", post(create_wallet))
        .route("/wallets/:agent_id", get(list_wallets))
        .route("/wallets/:id/sign", post(sign_message))
        .route("/invoices", post(create_invoice))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8723").await.unwrap();
    println!("Etrid wallet service listening on http://0.0.0.0:8723");
    axum::serve(listener, app).await.unwrap();
}

async fn health() -> &'static str {
    "{\"status\":\"ok\"}"
}

async fn create_wallet(
    State(state): State<AppState>,
    Json(req): Json<CreateWalletRequest>,
) -> Result<Json<allternit_etrid::Wallet>, (StatusCode, Json<serde_json::Value>)> {
    let mut store = state.store.lock().unwrap();
    match store.create(req) {
        Ok(wallet) => Ok(Json(wallet)),
        Err(e) => Err((StatusCode::BAD_REQUEST, Json(json_error(&e.to_string())))),
    }
}

async fn list_wallets(
    State(state): State<AppState>,
    Path(agent_id): Path<String>,
) -> Json<Vec<allternit_etrid::Wallet>> {
    let store = state.store.lock().unwrap();
    let wallets: Vec<_> = store.list_by_agent(&agent_id).into_iter().cloned().collect();
    Json(wallets)
}

async fn sign_message(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(mut req): Json<SignRequest>,
) -> Result<Json<allternit_etrid::SignResponse>, (StatusCode, Json<serde_json::Value>)> {
    req.wallet_id = id;
    let store = state.store.lock().unwrap();
    match store.sign(req) {
        Ok(res) => Ok(Json(res)),
        Err(e) => Err((StatusCode::BAD_REQUEST, Json(json_error(&e.to_string())))),
    }
}

async fn create_invoice(
    State(state): State<AppState>,
    Json(req): Json<InvoiceRequest>,
) -> Result<Json<allternit_etrid::Invoice>, (StatusCode, Json<serde_json::Value>)> {
    let store = state.store.lock().unwrap();
    match store.create_invoice(req) {
        Ok(invoice) => Ok(Json(invoice)),
        Err(e) => Err((StatusCode::BAD_REQUEST, Json(json_error(&e.to_string())))),
    }
}

fn json_error(message: &str) -> serde_json::Value {
    serde_json::json!({ "error": message })
}
