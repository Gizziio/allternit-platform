//! Golden-template build pipeline (Phase 4, "templates as code").
//!
//! A build turns a validated `ComputerTemplate` spec doc into a golden
//! snapshot: spawn a golden-holder VM as `role='golden'`, install packages,
//! write long-running services as systemd units, run `postCreate` hooks with
//! vault-resolved secrets injected as env (values never persisted anywhere),
//! then snapshot the holder statefully as `golden` and stop it. Provisioning
//! from a ready template clones that snapshot (see `bot_desktop_templates` and
//! `computer_routes`).
//!
//! Runs async: the POST handler flips `build_status` to `building` and returns
//! 202; progress is readable from `build_status` / `build_error` on the
//! template row. Every start/ready/failed transition and every secret-ref
//! resolution (ref NAME only, never the value) is audited via the Phase 3
//! `computer_access_logs` trail.

use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn};

use crate::auth::AuthUser;
use crate::bot_desktop_templates::{
    ComputerTemplateSpec, DesktopTemplate, ProvisionRequest, BUILD_STATUS_FAILED, BUILD_STATUS_READY,
};
use crate::AppState;
use allternit_driver_interface::CommandSpec;

pub const KIND_BUILD_START: &str = "template_build_start";
pub const KIND_BUILD_SERVICE: &str = "template_build_service";
pub const KIND_BUILD_READY: &str = "template_build_ready";
pub const KIND_BUILD_FAILED: &str = "template_build_failed";
pub const KIND_SECRET_RESOLVE: &str = "template_secret_resolve";

pub const GOLDEN_SNAPSHOT_NAME: &str = "golden";

/// Kick off the async build for a template whose row is already marked
/// `building`. Takes ownership of the state/user/template so the tokio task
/// outlives the handler.
pub fn start_build(state: Arc<AppState>, user: AuthUser, template: DesktopTemplate) {
    let template_id = template.id.clone();
    tokio::spawn(async move {
        if let Err(error) = run_build(&state, &user, &template).await {
            fail_build(&state, &template_id, &user.user_id, &error).await;
        }
    });
}

fn audit(db: &crate::db::DbHandle, computer_id: &str, user_id: &str, kind: &str, detail: String) {
    crate::computer_audit::log_computer_access(db, computer_id, user_id, kind, &detail);
}

