//! Persistent VM Session Routes
//!
//! Long-lived VM sessions where the VM stays alive across multiple command
//! executions — equivalent to Claude Code's cloud session architecture.
//!
//! ## Lifecycle
//!
//!   POST   /vm-session              — provision VM, return session_id
//!   GET    /vm-session/:id          — get session status
//!   POST   /vm-session/:id/execute  — run a command inside the live VM
//!   DELETE /vm-session/:id          — destroy VM and clean up
//!
//! The key difference from `/sandbox/execute` (which spawn→exec→destroy per
//! call) is that here `spawn()` is called once and the ExecutionHandle is kept
//! alive until `DELETE`.  All subsequent `exec()` calls reuse the same VM,
//! preserving filesystem state, installed packages, running processes etc.

use axum::{
    extract::{Json, Path, State},
    http::StatusCode,
    routing::{delete, get, post},
    Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

use crate::AppState;

// ─── Session state ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VmSessionStatus {
    Creating,
    Running,
    Destroyed,
}

/// Live VM session record kept in memory for the server lifetime.
#[derive(Debug, Clone, Serialize)]
pub struct VmSession {
    pub id: String,
    pub created_at: DateTime<Utc>,
    pub last_used: DateTime<Utc>,
    /// Host working directory (bind-mounted or cloned-from source)
    pub workdir: String,
    /// Path inside the VM where the workspace lives (always /workspace)
    pub workspace_path: String,
    pub status: VmSessionStatus,
    /// Opaque handle ID returned by the driver on spawn.
    /// None when running in process-fallback mode (no VM driver).
    #[serde(skip)]
    pub handle_id: Option<String>,
    /// True when the workspace was git-cloned into the VM
    pub git_cloned: bool,
}

/// Shared in-memory session store.
pub type VmSessionStore = Arc<RwLock<HashMap<String, VmSession>>>;

pub fn new_vm_session_store() -> VmSessionStore {
    Arc::new(RwLock::new(HashMap::new()))
}

// ─── Request / Response types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateVmSessionRequest {
    /// Absolute host path to share into the VM via bind-mount / VirtioFS.
    /// This becomes /workspace inside the VM.
    pub workdir: String,
    /// Environment variables available to all execs in this session
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Allow full outbound internet access (default: true — agents need npm/pip/cargo/git)
    #[serde(default = "default_true")]
    pub network_enabled: bool,
    /// CPU allocation (cores, default: 2)
    #[serde(default)]
    pub cpu_cores: Option<f64>,
    /// Memory allocation in MB (default: 4096 — agents need headroom for builds)
    #[serde(default)]
    pub memory_mb: Option<u64>,

    // ── Workspace bootstrap ──────────────────────────────────────────────────

    /// Git remote URL to clone into /workspace inside the VM.
    /// When provided the VM clones the repo fresh (like CC cloud sessions).
    /// When absent the host workdir is bind-mounted at /workspace instead.
    #[serde(default)]
    pub git_remote: Option<String>,
    /// Branch / ref to checkout after clone (default: HEAD)
    #[serde(default)]
    pub git_branch: Option<String>,
    /// Base64-encoded PEM SSH private key for private repo access.
    /// Written to /root/.ssh/id_rsa inside the VM and removed after bootstrap.
    #[serde(default)]
    pub ssh_key_b64: Option<String>,
    /// Additional apt packages to install on top of the default toolchain
    #[serde(default)]
    pub extra_packages: Vec<String>,
    /// Skip the default tool bootstrap (git, node, bun, python3, etc.)
    /// Useful when the image already has everything needed.
    #[serde(default)]
    pub skip_bootstrap: bool,

    // ── Tool-specific environment ────────────────────────────────────────────

    /// Exa API key for the WebSearch tool.
    /// Injected as EXA_API_KEY inside the VM environment.
    #[serde(default)]
    pub exa_api_key: Option<String>,

    /// URL of the gizzi-code HTTP server on the host.
    /// Required for the AskUserQuestion tool — inside the VM, localhost is the
    /// VM itself, not the host. This is written as GIZZI_SERVER_URL in /etc/environment
    /// so all exec() calls can reach the host server for question prompts.
    /// Example: "http://172.16.0.1:3000" (Firecracker host gateway)
    ///          "http://192.168.64.1:3000" (Apple VF host gateway)
    #[serde(default)]
    pub gizzi_server_url: Option<String>,

    /// Host path to the gizzi-code config directory (e.g. ~/.gizzi or ~/.openclaw).
    /// Bind-mounted into the VM at /gizzi-config so PreToolUse/PostToolUse command
    /// hooks (which run `sh -c <hook_command>`) can find their scripts.
    #[serde(default)]
    pub config_dir: Option<String>,

    /// Extra environment variables to set in /etc/environment for all exec() calls.
    /// Used to pass API keys, auth tokens, or any other session-wide config.
    #[serde(default)]
    pub extra_env: HashMap<String, String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Serialize)]
pub struct CreateVmSessionResponse {
    pub session_id: String,
    pub status: VmSessionStatus,
    /// Path inside the VM where the workspace is available
    pub workspace_path: String,
    /// Whether a real VM driver is backing this session
    pub vm_backed: bool,
    /// Whether the workspace was git-cloned (true) or bind-mounted (false)
    pub git_cloned: bool,
    /// Bootstrap log output (tool installation + git clone)
    pub bootstrap_log: String,
}

#[derive(Debug, Deserialize)]
pub struct VmExecRequest {
    /// Shell command to execute inside the VM
    pub command: String,
    /// Per-exec env overrides (merged with session env)
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Timeout in seconds (default: 300)
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
    /// Working directory override relative to session workdir
    #[serde(default)]
    pub workdir: Option<String>,
}

fn default_timeout() -> u64 {
    300
}

