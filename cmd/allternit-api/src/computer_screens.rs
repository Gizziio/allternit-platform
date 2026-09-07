//! One computer per user, many bot screens (Grok Bot parity).
//!
//! The Incus/Tart guest is owned by the user account. Each bot is assigned a
//! display index (screen). Display 0 is the primary x11vnc already exposed at
//! spawn. Extra displays start Xvfb + x11vnc in the guest and proxy a new port.

use std::sync::Arc;
use tracing::{info, warn};
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::AppState;
use allternit_driver_interface::{CommandSpec, ExecutionHandle};

const START_WINDOW_SCRIPT: &str = r#"
set -euo pipefail
N="${1:-1}"
if [ "$N" -le 0 ]; then
  echo "display 0 is the primary screen"
  exit 0
fi
export DISPLAY=":$N"
if pgrep -f "x11vnc.*rfbport $((5900+N))" >/dev/null 2>&1; then
  echo "screen $N already running"
  exit 0
fi
mkdir -p /workspace /tmp/allternit-screens
Xvfb ":$N" -screen 0 1920x1080x24 -nolisten tcp >/tmp/allternit-screens/xvfb-$N.log 2>&1 &
sleep 0.4
if command -v fluxbox >/dev/null 2>&1; then
  fluxbox >/tmp/allternit-screens/wm-$N.log 2>&1 &
elif command -v openbox >/dev/null 2>&1; then
  openbox >/tmp/allternit-screens/wm-$N.log 2>&1 &
fi
x11vnc -display ":$N" -rfbport $((5900+N)) -localhost -forever -shared -nopw \
  >/tmp/allternit-screens/vnc-$N.log 2>&1 &
sleep 0.3
echo "started screen $N on 5900+$N"
"#;

#[derive(Debug, Clone)]
pub struct UserComputer {
    pub id: String,
    pub native_id: String,
    pub provider: String,
    pub host: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone)]
pub struct ComputerScreen {
    pub id: String,
    pub computer_id: String,
    pub bot_id: String,
    pub display_index: i64,
    pub vnc_port: Option<i64>,
    pub status: String,
}

