//! Service installation: `allternit-node install|uninstall|status|logs`.
//!
//! macOS → LaunchDaemon at `/Library/LaunchDaemons/com.allternit.node.plist`
//! (starts at boot, before login, survives logout). Linux → systemd unit at
//! `/etc/systemd/system/allternit-node.service`. Uninstall removes only the
//! daemon's own unit + logs — the desktop app is never touched. Identity and
//! config files are shared with the desktop app, so `uninstall` keeps them
//! unless `--purge` is passed (documented as also unpairing the desktop).

use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ServicePlatform {
    Launchd,
    Systemd,
}

pub fn platform() -> ServicePlatform {
    if cfg!(target_os = "macos") {
        ServicePlatform::Launchd
    } else {
        ServicePlatform::Systemd
    }
}

pub const MACOS_PLIST_PATH: &str = "/Library/LaunchDaemons/com.allternit.node.plist";
pub const MACOS_LOG_DIR: &str = "/Library/Logs/allternit";
pub const SYSTEMD_UNIT_PATH: &str = "/etc/systemd/system/allternit-node.service";
pub const SERVICE_NAME: &str = "allternit-node";

/// Resolve the user the daemon should run as. LaunchDaemons default to root,
/// but the daemon must operate on the pairing user's files (identity,
/// terminals, exec) — so it runs as whoever paired the machine: `$SUDO_USER`
/// when installed via sudo, else the owner of the identity file. `None` means
/// root (headless installs, current behavior).
pub fn resolve_pairing_user(identity_path: &Path) -> Option<String> {
    if let Ok(user) = std::env::var("SUDO_USER") {
        if !user.is_empty() && user != "root" {
            return Some(user);
        }
    }
    if identity_path.exists() {
        if let Ok(owner) = run_command("stat", &["-f", "%Su", &identity_path.to_string_lossy()]) {
            if !owner.is_empty() && owner != "root" {
                return Some(owner);
            }
        }
    }
    None
}

/// Home directory of `user` on macOS: dscl first, `eval echo ~user` as a
/// fallback, then the conventional `/Users/<user>`.
pub fn user_home(user: &str) -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = run_command(
            "dscl",
            &[".", "-read", &format!("/Users/{user}"), "NFSHomeDirectory"],
        ) {
            if let Some((_, home)) = output.split_once(':') {
                let home = home.trim();
                if home.starts_with('/') {
                    return Some(PathBuf::from(home));
                }
            }
        }
        if let Ok(output) = run_command("sh", &["-c", &format!("eval echo ~{user}")]) {
            let home = output.trim();
            if home.starts_with('/') && !home.starts_with('~') {
                return Some(PathBuf::from(home));
            }
        }
        return Some(PathBuf::from(format!("/Users/{user}")));
    }
    #[cfg(not(target_os = "macos"))]
    {
        if let Ok(output) = run_command("sh", &["-c", &format!("eval echo ~{user}")]) {
            let home = output.trim();
            if home.starts_with('/') && !home.starts_with('~') {
                return Some(PathBuf::from(home));
            }
        }
        None
    }
}

/// Daemon log file. When the daemon runs as the pairing user it cannot write
/// `/Library/Logs`, so the log lives in that user's home instead.
pub fn log_file(identity_path: &Path) -> PathBuf {
    match platform() {
        ServicePlatform::Launchd => {
            if let Some(user) = resolve_pairing_user(identity_path) {
                if let Some(home) = user_home(&user) {
                    return home.join("Library/Logs/allternit/node.log");
                }
            }
            PathBuf::from(MACOS_LOG_DIR).join("node.log")
        }
        ServicePlatform::Systemd => PathBuf::from("/var/log/allternit-node.log"),
    }
}

/// launchd plist for the daemon. Pure function so the unit shape is unit
/// tested; `binary` is the absolute path of the running executable. When
/// `user` is `Some((name, home))` the daemon runs as that user (`UserName`)
/// and logs inside their home (a non-root daemon cannot write
/// `/Library/Logs`).
pub fn launchd_plist(binary: &Path, identity_path: &Path, user: Option<(&str, &Path)>) -> String {
    let username_block = user
        .map(|(name, _)| format!("    <key>UserName</key>\n    <string>{name}</string>\n"))
        .unwrap_or_default();
    let log_path = user
        .map(|(_, home)| home.join("Library/Logs/allternit/node.log"))
        .unwrap_or_else(|| PathBuf::from(MACOS_LOG_DIR).join("node.log"));
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.allternit.node</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
        <string>run</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>ALLTERNIT_RUNTIME_IDENTITY_PATH</key>
        <string>{}</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
{username_block}    <key>StandardOutPath</key>
    <string>{}</string>
    <key>StandardErrorPath</key>
    <string>{}</string>
    <key>ProcessType</key>
    <string>Background</string>
</dict>
</plist>
"#,
        binary.display(),
        identity_path.display(),
        log_path.display(),
        log_path.display(),
    )
}

