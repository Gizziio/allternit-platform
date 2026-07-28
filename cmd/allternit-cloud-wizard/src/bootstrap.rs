//! gizzi-code Bootstrap Module
//!
//! Turns a bare VPS into a gizzi-code instance over SSH:
//! - Detects arch (x86_64/aarch64), downloads the checksum-pinned gizzi-code
//!   release (same artifact as `cmd/allternit-hosted-runtime/Dockerfile`)
//! - Installs `gizzi-code.service` (systemd) serving on the mesh only
//! - Joins the Headscale tailnet via `tailscaled` + a single-use preauth key
//!   minted by the cloud-api BEFORE the SSH run (the key only ever lives in
//!   the 0600 env file on the box)
//! - Captures the mesh IPv4 (`tailscale ip -4`) for registry insertion
//!
//! Mesh join choice: the hosted runtime Dockerfile does not ship a mesh-node
//! sidecar from gizzi-code releases, so bootstrap installs the official
//! Tailscale package (`https://tailscale.com/install.sh`) and points it at
//! the platform Headscale control URL with `tailscale up --login-server`.
//! From v0.2.1 the release tarballs also ship the mesh-node tsnet sidecar,
//! which bootstrap installs next to gizzi-code (`/opt/gizzi/bin/mesh-node`)
//! so `serve --mesh` can fall back to a pure-userspace tailnet join.
//!
//! Everything is idempotent: re-running skips the download when the checksum
//! already matches and skips `tailscale up` when the node is already on the
//! tailnet (preauth keys are single-use, so a blind re-run would fail).

use allternit_cloud_ssh::SshConnection;
use serde::{Deserialize, Serialize};

/// Pinned gizzi-code release tag (in `Gizziio/allternit-platform`, built by
/// `release-gizzi-code.yml` from this monorepo).
pub const GIZZI_RELEASE: &str = "gizzi-code/0.2.1";

/// Bare version string used in release asset filenames
/// (`gizzi-code-v{VERSION}-linux-<arch>.tar.gz`).
pub const GIZZI_VERSION: &str = "0.2.1";

/// SHA-256 of `gizzi-code-v{VERSION}-linux-x64.tar.gz` for [`GIZZI_RELEASE`].
pub const GIZZI_LINUX_X64_SHA256: &str =
    "165ce341d1195588556039038e3aed6e7bd211fd8fdad4d64d2041e9ff2f2117";

/// SHA-256 of `gizzi-code-v{VERSION}-linux-arm64.tar.gz` for [`GIZZI_RELEASE`].
pub const GIZZI_LINUX_ARM64_SHA256: &str =
    "d54244bb686f2e899342f8f82448871a978b50db6cc267dc02e62279f7d234f4";

/// Escape hatch to override the pinned arm64 checksum (e.g. when testing a
/// newer release build that hasn't been pinned yet).
pub const GIZZI_LINUX_ARM64_SHA256_ENV: &str = "GIZZI_LINUX_ARM64_SHA256";

/// GitHub releases download base for the pinned release.
pub const GIZZI_DOWNLOAD_BASE: &str =
    "https://github.com/Gizziio/allternit-platform/releases/download";

/// Port gizzi-code serves on (mesh-only; no firewall ports are opened).
pub const GIZZI_PORT: u16 = 4096;

/// Default Headscale control URL (same default as the cloud-api mesh route).
pub const DEFAULT_MESH_CONTROL_URL: &str = "https://allternit-headscale.fly.dev";

/// SSH authentication for the bootstrap connection
#[derive(Debug, Clone)]
pub enum SshAuth {
    PrivateKey(String),
    Password(String),
}

/// Mesh (tailnet) configuration for the bootstrap
#[derive(Debug, Clone)]
pub struct MeshBootstrap {
    /// Single-use Headscale preauth key, minted by cloud-api before the run.
    pub auth_key: String,
    /// Headscale control URL for `tailscale up --login-server`.
    pub control_url: String,
}

/// Bootstrap configuration for one VPS
#[derive(Debug, Clone)]
pub struct BootstrapConfig {
    /// SSH host (public IP or hostname)
    pub host: String,
    /// SSH port
    pub port: u16,
    /// SSH username (must be root or have passwordless sudo)
    pub username: String,
    /// SSH credentials
    pub auth: SshAuth,
    /// Instance name (systemd hostname on the tailnet + registry name)
    pub instance_name: String,
    /// Mesh enrollment; `None` installs gizzi-code without joining a tailnet
    /// (legacy/manual path only — the wizard happy path always enrolls).
    pub mesh: Option<MeshBootstrap>,
    /// gizzi-code release tag to install
    pub release: String,
    /// SHA-256 for the linux-x64 artifact
    pub x64_sha256: String,
    /// SHA-256 for the linux-arm64 artifact (required on arm64 boxes)
    pub arm64_sha256: Option<String>,
}

