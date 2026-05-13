
//! SSH Key API routes

use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::warn;

use crate::AppState;
use crate::auth::AuthUser;

fn fingerprint_public_key(public_key: &str) -> String {
    let hash = md5::compute(public_key.trim().as_bytes());
    format!("{:x}", hash)
        .as_bytes()
        .chunks(2)
        .map(|chunk| std::str::from_utf8(chunk).unwrap_or(""))
        .collect::<Vec<_>>()
        .join(":")
}

pub fn ssh_key_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/ssh-keys", get(list_ssh_keys).post(create_ssh_key))
        .route("/ssh-keys/generate", post(generate_ssh_key))
        .route("/ssh-keys/import", post(import_ssh_key))
        .route("/ssh-keys/:id", get(get_ssh_key).put(update_ssh_key).delete(delete_ssh_key))
}

// ─── List SSH keys ──────────────────────────────────────────────────────────────

async fn list_ssh_keys(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let user_id = user.user_id;

    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, fingerprint, public_key, key_type, bits, last_used_at, created_at, updated_at
             FROM ssh_keys WHERE user_id = ?1 ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok(SshKeyRow {
                id: row.get(0)?,
                name: row.get(1)?,
                fingerprint: row.get(2)?,
                public_key: row.get(3)?,
                key_type: row.get(4)?,
                bits: row.get(5)?,
                last_used_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
        Ok::<_, rusqlite::Error>(rows)
    }).await;

    match rows {
        Ok(Ok(data)) => (StatusCode::OK, Json(json!(data))),
        _ => (StatusCode::OK, Json(json!(Vec::<SshKeyRow>::new()))),
    }
}

// ─── Create SSH key ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct CreateSshKey {
    name: String,
    public_key: Option<String>,
    private_key: Option<String>,
    passphrase: Option<String>,
    key_type: Option<String>,
    bits: Option<i64>,
}