async fn set_build_outcome(
    db: &crate::db::DbHandle,
    template_id: &str,
    status: &str,
    error: Option<&str>,
    golden_snapshot_id: Option<&str>,
) -> Result<(), String> {
    let db = db.clone();
    let template_id = template_id.to_string();
    let status = status.to_string();
    let error = error.map(|s| s.chars().take(4000).collect::<String>());
    let golden_snapshot_id = golden_snapshot_id.map(|s| s.to_string());
    tokio::task::spawn_blocking(move || {
        let conn = db.connect().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE desktop_templates SET build_status = ?1, build_error = ?2, \
             golden_snapshot_id = ?3, \
             built_at = CASE WHEN ?1 = ?4 THEN CURRENT_TIMESTAMP ELSE built_at END, \
             updated_at = CURRENT_TIMESTAMP \
             WHERE id = ?5",
            rusqlite::params![
                status,
                error,
                golden_snapshot_id,
                BUILD_STATUS_READY,
                template_id
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

async fn fail_build(state: &Arc<AppState>, template_id: &str, user_id: &str, error: &str) {
    warn!(template_id, error, "template build failed");
    let _ = set_build_outcome(
        &state.db,
        template_id,
        BUILD_STATUS_FAILED,
        Some(error),
        None,
    )
    .await;
    audit(
        &state.db,
        template_id,
        user_id,
        KIND_BUILD_FAILED,
        format!("template build failed: {error}"),
    );
}

fn tail(bytes: &Option<Vec<u8>>, max: usize) -> String {
    let text = bytes
        .as_ref()
        .map(|b| String::from_utf8_lossy(b).to_string())
        .unwrap_or_default();
    let trimmed = text.trim();
    if trimmed.len() <= max {
        trimmed.to_string()
    } else {
        // Slice at a char boundary: `len() - max` can land inside a multi-byte
        // UTF-8 sequence, and panicking here would strand the template in
        // 'building' forever (this runs inside the tokio build task).
        let mut start = trimmed.len() - max;
        while start > 0 && !trimmed.is_char_boundary(start) {
            start -= 1;
        }
        format!("…{}", &trimmed[start..])
    }
}

async fn exec_guest(
    driver: &Arc<dyn allternit_driver_interface::ExecutionDriver>,
    handle: &allternit_driver_interface::ExecutionHandle,
    command: Vec<String>,
    env: &HashMap<String, String>,
) -> Result<allternit_driver_interface::ExecResult, String> {
    let spec = CommandSpec {
        command,
        env_vars: env.clone(),
        working_dir: None,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };
    driver.exec(handle, spec).await.map_err(|e| e.to_string())
}

/// Non-zero exit → Err with the tail of the combined output (never includes
/// env/secret values: only stdout/stderr).
async fn exec_guest_checked(
    driver: &Arc<dyn allternit_driver_interface::ExecutionDriver>,
    handle: &allternit_driver_interface::ExecutionHandle,
    step: &str,
    command: Vec<String>,
    env: &HashMap<String, String>,
) -> Result<(), String> {
    let result = exec_guest(driver, handle, command, env).await?;
    if result.exit_code != 0 {
        let output = format!(
            "{}{}",
            tail(&result.stderr, 400),
            tail(&result.stdout, 400)
        );
        return Err(format!(
            "{step} exited with code {}: {}",
            result.exit_code,
            if output.is_empty() {
                "(no output)".to_string()
            } else {
                output
            }
        ));
    }
    Ok(())
}

/// Resolve every `vault://org/{org_id}/{name}` secret ref through the org
/// vault. Returns the env map injected into services and hooks. Values live
/// only in memory inside this build; they are never written to the DB.
async fn resolve_secrets(
    state: &Arc<AppState>,
    user: &AuthUser,
    template: &DesktopTemplate,
    spec: &ComputerTemplateSpec,
) -> Result<HashMap<String, String>, String> {
    let mut resolved = HashMap::new();
    for secret in &spec.secrets {
        let reference = crate::bot_desktop_templates::parse_vault_secret_ref(&secret.ref_)?;
        let db = state.db.clone();
        let requester = user.clone();
        let value = tokio::task::spawn_blocking(move || {
            crate::allternit_vault::resolve_org_vault_secret(&db, &requester, &reference)
        })
        .await
        .map_err(|e| format!("secret resolution task failed for {}: {e}", secret.ref_))??;
        let value = value.ok_or_else(|| {
            format!(
                "secret ref not found or expired: {} (env {})",
                secret.ref_, secret.name
            )
        })?;
        audit(
            &state.db,
            &template.id,
            &user.user_id,
            KIND_SECRET_RESOLVE,
            format!("resolved secret ref for env {} (ref name only; value never stored)", secret.name),
        );
        resolved.insert(secret.name.clone(), value);
    }
    Ok(resolved)
}

/// Render a systemd unit for one template service. Environment= lines are
/// double-quoted per systemd.syntax; secret values are escaped, never logged.
fn render_unit(service: &crate::bot_desktop_templates::TemplateService, env: &HashMap<String, String>) -> String {
    let mut out = String::new();
    out.push_str("[Unit]\n");
    out.push_str(&format!(
        "Description=Allternit template service {}\n",
        service.name
    ));
    out.push_str("After=network.target\n\n[Service]\n");
    let mut merged = service.env.clone();
    for (k, v) in env {
        merged.insert(k.clone(), v.clone());
    }
    let mut keys: Vec<&String> = merged.keys().collect();
    keys.sort();
    for key in keys {
        let value = &merged[key];
        let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
        out.push_str(&format!("Environment=\"{key}={escaped}\"\n"));
    }
    let command = service.command.replace('\\', "\\\\").replace('"', "\\\"");
    out.push_str(&format!("ExecStart=/bin/sh -lc \"{command}\"\n"));
    out.push_str("Restart=always\n\n[Install]\nWantedBy=default.target\n");
    out
}

/// Delete any previous golden holder (VM + row) before a (re)build.
async fn delete_old_holders(state: &Arc<AppState>, template_id: &str) {
    let db = state.db.clone();
    let template_id_owned = template_id.to_string();
    let holders = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare(
            "SELECT id, native_id, provider, os FROM computers \
             WHERE template_id = ?1 AND role = 'golden' AND status != 'deleted'",
        )?;
        let rows = stmt
            .query_map(rusqlite::params![template_id_owned], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>();
        rows
    })
    .await;

    let Ok(Ok(holders)) = holders else {
        warn!(template_id, "failed to look up old golden holders");
        return;
    };
    for (computer_id, native_id, provider, os) in holders {
        if let Some(native_id) = native_id {
            let driver = match &state.vm_driver {
                Some(d) => d.clone(),
                None => break,
            };
            let handle =
                crate::bot_desktop_routes::build_handle(&native_id, os.as_deref(), Some(&provider));
            if let Err(e) = driver.destroy(&handle).await {
                warn!(%native_id, error = %e, "failed to destroy old golden holder VM");
            }
        }
        let db = state.db.clone();
        let computer_id2 = computer_id.clone();
        let _ = tokio::task::spawn_blocking(move || {
            let conn = db.connect()?;
            conn.execute(
                "UPDATE computers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                rusqlite::params![computer_id2],
            )?;
            Ok::<_, rusqlite::Error>(())
        })
        .await;
        info!(%computer_id, template_id, "deleted old golden holder row");
    }
}

async fn run_build(
    state: &Arc<AppState>,
    user: &AuthUser,
    template: &DesktopTemplate,
) -> Result<(), String> {
    let template_id = template.id.clone();
    let spec: ComputerTemplateSpec = serde_yaml::from_str(template.spec_yaml.as_deref().ok_or(
        "template has no spec doc; import it as a ComputerTemplate doc first",
    )?)
    .map_err(|e| format!("stored spec doc does not parse: {e}"))?;
    spec.validate()?;

    // Package builds are linux-only in v1 (honest 501-class limitation, applied
    // at build time since the build VM is where packages get installed).
    if spec.os.name != "linux" {
        return Err("package builds are linux-only in v1".to_string());
    }

    let secrets = resolve_secrets(state, user, template, &spec).await?;

    delete_old_holders(state, &template_id).await;

    // Spawn the golden holder from the base image via the same spawn internals
    // as standalone desktops (factored in computer_routes).
    let provision_req = ProvisionRequest {
        os: Some(spec.os.name.clone()),
        template_id: Some(template_id.clone()),
        ..Default::default()
    };
    let provision = crate::bot_desktop_templates::resolve_provision_spec(state, user, &provision_req)
        .await
        .map_err(|(status, body)| {
            format!("failed to resolve provision spec ({status}): {}", body.0)
        })?;
    let holder_name = format!("tpl-golden-{template_id}");
    // Provider hint: on hosts with an Incus substrate the router's default
    // (linux -> Incus) is right. On Tart-only hosts (self-hosted desktop) a
    // Linux golden holder must be pinned to Tart — otherwise
    // `choose_spawn_driver` routes to the absent Incus substrate and every
    // build dies at holder spawn with "Feature not supported: Incus
    // substrate" (live-smoke defect, rq-20260909-004).
    let provider_hint = if state.incus_driver.is_some() {
        None
    } else {
        Some("tart")
    };
    let spawned = crate::computer_routes::spawn_desktop_for_owner(
        state,
        user,
        &provision,
        &holder_name,
        "user",
        &template.user_id,
        "golden",
        "cloud_desktop",
        None,
        Some(&template_id),
        None,
        provider_hint,
        "free",
        crate::computer_routes::Persistence::Persistent,
    )
    .await
    .map_err(|resp| format!("failed to spawn golden holder: {}", resp.status()))?;

    let holder_computer_id = spawned.computer_id.clone();
    let driver = match &state.vm_driver {
        Some(d) => d.clone(),
        None => {
            return Err("no VM driver is configured on this host".to_string());
        }
    };
    let result = build_in_guest(
        state,
        user,
        &template_id,
        &holder_computer_id,
        &driver,
        &spawned.handle,
        &spec,
        &secrets,
    )
    .await;

    match result {
        Ok(()) => {
            // Snapshot while the guest is still running: Incus stateful
            // snapshots capture live memory state and require a running
            // instance. The holder is stopped right after, so the golden
            // snapshot IS the stopped holder's state plus live-service memory.
            if let Err(e) = driver
                .create_snapshot(&spawned.handle, GOLDEN_SNAPSHOT_NAME, true)
                .await
            {
                let _ = driver.destroy(&spawned.handle).await;
                return Err(format!("failed to create golden snapshot: {e}"));
            }
            if let Err(e) = driver.pause_vm(&spawned.handle).await {
                warn!(error = %e, "golden holder stop failed after snapshot; leaving it running");
            } else {
                let db = state.db.clone();
                let holder_id = holder_computer_id.clone();
                let _ = tokio::task::spawn_blocking(move || {
                    let conn = db.connect()?;
                    conn.execute(
                        "UPDATE computers SET status = 'stopped', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                        rusqlite::params![holder_id],
                    )?;
                    Ok::<_, rusqlite::Error>(())
                })
                .await;
            }
            set_build_outcome(
                &state.db,
                &template_id,
                BUILD_STATUS_READY,
                None,
                Some(GOLDEN_SNAPSHOT_NAME),
            )
            .await?;
            audit(
                &state.db,
                &template_id,
                &user.user_id,
                KIND_BUILD_READY,
                format!(
                    "template build ready; golden snapshot '{GOLDEN_SNAPSHOT_NAME}' on holder {holder_computer_id}"
                ),
            );
            info!(template_id, "template build ready");
            Ok(())
        }
        Err(e) => {
            let _ = driver.destroy(&spawned.handle).await;
            let db = state.db.clone();
            let _ = tokio::task::spawn_blocking(move || {
                let conn = db.connect()?;
                conn.execute(
                    "UPDATE computers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                    rusqlite::params![holder_computer_id],
                )?;
                Ok::<_, rusqlite::Error>(())
            })
            .await;
            Err(e)
        }
    }
}

/// Everything that happens inside the golden-holder guest.
async fn build_in_guest(
    state: &Arc<AppState>,
    user: &AuthUser,
    template_id: &str,
    holder_computer_id: &str,
    driver: &Arc<dyn allternit_driver_interface::ExecutionDriver>,
    handle: &allternit_driver_interface::ExecutionHandle,
    spec: &ComputerTemplateSpec,
    secrets: &HashMap<String, String>,
) -> Result<(), String> {
    let mut apt_env = HashMap::new();
    apt_env.insert("DEBIAN_FRONTEND".to_string(), "noninteractive".to_string());

    if !spec.packages.is_empty() {
        exec_guest_checked(
            driver,
            handle,
            "apt-get update",
            vec!["apt-get".into(), "update".into()],
            &apt_env,
        )
        .await?;
        let mut install = vec!["apt-get".into(), "install".into(), "-y".into(), "--no-install-recommends".into()];
        install.extend(spec.packages.iter().cloned());
        exec_guest_checked(driver, handle, "apt-get install", install, &apt_env).await?;
    }

    for service in &spec.services {
        write_and_enable_service(driver, handle, service, secrets).await?;
        audit(
            &state.db,
            holder_computer_id,
            &user.user_id,
            KIND_BUILD_SERVICE,
            format!("service '{}' written to golden image (template {template_id})", service.name),
        );
    }

    for hook in &spec.hooks.post_create {
        exec_guest_checked(
            driver,
            handle,
            &format!("postCreate hook: {hook}"),
            vec!["sh".into(), "-lc".into(), hook.clone()],
            secrets,
        )
        .await?;
    }
    Ok(())
}

/// Write a service as a systemd user unit per the spec, then enable it.
/// Container guests often have no per-user systemd manager, so on user-unit
/// failure we fall back to a system unit; the build only fails if both fail.
async fn write_and_enable_service(
    driver: &Arc<dyn allternit_driver_interface::ExecutionDriver>,
    handle: &allternit_driver_interface::ExecutionHandle,
    service: &crate::bot_desktop_templates::TemplateService,
    secrets: &HashMap<String, String>,
) -> Result<(), String> {
    let unit = render_unit(service, secrets);
    let encoded = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        unit.as_bytes(),
    );
    let user_dir = format!("$HOME/.config/systemd/user/{}.service", service.name);
    exec_guest_checked(
        driver,
        handle,
        &format!("write unit for {}", service.name),
        vec![
            "sh".into(),
            "-c".into(),
            format!("mkdir -p \"$HOME/.config/systemd/user\" && printf %s '{encoded}' | base64 -d > \"{user_dir}\""),
        ],
        &HashMap::new(),
    )
    .await?;

    let action = if service.autostart {
        "enable --now"
    } else {
        "enable"
    };
    let user_cmd = format!(
        "systemctl --user daemon-reload && systemctl --user {action} {}.service",
        service.name
    );
    match exec_guest(
        driver,
        handle,
        vec!["sh".into(), "-lc".into(), user_cmd.clone()],
        &HashMap::new(),
    )
    .await
    {
        Ok(result) if result.exit_code == 0 => return Ok(()),
        Ok(result) => {
            tracing::info!(
                service = %service.name,
                stderr = %tail(&result.stderr, 200),
                "user systemd unavailable in guest; falling back to system unit"
            );
        }
        Err(e) => {
            tracing::info!(service = %service.name, error = %e, "user systemd exec failed; falling back to system unit");
        }
    }

    let sys_dir = format!("/etc/systemd/system/{}.service", service.name);
    exec_guest_checked(
        driver,
        handle,
        &format!("install system unit for {}", service.name),
        vec![
            "sh".into(),
            "-c".into(),
            format!("printf %s '{encoded}' | base64 -d > \"{sys_dir}\""),
        ],
        &HashMap::new(),
    )
    .await?;
    let sys_cmd = format!(
        "systemctl daemon-reload && systemctl {action} {}.service",
        service.name
    );
    exec_guest_checked(
        driver,
        handle,
        &format!("enable system unit for {}", service.name),
        vec!["sh".into(), "-lc".into(), sys_cmd],
        &HashMap::new(),
    )
    .await
}
