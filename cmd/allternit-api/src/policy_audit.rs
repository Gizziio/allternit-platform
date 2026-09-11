//! Audit-before-act store for declarative policy decisions.
//!
//! One JSONL row per policy decision made by the ACI policy seats
//! (`aci_run`, `execute_computer_tool`), written to
//! `<computer_use_dir>/policy_audit/policy_audit.jsonl`. The ordering
//! guarantee is the point of the store: the seat writes and fsyncs its row
//! BEFORE dispatching the action, so a row always exists for an action the
//! policy saw — including actions whose executor later fails, and refusals
//! that never reach an executor at all.
//!
//! Writes are synchronous append + flush + sync_all. Volume is low (one row
//! per policy-gated action) and correctness matters more than throughput.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;

/// Directory and file for the policy audit log.
pub fn policy_audit_dir() -> PathBuf {
    crate::aci_approvals::computer_use_dir().join("policy_audit")
}

pub fn policy_audit_path() -> PathBuf {
    policy_audit_dir().join("policy_audit.jsonl")
}

/// The policy decision recorded for one action.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PolicyDecision {
    Allowed,
    Denied,
}

/// One append-only audit row. `ts` is RFC 3339 UTC; optional fields are
/// omitted (not nulled) when the seat has no value for them.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyAuditRow {
    pub ts: String,
    pub decision: PolicyDecision,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rule_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bot_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actor: Option<String>,
    pub tool: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp_tool: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub run_id: Option<String>,
}

impl PolicyAuditRow {
    /// Build a row with the current timestamp.
    pub fn new(decision: PolicyDecision, tool: impl Into<String>) -> Self {
        Self {
            ts: chrono::Utc::now().to_rfc3339(),
            decision,
            rule_id: None,
            bot_id: None,
            session_id: None,
            actor: None,
            tool: tool.into(),
            intent: None,
            host: None,
            path: None,
            mcp_tool: None,
            run_id: None,
        }
    }
}

/// Append one row and fsync before returning. Callers in the policy seats
/// must treat an error here as a refusal to dispatch: if the row cannot be
/// made durable first, the ordering guarantee is gone.
pub fn record(row: &PolicyAuditRow) -> std::io::Result<()> {
    let path = policy_audit_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)?;
    let line = serde_json::to_string(row).expect("audit row serialization is infallible");
    writeln!(file, "{line}")?;
    file.flush()?;
    file.sync_all()?;
    Ok(())
}

/// Read audit rows newest-first, filtered by `bot_id` when given, capped at
/// `limit`. A missing or unreadable log yields an empty list (read side only;
/// the write path never fails open).
pub fn read_rows(bot_id: Option<&str>, limit: usize) -> Vec<serde_json::Value> {
    let Ok(text) = std::fs::read_to_string(policy_audit_path()) else {
        return Vec::new();
    };
    let mut rows: Vec<serde_json::Value> = text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str(line).ok())
        .filter(|row: &serde_json::Value| {
            bot_id
                .map(|wanted| row.get("bot_id").and_then(|v| v.as_str()) == Some(wanted))
                .unwrap_or(true)
        })
        .collect();
    rows.reverse();
    rows.truncate(limit);
    rows
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir_guard() -> (tempfile::TempDir, ()) {
        // Tests in this module are pure filesystem (no env mutation): they
        // write through `policy_audit_path`, so point the computer-use dir at
        // a tempdir via the same env idiom other aci tests use. Serialized by
        // the lock below because the path is process-global.
        let temp = tempfile::tempdir().unwrap();
        std::env::set_var("ALLTERNIT_COMPUTER_USE_DIR", temp.path());
        (temp, ())
    }

    fn fs_lock() -> std::sync::MutexGuard<'static, ()> {
        crate::policy_config::POLICY_TEST_LOCK
            .lock()
            .unwrap_or_else(|e| e.into_inner())
    }

    #[test]
    fn record_then_read_newest_first_with_bot_filter() {
        let _guard = fs_lock();
        let (_temp, ()) = temp_dir_guard();
        for i in 0..3 {
            let mut row = PolicyAuditRow::new(PolicyDecision::Allowed, "aci.run");
            row.bot_id = Some(format!("bot-{}", i % 2));
            row.actor = Some("user-1".to_string());
            record(&row).expect("record");
        }

        let all = read_rows(None, 100);
        assert_eq!(all.len(), 3);
        // Newest first: the last-written row (bot-0, i=2) leads.
        assert_eq!(all[0]["bot_id"], "bot-0");

        let filtered = read_rows(Some("bot-1"), 100);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0]["decision"], "allowed");
        assert_eq!(filtered[0]["tool"], "aci.run");

        let limited = read_rows(None, 2);
        assert_eq!(limited.len(), 2);

        let missing = read_rows(Some("nobody"), 100);
        assert!(missing.is_empty());
    }

    #[test]
    fn missing_log_reads_empty() {
        let _guard = fs_lock();
        let temp = tempfile::tempdir().unwrap();
        std::env::set_var("ALLTERNIT_COMPUTER_USE_DIR", temp.path());
        assert!(read_rows(None, 100).is_empty());
    }

    #[test]
    fn row_omits_absent_optional_fields() {
        let row = PolicyAuditRow::new(PolicyDecision::Denied, "computer.shell");
        let value = serde_json::to_value(&row).unwrap();
        assert!(value.get("bot_id").is_none());
        assert!(value.get("rule_id").is_none());
        assert_eq!(value["decision"], "denied");
        assert_eq!(value["tool"], "computer.shell");
        assert!(value.get("ts").is_some());
    }
}