impl BootstrapConfig {
    /// Config with the pinned release/checksums, mesh enrollment enabled.
    pub fn new(
        host: String,
        port: u16,
        username: String,
        auth: SshAuth,
        instance_name: String,
        mesh: MeshBootstrap,
    ) -> Self {
        Self {
            host,
            port,
            username,
            auth,
            instance_name,
            mesh: Some(mesh),
            release: GIZZI_RELEASE.to_string(),
            x64_sha256: GIZZI_LINUX_X64_SHA256.to_string(),
            arm64_sha256: Some(
                std::env::var(GIZZI_LINUX_ARM64_SHA256_ENV)
                    .unwrap_or_else(|_| GIZZI_LINUX_ARM64_SHA256.to_string()),
            ),
        }
    }

    /// Download URL for a given artifact arch (`x64` / `arm64`) — the
    /// monorepo release ships tarballs containing a `gizzi-code` binary.
    pub fn artifact_url(&self, artifact_arch: &str) -> String {
        format!(
            "{}/{}/gizzi-code-v{}-linux-{}.tar.gz",
            GIZZI_DOWNLOAD_BASE, self.release, GIZZI_VERSION, artifact_arch
        )
    }
}

/// Bootstrap result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapResult {
    pub success: bool,
    pub status: String,
    pub message: String,
    pub log_output: String,
    /// Mesh IPv4 captured from `tailscale ip -4` (present when enrolled)
    pub mesh_ip: Option<String>,
}

/// Bootstrap error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BootstrapError {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}

impl BootstrapError {
    /// SSH transport errors are transient (unreachable, timeout, transfer
    /// blip) and recoverable; authentication failures are not — re-running
    /// with the same credentials will fail the same way.
    fn ssh(error: allternit_cloud_ssh::SshError) -> Self {
        let recoverable = !matches!(
            error,
            allternit_cloud_ssh::SshError::AuthenticationFailed(_)
        );
        Self {
            code: "SSH_ERROR".to_string(),
            message: error.to_string(),
            recoverable,
        }
    }

    /// Runtime failure of the bootstrap script on the box (non-zero exit,
    /// apt lock, download/tailscale hiccup) — the script is idempotent, so
    /// these are recoverable by re-running.
    fn failed(message: impl Into<String>) -> Self {
        Self {
            code: "BOOTSTRAP_FAILED".to_string(),
            message: message.into(),
            recoverable: true,
        }
    }

    /// Local validation failure (the run never reached the box) — not
    /// recoverable without changing the request.
    fn invalid(message: impl Into<String>) -> Self {
        Self {
            code: "BOOTSTRAP_INVALID".to_string(),
            message: message.into(),
            recoverable: false,
        }
    }
}

impl std::fmt::Display for BootstrapError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for BootstrapError {}

/// Contents of `/etc/gizzi/gizzi-code.env` (written 0600 on the box). This
/// is the only place the mesh preauth key is stored.
pub fn generate_env_file(config: &BootstrapConfig) -> String {
    let mut out = String::from("GIZZI_REQUIRE_CLERK_AUTH=true\nGIZZI_DISABLE_AUTOUPDATE=1\n");
    if let Some(mesh) = &config.mesh {
        out.push_str(&format!("GIZZI_MESH_AUTH_KEY={}\n", mesh.auth_key));
        out.push_str(&format!("GIZZI_MESH_CONTROL_URL={}\n", mesh.control_url));
    }
    out
}