/// systemd unit for the daemon. `user` runs the service as the installing
/// user so fs/exec scopes land on the right home directory; root installs
/// run as root (headless servers).
pub fn systemd_unit(binary: &Path, identity_path: &Path, user: Option<&str>) -> String {
    let user_line = user
        .map(|user| format!("User={user}\n"))
        .unwrap_or_default();
    format!(
        r#"[Unit]
Description=Allternit Node Daemon (always-on node.core presence)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
{user_line}ExecStart={} run
Environment=ALLTERNIT_RUNTIME_IDENTITY_PATH={}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"#,
        binary.display(),
        identity_path.display(),
    )
}

fn run_command(program: &str, args: &[&str]) -> Result<String, String> {
    let output = std::process::Command::new(program)
        .args(args)
        .output()
        .map_err(|error| format!("{program}: {error}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(format!(
            "{program} {}: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        ))
    }
}

/// Install the service for the current platform. Requires root (LaunchDaemon
/// / system systemd unit); on failure prints the exact commands to run with
/// sudo so the operator stays in control.
pub fn install(binary: &Path, identity_path: &Path) -> Result<String, String> {
    let uid = std::process::Command::new("id")
        .arg("-u")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .and_then(|raw| raw.trim().parse::<u32>().ok())
        .unwrap_or(1);
    if uid != 0 {
        return Err(format!(
            "installing the service requires root. Run:\n\n  sudo {0} install\n\n\
             (the daemon then starts at boot and survives logout; the desktop \
             app is unaffected)",
            binary.display()
        ));
    }
    match platform() {
        ServicePlatform::Launchd => {
            let user = resolve_pairing_user(identity_path);
            let user_ctx = user.as_deref().and_then(|name| {
                user_home(name).map(|home| (name, home))
            });
            let plist = launchd_plist(binary, identity_path, user_ctx.as_ref().map(|(name, home)| (*name, home.as_path())));
            std::fs::write(MACOS_PLIST_PATH, &plist)
                .map_err(|error| format!("write {MACOS_PLIST_PATH}: {error}"))?;
            // A user daemon logs inside the user's home; create the dir and
            // hand it to the pairing user (install runs as root).
            if let Some((name, home)) = &user_ctx {
                let log_dir = home.join("Library/Logs/allternit");
                std::fs::create_dir_all(&log_dir)
                    .map_err(|error| format!("create {}: {error}", log_dir.display()))?;
                let _ = run_command("chown", &["-R", name, &log_dir.to_string_lossy()]);
            }
            let _ = run_command("launchctl", &["bootout", "system/com.allternit.node"]);
            run_command(
                "launchctl",
                &["bootstrap", "system/", MACOS_PLIST_PATH],
            )?;
            let user_note = user
                .as_ref()
                .map(|name| format!(" (running as {name})"))
                .unwrap_or_default();
            Ok(format!(
                "installed {MACOS_PLIST_PATH}{user_note}; service is starting (logs: {})",
                log_file(identity_path).display()
            ))
        }
        ServicePlatform::Systemd => {
            let user = std::env::var("SUDO_USER").ok();
            let unit = systemd_unit(binary, identity_path, user.as_deref());
            std::fs::write(SYSTEMD_UNIT_PATH, &unit)
                .map_err(|error| format!("write {SYSTEMD_UNIT_PATH}: {error}"))?;
            run_command("systemctl", &["daemon-reload"])?;
            run_command("systemctl", &["enable", "--now", "allternit-node.service"])?;
            Ok(format!(
                "installed {SYSTEMD_UNIT_PATH}; service is starting (logs: journalctl -u allternit-node)"
            ))
        }
    }
}

/// Remove the service. With `purge`, also remove the shared pairing identity
/// (documented: this unpairs Allternit Desktop too) and node config.
pub fn uninstall(identity_path: &Path, config_path: &Path, purge: bool) -> Result<String, String> {
    let mut actions = Vec::new();
    match platform() {
        ServicePlatform::Launchd => {
            let _ = run_command("launchctl", &["bootout", "system/com.allternit.node"]);
            if Path::new(MACOS_PLIST_PATH).exists() {
                std::fs::remove_file(MACOS_PLIST_PATH)
                    .map_err(|error| format!("remove {MACOS_PLIST_PATH}: {error}"))?;
                actions.push(format!("removed {MACOS_PLIST_PATH}"));
            } else {
                actions.push("no LaunchDaemon was installed".to_string());
            }
        }
        ServicePlatform::Systemd => {
            let _ = run_command("systemctl", &["disable", "--now", "allternit-node.service"]);
            if Path::new(SYSTEMD_UNIT_PATH).exists() {
                std::fs::remove_file(SYSTEMD_UNIT_PATH)
                    .map_err(|error| format!("remove {SYSTEMD_UNIT_PATH}: {error}"))?;
                actions.push(format!("removed {SYSTEMD_UNIT_PATH}"));
            } else {
                actions.push("no systemd unit was installed".to_string());
            }
            let _ = run_command("systemctl", &["daemon-reload"]);
        }
    }
    if purge {
        if identity_path.exists() {
            std::fs::remove_file(identity_path)
                .map_err(|error| format!("remove {}: {error}", identity_path.display()))?;
            actions.push(format!(
                "removed identity {} (also unpairs Allternit Desktop)",
                identity_path.display()
            ));
        }
        if config_path.exists() {
            std::fs::remove_file(config_path)
                .map_err(|error| format!("remove {}: {error}", config_path.display()))?;
            actions.push(format!("removed config {}", config_path.display()));
        }
    } else {
        actions.push(format!(
            "kept shared identity {} (pass --purge to remove it; that also \
             unpairs Allternit Desktop)",
            identity_path.display()
        ));
    }
    actions.push("desktop app untouched".to_string());
    Ok(actions.join("; "))
}

/// Human-readable service status (best effort, read-only).
pub fn status(identity_path: &Path) -> String {
    match platform() {
        ServicePlatform::Launchd => {
            let loaded = run_command("launchctl", &["list"]).unwrap_or_default();
            let line = loaded
                .lines()
                .find(|line| line.contains("com.allternit.node"))
                .map(|line| line.trim().to_string());
            match line {
                Some(line) => format!(
                    "LaunchDaemon loaded ({line}). logs: {}",
                    log_file(identity_path).display()
                ),
                None => "LaunchDaemon not loaded (run `sudo allternit-node install`)".to_string(),
            }
        }
        ServicePlatform::Systemd => {
            let state = run_command("systemctl", &["is-active", "allternit-node.service"])
                .unwrap_or_else(|_| "not installed".to_string());
            format!("allternit-node.service: {state} (logs: journalctl -u allternit-node)")
        }
    }
}

/// Tail the daemon log (last 100 lines) or print where logs live.
pub fn logs(identity_path: &Path) -> String {
    let file = log_file(identity_path);
    if file.exists() {
        run_command("tail", &["-n", "100", &file.to_string_lossy()])
            .unwrap_or_else(|error| format!("unable to read {}: {error}", file.display()))
    } else {
        match platform() {
            ServicePlatform::Launchd => format!("no log yet at {}", file.display()),
            ServicePlatform::Systemd => {
                run_command("journalctl", &["-u", "allternit-node", "--no-pager", "-n", "100"])
                    .unwrap_or_else(|error| format!("no logs yet: {error}"))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launchd_plist_runs_binary_at_boot_and_survives_logout() {
        let plist = launchd_plist(Path::new("/usr/local/bin/allternit-node"), Path::new("/home/u/.config/allternit/runtime-identity.json"), None);
        assert!(plist.contains("<key>RunAtLoad</key>"));
        assert!(plist.contains("<true/>"));
        assert!(plist.contains("<key>KeepAlive</key>"));
        assert!(plist.contains("/usr/local/bin/allternit-node"));
        assert!(plist.contains("<string>run</string>"));
        assert!(plist.contains("ALLTERNIT_RUNTIME_IDENTITY_PATH"));
        assert!(plist.contains("com.allternit.node"));
        assert!(plist.contains("/Library/Logs/allternit/node.log"));
        // No pairing user known → root daemon, no UserName key.
        assert!(!plist.contains("UserName"));
    }

    #[test]
    fn launchd_plist_runs_as_pairing_user_with_user_home_logs() {
        let plist = launchd_plist(
            Path::new("/usr/local/bin/allternit-node"),
            Path::new("/Users/joe/.config/allternit/runtime-identity.json"),
            Some(("joe", Path::new("/Users/joe"))),
        );
        assert!(plist.contains("<key>UserName</key>"));
        assert!(plist.contains("<string>joe</string>"));
        assert!(plist.contains("/Users/joe/Library/Logs/allternit/node.log"));
        // The root-owned log dir must not appear as a standalone path.
        assert!(!plist.contains("<string>/Library/Logs/allternit/node.log</string>"));
    }

    #[test]
    fn systemd_unit_enables_at_boot_with_restart_policy() {
        let unit = systemd_unit(
            Path::new("/usr/local/bin/allternit-node"),
            Path::new("/root/.config/allternit/runtime-identity.json"),
            Some("allternit"),
        );
        assert!(unit.contains("WantedBy=multi-user.target"));
        assert!(unit.contains("Restart=always"));
        assert!(unit.contains("After=network-online.target"));
        assert!(unit.contains("User=allternit"));
        assert!(unit.contains("ExecStart=/usr/local/bin/allternit-node run"));
    }
}