async fn create_ssh_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<CreateSshKey>,
) -> impl axum::response::IntoResponse {

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Name is required"})));
    }

    let public_key = body.public_key.unwrap_or_default();
    let fingerprint = if public_key.is_empty() { String::new() } else { fingerprint_public_key(&public_key) };
    let key_type = body.key_type.unwrap_or_else(|| "ed25519".to_string());
    let bits = body.bits.unwrap_or(256);
    let private_key = body.private_key;
    let passphrase = body.passphrase;

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;
    let name2 = name.clone();
    let fingerprint2 = fingerprint.clone();
    let public_key2 = public_key.clone();
    let key_type2 = key_type.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO ssh_keys (id, user_id, name, public_key, private_key, passphrase, fingerprint, key_type, bits)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id2, user_id, name2, public_key2, private_key, passphrase, fingerprint2, key_type2, bits],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({ "id": id, "name": name, "fingerprint": fingerprint, "public_key": public_key, "key_type": key_type, "bits": bits }))),
        Ok(Err(e)) => {
            warn!("DB error creating SSH key: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

// ─── Generate SSH key ───────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct GenerateSshKey {
    name: String,
    #[serde(alias = "type")]
    key_type: Option<String>,
    bits: Option<i64>,
}

async fn generate_ssh_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<GenerateSshKey>,
) -> impl axum::response::IntoResponse {

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Name is required"})));
    }

    let key_type = body.key_type.unwrap_or_else(|| "ed25519".to_string());
    let bits = body.bits.unwrap_or_else(|| if key_type == "rsa" { 4096 } else { 256 });
    let (algo, bits_str) = match key_type.as_str() {
        "rsa" => ("rsa", format!("{}", bits)),
        "ecdsa" => ("ecdsa", "256".to_string()),
        _ => ("ed25519", "256".to_string()),
    };

    // Generate key pair using ssh-keygen
    let tmp_dir = std::env::temp_dir().join(format!("allternit_ssh_key_{}", uuid::Uuid::new_v4()));
    let tmp_path = tmp_dir.to_string_lossy().to_string();
    let key_file = format!("{}/key", tmp_path);
    let name_for_gen = name.clone();

    let gen_result = tokio::task::spawn_blocking(move || {
        std::fs::create_dir_all(&tmp_dir)?;
        
        let mut cmd = std::process::Command::new("ssh-keygen");
        cmd.arg("-t").arg(algo)
           .arg("-f").arg(&key_file)
           .arg("-N").arg("")
           .arg("-C").arg(format!("allternit-{}", name_for_gen))
           .stdout(std::process::Stdio::null())
           .stderr(std::process::Stdio::null());
        
        if algo == "rsa" {
            cmd.arg("-b").arg(&bits_str);
        }
        
        let status = cmd.status()?;
        if !status.success() {
            return Err(std::io::Error::new(std::io::ErrorKind::Other, "ssh-keygen failed"));
        }

        let private_key = std::fs::read_to_string(&key_file)?;
        let public_key = std::fs::read_to_string(format!("{}.pub", key_file))?;
        
        // Cleanup
        let _ = std::fs::remove_file(&key_file);
        let _ = std::fs::remove_file(format!("{}.pub", key_file));
        let _ = std::fs::remove_dir(&tmp_dir);
        
        Ok::<_, std::io::Error>((private_key, public_key))
    }).await;

    let (private_key, public_key) = match gen_result {
        Ok(Ok(pair)) => pair,
        _ => {
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "Failed to generate SSH key"})));
        }
    };

    let fingerprint = fingerprint_public_key(&public_key);

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;
    let name2 = name.clone();
    let public_key2 = public_key.clone();
    let private_key2 = private_key.clone();
    let fingerprint2 = fingerprint.clone();
    let key_type2 = key_type.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO ssh_keys (id, user_id, name, public_key, private_key, fingerprint, key_type, bits)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id2, user_id, name2, public_key2, private_key2, fingerprint2, key_type2, bits],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({
            "id": id,
            "name": name,
            "public_key": public_key,
            "private_key": private_key,
            "fingerprint": fingerprint,
        }))),
        Ok(Err(e)) => {
            warn!("DB error storing generated SSH key: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

// ─── Import SSH key ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ImportSshKey {
    name: String,
    private_key: String,
    passphrase: Option<String>,
}

async fn import_ssh_key(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<ImportSshKey>,
) -> impl axum::response::IntoResponse {

    let name = body.name.trim().to_string();
    if name.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "Name is required"})));
    }

    let private_key = body.private_key.trim().to_string();
    if private_key.is_empty() {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "private_key is required"})));
    }

    // Derive public key from private key using ssh-keygen -y
    let tmp_dir = std::env::temp_dir().join(format!("allternit_ssh_import_{}", uuid::Uuid::new_v4()));
    let key_file = format!("{}/key", tmp_dir.to_string_lossy());

    let pub_result = tokio::task::spawn_blocking({
        let key_file = key_file.clone();
        let private_key = private_key.clone();
        let tmp_dir = tmp_dir.clone();
        let passphrase = body.passphrase.clone();
        move || {
            std::fs::create_dir_all(&tmp_dir)?;
            std::fs::write(&key_file, private_key)?;
            
            let mut cmd = std::process::Command::new("ssh-keygen");
            cmd.arg("-y").arg("-f").arg(&key_file);
            if let Some(pp) = passphrase {
                if !pp.is_empty() {
                    cmd.arg("-P").arg(pp);
                }
            }
            
            let output = cmd.output()?;
            let public_key = String::from_utf8_lossy(&output.stdout).trim().to_string();
            
            // Cleanup
            let _ = std::fs::remove_file(&key_file);
            let _ = std::fs::remove_dir(&tmp_dir);
            
            if public_key.is_empty() {
                return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Failed to derive public key"));
            }
            
            Ok::<_, std::io::Error>(public_key)
        }
    }).await;

    let public_key = match pub_result {
        Ok(Ok(pk)) => pk,
        _ => {
            return (StatusCode::BAD_REQUEST, Json(json!({"error": "Failed to derive public key from private key"})));
        }
    };

    let fingerprint = fingerprint_public_key(&public_key);

    // Infer key type from the public key format
    let key_type = if public_key.starts_with("ssh-rsa") {
        "rsa"
    } else if public_key.starts_with("ecdsa") {
        "ecdsa"
    } else {
        "ed25519"
    }.to_string();

    let bits = if key_type == "rsa" { 4096i64 } else { 256i64 };
    let passphrase = body.passphrase;

    let db = state.db.clone();
    let id = uuid::Uuid::new_v4().to_string();
    let id2 = id.clone();
    let user_id = user.user_id;
    let name2 = name.clone();
    let public_key2 = public_key.clone();
    let fingerprint2 = fingerprint.clone();
    let key_type2 = key_type.clone();

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "INSERT INTO ssh_keys (id, user_id, name, public_key, private_key, passphrase, fingerprint, key_type, bits)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id2, user_id, name2, public_key2, private_key, passphrase, fingerprint2, key_type2, bits],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::CREATED, Json(json!({
            "id": id,
            "name": name,
            "fingerprint": fingerprint,
            "public_key": public_key,
            "created_at": chrono::Utc::now().to_rfc3339(),
        }))),
        Ok(Err(e)) => {
            warn!("DB error importing SSH key: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

// ─── Get SSH key ────────────────────────────────────────────────────────────────

async fn get_ssh_key(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let row = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, name, fingerprint, public_key, key_type, bits, last_used_at, created_at, updated_at
             FROM ssh_keys WHERE id = ?1 AND user_id = ?2"
        )?;
        let row = stmt.query_row(params![id2, user_id], |row| {
            Ok(SshKeyRow {
                id: row.get(0)?,
                name: row.get(1)?,
                fingerprint: row.get(2)?,
                public_key: row.get(3)?,
                key_type: row.get(4)?,
                bits: row.get(5)?,
                last_used_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        Ok::<_, rusqlite::Error>(row)
    }).await;

    match row {
        Ok(Ok(data)) => (StatusCode::OK, Json(json!(data))),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "SSH key not found"})))
        }
        _ => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"}))),
    }
}