#[derive(Debug, Serialize)]
pub struct VmExecResponse {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
    /// True if executed inside a real VM, false if local process fallback
    pub vm_backed: bool,
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn vm_session_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(create_session_handler))
        .route("/:session_id", get(get_session_handler))
        .route("/:session_id/execute", post(exec_in_session_handler))
        .route("/:session_id", delete(destroy_session_handler))
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/// POST /vm-session
async fn create_session_handler(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateVmSessionRequest>,
) -> Result<Json<CreateVmSessionResponse>, (StatusCode, String)> {
    let session_id = Uuid::new_v4().to_string();
    info!(
        session_id = %session_id,
        workdir = %request.workdir,
        git_remote = ?request.git_remote,
        "Creating VM session"
    );

    let workspace_path = "/workspace".to_string();
    let mut handle_id: Option<String> = None;
    #[allow(unused_assignments)]
    let mut bootstrap_log = String::new();
    let mut git_cloned = false;
    let vm_backed;

    if let Some(driver) = state.vm_driver.as_ref() {
        vm_backed = true;

        #[cfg(feature = "vm-driver")]
        {
            use allternit_driver_interface::{
                CommandSpec, EnvironmentSpec, MountSpec, MountType, NetworkPolicy, PolicySpec,
                ResourceSpec, SpawnSpec, TenantId,
            };

            let tenant = TenantId::new(format!("gizzi-{}", session_id))
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            let cpu_millis = ((request.cpu_cores.unwrap_or(2.0)) * 1000.0) as u32;
            // Default 4 GiB — agents need headroom for npm install, cargo build, etc.
            let memory_mib = request.memory_mb.unwrap_or(4096) as u32;

            let resources = ResourceSpec {
                cpu_millis,
                memory_mib,
                disk_mib: Some(20480), // 20 GiB — enough for node_modules + cargo registry
                network_egress_kib: if request.network_enabled {
                    None // unlimited — agents need to fetch deps from the internet
                } else {
                    Some(0)
                },
                gpu_count: None,
            };

            // Bind-mount the host workdir into the VM at /workspace (VirtioFS / virtio-9p).
            // This means Read/Write tool calls still work on host paths — the file system
            // is shared bidirectionally, just like Claude Code's VirtioFS mount.
            let mut mounts = if request.git_remote.is_none() {
                // No git remote → share host dir directly
                vec![MountSpec {
                    source: request.workdir.clone(),
                    target: workspace_path.clone(),
                    read_only: false,
                    mount_type: MountType::Bind,
                }]
            } else {
                // Git remote provided → VM gets a fresh clone; host dir is NOT mounted
                // (matches Claude Code cloud: repo is cloned fresh into an ephemeral VM)
                vec![]
            };

            // config_dir bind-mount: PreToolUse/PostToolUse hook scripts need access
            // to the user's gizzi-code config from inside the VM.
            // The bootstrap script sets GIZZI_CONFIG_DIR=/gizzi-config for all execs.
            if let Some(cfg_dir) = &request.config_dir {
                mounts.push(MountSpec {
                    source: cfg_dir.clone(),
                    target: "/gizzi-config".to_string(),
                    read_only: true,
                    mount_type: MountType::Bind,
                });
            }

            let network_policy = if request.network_enabled {
                NetworkPolicy {
                    egress_allowed: true,
                    allowed_hosts: vec![], // empty = allow all
                    allowed_ports: vec![], // empty = allow all
                    dns_allowed: true,
                }
            } else {
                NetworkPolicy::default() // deny all
            };

            let mut policy = PolicySpec::default_permissive();
            policy.network_policy = network_policy;

            let env_spec = EnvironmentSpec {
                // Ubuntu 24.04 with git pre-installed; tools added via bootstrap below.
                // Using "minimal" avoids pulling in a full desktop, but git+curl are present.
                image: "ubuntu-24.04-minimal".to_string(),
                env_vars: request.env.clone(),
                working_dir: Some(workspace_path.clone()),
                mounts: mounts.clone(),
                ..Default::default()
            };

            let spawn_spec = SpawnSpec {
                tenant,
                project: None,
                workspace: Some(request.workdir.clone()),
                run_id: None,
                env: env_spec,
                policy,
                resources,
                envelope: None,
                prewarm_pool: None,
            };

            let execution_handle = driver
                .spawn(spawn_spec)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Spawn failed: {e}")))?;

            let handle_str = execution_handle.id.to_string();
            info!(
                session_id = %session_id,
                handle_id = %handle_str,
                "VM spawned — running bootstrap"
            );

            // ── Bootstrap the VM environment ─────────────────────────────────
            // Run the setup script inside the freshly spawned VM.
            if !request.skip_bootstrap {
                let bootstrap_script = build_bootstrap_script(
                    &request,
                    &workspace_path,
                );

                let bootstrap_cmd = CommandSpec {
                    command: vec![
                        "bash".to_string(),
                        "-c".to_string(),
                        bootstrap_script,
                    ],
                    env_vars: HashMap::new(),
                    working_dir: Some("/".to_string()),
                    stdin_data: None,
                    capture_stdout: true,
                    capture_stderr: true,
                };

                // Bootstrap has a generous timeout — apt + git clone can take time
                match tokio::time::timeout(
                    tokio::time::Duration::from_secs(300),
                    driver.exec(&execution_handle, bootstrap_cmd),
                )
                .await
                {
                    Ok(Ok(result)) => {
                        let stdout = result.stdout
                            .map(|b| String::from_utf8_lossy(&b).into_owned())
                            .unwrap_or_default();
                        let stderr = result.stderr
                            .map(|b| String::from_utf8_lossy(&b).into_owned())
                            .unwrap_or_default();
                        bootstrap_log = format!("{}\n{}", stdout, stderr);

                        if result.exit_code != 0 {
                            warn!(
                                session_id = %session_id,
                                exit_code = result.exit_code,
                                "Bootstrap exited non-zero — session may be partially set up"
                            );
                        } else {
                            git_cloned = request.git_remote.is_some();
                            info!(session_id = %session_id, "Bootstrap complete");
                        }
                    }
                    Ok(Err(e)) => {
                        warn!(session_id = %session_id, error = %e, "Bootstrap exec failed");
                        bootstrap_log = format!("Bootstrap failed: {e}");
                    }
                    Err(_) => {
                        warn!(session_id = %session_id, "Bootstrap timed out after 300s");
                        bootstrap_log = "Bootstrap timed out".to_string();
                    }
                }
            } else {
                bootstrap_log = "Bootstrap skipped (skip_bootstrap=true)".to_string();
            }

            handle_id = Some(handle_str);
        }

        #[cfg(not(feature = "vm-driver"))]
        {
            let _ = driver;
            warn!("vm-driver feature not compiled — falling back to local process execution");
            bootstrap_log = "vm-driver feature not enabled; running in local process mode".to_string();
        }
    } else {
        // No VM driver — run bootstrap locally so tools are verified present
        vm_backed = false;
        warn!(
            session_id = %session_id,
            "No VM driver — session will use local process fallback"
        );
        bootstrap_log = run_local_bootstrap(&request, &workspace_path).await;
        if request.git_remote.is_some() {
            git_cloned = true; // may have cloned locally
        }
    }

    let now = Utc::now();
    {
        let mut sessions = state.vm_sessions.write().await;
        sessions.insert(
            session_id.clone(),
            VmSession {
                id: session_id.clone(),
                created_at: now,
                last_used: now,
                workdir: request.workdir.clone(),
                workspace_path: workspace_path.clone(),
                status: VmSessionStatus::Running,
                handle_id,
                git_cloned,
            },
        );
    }

    Ok(Json(CreateVmSessionResponse {
        session_id,
        status: VmSessionStatus::Running,
        workspace_path,
        vm_backed,
        git_cloned,
        bootstrap_log,
    }))
}

