//! bb-compatible database access layer (rusqlite).

use super::models::*;
use crate::db::DbHandle;
use rusqlite::{params, OptionalExtension};
use std::sync::Arc;
use uuid::Uuid;

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn bb_id(prefix: &str) -> String {
    format!("{}_{}", prefix, Uuid::new_v4().to_string().replace('-', "").split_at(16).0)
}

pub struct BbDb {
    db: Arc<DbHandle>,
}

impl BbDb {
    pub fn new(db: Arc<DbHandle>) -> Self {
        Self { db }
    }

    // Projects

    pub fn list_projects(&self, user_id: &str) -> Result<Vec<BbProject>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, kind, name, git_remote_url, sort_key, deleted_at, created_at, updated_at
             FROM bb_projects
             WHERE user_id = ?1 AND deleted_at IS NULL
             ORDER BY sort_key, id"
        )?;
        let rows = stmt.query_map(params![user_id], |row| {
            Ok(BbProject {
                id: row.get(0)?,
                user_id: row.get(1)?,
                kind: row.get(2)?,
                name: row.get(3)?,
                git_remote_url: row.get(4)?,
                sort_key: row.get(5)?,
                deleted_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_project(&self, user_id: &str, id: &str) -> Result<Option<BbProject>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, kind, name, git_remote_url, sort_key, deleted_at, created_at, updated_at
             FROM bb_projects
             WHERE id = ?1 AND user_id = ?2"
        )?;
        stmt.query_row(params![id, user_id], |row| {
            Ok(BbProject {
                id: row.get(0)?,
                user_id: row.get(1)?,
                kind: row.get(2)?,
                name: row.get(3)?,
                git_remote_url: row.get(4)?,
                sort_key: row.get(5)?,
                deleted_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        }).optional()
    }

    pub fn create_project(
        &self,
        user_id: &str,
        name: &str,
        kind: &str,
        git_remote_url: Option<&str>,
    ) -> Result<BbProject, rusqlite::Error> {
        let conn = self.db.connect()?;
        let id = bb_id("bbproj");
        let now = now_ms();
        conn.execute(
            "INSERT INTO bb_projects (id, user_id, kind, name, git_remote_url, sort_key, deleted_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 'V', NULL, ?6, ?6)",
            params![&id, user_id, kind, name, git_remote_url, now],
        )?;
        self.get_project(user_id, &id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn update_project(
        &self,
        user_id: &str,
        id: &str,
        name: Option<&str>,
        sort_key: Option<&str>,
    ) -> Result<Option<BbProject>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let now = now_ms();
        let mut sets = vec!["updated_at = ?1".to_string()];
        if name.is_some() {
            sets.push("name = ?2".to_string());
        }
        if sort_key.is_some() {
            sets.push("sort_key = ?3".to_string());
        }
        let sql = format!("UPDATE bb_projects SET {} WHERE id = ?4 AND user_id = ?5", sets.join(", "));
        conn.execute(&sql, params![now, name, sort_key, id, user_id])?;
        self.get_project(user_id, id)
    }

    pub fn delete_project(&self, user_id: &str, id: &str) -> Result<bool, rusqlite::Error> {
        let conn = self.db.connect()?;
        let now = now_ms();
        let rows = conn.execute(
            "UPDATE bb_projects SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND user_id = ?3",
            params![now, id, user_id],
        )?;
        Ok(rows > 0)
    }

    pub fn add_project_source(
        &self,
        user_id: &str,
        project_id: &str,
        source: &super::contracts::CreateProjectSourceRequest,
    ) -> Result<BbProjectSource, rusqlite::Error> {
        let conn = self.db.connect()?;
        let id = bb_id("bbsrc");
        let now = now_ms();
        // Verify project ownership
        let _: String = conn.query_row(
            "SELECT id FROM bb_projects WHERE id = ?1 AND user_id = ?2",
            params![project_id, user_id],
            |row| row.get(0),
        )?;
        conn.execute(
            "INSERT INTO bb_project_sources (id, project_id, source_type, host_id, path, is_default, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?6)",
            params![&id, project_id, &source.source_type, &source.host_id, &source.path, now],
        )?;
        self.get_project_source(&id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_project_source(&self, id: &str) -> Result<Option<BbProjectSource>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, source_type, host_id, path, is_default, created_at, updated_at
             FROM bb_project_sources
             WHERE id = ?1"
        )?;
        stmt.query_row(params![id], |row| {
            Ok(BbProjectSource {
                id: row.get(0)?,
                project_id: row.get(1)?,
                source_type: row.get(2)?,
                host_id: row.get(3)?,
                path: row.get(4)?,
                is_default: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        }).optional()
    }

    // Threads

    pub fn list_threads(&self, project_id: &str) -> Result<Vec<BbThread>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, environment_id, provider_id, model_override, reasoning_level_override,
                    title, title_fallback, section_id, status, parent_thread_id, source_thread_id,
                    origin_kind, origin_plugin_id, visibility, archived_at, pinned_at, pin_sort_key,
                    deleted_at, last_read_at, latest_attention_at, created_at, updated_at
             FROM bb_threads
             WHERE project_id = ?1 AND deleted_at IS NULL
             ORDER BY pinned_at IS NULL, pin_sort_key, updated_at DESC"
        )?;
        let rows = stmt.query_map(params![project_id], |row| {
            Ok(BbThread {
                id: row.get(0)?,
                project_id: row.get(1)?,
                environment_id: row.get(2)?,
                provider_id: row.get(3)?,
                model_override: row.get(4)?,
                reasoning_level_override: row.get(5)?,
                title: row.get(6)?,
                title_fallback: row.get(7)?,
                section_id: row.get(8)?,
                status: row.get(9)?,
                parent_thread_id: row.get(10)?,
                source_thread_id: row.get(11)?,
                origin_kind: row.get(12)?,
                origin_plugin_id: row.get(13)?,
                visibility: row.get(14)?,
                archived_at: row.get(15)?,
                pinned_at: row.get(16)?,
                pin_sort_key: row.get(17)?,
                deleted_at: row.get(18)?,
                last_read_at: row.get(19)?,
                latest_attention_at: row.get(20)?,
                created_at: row.get(21)?,
                updated_at: row.get(22)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_thread(&self, id: &str) -> Result<Option<BbThread>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, environment_id, provider_id, model_override, reasoning_level_override,
                    title, title_fallback, section_id, status, parent_thread_id, source_thread_id,
                    origin_kind, origin_plugin_id, visibility, archived_at, pinned_at, pin_sort_key,
                    deleted_at, last_read_at, latest_attention_at, created_at, updated_at
             FROM bb_threads
             WHERE id = ?1"
        )?;
        stmt.query_row(params![id], |row| {
            Ok(BbThread {
                id: row.get(0)?,
                project_id: row.get(1)?,
                environment_id: row.get(2)?,
                provider_id: row.get(3)?,
                model_override: row.get(4)?,
                reasoning_level_override: row.get(5)?,
                title: row.get(6)?,
                title_fallback: row.get(7)?,
                section_id: row.get(8)?,
                status: row.get(9)?,
                parent_thread_id: row.get(10)?,
                source_thread_id: row.get(11)?,
                origin_kind: row.get(12)?,
                origin_plugin_id: row.get(13)?,
                visibility: row.get(14)?,
                archived_at: row.get(15)?,
                pinned_at: row.get(16)?,
                pin_sort_key: row.get(17)?,
                deleted_at: row.get(18)?,
                last_read_at: row.get(19)?,
                latest_attention_at: row.get(20)?,
                created_at: row.get(21)?,
                updated_at: row.get(22)?,
            })
        }).optional()
    }

    pub fn create_thread(
        &self,
        project_id: &str,
        environment_id: Option<&str>,
        provider_id: &str,
        title: Option<&str>,
    ) -> Result<BbThread, rusqlite::Error> {
        let conn = self.db.connect()?;
        let id = bb_id("bbthread");
        let now = now_ms();
        conn.execute(
            "INSERT INTO bb_threads (
                id, project_id, environment_id, provider_id, title, status, visibility,
                latest_attention_at, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'idle', 'visible', ?6, ?6, ?6)",
            params![&id, project_id, environment_id, provider_id, title, now],
        )?;
        self.get_thread(&id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn update_thread(
        &self,
        id: &str,
        req: &super::contracts::UpdateThreadRequest,
    ) -> Result<Option<BbThread>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let now = now_ms();
        let mut sets = vec!["updated_at = ?1".to_string()];
        let mut idx = 2;
        if req.title.is_some() {
            sets.push(format!("title = ?{}", idx));
            idx += 1;
        }
        if req.status.is_some() {
            sets.push(format!("status = ?{}", idx));
            idx += 1;
        }
        if req.archived_at.is_some() {
            sets.push(format!("archived_at = ?{}", idx));
            idx += 1;
        }
        if req.pinned_at.is_some() {
            sets.push(format!("pinned_at = ?{}", idx));
            idx += 1;
        }
        if req.deleted_at.is_some() {
            sets.push(format!("deleted_at = ?{}", idx));
            idx += 1;
        }
        let sql = format!("UPDATE bb_threads SET {} WHERE id = ?{}", sets.join(", "), idx);
        conn.execute(&sql, params![now, req.title.as_deref(), req.status.as_deref(), req.archived_at, req.pinned_at, req.deleted_at, id])?;
        self.get_thread(id)
    }

    pub fn next_event_sequence(&self, thread_id: &str) -> Result<i64, rusqlite::Error> {
        let conn = self.db.connect()?;
        let seq: i64 = conn.query_row(
            "SELECT COALESCE(MAX(sequence), 0) + 1 FROM bb_events WHERE thread_id = ?1",
            params![thread_id],
            |row| row.get(0),
        )?;
        Ok(seq)
    }

    pub fn append_event(
        &self,
        thread_id: &str,
        environment_id: Option<&str>,
        scope_kind: &str,
        event_type: &str,
        data: serde_json::Value,
    ) -> Result<BbEvent, rusqlite::Error> {
        let conn = self.db.connect()?;
        let id = bb_id("bbevent");
        let seq = self.next_event_sequence(thread_id)?;
        let now = now_ms();
        conn.execute(
            "INSERT INTO bb_events (id, thread_id, environment_id, scope_kind, sequence, event_type, data, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![&id, thread_id, environment_id, scope_kind, seq, event_type, data.to_string(), now],
        )?;
        self.get_event(&id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn get_event(&self, id: &str) -> Result<Option<BbEvent>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, thread_id, environment_id, scope_kind, turn_id, provider_thread_id, sequence,
                    event_type, item_id, item_kind, parent_tool_call_id, data, created_at
             FROM bb_events
             WHERE id = ?1"
        )?;
        stmt.query_row(params![id], |row| {
            let data_str: String = row.get(11)?;
            Ok(BbEvent {
                id: row.get(0)?,
                thread_id: row.get(1)?,
                environment_id: row.get(2)?,
                scope_kind: row.get(3)?,
                turn_id: row.get(4)?,
                provider_thread_id: row.get(5)?,
                sequence: row.get(6)?,
                event_type: row.get(7)?,
                item_id: row.get(8)?,
                item_kind: row.get(9)?,
                parent_tool_call_id: row.get(10)?,
                data: serde_json::from_str(&data_str).unwrap_or(serde_json::Value::Null),
                created_at: row.get(12)?,
            })
        }).optional()
    }

    pub fn list_events(&self, thread_id: &str, after_sequence: Option<i64>) -> Result<Vec<BbEvent>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let sql = if after_sequence.is_some() {
            "SELECT id, thread_id, environment_id, scope_kind, turn_id, provider_thread_id, sequence,
                    event_type, item_id, item_kind, parent_tool_call_id, data, created_at
             FROM bb_events
             WHERE thread_id = ?1 AND sequence > ?2
             ORDER BY sequence"
        } else {
            "SELECT id, thread_id, environment_id, scope_kind, turn_id, provider_thread_id, sequence,
                    event_type, item_id, item_kind, parent_tool_call_id, data, created_at
             FROM bb_events
             WHERE thread_id = ?1
             ORDER BY sequence"
        };
        let mut stmt = conn.prepare(sql)?;
        let rows = if let Some(after) = after_sequence {
            stmt.query_map(params![thread_id, after], event_row_mapper)?
        } else {
            stmt.query_map(params![thread_id], event_row_mapper)?
        };
        rows.collect()
    }

    // Hosts

    pub fn list_hosts(&self, user_id: &str) -> Result<Vec<BbHost>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, host_type, connect_machine_id, max_permission_mode,
                    destroyed_at, last_seen_at, last_rejected_protocol_version, created_at, updated_at
             FROM bb_hosts
             WHERE user_id = ?1
             ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map(params![user_id], host_row_mapper)?;
        rows.collect()
    }

    pub fn get_host(&self, user_id: &str, id: &str) -> Result<Option<BbHost>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, user_id, name, host_type, connect_machine_id, max_permission_mode,
                    destroyed_at, last_seen_at, last_rejected_protocol_version, created_at, updated_at
             FROM bb_hosts
             WHERE id = ?1 AND user_id = ?2"
        )?;
        stmt.query_row(params![id, user_id], host_row_mapper).optional()
    }

    pub fn create_host(
        &self,
        user_id: &str,
        name: &str,
        host_type: &str,
        max_permission_mode: &str,
    ) -> Result<BbHost, rusqlite::Error> {
        let conn = self.db.connect()?;
        let id = bb_id("bbhost");
        let now = now_ms();
        conn.execute(
            "INSERT INTO bb_hosts (id, user_id, name, host_type, max_permission_mode, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
            params![&id, user_id, name, host_type, max_permission_mode, now],
        )?;
        self.get_host(user_id, &id)?.ok_or(rusqlite::Error::QueryReturnedNoRows)
    }

    pub fn update_host(
        &self,
        user_id: &str,
        id: &str,
        name: Option<&str>,
        max_permission_mode: Option<&str>,
    ) -> Result<Option<BbHost>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let now = now_ms();
        let mut sets = vec!["updated_at = ?1".to_string()];
        if name.is_some() {
            sets.push("name = ?2".to_string());
        }
        if max_permission_mode.is_some() {
            sets.push("max_permission_mode = ?3".to_string());
        }
        let sql = format!("UPDATE bb_hosts SET {} WHERE id = ?4 AND user_id = ?5", sets.join(", "));
        conn.execute(&sql, params![now, name, max_permission_mode, id, user_id])?;
        self.get_host(user_id, id)
    }

    fn host_row_mapper(row: &rusqlite::Row<'_>) -> Result<BbHost, rusqlite::Error> {
        Ok(BbHost {
            id: row.get(0)?,
            user_id: row.get(1)?,
            name: row.get(2)?,
            host_type: row.get(3)?,
            connect_machine_id: row.get(4)?,
            max_permission_mode: row.get(5)?,
            destroyed_at: row.get(6)?,
            last_seen_at: row.get(7)?,
            last_rejected_protocol_version: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    }

    // Environments

    pub fn get_environment(&self, id: &str) -> Result<Option<BbEnvironment>, rusqlite::Error> {
        let conn = self.db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, project_id, host_id, name, path, managed, is_git_repo, is_worktree,
                    branch_name, base_branch, default_branch, merge_base_branch,
                    destroy_attempt_id, retire_requested_at, workspace_provision_type, status,
                    created_at, updated_at
             FROM bb_environments
             WHERE id = ?1"
        )?;
        stmt.query_row(params![id], |row| {
            Ok(BbEnvironment {
                id: row.get(0)?,
                project_id: row.get(1)?,
                host_id: row.get(2)?,
                name: row.get(3)?,
                path: row.get(4)?,
                managed: row.get::<_, i32>(5)? != 0,
                is_git_repo: row.get::<_, i32>(6)? != 0,
                is_worktree: row.get::<_, i32>(7)? != 0,
                branch_name: row.get(8)?,
                base_branch: row.get(9)?,
                default_branch: row.get(10)?,
                merge_base_branch: row.get(11)?,
                destroy_attempt_id: row.get(12)?,
                retire_requested_at: row.get(13)?,
                workspace_provision_type: row.get(14)?,
                status: row.get(15)?,
                created_at: row.get(16)?,
                updated_at: row.get(17)?,
            })
        }).optional()
    }
}

fn event_row_mapper(row: &rusqlite::Row<'_>) -> Result<BbEvent, rusqlite::Error> {
    let data_str: String = row.get(11)?;
    Ok(BbEvent {
        id: row.get(0)?,
        thread_id: row.get(1)?,
        environment_id: row.get(2)?,
        scope_kind: row.get(3)?,
        turn_id: row.get(4)?,
        provider_thread_id: row.get(5)?,
        sequence: row.get(6)?,
        event_type: row.get(7)?,
        item_id: row.get(8)?,
        item_kind: row.get(9)?,
        parent_tool_call_id: row.get(10)?,
        data: serde_json::from_str(&data_str).unwrap_or(serde_json::Value::Null),
        created_at: row.get(12)?,
    })
}

fn host_row_mapper(row: &rusqlite::Row<'_>) -> Result<BbHost, rusqlite::Error> {
    Ok(BbHost {
        id: row.get(0)?,
        user_id: row.get(1)?,
        name: row.get(2)?,
        host_type: row.get(3)?,
        connect_machine_id: row.get(4)?,
        max_permission_mode: row.get(5)?,
        destroyed_at: row.get(6)?,
        last_seen_at: row.get(7)?,
        last_rejected_protocol_version: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}