pub fn find_user_computer(
    db: &crate::db::DbHandle,
    user_id: &str,
) -> Result<Option<UserComputer>, rusqlite::Error> {
    let conn = db.connect()?;
    let mut stmt = conn.prepare(
        "SELECT id, COALESCE(native_id, id), provider, host, status
         FROM computers
         WHERE owner_type = 'user' AND owner_id = ?1 AND kind = 'cloud_desktop'
           AND status IN ('running', 'creating')
         ORDER BY updated_at DESC
         LIMIT 1",
    )?;
    let result = stmt.query_row(rusqlite::params![user_id], |row| {
        Ok(UserComputer {
            id: row.get(0)?,
            native_id: row.get(1)?,
            provider: row.get(2)?,
            host: row.get(3)?,
            status: row.get(4)?,
        })
    });
    match result {
        Ok(r) => Ok(Some(r)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn upsert_user_computer(
    db: &crate::db::DbHandle,
    user_id: &str,
    sandbox_id: &str,
    provider: &str,
    host: Option<&str>,
    status: &str,
    os: Option<&str>,
) -> Result<String, rusqlite::Error> {
    if let Some(existing) = find_user_computer(db, user_id)? {
        let conn = db.connect()?;
        conn.execute(
            "UPDATE computers SET status = ?2, host = COALESCE(?3, host), native_id = ?4, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?1",
            rusqlite::params![existing.id, status, host, sandbox_id],
        )?;
        return Ok(existing.id);
    }

    let id = sandbox_id.to_string();
    let conn = db.connect()?;
    conn.execute(
        "INSERT INTO computers (id, kind, provider, status, owner_type, owner_id, name, os, host, native_id, billing_source)
         VALUES (?1, 'cloud_desktop', ?2, ?3, 'user', ?4, 'Account computer', ?5, ?6, ?7, 'credits')",
        rusqlite::params![id, provider, status, user_id, os, host, sandbox_id],
    )?;
    conn.execute(
        "INSERT INTO computer_cloud_desktop (computer_id, sandbox_id, control_state)
         VALUES (?1, ?2, 'bot_controls')
         ON CONFLICT(computer_id) DO UPDATE SET sandbox_id = excluded.sandbox_id",
        rusqlite::params![id, sandbox_id],
    )?;
    Ok(id)
}

pub fn assign_screen(
    db: &crate::db::DbHandle,
    computer_id: &str,
    bot_id: &str,
) -> Result<ComputerScreen, rusqlite::Error> {
    let conn = db.connect()?;
    if let Ok(existing) = conn.query_row(
        "SELECT id, computer_id, bot_id, display_index, vnc_port, status
         FROM computer_screens WHERE computer_id = ?1 AND bot_id = ?2",
        rusqlite::params![computer_id, bot_id],
        |row| {
            Ok(ComputerScreen {
                id: row.get(0)?,
                computer_id: row.get(1)?,
                bot_id: row.get(2)?,
                display_index: row.get(3)?,
                vnc_port: row.get(4)?,
                status: row.get(5)?,
            })
        },
    ) {
        return Ok(existing);
    }

    let next: i64 = conn.query_row(
        "SELECT COALESCE(MAX(display_index) + 1, 0) FROM computer_screens WHERE computer_id = ?1",
        rusqlite::params![computer_id],
        |row| row.get(0),
    )?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO computer_screens (id, computer_id, bot_id, display_index, status)
         VALUES (?1, ?2, ?3, ?4, 'running')",
        rusqlite::params![id, computer_id, bot_id, next],
    )?;
    Ok(ComputerScreen {
        id,
        computer_id: computer_id.to_string(),
        bot_id: bot_id.to_string(),
        display_index: next,
        vnc_port: None,
        status: "running".to_string(),
    })
}

pub fn screen_count(db: &crate::db::DbHandle, computer_id: &str) -> Result<i64, rusqlite::Error> {
    let conn = db.connect()?;
    conn.query_row(
        "SELECT COUNT(*) FROM computer_screens WHERE computer_id = ?1",
        rusqlite::params![computer_id],
        |row| row.get(0),
    )
}

pub fn delete_screen(
    db: &crate::db::DbHandle,
    computer_id: &str,
    bot_id: &str,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "DELETE FROM computer_screens WHERE computer_id = ?1 AND bot_id = ?2",
        rusqlite::params![computer_id, bot_id],
    )?;
    Ok(())
}

pub fn set_screen_vnc_port(
    db: &crate::db::DbHandle,
    screen_id: &str,
    port: i64,
) -> Result<(), rusqlite::Error> {
    let conn = db.connect()?;
    conn.execute(
        "UPDATE computer_screens SET vnc_port = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        rusqlite::params![screen_id, port],
    )?;
    Ok(())
}

/// Start an extra X display + x11vnc in the guest (Grok start-window).
pub async fn start_extra_display(
    state: &Arc<AppState>,
    native_id: &str,
    display_index: i64,
) -> Option<u16> {
    if display_index <= 0 {
        return None;
    }
    let driver = state.vm_driver.as_ref()?;
    let handle = handle_for_native(native_id);
    let cmd = CommandSpec {
        command: vec![
            "bash".to_string(),
            "-lc".to_string(),
            format!(
                "cat > /tmp/allternit-start-window.sh <<'EOS'\n{}\nEOS\nchmod +x /tmp/allternit-start-window.sh\n/tmp/allternit-start-window.sh {}",
                START_WINDOW_SCRIPT, display_index
            ),
        ],
        env_vars: Default::default(),
        working_dir: Some("/workspace".to_string()),
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };
    match driver.exec(&handle, cmd).await {
        Ok(result) if result.exit_code == 0 => {
            info!(native_id, display_index, "started extra bot screen");
        }
        Ok(result) => {
            warn!(
                native_id,
                display_index,
                exit = result.exit_code,
                "start-window exited non-zero; bot will share the primary screen"
            );
            return None;
        }
        Err(e) => {
            warn!(native_id, display_index, error = %e, "start-window exec failed");
            return None;
        }
    }

    let guest_port = 5900u16.saturating_add(display_index as u16);
    if let Some(incus) = &state.incus_driver {
        match incus
            .expose_port(
                native_id,
                &format!("vnc{}", display_index),
                guest_port,
            )
            .await
        {
            Ok(host_port) => {
                info!(native_id, display_index, host_port, "proxied extra screen VNC");
                return Some(host_port);
            }
            Err(e) => {
                warn!(native_id, display_index, error = %e, "failed to proxy extra screen VNC");
            }
        }
    }
    None
}

fn handle_for_native(native_id: &str) -> ExecutionHandle {
    let mut driver_info = std::collections::HashMap::new();
    driver_info.insert("native_id".to_string(), native_id.to_string());
    ExecutionHandle {
        id: allternit_driver_interface::ExecutionId::new(),
        tenant: allternit_driver_interface::TenantId::new("user-shared".to_string())
            .unwrap_or_else(|_| {
                allternit_driver_interface::TenantId::new("bot-unknown".to_string()).unwrap()
            }),
        driver_info,
        env_spec: allternit_driver_interface::EnvironmentSpec {
            spec_type: allternit_driver_interface::EnvSpecType::Oci,
            image: "ubuntu-24.04-desktop".to_string(),
            version: None,
            packages: vec![],
            env_vars: Default::default(),
            working_dir: Some("/workspace".to_string()),
            mounts: vec![],
        },
    }
}

pub async fn attach_bot_to_user_computer(
    state: &Arc<AppState>,
    user: &AuthUser,
    bot_id: &str,
) -> Result<Option<(UserComputer, ComputerScreen)>, rusqlite::Error> {
    let Some(computer) = find_user_computer(&state.db, &user.user_id)? else {
        return Ok(None);
    };
    let screen = assign_screen(&state.db, &computer.id, bot_id)?;
    if screen.display_index > 0 && screen.vnc_port.is_none() {
        if let Some(port) = start_extra_display(state, &computer.native_id, screen.display_index).await
        {
            let _ = set_screen_vnc_port(&state.db, &screen.id, port as i64);
        }
    }
    Ok(Some((computer, screen)))
}