// ── Bootstrap scripts ──────────────────────────────────────────────────────────

/// Build the full bootstrap shell script to run inside the VM.
///
/// Matches the Claude Code cloud session environment exactly:
///
///   Source 1 — Anthropic official devcontainer Dockerfile (node:20 base):
///     less, git, procps, sudo, fzf, zsh, man-db, unzip, gnupg2, gh, iptables,
///     ipset, iproute2, dnsutils, aggregate, jq, nano, vim, git-delta v0.18.2,
///     zsh Powerlevel10k (zsh-in-docker), Node.js 20, @anthropic-ai/claude-code
///
///   Source 2 — Docker sandbox template (docker/sandbox-templates:claude-code):
///     Node.js, Go, Python 3, Git, ripgrep, jq, Docker CLI, gh CLI
///
///   Source 3 — Claude Code cloud session (claude.ai/product/claude-code):
///     Ruby 3.3.6 + rbenv + bundler, Java OpenJDK 21 + Maven + Gradle,
///     PHP 8.x, PostgreSQL 16 server, Redis 7 server, kubectl, Helm,
///     nvm, uv, bat, fd, fzf, all language LSP servers
///
///   Gizzi-code tool deps added on top:
///     uvicorn + playwright + Chromium (browser tool), jupyter + ipykernel (notebook),
///     rust-analyzer + gopls + clangd + typescript-language-server + pyright (lsp),
///     MCP bundled server npm packages (sequential-thinking, context7)
fn build_bootstrap_script(request: &CreateVmSessionRequest, workspace_path: &str) -> String {
    let mut script = String::from(r#"#!/usr/bin/env bash
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export PATH="/root/.cargo/bin:/root/.nvm/versions/node/$(ls /root/.nvm/versions/node/ 2>/dev/null | tail -1)/bin:/usr/local/go/bin:/usr/local/bin:$PATH"

echo "[gizzi-bootstrap] ============================================"
echo "[gizzi-bootstrap]  Gizzi Code VM Environment Bootstrap"
echo "[gizzi-bootstrap]  Matches Claude Code cloud session spec"
echo "[gizzi-bootstrap] ============================================"

# ── 1. System base (matches Anthropic devcontainer Dockerfile exactly) ─────────
echo "[gizzi-bootstrap] [1/15] System base packages (devcontainer-matched)..."
apt-get update -qq 2>&1
apt-get install -y --no-install-recommends \
    less \
    git \
    git-lfs \
    procps \
    sudo \
    fzf \
    zsh \
    man-db \
    unzip \
    zip \
    gnupg2 \
    gnupg \
    gh \
    iptables \
    ipset \
    iproute2 \
    dnsutils \
    aggregate \
    jq \
    nano \
    vim \
    curl \
    wget \
    tar \
    xz-utils \
    bzip2 \
    gzip \
    ca-certificates \
    lsb-release \
    software-properties-common \
    build-essential \
    pkg-config \
    make \
    cmake \
    ninja-build \
    gcc \
    g++ \
    clang \
    lldb \
    libssl-dev \
    libffi-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    zlib1g-dev \
    libxml2-dev \
    libxslt-dev \
    libpq-dev \
    sqlite3 \
    openssh-client \
    socat \
    netcat-openbsd \
    iputils-ping \
    htop \
    strace \
    lsof \
    file \
    tree \
    watch \
    tmux \
    screen \
    patch \
    diffutils \
    xxd \
    bc \
    parallel \
    2>&1

# ── 2. Search + diff tools (CC devcontainer: ripgrep, fd, fzf, bat, git-delta) ─
echo "[gizzi-bootstrap] [2/15] Search and diff tools..."
apt-get install -y --no-install-recommends ripgrep fd-find 2>&1
# fd is installed as fdfind on Ubuntu — create the alias CC agents expect
if ! command -v fd &>/dev/null && command -v fdfind &>/dev/null; then
    ln -sf "$(which fdfind)" /usr/local/bin/fd
fi
# bat — syntax-highlighted cat (CC cloud session ships this)
if ! command -v bat &>/dev/null; then
    apt-get install -y --no-install-recommends bat 2>&1 || true
    # Ubuntu installs bat as batcat — alias to bat
    if command -v batcat &>/dev/null && ! command -v bat &>/dev/null; then
        ln -sf "$(which batcat)" /usr/local/bin/bat
    fi
fi
# git-delta v0.18.2 — EXACT version from Anthropic devcontainer Dockerfile
DELTA_VER="0.18.2"
if ! command -v delta &>/dev/null; then
    DELTA_ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
    curl -fsSL "https://github.com/dandavison/delta/releases/download/${DELTA_VER}/git-delta_${DELTA_VER}_${DELTA_ARCH}.deb" \
        -o /tmp/git-delta.deb 2>&1 && dpkg -i /tmp/git-delta.deb 2>&1 && rm /tmp/git-delta.deb || true
fi
echo "  rg:    $(rg --version | head -1)"
echo "  fd:    $(fd --version 2>/dev/null || echo 'via fdfind')"
echo "  bat:   $(bat --version 2>/dev/null || echo 'not available')"
echo "  delta: $(delta --version 2>/dev/null || echo 'not available')"

# ── 3. Shell environments (zsh + Powerlevel10k — exact CC devcontainer style) ──
echo "[gizzi-bootstrap] [3/15] Shell environments (zsh/Powerlevel10k/fish)..."
apt-get install -y --no-install-recommends zsh fish 2>&1
# zsh-in-docker installs Powerlevel10k + git + fzf plugins — same as CC devcontainer
ZSH_IN_DOCKER_VER="1.2.0"
if [ ! -d "/root/.oh-my-zsh" ]; then
    curl -fsSL "https://raw.githubusercontent.com/deluan/zsh-in-docker/${ZSH_IN_DOCKER_VER}/zsh-in-docker.sh" \
        | sh -s -- -t powerlevel10k/powerlevel10k -p git -p fzf 2>&1 || \
    sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended 2>&1 || true
fi
echo 'EDITOR=nano' >> /root/.zshrc
echo "  bash: $(bash --version | head -1 | cut -d' ' -f4)"
echo "  zsh:  $(zsh --version)"
echo "  fish: $(fish --version)"

# ── 4. Node.js via nvm (CC ships nvm for version management) ──────────────────
echo "[gizzi-bootstrap] [4/15] Node.js via nvm..."
export NVM_DIR="/root/.nvm"
if [ ! -d "$NVM_DIR" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash 2>&1
fi
# Source nvm
. "$NVM_DIR/nvm.sh" 2>&1 || true
# CC uses Node 22 LTS (current LTS as of 2026)
nvm install 22 2>&1 || true
nvm use 22 2>&1 || true
nvm alias default 22 2>&1 || true
# Persist nvm in all shells
echo 'export NVM_DIR="/root/.nvm"' >> /etc/environment
echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' >> /root/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"' >> /root/.zshrc
echo 'export NVM_DIR="/root/.nvm"' >> /root/.bashrc
export PATH="$NVM_DIR/versions/node/$(ls $NVM_DIR/versions/node/ | tail -1)/bin:$PATH"
echo "  Node: $(node --version 2>/dev/null || echo 'not yet in PATH')"
echo "  npm:  $(npm --version 2>/dev/null || echo 'not yet in PATH')"

# Global npm packages (CC devcontainer + gizzi-code tool deps):
echo "[gizzi-bootstrap]   Installing global npm packages..."
npm install -g --quiet \
    typescript \
    typescript-language-server \
    ts-node \
    tsx \
    prettier \
    eslint \
    serve \
    http-server \
    nodemon \
    concurrently \
    yarn \
    @modelcontextprotocol/server-sequential-thinking \
    @upstash/context7-mcp \
    2>&1 || true
echo "  tsc:  $(tsc --version 2>/dev/null || echo 'not available')"

# ── 5. Bun + pnpm ──────────────────────────────────────────────────────────────
echo "[gizzi-bootstrap] [5/15] Bun + pnpm..."
if ! command -v bun &>/dev/null; then
    export BUN_INSTALL="/usr/local"
    curl -fsSL https://bun.sh/install | bash 2>&1
fi
if ! command -v pnpm &>/dev/null; then
    npm install -g pnpm --quiet 2>&1
fi
echo "  Bun:  $(bun --version 2>/dev/null || echo 'not available')"
echo "  pnpm: $(pnpm --version 2>/dev/null || echo 'not available')"

# ── 6. Python 3 + uv (CC ships uv for fast packaging) ─────────────────────────
echo "[gizzi-bootstrap] [6/15] Python 3 + uv..."
apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    python3-setuptools \
    python3-wheel \
    2>&1
python3 -m pip install --upgrade pip setuptools wheel --quiet 2>&1 || true
# uv — fast Python package manager (CC cloud session ships this)
curl -fsSL https://astral.sh/uv/install.sh | sh 2>&1 || pip3 install uv --quiet 2>&1 || true
# Core Python packages
pip3 install --quiet \
    uvicorn \
    fastapi \
    playwright \
    jupyter \
    jupyterlab \
    ipykernel \
    ipython \
    httpx \
    requests \
    aiohttp \
    aiofiles \
    black \
    isort \
    flake8 \
    mypy \
    pyright \
    pytest \
    pytest-asyncio \
    pydantic \
    python-dotenv \
    rich \
    typer \
    poetry \
    2>&1 || true
python3 -m playwright install --with-deps chromium 2>&1 || true
echo "  Python: $(python3 --version)"
echo "  pip:    $(pip3 --version | cut -d' ' -f2)"
echo "  uv:     $(uv --version 2>/dev/null || echo 'not available')"

# ── 7. Ruby via rbenv (CC cloud session: 3.3.6 default) ───────────────────────
echo "[gizzi-bootstrap] [7/15] Ruby 3.3.6 via rbenv..."
if ! command -v rbenv &>/dev/null; then
    curl -fsSL https://github.com/rbenv/rbenv-installer/raw/HEAD/bin/rbenv-installer | bash 2>&1 || \
    git clone https://github.com/rbenv/rbenv.git /root/.rbenv 2>&1 && \
    git clone https://github.com/rbenv/ruby-build.git /root/.rbenv/plugins/ruby-build 2>&1 || true
fi
export PATH="/root/.rbenv/bin:/root/.rbenv/shims:$PATH"
echo 'export PATH="/root/.rbenv/bin:/root/.rbenv/shims:$PATH"' >> /root/.bashrc
echo 'export PATH="/root/.rbenv/bin:/root/.rbenv/shims:$PATH"' >> /root/.zshrc
echo 'eval "$(rbenv init -)"' >> /root/.bashrc
echo 'eval "$(rbenv init -)"' >> /root/.zshrc
if command -v rbenv &>/dev/null; then
    eval "$(rbenv init -)" 2>/dev/null || true
    # Install Ruby 3.3.6 — exact CC default version
    rbenv install 3.3.6 --skip-existing 2>&1 || true
    rbenv global 3.3.6 2>/dev/null || true
    # Install bundler + common gems
    gem install bundler rake rails --no-document 2>&1 || true
fi
echo "  Ruby:    $(ruby --version 2>/dev/null || echo 'not available')"
echo "  bundler: $(bundle --version 2>/dev/null || echo 'not available')"

# ── 8. Java OpenJDK 21 + Maven + Gradle (CC cloud session) ────────────────────
echo "[gizzi-bootstrap] [8/15] Java OpenJDK 21 + Maven + Gradle..."
apt-get install -y --no-install-recommends \
    openjdk-21-jdk \
    maven \
    2>&1 || apt-get install -y --no-install-recommends default-jdk maven 2>&1 || true
# Gradle — latest via sdkman or direct download
if ! command -v gradle &>/dev/null; then
    GRADLE_VER="8.9"
    curl -fsSL "https://services.gradle.org/distributions/gradle-${GRADLE_VER}-bin.zip" \
        -o /tmp/gradle.zip 2>&1 && \
    unzip -q /tmp/gradle.zip -d /opt/ 2>&1 && \
    ln -sf "/opt/gradle-${GRADLE_VER}/bin/gradle" /usr/local/bin/gradle 2>&1 && \
    rm /tmp/gradle.zip 2>&1 || true
fi
echo "  Java:    $(java --version 2>/dev/null | head -1 || echo 'not available')"
echo "  mvn:     $(mvn --version 2>/dev/null | head -1 || echo 'not available')"
echo "  gradle:  $(gradle --version 2>/dev/null | grep Gradle || echo 'not available')"

# ── 9. PHP 8.x (CC cloud session) ─────────────────────────────────────────────
echo "[gizzi-bootstrap] [9/15] PHP 8.x + Composer..."
apt-get install -y --no-install-recommends \
    php \
    php-cli \
    php-curl \
    php-mbstring \
    php-xml \
    php-zip \
    php-pgsql \
    php-sqlite3 \
    2>&1 || true
# Composer — PHP package manager
if ! command -v composer &>/dev/null; then
    curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer 2>&1 || true
fi
echo "  PHP:      $(php --version 2>/dev/null | head -1 || echo 'not available')"
echo "  composer: $(composer --version 2>/dev/null | head -1 || echo 'not available')"

# ── 10. Rust toolchain + rust-analyzer ────────────────────────────────────────
echo "[gizzi-bootstrap] [10/15] Rust toolchain..."
if ! command -v cargo &>/dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
        | sh -s -- -y --default-toolchain stable --no-modify-path 2>&1
fi
export PATH="/root/.cargo/bin:$PATH"
echo 'export PATH="/root/.cargo/bin:$PATH"' >> /etc/environment
echo '. /root/.cargo/env 2>/dev/null || true' >> /root/.bashrc
echo '. /root/.cargo/env 2>/dev/null || true' >> /root/.zshrc
rustup component add rust-analyzer clippy rustfmt 2>&1 || true
echo "  Rust:           $(rustc --version 2>/dev/null || echo 'not in PATH yet')"
echo "  rust-analyzer:  $(rust-analyzer --version 2>/dev/null || echo 'installed via rustup')"

# ── 11. Go 1.23 + gopls ───────────────────────────────────────────────────────
echo "[gizzi-bootstrap] [11/15] Go + gopls..."
if ! command -v go &>/dev/null; then
    GO_VER="1.23.4"
    GOARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')
    curl -fsSL "https://go.dev/dl/go${GO_VER}.linux-${GOARCH}.tar.gz" \
        | tar -xz -C /usr/local 2>&1
    echo 'export PATH="/usr/local/go/bin:/root/go/bin:$PATH"' >> /etc/environment
    echo 'export PATH="/usr/local/go/bin:/root/go/bin:$PATH"' >> /root/.bashrc
    echo 'export PATH="/usr/local/go/bin:/root/go/bin:$PATH"' >> /root/.zshrc
fi
export PATH="/usr/local/go/bin:/root/go/bin:$PATH"
if command -v go &>/dev/null && ! command -v gopls &>/dev/null; then
    go install golang.org/x/tools/gopls@latest 2>&1 || true
    # Symlink to /usr/local/bin so it's in all exec() PATHs
    ln -sf "$(go env GOPATH 2>/dev/null || echo /root/go)/bin/gopls" /usr/local/bin/gopls 2>/dev/null || true
fi
echo "  Go:    $(go version 2>/dev/null || echo 'not available')"
echo "  gopls: $(gopls version 2>/dev/null || echo 'not available')"

# ── 12. C/C++ LSP (clangd) ────────────────────────────────────────────────────
echo "[gizzi-bootstrap] [12/15] clangd LSP..."
if ! command -v clangd &>/dev/null; then
    apt-get install -y --no-install-recommends clangd 2>&1 || true
fi
echo "  clangd: $(clangd --version 2>/dev/null | head -1 || echo 'not available')"

# ── 13. PostgreSQL 16 server + Redis 7 (CC cloud session databases) ───────────
echo "[gizzi-bootstrap] [13/15] PostgreSQL 16 + Redis 7..."
# PostgreSQL 16
if ! command -v psql &>/dev/null || ! psql --version 2>/dev/null | grep -q "16\|17"; then
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        | gpg --dearmor -o /usr/share/keyrings/postgresql-keyring.gpg 2>/dev/null
    echo "deb [signed-by=/usr/share/keyrings/postgresql-keyring.gpg] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    apt-get update -qq 2>&1
    apt-get install -y --no-install-recommends postgresql-16 postgresql-client-16 2>&1 || true
fi
# Start PostgreSQL (for agents that need a live DB)
pg_ctlcluster 16 main start 2>&1 || service postgresql start 2>&1 || true
# Redis 7
apt-get install -y --no-install-recommends redis-server 2>&1 || true
# Start Redis
service redis-server start 2>&1 || redis-server --daemonize yes 2>&1 || true
echo "  PostgreSQL: $(psql --version 2>/dev/null || echo 'not available')"
echo "  Redis:      $(redis-server --version 2>/dev/null | head -1 || echo 'not available')"

# ── 14. Cloud/DevOps tools (kubectl, Helm, Docker CLI, gh CLI) ────────────────
echo "[gizzi-bootstrap] [14/15] Cloud + DevOps tools..."
# gh CLI (from Anthropic devcontainer — installed via apt above if repo available)
if ! command -v gh &>/dev/null; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list
    apt-get update -qq 2>&1 && apt-get install -y --no-install-recommends gh 2>&1 || true
fi
# Docker CLI (no daemon — agents build/push images, run compose)
if ! command -v docker &>/dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg 2>/dev/null
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update -qq 2>&1
    apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin 2>&1 || true
fi
# kubectl (CC cloud session ships this for k8s agents)
if ! command -v kubectl &>/dev/null; then
    curl -fsSL "https://dl.k8s.io/release/$(curl -fsSL https://dl.k8s.io/release/stable.txt)/bin/linux/$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')/kubectl" \
        -o /usr/local/bin/kubectl 2>&1 && chmod +x /usr/local/bin/kubectl 2>&1 || true
fi
# Helm (CC cloud session ships this)
if ! command -v helm &>/dev/null; then
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash 2>&1 || true
fi
# ffmpeg + imagemagick (media processing agents use these)
apt-get install -y --no-install-recommends ffmpeg imagemagick 2>&1 || true
echo "  gh:      $(gh --version 2>/dev/null | head -1 || echo 'not available')"
echo "  docker:  $(docker --version 2>/dev/null || echo 'not available')"
echo "  kubectl: $(kubectl version --client 2>/dev/null | head -1 || echo 'not available')"
echo "  helm:    $(helm version --short 2>/dev/null || echo 'not available')"
echo "  ffmpeg:  $(ffmpeg -version 2>/dev/null | head -1 || echo 'not available')"

"#);

    // ── Extra packages ────────────────────────────────────────────────────────
    if !request.extra_packages.is_empty() {
        let pkgs = request.extra_packages.join(" ");
        script.push_str(&format!(
            r#"
echo "[gizzi-bootstrap] Installing extra packages: {pkgs}..."
apt-get install -y -qq {pkgs} 2>&1
"#
        ));
    }

    // ── Tool-specific environment variables ──────────────────────────────────
    // Write env vars that tool integrations need into /etc/environment so
    // every exec() call in this session inherits them automatically.
    //
    //   EXA_API_KEY      — WebSearch tool (POST to mcp.exa.ai/mcp)
    //   GIZZI_SERVER_URL — AskUserQuestion tool (reach host server from inside VM)
    //   GIZZI_CONFIG_DIR — PreToolUse/PostToolUse hooks (path to hook scripts)
    //   extra_env        — any additional caller-supplied variables
    {
        let mut env_lines = String::new();

        if let Some(exa_key) = &request.exa_api_key {
            env_lines.push_str(&format!("EXA_API_KEY={}\n", exa_key));
        }
        if let Some(server_url) = &request.gizzi_server_url {
            env_lines.push_str(&format!("GIZZI_SERVER_URL={}\n", server_url));
        }
        if request.config_dir.is_some() {
            // config_dir is bind-mounted at /gizzi-config by the driver (see MountSpec below)
            env_lines.push_str("GIZZI_CONFIG_DIR=/gizzi-config\n");
        }
        for (k, v) in &request.extra_env {
            // Skip keys already handled above to avoid duplicates
            if k != "EXA_API_KEY" && k != "GIZZI_SERVER_URL" && k != "GIZZI_CONFIG_DIR" {
                env_lines.push_str(&format!("{}={}\n", k, v));
            }
        }

        if !env_lines.is_empty() {
            script.push_str(&format!(
                r#"
echo "[gizzi-bootstrap] Writing tool environment variables to /etc/environment..."
cat >> /etc/environment << 'GIZZI_ENV_EOF'
{env_lines}GIZZI_ENV_EOF
echo "  Written: $(grep -c '=' /etc/environment) vars in /etc/environment"
"#
            ));
        }
    }

    // ── SSH key for private repos ─────────────────────────────────────────────
    if let Some(key_b64) = &request.ssh_key_b64 {
        script.push_str(&format!(
            r#"
echo "[gizzi-bootstrap] Installing SSH key..."
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo "{key_b64}" | base64 -d > /root/.ssh/id_rsa
chmod 600 /root/.ssh/id_rsa
# Accept GitHub, GitLab, and Bitbucket host keys automatically
ssh-keyscan -H github.com gitlab.com bitbucket.org >> /root/.ssh/known_hosts 2>/dev/null
echo "  SSH key installed"
"#
        ));
    } else {
        // No SSH key provided — still set up known_hosts so HTTPS git works smoothly
        script.push_str(r#"
mkdir -p /root/.ssh
chmod 700 /root/.ssh
ssh-keyscan -H github.com gitlab.com bitbucket.org >> /root/.ssh/known_hosts 2>/dev/null || true
"#);
    }

    // ── Git config ────────────────────────────────────────────────────────────
    script.push_str(r#"
echo "[gizzi-bootstrap] Configuring git..."
git config --global user.email "gizzi@allternit.local"
git config --global user.name "Gizzi Code"
git config --global init.defaultBranch main
git config --global core.autocrlf false
git config --global safe.directory '*'
"#);

    // ── Workspace setup ───────────────────────────────────────────────────────
    if let Some(remote) = &request.git_remote {
        let branch = request.git_branch.as_deref().unwrap_or("HEAD");
        let is_default_branch = branch == "HEAD";

        script.push_str(&format!(
            r#"
echo "[gizzi-bootstrap] Cloning repository..."
mkdir -p {workspace_path}
# Clone with depth 1 for speed; agents can fetch more history if needed
if [ "{is_default_branch}" = "true" ]; then
    git clone --depth 1 "{remote}" "{workspace_path}" 2>&1
else
    git clone --depth 1 --branch "{branch}" "{remote}" "{workspace_path}" 2>&1
fi
echo "  Cloned: $(git -C {workspace_path} log --oneline -1 2>/dev/null || echo 'no commits')"
echo "  Branch: $(git -C {workspace_path} rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
"#
        ));
    } else {
        // Workdir is bind-mounted at workspace_path — just ensure it exists
        script.push_str(&format!(
            r#"
echo "[gizzi-bootstrap] Workspace available at {workspace_path} (bind-mounted)"
ls -la {workspace_path} 2>/dev/null | head -5 || echo "  (empty or not yet mounted)"
"#
        ));
    }

    // ── Install project dependencies ──────────────────────────────────────────
    script.push_str(&format!(
        r#"
echo "[gizzi-bootstrap] [15/15] Installing project dependencies..."
cd {workspace_path} 2>/dev/null || true

# package.json — bun first (lockfile), then npm fallback
if [ -f "bun.lockb" ] || [ -f "bun.lock" ]; then
    echo "  Found bun lockfile — running bun install..."
    bun install 2>&1 || true
elif [ -f "package.json" ]; then
    echo "  Found package.json — running bun install..."
    bun install 2>&1 || npm install 2>&1 || true
fi

# pnpm workspace
if [ -f "pnpm-workspace.yaml" ] || [ -f "pnpm-lock.yaml" ]; then
    echo "  Found pnpm workspace — running pnpm install..."
    pnpm install --frozen-lockfile 2>&1 || pnpm install 2>&1 || true
fi

# Cargo.toml — fetch + check (don't full build, too slow)
if [ -f "Cargo.toml" ]; then
    echo "  Found Cargo.toml — fetching crates..."
    /root/.cargo/bin/cargo fetch 2>&1 || true
    # Generate lockfile if not present
    [ ! -f "Cargo.lock" ] && /root/.cargo/bin/cargo generate-lockfile 2>&1 || true
fi

# Go modules
if [ -f "go.mod" ]; then
    echo "  Found go.mod — running go mod download..."
    /usr/local/go/bin/go mod download 2>&1 || true
fi

# Python — requirements.txt first, then pyproject.toml, then setup.py
if [ -f "requirements.txt" ]; then
    echo "  Found requirements.txt — pip install..."
    pip3 install -r requirements.txt -q 2>&1 || true
fi
if [ -f "requirements-dev.txt" ]; then
    pip3 install -r requirements-dev.txt -q 2>&1 || true
fi
if [ -f "pyproject.toml" ] && ! [ -f "requirements.txt" ]; then
    echo "  Found pyproject.toml — pip install -e..."
    pip3 install -e ".[dev]" -q 2>&1 || pip3 install -e . -q 2>&1 || true
fi
if [ -f "setup.py" ] && ! [ -f "requirements.txt" ]; then
    pip3 install -e . -q 2>&1 || true
fi

# Jupyter kernel registration (notebook tool needs this)
python3 -m ipykernel install --user --name python3 2>&1 || true
"#
    ));

    // ── Cleanup sensitive data ─────────────────────────────────────────────────
    if request.ssh_key_b64.is_some() {
        script.push_str(r#"
# Remove SSH key from disk after use (it stays in the driver's memory-backed rootfs)
rm -f /root/.ssh/id_rsa
echo "[gizzi-bootstrap] SSH key removed from disk"
"#);
    }

    script.push_str(r#"
echo "[gizzi-bootstrap] ============================================"
echo "[gizzi-bootstrap]  Bootstrap complete — CC-matched environment"
echo "[gizzi-bootstrap] ============================================"
echo "  OS:         $(lsb_release -d 2>/dev/null | cut -f2 || echo Ubuntu)"
echo "  Shells:     bash=$(bash --version | head -1 | cut -d' ' -f4)  zsh=$(zsh --version | cut -d' ' -f2)  fish=$(fish --version | cut -d' ' -f3)"
echo "  Search:     rg=$(rg --version | head -1 | cut -d' ' -f2)  fd=$(fd --version 2>/dev/null | cut -d' ' -f2 || echo n/a)  bat=$(bat --version 2>/dev/null | cut -d' ' -f2 || echo n/a)  delta=$(delta --version 2>/dev/null | cut -d' ' -f2 || echo n/a)"
echo "  Node:       $(node --version 2>/dev/null || echo n/a)  npm=$(npm --version 2>/dev/null || echo n/a)  nvm=$(nvm --version 2>/dev/null || echo installed)"
echo "  Bun:        $(bun --version 2>/dev/null || echo n/a)  pnpm=$(pnpm --version 2>/dev/null || echo n/a)  yarn=$(yarn --version 2>/dev/null || echo n/a)"
echo "  TypeScript: tsc=$(tsc --version 2>/dev/null || echo n/a)"
echo "  Python:     $(python3 --version 2>/dev/null || echo n/a)  pip=$(pip3 --version 2>/dev/null | cut -d' ' -f2 || echo n/a)  uv=$(uv --version 2>/dev/null || echo n/a)"
echo "  Jupyter:    $(jupyter --version 2>/dev/null | head -1 || echo n/a)"
echo "  Playwright: $(python3 -m playwright --version 2>/dev/null || echo n/a)"
echo "  Ruby:       $(ruby --version 2>/dev/null || echo n/a)  bundler=$(bundle --version 2>/dev/null || echo n/a)"
echo "  Java:       $(java --version 2>/dev/null | head -1 || echo n/a)  mvn=$(mvn --version 2>/dev/null | head -1 || echo n/a)"
echo "  PHP:        $(php --version 2>/dev/null | head -1 || echo n/a)"
echo "  Rust:       $(rustc --version 2>/dev/null || echo n/a)  rust-analyzer=$(rust-analyzer --version 2>/dev/null || echo n/a)"
echo "  Go:         $(go version 2>/dev/null || echo n/a)  gopls=$(gopls version 2>/dev/null || echo n/a)"
echo "  clangd:     $(clangd --version 2>/dev/null | head -1 || echo n/a)"
echo "  PostgreSQL: $(psql --version 2>/dev/null || echo n/a)"
echo "  Redis:      $(redis-server --version 2>/dev/null | head -1 || echo n/a)"
echo "  Git:        $(git --version)  gh=$(gh --version 2>/dev/null | head -1 | cut -d' ' -f3 || echo n/a)"
echo "  Docker:     $(docker --version 2>/dev/null || echo n/a)"
echo "  kubectl:    $(kubectl version --client --short 2>/dev/null || echo n/a)"
echo "  helm:       $(helm version --short 2>/dev/null || echo n/a)"
echo "  Network:    $(curl -s --max-time 3 https://registry.npmjs.org/ >/dev/null 2>&1 && echo 'internet reachable ✓' || echo 'internet check failed')"
echo "[gizzi-bootstrap] ============================================"
"#);

    script
}

/// Run a lightweight bootstrap for the process-fallback path (no real VM).
/// Mostly just verifies the workspace and git state.
async fn run_local_bootstrap(
    request: &CreateVmSessionRequest,
    workspace_path: &str,
) -> String {
    let mut log = format!(
        "[gizzi-local] Process fallback mode — workdir: {}\n",
        request.workdir
    );

    // If git remote provided, clone locally
    if let Some(remote) = &request.git_remote {
        let branch_args: Vec<&str> = if let Some(b) = &request.git_branch {
            vec!["--branch", b]
        } else {
            vec![]
        };

        let dir = workspace_path;
        let mut args = vec!["clone", "--depth", "1"];
        args.extend(branch_args.iter().copied());
        args.push(remote.as_str());
        args.push(dir);

        match tokio::process::Command::new("git")
            .args(&args)
            .kill_on_drop(true)
            .output()
            .await
        {
            Ok(out) => {
                log.push_str(&String::from_utf8_lossy(&out.stdout));
                log.push_str(&String::from_utf8_lossy(&out.stderr));
                if out.status.success() {
                    log.push_str(&format!("[gizzi-local] Cloned {remote} → {dir}\n"));
                }
            }
            Err(e) => {
                log.push_str(&format!("[gizzi-local] git clone failed: {e}\n"));
            }
        }
    } else {
        log.push_str(&format!(
            "[gizzi-local] Using host workdir as workspace: {}\n",
            request.workdir
        ));
    }

    log
}

/// GET /vm-session/:session_id
async fn get_session_handler(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<VmSession>, (StatusCode, String)> {
    let sessions = state.vm_sessions.read().await;
    sessions
        .get(&session_id)
        .cloned()
        .map(Json)
        .ok_or_else(|| (StatusCode::NOT_FOUND, format!("VM session {session_id} not found")))
}

/// POST /vm-session/:session_id/execute
async fn exec_in_session_handler(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
    Json(request): Json<VmExecRequest>,
) -> Result<Json<VmExecResponse>, (StatusCode, String)> {
    let start = std::time::Instant::now();

    let session = {
        let sessions = state.vm_sessions.read().await;
        sessions.get(&session_id).cloned()
    }
    .ok_or_else(|| (StatusCode::NOT_FOUND, format!("VM session {session_id} not found")))?;

    if session.status != VmSessionStatus::Running {
        return Err((
            StatusCode::CONFLICT,
            format!("VM session {session_id} is not running"),
        ));
    }

    let (exit_code, stdout, stderr, vm_backed) =
        if let (Some(driver), Some(handle_id)) = (state.vm_driver.as_ref(), &session.handle_id) {
            // ── Real VM execution ──────────────────────────────────────────
            #[cfg(feature = "vm-driver")]
            {
                use allternit_driver_interface::{CommandSpec, ExecutionHandle, ExecutionId, TenantId};

                let handle_uuid = Uuid::parse_str(handle_id)
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                let handle = ExecutionHandle {
                    id: ExecutionId(handle_uuid),
                    tenant: TenantId::new(format!("gizzi-{}", session_id))
                        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?,
                    driver_info: HashMap::new(),
                    env_spec: Default::default(),
                };

                let cwd = request
                    .workdir
                    .as_deref()
                    .map(|rel| format!("{}/{}", session.workspace_path, rel))
                    .unwrap_or_else(|| session.workspace_path.clone());

                let cmd = CommandSpec {
                    command: vec![
                        "bash".to_string(),
                        "-c".to_string(),
                        request.command.clone(),
                    ],
                    env_vars: request.env.clone(),
                    working_dir: Some(cwd),
                    stdin_data: None,
                    capture_stdout: true,
                    capture_stderr: true,
                };

                let result = driver
                    .exec(&handle, cmd)
                    .await
                    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Exec failed: {e}")))?;

                let stdout = result
                    .stdout
                    .map(|b| String::from_utf8_lossy(&b).into_owned())
                    .unwrap_or_default();
                let stderr = result
                    .stderr
                    .map(|b| String::from_utf8_lossy(&b).into_owned())
                    .unwrap_or_default();

                (result.exit_code, stdout, stderr, true)
            }

            #[cfg(not(feature = "vm-driver"))]
            {
                let _ = (driver, handle_id);
                local_exec(&request, &session).await?
            }
        } else {
            // ── Local process fallback ────────────────────────────────────
            local_exec(&request, &session).await?
        };

    // Update last_used timestamp
    {
        let mut sessions = state.vm_sessions.write().await;
        if let Some(s) = sessions.get_mut(&session_id) {
            s.last_used = Utc::now();
        }
    }

    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(Json(VmExecResponse {
        exit_code,
        stdout,
        stderr,
        duration_ms,
        vm_backed,
    }))
}

/// DELETE /vm-session/:session_id
async fn destroy_session_handler(
    State(state): State<Arc<AppState>>,
    Path(session_id): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let session = {
        let mut sessions = state.vm_sessions.write().await;
        sessions.remove(&session_id)
    }
    .ok_or_else(|| (StatusCode::NOT_FOUND, format!("VM session {session_id} not found")))?;

    info!(session_id = %session_id, "Destroying VM session");

    if let (Some(driver), Some(handle_id)) = (state.vm_driver.as_ref(), &session.handle_id) {
        #[cfg(feature = "vm-driver")]
        {
            use allternit_driver_interface::{ExecutionHandle, ExecutionId, TenantId};

            if let Ok(handle_uuid) = Uuid::parse_str(handle_id) {
                let handle = ExecutionHandle {
                    id: ExecutionId(handle_uuid),
                    tenant: TenantId::new(format!("gizzi-{}", session_id))
                        .unwrap_or_else(|_| TenantId("unknown".to_string())),
                    driver_info: HashMap::new(),
                    env_spec: Default::default(),
                };

                if let Err(e) = driver.destroy(&handle).await {
                    warn!(session_id = %session_id, error = %e, "VM destroy failed");
                }
            }
        }

        #[cfg(not(feature = "vm-driver"))]
        {
            let _ = (driver, handle_id);
        }
    }

    Ok(Json(serde_json::json!({
        "destroyed": true,
        "session_id": session_id,
    })))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Run the command locally as a subprocess (fallback when no VM driver).
async fn local_exec(
    request: &VmExecRequest,
    session: &VmSession,
) -> Result<(i32, String, String, bool), (StatusCode, String)> {
    let cwd = request
        .workdir
        .as_deref()
        .map(|rel| format!("{}/{}", session.workspace_path, rel))
        .unwrap_or_else(|| session.workspace_path.clone());

    let timeout = tokio::time::Duration::from_secs(request.timeout_secs);

    let mut cmd = tokio::process::Command::new("bash");
    cmd.arg("-c")
        .arg(&request.command)
        .current_dir(&cwd)
        .envs(&request.env)
        .kill_on_drop(true);

    let result = tokio::time::timeout(timeout, cmd.output())
        .await
        .map_err(|_| {
            (
                StatusCode::REQUEST_TIMEOUT,
                format!("Command timed out after {}s", request.timeout_secs),
            )
        })?
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Spawn failed: {e}")))?;

    let stdout = String::from_utf8_lossy(&result.stdout).into_owned();
    let stderr = String::from_utf8_lossy(&result.stderr).into_owned();
    let exit_code = result.status.code().unwrap_or(-1);

    Ok((exit_code, stdout, stderr, false))
}