/// Generate the idempotent bootstrap script for this configuration.
///
/// The script deliberately contains NO secrets: it sources the uploaded
/// `/etc/gizzi/gizzi-code.env` for the mesh key.
pub fn generate_bootstrap_script(config: &BootstrapConfig) -> Result<String, BootstrapError> {
    let mesh_enabled = config.mesh.is_some();

    // Pre-validate so we never upload a script that cannot succeed.
    if config.username.is_empty() || config.host.is_empty() {
        return Err(BootstrapError::invalid("host and username are required"));
    }
    if let Some(mesh) = &config.mesh {
        if mesh.auth_key.is_empty() || mesh.control_url.is_empty() {
            return Err(BootstrapError::invalid(
                "mesh auth key and control URL are required for enrollment",
            ));
        }
    }

    let exec_start = if mesh_enabled {
        format!(
            "/opt/gizzi/bin/gizzi-code serve --mesh --hostname 0.0.0.0 --port {}",
            GIZZI_PORT
        )
    } else {
        format!(
            "/opt/gizzi/bin/gizzi-code serve --hostname 0.0.0.0 --port {}",
            GIZZI_PORT
        )
    };

    let tailscale_block = if mesh_enabled {
        r#"
# ── Tailscale (Headscale tailnet) ────────────────────────────────────────────
if ! command -v tailscale >/dev/null 2>&1; then
    log "Installing tailscale..."
    curl -fsSL https://tailscale.com/install.sh | $SUDO sh
fi

if $SUDO tailscale ip -4 >/dev/null 2>&1; then
    log "Already on the tailnet - skipping tailscale up"
else
    log "Joining tailnet via $GIZZI_MESH_CONTROL_URL..."
    $SUDO tailscale up \
        --login-server "$GIZZI_MESH_CONTROL_URL" \
        --auth-key "$GIZZI_MESH_AUTH_KEY" \
        --hostname "$INSTANCE_NAME" \
        --timeout 60s
fi

MESH_IP="$($SUDO tailscale ip -4 | head -n1)"
[ -n "$MESH_IP" ] || error "tailscale did not assign a mesh IPv4"
log "Mesh IPv4: $MESH_IP"
"#
    } else {
        r#"
MESH_IP=""
log "Mesh enrollment disabled - gizzi-code will serve without a tailnet"
"#
    };

    // NOTE: single-quoted heredocs everywhere so nothing expands locally.
    let script = format!(
        r#"#!/bin/bash
set -euo pipefail

# gizzi-code bootstrap — idempotent, safe to re-run.
# Generated by allternit-cloud-wizard; contains no secrets (the mesh key is
# sourced from /etc/gizzi/gizzi-code.env, uploaded separately as 0600).

log() {{ echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }}
error() {{ echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" >&2; exit 1; }}

# Root or passwordless sudo
if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    SUDO="sudo"
else
    error "bootstrap requires root or passwordless sudo"
fi

command -v systemctl >/dev/null 2>&1 || error "systemd is required"

# ── Arch detection ───────────────────────────────────────────────────────────
case "$(uname -m)" in
    x86_64|amd64)  ARTIFACT_ARCH="x64";   EXPECTED_SHA256="{x64_sha256}" ;;
    aarch64|arm64) ARTIFACT_ARCH="arm64"; EXPECTED_SHA256="{arm64_sha256}" ;;
    *)             error "unsupported architecture: $(uname -m)" ;;
esac
[ -n "$EXPECTED_SHA256" ] || error "no pinned checksum for linux-$ARTIFACT_ARCH (set {arm64_env})"
log "Architecture: $ARTIFACT_ARCH"

# ── Dependencies ─────────────────────────────────────────────────────────────
if ! command -v curl >/dev/null 2>&1; then
    log "Installing curl..."
    if command -v apt-get >/dev/null 2>&1; then
        $SUDO apt-get update -qq && $SUDO apt-get install -y -qq curl ca-certificates
    elif command -v dnf >/dev/null 2>&1; then
        $SUDO dnf install -y -q curl ca-certificates
    elif command -v yum >/dev/null 2>&1; then
        $SUDO yum install -y -q curl ca-certificates
    else
        error "no supported package manager (apt-get, dnf, yum)"
    fi
fi

# ── gizzi-code binary (checksum-pinned tarball) ──────────────────────────────
$SUDO mkdir -p /opt/gizzi/bin /etc/gizzi
ARTIFACT_URL="{artifact_url}"
INSTALLED_RELEASE="$(cat /opt/gizzi/RELEASE 2>/dev/null || true)"
if [ "$INSTALLED_RELEASE" = "{release}" ] && [ -f /opt/gizzi/bin/gizzi-code ]; then
    log "gizzi-code {release} already installed - skipping download"
else
    log "Downloading gizzi-code {release} ($ARTIFACT_ARCH)..."
    curl -fsSL "$ARTIFACT_URL" -o /tmp/gizzi-code.tar.gz
    echo "$EXPECTED_SHA256  /tmp/gizzi-code.tar.gz" | sha256sum -c - || error "checksum mismatch for $ARTIFACT_URL"
    rm -rf /tmp/gizzi-extract && mkdir -p /tmp/gizzi-extract
    tar -xzf /tmp/gizzi-code.tar.gz -C /tmp/gizzi-extract
    $SUDO mv /tmp/gizzi-extract/gizzi-code /opt/gizzi/bin/gizzi-code
    $SUDO chmod +x /opt/gizzi/bin/gizzi-code
    # mesh-node tsnet sidecar ships in the tarball from v0.2.1 on; install it
    # next to gizzi-code so `serve --mesh` finds it via execDir-sibling
    # discovery. Conditional so older tarballs (gizzi-code only) still work.
    if [ -f /tmp/gizzi-extract/mesh-node ]; then
        log "Installing mesh-node sidecar..."
        $SUDO mv /tmp/gizzi-extract/mesh-node /opt/gizzi/bin/mesh-node
        $SUDO chmod 0755 /opt/gizzi/bin/mesh-node
    else
        log "No mesh-node in tarball - skipping sidecar install"
    fi
    echo "{release}" | $SUDO tee /opt/gizzi/RELEASE >/dev/null
fi

# ── Env file (uploaded to /tmp by the provisioner, contains the mesh key) ────
[ -f /tmp/gizzi-code.env ] || error "/tmp/gizzi-code.env missing (provisioner must upload it)"
$SUDO mv /tmp/gizzi-code.env /etc/gizzi/gizzi-code.env
$SUDO chmod 600 /etc/gizzi/gizzi-code.env
set -a; . /etc/gizzi/gizzi-code.env; set +a
INSTANCE_NAME="{instance_name}"

# ── systemd unit ─────────────────────────────────────────────────────────────
log "Writing gizzi-code.service..."
$SUDO tee /etc/systemd/system/gizzi-code.service >/dev/null << 'UNIT'
[Unit]
Description=gizzi-code instance (Allternit BYO-VPS)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/gizzi/gizzi-code.env
ExecStart={exec_start}
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
{tailscale_block}

# ── Start service ────────────────────────────────────────────────────────────
log "Starting gizzi-code.service..."
$SUDO systemctl daemon-reload
$SUDO systemctl enable gizzi-code.service >/dev/null 2>&1 || true
$SUDO systemctl restart gizzi-code.service

sleep 3
$SUDO systemctl is-active --quiet gizzi-code.service || error "gizzi-code.service failed to start"

# Mesh-only by design: no firewall ports are opened here.

echo "STATUS=SUCCESS"
echo "MESH_IP=$MESH_IP"
echo "MESSAGE=gizzi-code bootstrap complete"
"#,
        x64_sha256 = config.x64_sha256,
        arm64_sha256 = config.arm64_sha256.clone().unwrap_or_default(),
        arm64_env = GIZZI_LINUX_ARM64_SHA256_ENV,
        artifact_url = config.artifact_url("${ARTIFACT_ARCH}"),
        release = config.release,
        instance_name = config.instance_name,
        exec_start = exec_start,
        tailscale_block = tailscale_block,
    );

    Ok(script)
}