// ─── Update SSH key ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct UpdateSshKey {
    name: Option<String>,
    public_key: Option<String>,
}

async fn update_ssh_key(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
    Json(body): Json<UpdateSshKey>,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;
    let name = body.name;
    let public_key = body.public_key;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        
        let existing: Option<String> = conn.query_row(
            "SELECT id FROM ssh_keys WHERE id = ?1 AND user_id = ?2",
            params![id2, user_id],
            |row| row.get(0),
        ).ok();
        
        if existing.is_none() {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        let mut sets = vec![];
        if let Some(n) = name {
            sets.push(format!("name = '{}'", n.replace('\'', "''")));
        }
        if let Some(pk) = public_key {
            let fp = fingerprint_public_key(&pk);
            sets.push(format!("public_key = '{}'", pk.replace('\'', "''")));
            sets.push(format!("fingerprint = '{}'", fp.replace('\'', "''")));
        }

        if sets.is_empty() {
            return Ok::<_, rusqlite::Error>(());
        }

        let sql = format!("UPDATE ssh_keys SET {} WHERE id = '{}'", sets.join(", "), id2.replace('\'', "''"));
        conn.execute(&sql, [])?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({"success": true}))),
        Ok(Err(rusqlite::Error::QueryReturnedNoRows)) => {
            (StatusCode::NOT_FOUND, Json(json!({"error": "SSH key not found"})))
        }
        Ok(Err(e)) => {
            warn!("DB error updating SSH key: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

// ─── Delete SSH key ─────────────────────────────────────────────────────────────

async fn delete_ssh_key(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Extension(user): Extension<AuthUser>,
    _headers: HeaderMap,
) -> impl axum::response::IntoResponse {

    let db = state.db.clone();
    let id2 = id.clone();
    let user_id = user.user_id;

    let result = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        conn.execute(
            "DELETE FROM ssh_keys WHERE id = ?1 AND user_id = ?2",
            params![id2, user_id],
        )?;
        Ok::<_, rusqlite::Error>(())
    }).await;

    match result {
        Ok(Ok(())) => (StatusCode::OK, Json(json!({"success": true}))),
        Ok(Err(e)) => {
            warn!("DB error deleting SSH key: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()})))
        }
        Err(e) => {
            warn!("DB task panicked: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": "internal error"})))
        }
    }
}

#[derive(Serialize)]
struct SshKeyRow {
    id: String,
    name: String,
    fingerprint: String,
    public_key: String,
    key_type: String,
    bits: i64,
    last_used_at: Option<String>,
    created_at: String,
    updated_at: String,
}
