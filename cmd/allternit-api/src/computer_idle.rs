//! Idle auto-stop uses the same lifecycle pause/usage cleanup as the computer route.
use crate::{
    computer_routes::{computer_from_row, stop_computer_inner, ComputerResponse},
    AppState,
};
use rusqlite::Connection;
use std::{sync::Arc, time::Duration};

/// Return expired rows and their takeover state. Kept connection-only for deterministic SQL tests.
pub(crate) fn idle_candidates(
    conn: &Connection,
) -> rusqlite::Result<Vec<(ComputerResponse, bool)>> {
    let mut stmt=conn.prepare("SELECT c.id, c.kind, c.provider, c.status, c.owner_type, c.owner_id,
        c.bot_id, c.session_id, c.name, c.os, c.cpu_cores, c.memory_mb, c.disk_mb,
        c.region, c.host, c.native_id, c.template_id, c.billing_source, c.created_at, c.updated_at,
        c.idle_timeout_secs, c.last_activity_at, c.group_id, COALESCE(d.control_state='human_controls', 0)
        FROM computers c LEFT JOIN computer_cloud_desktop d ON d.computer_id=c.id
        WHERE c.status='running' AND c.idle_timeout_secs IS NOT NULL AND c.last_activity_at IS NOT NULL
        AND c.last_activity_at < datetime('now', '-' || c.idle_timeout_secs || ' seconds')")?;
    let rows = stmt.query_map([], |r| Ok((computer_from_row(r)?, r.get(23)?)))?;
    rows.collect()
}

async fn sweep(state: &Arc<AppState>) {
    let db = state.db.clone();
    let candidates =
        match tokio::task::spawn_blocking(move || idle_candidates(&db.connect()?)).await {
            Ok(Ok(rows)) => rows,
            error => {
                tracing::warn!(?error, "failed to select idle computers");
                return;
            }
        };
    for (computer, human_controls) in candidates {
        if human_controls {
            tracing::info!(computer_id=%computer.id,"skipping idle computer under human control");
            continue;
        }
        // Recheck immediately before acting: earlier stops may have taken time, and activity/takeover may have changed.
        let db = state.db.clone();
        let id = computer.id.clone();
        let still_idle=tokio::task::spawn_blocking(move || {
            let conn=db.connect()?;
            conn.query_row("SELECT EXISTS(SELECT 1 FROM computers c LEFT JOIN computer_cloud_desktop d ON d.computer_id=c.id
                WHERE c.id=?1 AND c.status='running' AND c.idle_timeout_secs IS NOT NULL
                AND c.last_activity_at < datetime('now','-' || c.idle_timeout_secs || ' seconds')
                AND COALESCE(d.control_state,'')!='human_controls')",[id],|r|r.get::<_,bool>(0))
        }).await;
        if !matches!(still_idle, Ok(Ok(true))) {
            continue;
        }
        let response = stop_computer_inner(state, &computer).await;
        if !response.status().is_success() {
            tracing::warn!(computer_id=%computer.id,status=%response.status(),"failed to auto-stop idle computer");
        }
    }
}

pub fn spawn_idle_sweeper(
    state: Arc<AppState>,
    mut shutdown: tokio::sync::broadcast::Receiver<()>,
) {
    let period = std::env::var("COMPUTER_IDLE_SWEEP_SECS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(60);
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(period));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            tokio::select! {
                _=shutdown.recv()=>break,
                _=interval.tick()=> {
                    tokio::select! { _=shutdown.recv()=>break, _=sweep(&state)=>{} }
                }
            }
        }
    });
}

#[cfg(test)]
mod computer_idle_tests {
    use super::*;
    #[test]
    fn computer_idle_selection_excludes_disabled_recent_and_non_running_and_flags_human() {
        let conn = crate::computer_routes::phase_two_test_db();
        for (id, status, timeout, age, control) in [
            (
                "expired",
                "running",
                Some(60),
                Some("-120 seconds"),
                "bot_controls",
            ),
            (
                "human",
                "running",
                Some(60),
                Some("-120 seconds"),
                "human_controls",
            ),
            (
                "recent",
                "running",
                Some(60),
                Some("-1 seconds"),
                "human_observing",
            ),
            (
                "disabled",
                "running",
                None,
                Some("-120 seconds"),
                "bot_controls",
            ),
            ("untouched", "running", Some(60), None, "bot_controls"),
            (
                "stopped",
                "stopped",
                Some(60),
                Some("-120 seconds"),
                "bot_controls",
            ),
            (
                "creating",
                "creating",
                Some(60),
                Some("-120 seconds"),
                "bot_controls",
            ),
            (
                "error",
                "error",
                Some(60),
                Some("-120 seconds"),
                "bot_controls",
            ),
            (
                "deleted",
                "deleted",
                Some(60),
                Some("-120 seconds"),
                "bot_controls",
            ),
        ] {
            conn.execute("INSERT INTO computers (id,kind,provider,status,owner_type,owner_id,name,idle_timeout_secs,last_activity_at) VALUES (?1,'cloud_desktop','incus',?2,'user','u',?1,?3,datetime('now',?4))",rusqlite::params![id,status,timeout,age]).unwrap();
            conn.execute("INSERT INTO computer_cloud_desktop (computer_id,sandbox_id,control_state) VALUES (?1,?1,?2)",rusqlite::params![id,control]).unwrap();
        }
        let candidates = idle_candidates(&conn).unwrap();
        assert_eq!(candidates.len(), 2);
        let stopped: Vec<_> = candidates
            .iter()
            .filter(|(_, human)| !human)
            .map(|(c, _)| c.id.as_str())
            .collect();
        assert_eq!(stopped, vec!["expired"]);
        assert!(candidates.iter().any(|(c, h)| c.id == "human" && *h));
    }
}