/// Parse a `KEY=value` marker line out of bootstrap stdout.
pub fn parse_marker<'a>(stdout: &'a str, key: &str) -> Option<&'a str> {
    stdout
        .lines()
        .filter_map(|line| line.trim().split_once('='))
        .find(|(k, _)| *k == key)
        .map(|(_, v)| v.trim())
        .filter(|v| !v.is_empty())
}

/// Run the full bootstrap over SSH: upload env file (0600) + script, execute,
/// parse result markers. Returns the mesh IPv4 on success.
pub async fn run_bootstrap(config: &BootstrapConfig) -> Result<BootstrapResult, BootstrapError> {
    let script = generate_bootstrap_script(config)?;
    let env_file = generate_env_file(config);

    let conn = match &config.auth {
        SshAuth::PrivateKey(key) => {
            SshConnection::connect(&config.host, config.port, &config.username, key).await
        }
        SshAuth::Password(password) => {
            SshConnection::connect_password(&config.host, config.port, &config.username, password)
                .await
        }
    }
    .map_err(BootstrapError::ssh)?;

    // Env file first (0600 — carries the mesh preauth key), then the script.
    conn.upload_file_with_mode("/tmp/gizzi-code.env", env_file.as_bytes(), 0o600)
        .await
        .map_err(BootstrapError::ssh)?;
    conn.upload_file("bootstrap.sh", "/tmp/gizzi-bootstrap.sh", script.as_bytes())
        .await
        .map_err(BootstrapError::ssh)?;

    let output = conn
        .execute("bash /tmp/gizzi-bootstrap.sh")
        .await
        .map_err(BootstrapError::ssh)?;

    // Best-effort cleanup of the temp script (the env file was moved into
    // /etc/gizzi by the script itself).
    let _ = conn.execute("rm -f /tmp/gizzi-bootstrap.sh /tmp/gizzi-code.env").await;

    let log_output = output.stdout.clone();
    if output.exit_code != 0 {
        return Err(BootstrapError {
            code: "BOOTSTRAP_FAILED".to_string(),
            message: format!(
                "bootstrap script exited {}: {}",
                output.exit_code,
                tail(&output.stderr, 500)
            ),
            recoverable: true,
        });
    }

    let status = parse_marker(&output.stdout, "STATUS").unwrap_or("");
    if status != "SUCCESS" {
        return Err(BootstrapError {
            code: "BOOTSTRAP_FAILED".to_string(),
            message: format!(
                "bootstrap did not report success: {}",
                tail(&output.stdout, 500)
            ),
            recoverable: true,
        });
    }

    let mesh_ip = parse_marker(&output.stdout, "MESH_IP").map(str::to_string);
    if config.mesh.is_some() && mesh_ip.is_none() {
        return Err(BootstrapError::failed(
            "bootstrap succeeded but reported no mesh IPv4",
        ));
    }

    Ok(BootstrapResult {
        success: true,
        status: "SUCCESS".to_string(),
        message: parse_marker(&output.stdout, "MESSAGE")
            .unwrap_or("bootstrap complete")
            .to_string(),
        log_output,
        mesh_ip,
    })
}

