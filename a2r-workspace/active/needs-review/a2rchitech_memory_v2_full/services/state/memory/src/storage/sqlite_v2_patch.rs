/*
PATCH TARGET: /a2rchitech/services/state/memory/src/storage/mod.rs

Drop-in v2 write semantics to replace `INSERT OR REPLACE` used in:
- SqliteMemoryStorage::store_memory
- store_rlm_processing_result

Hard rule: no overwrite. Conflicts create supersession chain.
*/
use crate::v2::truth_engine::TruthEngine;
use crate::v2::types::{MemoryAuthority, MemoryStatus, MemoryTimeline};
use crate::v2::conflict::choose_strategy;
use serde_json::Value;

pub struct DbConn;   // TODO(INTEGRATE)
pub struct MemoryError; // TODO(INTEGRATE)

pub struct ExistingRow {
    pub memory_id: String,
    pub created_at: u64,
    pub status: String,
    pub valid_from: Option<u64>,
    pub valid_to: Option<u64>,
    pub confidence: Option<f64>,
    pub authority: Option<String>,
    pub supersedes_memory_id: Option<String>,
}

pub fn store_memory_v2(
    conn: &mut DbConn,
    tenant_id: &str,
    memory_id: &str,
    memory_type: &str,
    content: &Value,
    metadata: &Value,
    tags: &[String],
    now: u64,
) -> Result<(), MemoryError> {
    let slot = TruthEngine::slot_key(content, tags, metadata);

    let existing = if let Some(slot_key) = slot.as_ref() {
        find_active_by_slot(conn, tenant_id, slot_key)?
    } else {
        find_active_by_memory_id(conn, tenant_id, memory_id)?
    };

    let mut incoming = MemoryTimeline::new_active(now, MemoryAuthority::Agent, 0.75);

    if let Some(ex) = existing {
        let mut existing_tl = MemoryTimeline {
            status: parse_status(&ex.status),
            valid_from: ex.valid_from.unwrap_or(ex.created_at),
            valid_to: ex.valid_to,
            confidence: ex.confidence.unwrap_or(0.75),
            authority: parse_authority(ex.authority.as_deref()),
            supersedes_memory_id: ex.supersedes_memory_id.clone(),
        };

        let strategy = choose_strategy(memory_type, tags);
        crate::v2::truth_engine::TruthEngine::apply(now, &mut existing_tl, &mut incoming, strategy);

        update_timeline(conn, tenant_id, &ex.memory_id, &existing_tl)?;
        let new_memory_id = generate_new_version_id(memory_id, now);
        incoming.supersedes_memory_id = Some(ex.memory_id.clone());
        insert_memory_row(conn, tenant_id, &new_memory_id, memory_type, content, metadata, tags, &incoming)?;
        return Ok(());
    }

    insert_memory_row(conn, tenant_id, memory_id, memory_type, content, metadata, tags, &incoming)?;
    Ok(())
}

/* ---- helpers: implement using your existing query builder / sqlx ---- */

fn find_active_by_slot(_conn: &mut DbConn, _tenant: &str, _slot_key: &str) -> Result<Option<ExistingRow>, MemoryError> { Ok(None) }
fn find_active_by_memory_id(_conn: &mut DbConn, _tenant: &str, _memory_id: &str) -> Result<Option<ExistingRow>, MemoryError> { Ok(None) }
fn update_timeline(_conn: &mut DbConn, _tenant: &str, _memory_id: &str, _tl: &MemoryTimeline) -> Result<(), MemoryError> { Ok(()) }

fn insert_memory_row(
    _conn: &mut DbConn,
    _tenant: &str,
    _memory_id: &str,
    _memory_type: &str,
    _content: &Value,
    _metadata: &Value,
    _tags: &[String],
    _tl: &MemoryTimeline,
) -> Result<(), MemoryError> { Ok(()) }

fn generate_new_version_id(base: &str, now: u64) -> String { format!("{}::v{}", base, now) }

fn parse_status(s: &str) -> MemoryStatus {
    match s {
        "active" => MemoryStatus::Active,
        "superseded" => MemoryStatus::Superseded,
        "archived" => MemoryStatus::Archived,
        _ => MemoryStatus::Active,
    }
}
fn parse_authority(s: Option<&str>) -> MemoryAuthority {
    match s.unwrap_or("agent") {
        "user" => MemoryAuthority::User,
        "system" => MemoryAuthority::System,
        _ => MemoryAuthority::Agent,
    }
}