/// Last `n` chars of a string, for error messages.
fn tail(value: &str, n: usize) -> &str {
    if value.len() <= n {
        value
    } else {
        &value[value.len() - n..]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config(mesh: bool) -> BootstrapConfig {
        BootstrapConfig {
            host: "203.0.113.10".to_string(),
            port: 22,
            username: "root".to_string(),
            auth: SshAuth::PrivateKey("key".to_string()),
            instance_name: "byo-vps-1".to_string(),
            mesh: mesh.then(|| MeshBootstrap {
                auth_key: "hskey-auth-abc".to_string(),
                control_url: DEFAULT_MESH_CONTROL_URL.to_string(),
            }),
            release: GIZZI_RELEASE.to_string(),
            x64_sha256: GIZZI_LINUX_X64_SHA256.to_string(),
            arm64_sha256: Some("deadbeef".to_string()),
        }
    }

    #[test]
    fn script_pins_hosted_release_and_checksum() {
        let script = generate_bootstrap_script(&test_config(true)).unwrap();
        assert!(script.contains(GIZZI_RELEASE));
        assert!(script.contains(GIZZI_LINUX_X64_SHA256));
        assert!(script.contains(&format!(
            "{}/{}/gizzi-code-v{}-linux-${{ARTIFACT_ARCH}}.tar.gz",
            GIZZI_DOWNLOAD_BASE, GIZZI_RELEASE, GIZZI_VERSION
        )));
        // Tarballs need extraction + a release marker for idempotency.
        assert!(script.contains("tar -xzf /tmp/gizzi-code.tar.gz"));
        assert!(script.contains("/opt/gizzi/RELEASE"));
    }

    #[test]
    fn script_installs_mesh_node_sidecar_when_present_in_tarball() {
        let script = generate_bootstrap_script(&test_config(true)).unwrap();
        // Conditional on the file existing so older tarballs (gizzi-code
        // only) still bootstrap cleanly.
        assert!(script.contains("if [ -f /tmp/gizzi-extract/mesh-node ]; then"));
        assert!(script.contains("$SUDO mv /tmp/gizzi-extract/mesh-node /opt/gizzi/bin/mesh-node"));
        assert!(script.contains("$SUDO chmod 0755 /opt/gizzi/bin/mesh-node"));
        // mesh.ts discovers the sidecar as an execDir sibling of gizzi-code.
        assert!(script.contains("/opt/gizzi/bin/gizzi-code"));
    }

    #[test]
    fn script_contains_no_secrets_and_mesh_flags() {
        let config = test_config(true);
        let script = generate_bootstrap_script(&config).unwrap();
        assert!(
            !script.contains("hskey-auth-abc"),
            "mesh key must only live in the env file"
        );
        assert!(script.contains("--auth-key \"$GIZZI_MESH_AUTH_KEY\""));
        assert!(script.contains("--login-server \"$GIZZI_MESH_CONTROL_URL\""));
        assert!(script.contains(&format!(
            "serve --mesh --hostname 0.0.0.0 --port {}",
            GIZZI_PORT
        )));
        assert!(script.contains("GIZZI_REQUIRE_CLERK_AUTH") == false,
            "env values belong in the env file, not the script");
    }

    #[test]
    fn env_file_carries_mesh_key_and_clerk_auth() {
        let env = generate_env_file(&test_config(true));
        assert!(env.contains("GIZZI_REQUIRE_CLERK_AUTH=true"));
        assert!(env.contains("GIZZI_MESH_AUTH_KEY=hskey-auth-abc"));
        assert!(env.contains(&format!("GIZZI_MESH_CONTROL_URL={}", DEFAULT_MESH_CONTROL_URL)));
    }

    #[test]
    fn arm64_without_checksum_fails_on_box_not_locally() {
        let mut config = test_config(true);
        config.arm64_sha256 = None;
        let script = generate_bootstrap_script(&config).unwrap();
        // The generated script must hard-fail on arm64 when no checksum is pinned.
        assert!(script.contains("no pinned checksum for linux-$ARTIFACT_ARCH"));
        assert!(script.contains(GIZZI_LINUX_ARM64_SHA256_ENV));
    }

    #[test]
    fn mesh_disabled_omits_tailscale() {
        let config = test_config(false);
        let script = generate_bootstrap_script(&config).unwrap();
        assert!(!script.contains("tailscale up"));
        assert!(script.contains(&format!(
            "serve --hostname 0.0.0.0 --port {}",
            GIZZI_PORT
        )));
        let env = generate_env_file(&config);
        assert!(!env.contains("GIZZI_MESH_AUTH_KEY"));
    }

    #[test]
    fn script_is_bash_syntax_valid() {
        // If bash is available, syntax-check the generated scripts.
        if std::process::Command::new("bash")
            .arg("-n")
            .arg("/dev/null")
            .output()
            .is_err()
        {
            return;
        }
        for mesh in [true, false] {
            let script = generate_bootstrap_script(&test_config(mesh)).unwrap();
            let mut child = std::process::Command::new("bash")
                .arg("-n")
                .stdin(std::process::Stdio::piped())
                .spawn()
                .unwrap();
            use std::io::Write;
            child
                .stdin
                .as_mut()
                .unwrap()
                .write_all(script.as_bytes())
                .unwrap();
            let status = child.wait().unwrap();
            assert!(status.success(), "bash -n rejected script (mesh={})", mesh);
        }
    }

    #[test]
    fn parse_marker_reads_last_word_of_key_value_lines() {
        let stdout = "log line\nSTATUS=SUCCESS\nMESH_IP=100.64.0.7\nMESSAGE=done\n";
        assert_eq!(parse_marker(stdout, "STATUS"), Some("SUCCESS"));
        assert_eq!(parse_marker(stdout, "MESH_IP"), Some("100.64.0.7"));
        assert_eq!(parse_marker(stdout, "MISSING"), None);
        assert_eq!(parse_marker("MESH_IP=\n", "MESH_IP"), None);
    }

    #[test]
    fn empty_host_or_user_is_rejected() {
        let mut config = test_config(true);
        config.host = String::new();
        assert!(generate_bootstrap_script(&config).is_err());
    }

    #[test]
    fn ssh_auth_failure_is_not_recoverable_but_transport_errors_are() {
        let auth = BootstrapError::ssh(allternit_cloud_ssh::SshError::AuthenticationFailed(
            "permission denied".to_string(),
        ));
        assert!(!auth.recoverable);

        let transport = BootstrapError::ssh(allternit_cloud_ssh::SshError::ConnectionFailed(
            "connection timed out".to_string(),
        ));
        assert!(transport.recoverable);
    }

    #[test]
    fn local_validation_failure_is_not_recoverable() {
        let mut config = test_config(true);
        config.host = String::new();
        let err = generate_bootstrap_script(&config).unwrap_err();
        assert_eq!(err.code, "BOOTSTRAP_INVALID");
        assert!(!err.recoverable);
    }
}
